import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import { getEmbarque, getEmbarquesPorNumero, cambiarEstadoEmbarque, getRequisicion, getSolicitudDocumento, getCiegoDocumento, getRtDocumento, getCartaDocumento, guardarSellos } from '../../api/embarques'
import { getArchivoDocumento } from '../../api/documentos'
import { descargarRequisicionPdf } from '../../utils/requisicionPdf'
import { descargarSolicitudPdf } from '../../utils/solicitudPdf'
import { descargarCiegoPdf } from '../../utils/ciegoPdf'
import { descargarRtPdf } from '../../utils/rtPdf'
import { descargarCartaPdf } from '../../utils/cartaPdf'

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
  const [aviso, setAviso] = useState(null) // { documento, datos, destino, formato } de un documento con datos faltantes, en espera de confirmar
  const [generando, setGenerando] = useState(false)
  const [sellos, setSellos] = useState(null) // { sello1, sello2 } mientras se piden los sellos de la Carta responsiva

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

  // Los documentos que el sistema genera (Requisición, Solicitud, RT y Ciego de carga, en PDF y Excel). El Excel y su librería (que pesa) solo
  // se cargan cuando se pide.
  const DOCUMENTOS = {
    requisicion: {
      nombre: 'Requisición',
      incompleto: 'La requisición está incompleta',
      cargar: (idEmbarque) => getRequisicion(idEmbarque),
      pdf: (datos, destino) => descargarRequisicionPdf(datos, destino),
      excel: async (datos, destino) => (await import('../../utils/requisicionExcel')).descargarRequisicionExcel(datos, destino),
    },
    solicitud: {
      nombre: 'Solicitud',
      incompleto: 'La solicitud está incompleta',
      cargar: (idEmbarque) => getSolicitudDocumento(idEmbarque),
      pdf: (datos) => descargarSolicitudPdf(datos),
      excel: async (datos) => (await import('../../utils/solicitudExcel')).descargarSolicitudExcel(datos),
    },
    rt: {
      nombre: 'RT',
      incompleto: 'La RT está incompleta',
      cargar: (idEmbarque) => getRtDocumento(idEmbarque),
      // El PDF lleva, después de la hoja, los pedimentos y facturas seleccionados en la pantalla del RT.
      pdf: (datos, destino) => descargarRtPdf(datos, destino, getArchivoDocumento),
      excel: async (datos, destino) => (await import('../../utils/rtExcel')).descargarRtExcel(datos, destino),
    },
    carta: {
      nombre: 'Carta responsiva',
      incompleto: 'La carta responsiva está incompleta',
      cargar: (idEmbarque) => getCartaDocumento(idEmbarque),
      pdf: (datos) => descargarCartaPdf(datos),
    },
    ciego: {
      nombre: 'Ciego de carga',
      incompleto: 'El ciego de carga está incompleto',
      cargar: (idEmbarque) => getCiegoDocumento(idEmbarque),
      pdf: (datos) => descargarCiegoPdf(datos),
      excel: async (datos) => (await import('../../utils/ciegoExcel')).descargarCiegoExcel(datos),
    },
  }

  const descargarDocumento = async (documento, datos, destino, formato) => {
    setGenerando(true)
    try {
      const resultado = await DOCUMENTOS[documento][formato === 'excel' ? 'excel' : 'pdf'](datos, destino)
      // El PDF del RT devuelve además los documentos que no se pudieron anexar.
      const nombre = typeof resultado === 'string' ? resultado : resultado.nombre
      toast.exito(`${nombre} descargada`)
      if (resultado?.sinAnexar?.length) toast.advertencia(`No se anexaron: ${resultado.sinAnexar.join('; ')}`)
    } catch {
      toast.error(`No se pudo generar el ${formato === 'excel' ? 'Excel' : 'PDF'} de ${DOCUMENTOS[documento].nombre}`)
    } finally {
      setGenerando(false)
    }
  }

  // Siempre se puede generar; si falta algún dato se avisa antes de descargar.
  const pedirDocumento = async (documento, idEmbarque, destino, formato) => {
    setGenerando(true)
    try {
      const { data } = await DOCUMENTOS[documento].cargar(idEmbarque)
      if (data.faltantes?.length) setAviso({ documento, datos: data, destino, formato })
      else await descargarDocumento(documento, data, destino, formato)
    } catch {
      toast.error(`No se pudo cargar la información de ${DOCUMENTOS[documento].nombre}`)
    } finally {
      setGenerando(false)
    }
  }

  // La carta lleva los números de sello de seguridad de la unidad: se piden antes de generarla (al menos el primero) y se
  // guardan en el embarque, así la próxima vez ya aparecen.
  const abrirSellos = async () => {
    setGenerando(true)
    try {
      const { data } = await getCartaDocumento(id)
      setSellos({ sello1: data.sello1 || '', sello2: data.sello2 || '' })
    } catch {
      setSellos({ sello1: '', sello2: '' })
    } finally {
      setGenerando(false)
    }
  }

  const generarCarta = async () => {
    if (!sellos.sello1.trim()) return toast.advertencia('Escribe al menos un número de sello de seguridad')
    setGenerando(true)
    try {
      await guardarSellos(id, { sello1: sellos.sello1.trim(), sello2: sellos.sello2.trim() || null, idUsuario: usuario?.id })
    } catch (e) {
      setGenerando(false)
      return toast.error(e.response?.data?.mensaje || 'No se pudieron guardar los sellos')
    }
    setSellos(null)
    setGenerando(false)
    setEmbarque((prev) => ({ ...prev, cartaCompleta: true }))
    await pedirDocumento('carta', id, null, 'pdf')
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

          const exportar = (tipo, destinoTexto, idEmbarque = id, destino = null) => (e) => {
            e.stopPropagation()
            if (DOCUMENTOS[doc.ruta]) return pedirDocumento(doc.ruta, idEmbarque, destino, tipo)
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
                          onClick={exportar('excel', h.direccion, h.id, `Destino ${hi + 1}`)}
                          disabled={generando}
                          className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold text-white transition hover:brightness-95"
                        >
                          EXCEL
                        </button>
                        <button
                          onClick={exportar('pdf', h.direccion, h.id, `Destino ${hi + 1}`)}
                          disabled={generando}
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
                    disabled={generando}
                    className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-95"
                  >
                    EXCEL
                  </button>
                  <button
                    onClick={exportar('pdf')}
                    disabled={generando}
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
          <p className="mb-4 text-xs font-semibold text-blue-500">Pide los números de sello de seguridad</p>
          <div className="flex justify-center">
            <button
              onClick={abrirSellos}
              disabled={generando}
              className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-95"
            >
              PDF
            </button>
          </div>
        </div>
      </div>

      <Modal abierto={!!sellos} onCerrar={() => setSellos(null)} ancho="max-w-md" titulo="Sellos de seguridad">
        <p className="text-sm text-gray-600">
          La carta responsiva lleva los números de sello de seguridad de la unidad de carga. Escribe al menos uno.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="text-sm font-semibold text-teal">Sello de seguridad #1 *</span>
            <input
              className="gm-input mt-1 font-mono"
              autoFocus
              value={sellos?.sello1 ?? ''}
              onChange={(e) => setSellos({ ...sellos, sello1: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Sello de seguridad #2 (opcional)</span>
            <input
              className="gm-input mt-1 font-mono"
              value={sellos?.sello2 ?? ''}
              onChange={(e) => setSellos({ ...sellos, sello2: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setSellos(null)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" disabled={generando} onClick={generarCarta}>
            Generar PDF
          </button>
        </div>
      </Modal>

      <Modal abierto={!!aviso} onCerrar={() => setAviso(null)} ancho="max-w-md" titulo={aviso ? DOCUMENTOS[aviso.documento].incompleto : ''}>
        <p className="text-sm text-gray-600">
          Se puede generar, pero estos datos no están registrados y esos campos quedarán en blanco en el documento:
        </p>
        <ul className="mt-3 max-h-60 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-gray-700">
          {aviso?.datos.faltantes.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setAviso(null)}>
            Cancelar
          </button>
          <button
            className="gm-btn-guardar"
            disabled={generando}
            onClick={async () => {
              const { documento, datos, destino, formato } = aviso
              setAviso(null)
              await descargarDocumento(documento, datos, destino, formato)
            }}
          >
            Descargar de todos modos
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
