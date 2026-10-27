import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { getEmbarque, getEmbarquesPorNumero, cambiarEstadoEmbarque } from '../../api/embarques'

// Requisición y RT genuinamente difieren por destino (productos/kilos distintos), así que cuando
// el número de embarque se comparte entre varios destinos, sus botones de EXCEL/PDF se duplican
// (uno por destino) dentro del mismo recuadro — el recuadro en sí no se separa.
const DOCS = [
  { nombre: 'Requisision', ruta: 'requisicion', flag: 'requisicionCompleta', dividir: true },
  { nombre: 'Solicitud', ruta: 'solicitud', flag: 'solicitudCompleta', dividir: false },
  { nombre: 'RT', ruta: 'rt', flag: 'rtCompleta', dividir: true },
  { nombre: 'Ciego de carga', ruta: 'ciego', flag: 'ciegoCompleto', dividir: false },
]

export default function EmbarqueDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { usuario, puede } = useAuth()

  const [embarque, setEmbarque] = useState(null)
  const [hermanos, setHermanos] = useState([]) // embarques con el mismo número (uno por destino)
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    getEmbarque(id).then((r) => setEmbarque(r.data)).catch(console.error)
  }
  useEffect(cargar, [id])

  useEffect(() => {
    if (embarque?.numero) {
      getEmbarquesPorNumero(embarque.numero).then((r) => setHermanos(r.data)).catch(() => setHermanos([]))
    } else {
      setHermanos(embarque ? [embarque] : [])
    }
  }, [embarque])

  const marcarCompletado = async () => {
    setGuardando(true)
    try {
      await cambiarEstadoEmbarque(id, { estado: 'Completado', idUsuario: usuario?.id })
      toast.exito('Embarque marcado como completado')
      setEmbarque((prev) => ({ ...prev, estado: 'Completado' }))
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo actualizar el estado')
    } finally {
      setGuardando(false)
    }
  }

  const estado = embarque?.estado

  return (
    <Layout>
      <PageHeader titulo={`Embarque #${embarque?.numero ?? id}`} />

      <div className="mx-auto mb-6 flex max-w-4xl items-center justify-center gap-4 px-6">
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            estado === 'Completado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {estado || 'Cargando…'}
        </span>
        {estado && estado !== 'Completado' && puede('embarques', 'editar') && (
          <button className="gm-pill" onClick={marcarCompletado} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Marcar como completado'}
          </button>
        )}
      </div>

      <p className="mx-auto mb-4 max-w-4xl px-6 text-center text-xs text-gray-400">
        Cada documento se pinta de verde en cuanto se completa, en el orden en que se van
        entregando.
      </p>

      <div className="mx-auto grid max-w-4xl gap-6 px-6 sm:grid-cols-2 md:grid-cols-3">
        {DOCS.map((doc) => {
          const completo = embarque ? !!embarque[doc.flag] : false
          const porDestino = doc.dividir && hermanos.length > 1

          const exportar = (tipo, destinoTexto) => (e) => {
            e.stopPropagation()
            toast.info(
              tipo === 'excel'
                ? `Exportando ${doc.nombre}${destinoTexto ? ` (${destinoTexto})` : ''} a Excel…`
                : `Generando PDF de ${doc.nombre}${destinoTexto ? ` (${destinoTexto})` : ''}…`,
            )
          }

          return (
            <div
              key={doc.nombre}
              onClick={() => navigate(`/salidas/embarques/${id}/${doc.ruta}`)}
              className="cursor-pointer rounded-2xl p-6 text-center transition-colors duration-300 hover:brightness-95"
              style={{ backgroundColor: completo ? '#cdf6ec' : '#f9d6d6' }}
            >
              <p className="mb-1 text-xl font-bold">{doc.nombre}</p>
              <p className={`mb-4 text-xs font-semibold ${completo ? 'text-teal-oscuro' : 'text-cancelar'}`}>
                {completo ? '✓ Completo' : 'Pendiente'}
              </p>
              {porDestino ? (
                <div className="flex flex-col gap-2">
                  {hermanos.map((h, hi) => (
                    <div key={h.id}>
                      <p className="mb-1 text-[0.65rem] font-semibold text-gray-500">
                        Destino {hi + 1}
                        {h.direccion ? `: ${h.direccion}` : ''}
                      </p>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={exportar('excel', h.direccion)}
                          className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold text-white transition hover:brightness-95"
                        >
                          EXCEL
                        </button>
                        <button
                          onClick={exportar('pdf', h.direccion)}
                          className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white transition hover:brightness-95"
                        >
                          PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center gap-3">
                  <button
                    onClick={exportar('excel')}
                    className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-95"
                  >
                    EXCEL
                  </button>
                  <button
                    onClick={exportar('pdf')}
                    className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-95"
                  >
                    PDF
                  </button>
                </div>
              )}
            </div>
          )
        })}

        <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#dbeafe' }}>
          <p className="mb-1 text-xl font-bold">Carta responsiva</p>
          <p className="mb-4 text-xs font-semibold text-blue-500">Se genera desde la Requisición</p>
          <div className="flex justify-center">
            <button
              onClick={() => toast.info('Generando PDF de Carta responsiva…')}
              className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-95"
            >
              PDF
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
