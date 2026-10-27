import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import usePaginacion from '../../hooks/usePaginacion'
import { getEmpresas } from '../../api/destinos'
import {
  getPedidosConsignacion,
  getPedidoConsignacion,
  liberarPedidoConsignacion,
  subirFacturaPedido,
} from '../../api/pedidosConsignacion'
import { abrirArchivoDocumento, validarArchivoDocumento, TIPOS_ARCHIVO_DOCUMENTO } from '../../api/documentos'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
// 09 oct 26
const fechaCorta = (f) => {
  const d = new Date(f)
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`
}
const kg = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ESTADO_CLASE = {
  Pendiente: 'bg-amber-100 text-amber-700',
  Liberado: 'bg-green-100 text-green-700',
}

// Selector de archivo (clic o arrastrar) como el de Pedimentos.
function CampoArchivo({ archivo, onElegir }) {
  const input = useRef(null)
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          onElegir(e.dataTransfer.files[0])
        }}
        className="mt-1 flex w-full items-center justify-center rounded-xl border-2 border-dashed border-teal px-6 py-8 text-center text-teal transition hover:brightness-95"
        style={{ backgroundColor: 'var(--color-pill)' }}
      >
        {archivo ? archivo.name : 'Arrastrar o examinar'}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={TIPOS_ARCHIVO_DOCUMENTO}
        onChange={(e) => {
          onElegir(e.target.files[0])
          e.target.value = ''
        }}
      />
    </>
  )
}

// Solicitudes de compra a una empresa en consignación. Se generan solas cuando un embarque, una
// venta o una producción usa producto de esa empresa.
export default function PedidosConsignacion() {
  const { IdEmpresa, idEmpresa } = useParams()
  const empresaId = IdEmpresa || idEmpresa
  const navigate = useNavigate()
  const toast = useToast()
  const { puede } = useAuth()
  const puedeEditar = puede('inventario', 'editar')

  const [empresa, setEmpresa] = useState(null)
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [detalle, setDetalle] = useState(null) // pedido abierto en "Detalles"
  const [liberando, setLiberando] = useState(null) // pedido que se libera
  const [facturando, setFacturando] = useState(null) // pedido al que se sube factura
  const [form, setForm] = useState({ numero: '', archivo: null })
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    getPedidosConsignacion(empresaId)
      .then((r) => setDatos(r.data))
      .catch(console.error)
      .finally(() => setCargando(false))
  }
  useEffect(() => {
    cargar()
    getEmpresas()
      .then((r) => setEmpresa(r.data.find((e) => String(e.id) === String(empresaId))))
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  const filtrados = datos.filter((d) => {
    const q = busqueda.trim().toLowerCase()
    return [d.numero, d.destino, d.estado, d.ordenEmbarque, d.numeroFactura].some((v) => (v || '').toLowerCase().includes(q))
  })
  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(filtrados, 20)

  const verDetalle = async (p) => {
    try {
      const r = await getPedidoConsignacion(p.id)
      setDetalle(r.data)
    } catch {
      toast.error('No se pudo cargar el pedido')
    }
  }

  const elegirArchivo = (archivo) => {
    if (!archivo) return
    const error = validarArchivoDocumento(archivo)
    if (error) return toast.advertencia(error)
    setForm((f) => ({ ...f, archivo }))
  }

  const abrirLiberar = (p) => {
    setForm({ numero: '', archivo: null })
    setLiberando(p)
  }
  const abrirFactura = (p) => {
    setForm({ numero: p.numeroFactura || '', archivo: null })
    setFacturando(p)
  }

  const liberar = async () => {
    if (!form.numero.trim()) return toast.advertencia('Indica el número de la orden de embarque')
    if (!form.archivo) return toast.advertencia('Sube el documento de la orden de embarque')
    setGuardando(true)
    try {
      await liberarPedidoConsignacion(liberando.id, form.numero.trim(), form.archivo)
      toast.exito(`Pedido ${liberando.numero} liberado`)
      setLiberando(null)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo liberar el pedido')
    } finally {
      setGuardando(false)
    }
  }

  const subirFactura = async () => {
    if (!form.numero.trim()) return toast.advertencia('Indica el número de la factura')
    if (!form.archivo) return toast.advertencia('Sube el archivo de la factura')
    setGuardando(true)
    try {
      await subirFacturaPedido(facturando.id, form.numero.trim(), form.archivo)
      toast.exito(`Factura del pedido ${facturando.numero} guardada`)
      setFacturando(null)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la factura')
    } finally {
      setGuardando(false)
    }
  }

  const ver = (idDocumento) => abrirArchivoDocumento(idDocumento).catch(() => toast.error('No se pudo abrir el documento'))

  return (
    <Layout>
      <PageHeader titulo="Pedidos de compra" subtitulo={`a ${empresa?.nombre || '…'}`} />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Buscador
            valor={busqueda}
            onChange={(v) => {
              setBusqueda(v)
              setPagina(1)
            }}
            placeholder="Busca por pedido, destino, orden o factura"
            className="w-80 max-w-full"
          />
          <button className="gm-pill" onClick={() => navigate(`/inventario/consignacion/${empresaId}`)}>
            ← Consignación
          </button>
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="gm-tabla">
                <thead>
                  <tr>
                    <th className="italic">No. pedido</th>
                    <th>Fecha</th>
                    <th>Destino</th>
                    <th>Estado</th>
                    <th>Orden de embarque</th>
                    <th aria-hidden="true" />
                    <th>Factura</th>
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((p) => (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.numero}</td>
                      <td className="whitespace-nowrap">{fechaCorta(p.fecha)}</td>
                      <td className="text-sm">
                        {p.destino}
                        <span className="block text-xs text-gray-400">{p.tipoDestino}</span>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ESTADO_CLASE[p.estado] || 'bg-gray-100 text-gray-600'}`}>
                            {p.estado}
                          </span>
                          {p.estado === 'Pendiente' && puedeEditar && (
                            <button className="text-xs font-semibold text-teal underline" onClick={() => abrirLiberar(p)}>
                              Liberar
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="text-sm">
                        {p.ordenEmbarque ? (
                          <>
                            <span className="font-semibold">{p.ordenEmbarque}</span>
                            {p.tieneOrden && (
                              <button className="ml-2 text-xs font-semibold text-marca underline" onClick={() => ver(p.idDocumentoOrden)}>
                                Ver
                              </button>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <button className="gm-pill" onClick={() => verDetalle(p)}>
                          Detalles
                        </button>
                      </td>
                      <td className="text-sm">
                        {p.tieneFactura ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{p.numeroFactura}</span>
                            <button className="text-xs font-semibold text-marca underline" onClick={() => ver(p.idDocumentoFactura)}>
                              Ver
                            </button>
                            {puedeEditar && (
                              <button className="text-xs font-semibold text-teal underline" onClick={() => abrirFactura(p)}>
                                Cambiar
                              </button>
                            )}
                          </div>
                        ) : puedeEditar ? (
                          <button className="gm-pill" onClick={() => abrirFactura(p)}>
                            Subir factura
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="!py-12 text-center text-gray-400">
                        {busqueda
                          ? 'Sin resultados para esa búsqueda'
                          : 'Aún no hay pedidos: se generan solos cuando un embarque, venta o producción usa producto de esta empresa.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Paginacion total={total} porPagina={porPagina} paginaActual={pagina} onCambiar={setPagina} />
          </>
        )}
      </div>

      <Modal
        abierto={!!detalle}
        onCerrar={() => setDetalle(null)}
        ancho="max-w-xl"
        titulo="Pedido de mercancía"
      >
        {detalle && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="block text-xs text-gray-400">No. pedido</span>
                <span className="font-semibold">{detalle.numero}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Fecha</span>
                <span className="font-semibold">{fechaCorta(detalle.fecha)}</span>
              </div>
            </div>
            <table className="gm-tabla-grid w-full">
              <thead>
                <tr>
                  <th className="text-right">Cantidad en kgs</th>
                  <th>Producto</th>
                  <th className="text-right">Cantidad en cajas</th>
                </tr>
              </thead>
              <tbody>
                {detalle.detalles.map((d) => (
                  <tr key={d.id}>
                    <td className="text-right text-sm">{kg(d.kilos)}</td>
                    <td className="text-sm font-semibold">{d.descripcion}</td>
                    <td className="text-right text-sm">{d.cajas != null ? kg(d.cajas) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td className="text-right text-sm">{kg(detalle.detalles.reduce((s, d) => s + Number(d.kilos || 0), 0))}</td>
                  <td className="text-sm">Total</td>
                  <td className="text-right text-sm">{kg(detalle.detalles.reduce((s, d) => s + Number(d.cajas || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </>
        )}
        <div className="mt-6 flex justify-between">
          <button className="gm-pill" onClick={() => toast.info('El formato del PDF se definirá más adelante')}>
            PDF
          </button>
          <button className="gm-btn-guardar" onClick={() => setDetalle(null)}>
            Cerrar
          </button>
        </div>
      </Modal>

      <Modal
        abierto={!!liberando}
        onCerrar={() => setLiberando(null)}
        ancho="max-w-md"
        titulo={liberando ? `Liberar pedido ${liberando.numero}` : ''}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-marca">Número de orden de embarque *</span>
            <input
              className="gm-input mt-1"
              placeholder="Escribe el número…"
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
            />
          </label>
          <div>
            <span className="text-sm font-semibold text-marca">Documento de la orden de embarque *</span>
            <CampoArchivo archivo={form.archivo} onElegir={elegirArchivo} />
          </div>
        </div>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setLiberando(null)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={liberar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Liberar'}
          </button>
        </div>
      </Modal>

      <Modal
        abierto={!!facturando}
        onCerrar={() => setFacturando(null)}
        ancho="max-w-md"
        titulo={facturando ? `Factura del pedido ${facturando.numero}` : ''}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-marca">Número de factura *</span>
            <input
              className="gm-input mt-1"
              placeholder="Escribe el número…"
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
            />
          </label>
          <div>
            <span className="text-sm font-semibold text-marca">Archivo de la factura *</span>
            <CampoArchivo archivo={form.archivo} onElegir={elegirArchivo} />
          </div>
          {facturando?.tieneFactura && (
            <p className="text-xs text-gray-400">Ya hay una factura cargada; al guardar se reemplaza por esta.</p>
          )}
        </div>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setFacturando(null)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={subirFactura} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
