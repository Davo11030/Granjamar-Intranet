import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import NotaAdmin from '../../components/NotaAdmin'
import Cargando from '../../components/Cargando'
import { useToast } from '../../context/ToastContext'
import { getConfiguracionDocumentos, guardarConfiguracionDocumento } from '../../api/configuracionDocumentos'

// Pestaña corta de cada documento (el nombre completo va como título dentro de la pestaña).
const PESTANAS = {
  Requisicion: 'Requisición',
  Solicitud: 'Solicitud',
  Ciego: 'Ciego de carga',
  RT: 'RT',
  Carta: 'Carta responsiva',
  PedidoMercancia: 'Pedido de mercancía',
}
// Los campos de texto largo (párrafos y notas) se editan en un cuadro de varias líneas.
const esLargo = (c) => ['Observaciones', 'Nota'].includes(c.clave) || (c.predeterminado || '').length > 70

// Admin → Documentos: los datos que son fijos en los documentos que genera el sistema (títulos, nombres de quienes
// firman, textos de la carta…) y que se pueden actualizar sin tocar el código. Una pestaña por documento; cada cambio
// queda en Movimientos.
export default function Documentos() {
  const toast = useToast()
  const [documentos, setDocumentos] = useState(null)
  const [valores, setValores] = useState({}) // documento → { clave: valor } (lo que se está editando)
  const [activa, setActiva] = useState('')
  const [guardando, setGuardando] = useState('')

  const cargar = () =>
    getConfiguracionDocumentos()
      .then((r) => {
        setDocumentos(r.data)
        setValores(Object.fromEntries(r.data.map((d) => [d.clave, Object.fromEntries(d.campos.map((c) => [c.clave, c.valor]))])))
        setActiva((a) => a || r.data[0]?.clave || '')
      })
      .catch(() => toast.error('No se pudo cargar la configuración de documentos'))
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hayCambios = (doc) => doc.campos.some((c) => (valores[doc.clave]?.[c.clave] ?? '') !== c.valor)

  const guardar = async (doc) => {
    setGuardando(doc.clave)
    try {
      await guardarConfiguracionDocumento(doc.clave, valores[doc.clave])
      toast.exito(`${doc.nombre}: cambios guardados`)
      await cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudieron guardar los cambios')
    } finally {
      setGuardando('')
    }
  }

  const doc = documentos?.find((d) => d.clave === activa)

  return (
    <Layout>
      <PageHeader titulo="Documentos" subtitulo="Datos fijos de los documentos" />

      <div className="mx-auto max-w-3xl px-6 pb-10">
        <NotaAdmin>
          Aquí se cambian los datos que no vienen de un embarque o pedido: títulos, nombres de quienes firman y los textos
          fijos de cada documento. El origen y el destino salen del propio embarque. Un campo vacío vuelve al valor de
          fábrica.
        </NotaAdmin>

        {!documentos ? (
          <Cargando />
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2" role="tablist">
              {documentos.map((d) => (
                <button
                  key={d.clave}
                  role="tab"
                  aria-selected={d.clave === activa}
                  onClick={() => setActiva(d.clave)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    d.clave === activa ? 'bg-marca text-white' : 'bg-white text-marca shadow-sm hover:brightness-95'
                  }`}
                >
                  {PESTANAS[d.clave] || d.nombre}
                  {hayCambios(d) && <span className="ml-1.5 text-amber-400" title="Cambios sin guardar">●</span>}
                </button>
              ))}
            </div>

            {doc && (
              <section key={doc.clave} className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-marca">{doc.nombre}</h2>
                <p className="mb-4 text-sm text-gray-500">{doc.descripcion}</p>
                <div className="space-y-4">
                  {doc.campos.map((c) => {
                    const propiedades = {
                      className: 'gm-input mt-1',
                      placeholder: c.predeterminado || 'Sin capturar',
                      value: valores[doc.clave]?.[c.clave] ?? '',
                      onChange: (e) => setValores({ ...valores, [doc.clave]: { ...valores[doc.clave], [c.clave]: e.target.value } }),
                    }
                    return (
                      <label key={c.clave} className="block">
                        <span className="text-sm font-semibold text-marca">{c.etiqueta}</span>
                        {esLargo(c) ? <textarea rows={4} {...propiedades} /> : <input {...propiedades} />}
                        <span className="text-xs text-gray-400">{c.ayuda}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="mt-6 flex justify-end">
                  <button className="gm-btn-guardar" onClick={() => guardar(doc)} disabled={!hayCambios(doc) || guardando === doc.clave}>
                    {guardando === doc.clave ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
