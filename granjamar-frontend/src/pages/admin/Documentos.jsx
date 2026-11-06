import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import NotaAdmin from '../../components/NotaAdmin'
import Cargando from '../../components/Cargando'
import { useToast } from '../../context/ToastContext'
import { getConfiguracionDocumentos, guardarConfiguracionDocumento } from '../../api/configuracionDocumentos'

// Admin → Documentos: los datos que son fijos en los documentos que genera el sistema (títulos, nombres de quienes
// firman…) y que se pueden actualizar sin tocar el código. Cada cambio queda en Movimientos.
export default function Documentos() {
  const toast = useToast()
  const [documentos, setDocumentos] = useState(null)
  const [valores, setValores] = useState({}) // documento → { clave: valor } (lo que se está editando)
  const [guardando, setGuardando] = useState('')

  const cargar = () =>
    getConfiguracionDocumentos()
      .then((r) => {
        setDocumentos(r.data)
        setValores(Object.fromEntries(r.data.map((d) => [d.clave, Object.fromEntries(d.campos.map((c) => [c.clave, c.valor]))])))
      })
      .catch(() => toast.error('No se pudo cargar la configuración de documentos'))
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return (
    <Layout>
      <PageHeader titulo="Documentos" subtitulo="Datos fijos de los documentos" />

      <div className="mx-auto max-w-3xl px-6 pb-10">
        <NotaAdmin>
          Aquí se cambian los datos que no vienen de un embarque o pedido: títulos y nombres de quienes firman. Se usan en
          el PDF y el Excel de la Requisición y en la imagen del Pedido de mercancía. Un campo vacío vuelve al valor de
          fábrica.
        </NotaAdmin>

        {!documentos ? (
          <Cargando />
        ) : (
          <div className="mt-6 space-y-6">
            {documentos.map((doc) => {
              const cambiado = doc.campos.some((c) => (valores[doc.clave]?.[c.clave] ?? '') !== c.valor)
              return (
                <section key={doc.clave} className="rounded-2xl bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-marca">{doc.nombre}</h2>
                  <p className="mb-4 text-sm text-gray-500">{doc.descripcion}</p>
                  <div className="space-y-4">
                    {doc.campos.map((c) => (
                      <label key={c.clave} className="block">
                        <span className="text-sm font-semibold text-marca">{c.etiqueta}</span>
                        <input
                          className="gm-input mt-1"
                          placeholder={c.predeterminado || 'Sin capturar'}
                          value={valores[doc.clave]?.[c.clave] ?? ''}
                          onChange={(e) => setValores({ ...valores, [doc.clave]: { ...valores[doc.clave], [c.clave]: e.target.value } })}
                        />
                        <span className="text-xs text-gray-400">{c.ayuda}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button className="gm-btn-guardar" onClick={() => guardar(doc)} disabled={!cambiado || guardando === doc.clave}>
                      {guardando === doc.clave ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
