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
import { descargarPedidoPng } from '../../utils/pedidoPng'
import { getEmpresas } from '../../api/destinos'
import {
  getPedidosConsignacion,
  getPedidoConsignacion,
  liberarPedidoConsignacion,
  subirFacturaOrden,
  dividirPedido,
  editarOrdenEmbarque,
  eliminarOrdenEmbarque,
  quitarFacturaOrden,
  deshacerDivisionPedido,
} from '../../api/pedidosConsignacion'
import { abrirArchivoDocumento, validarArchivoDocumento, TIPOS_ARCHIVO_DOCUMENTO } from '../../api/documentos'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
// 09 oct 26
const fechaCorta = (f) => {
  const d = new Date(f)
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`
}
const kg = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Los kilos se guardan con hasta 3 decimales: se redondea para no arrastrar basura de punto flotante.
const r3 = (n) => Math.round(Number(n || 0) * 1000) / 1000
const TOLERANCIA = 0.0005
const MAX_PARTES = 6

const ESTADO_CLASE = {
  Pendiente: 'bg-amber-100 text-amber-700',
  Liberado: 'bg-green-100 text-green-700',
  Cancelado: 'bg-gray-200 text-gray-500',
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
// venta o una producción usa producto de esa empresa. Un pedido se puede dividir en varios y liberar con una o más
// órdenes de embarque (cada una con su factura).
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
  const [liberando, setLiberando] = useState(null) // detalle del pedido al que se le crea una orden de embarque
  const [kilosOrden, setKilosOrden] = useState({}) // código → kilos que libera esta orden
  const [dividiendo, setDividiendo] = useState(null) // detalle del pedido que se divide
  const [facturando, setFacturando] = useState(null) // { pedido, orden } al que se sube factura
  const [form, setForm] = useState({ numero: '', archivo: null })
  const [guardando, setGuardando] = useState(false)
  const [generandoPng, setGenerandoPng] = useState(false)
  const [confirmar, setConfirmar] = useState(null) // { titulo, texto, boton, accion } para lo que no se puede deshacer a ciegas

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
    const textos = [d.numero, d.destino, d.estado, d.divididoDe, ...(d.ordenes || []).flatMap((o) => [o.numero, o.numeroFactura])]
    return textos.some((v) => (v || '').toLowerCase().includes(q))
  })
  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(filtrados, 20)

  const pedirDetalle = async (p) => {
    try {
      return (await getPedidoConsignacion(p.id)).data
    } catch {
      toast.error('No se pudo cargar el pedido')
      return null
    }
  }
  const verDetalle = async (p) => setDetalle(await pedirDetalle(p))

  const elegirArchivo = (archivo) => {
    if (!archivo) return
    const error = validarArchivoDocumento(archivo)
    if (error) return toast.advertencia(error)
    setForm((f) => ({ ...f, archivo }))
  }

  const abrirLiberar = async (p) => {
    const d = await pedirDetalle(p)
    if (!d) return
    setForm({ numero: '', archivo: null })
    // Por defecto la orden libera todo lo que falta; se puede bajar para hacer varias órdenes.
    setKilosOrden(Object.fromEntries(d.detalles.map((x) => [x.codigo, String(r3(x.pendiente))])))
    setLiberando(d)
  }
  // Corrige una orden: sus kilos pueden subir hasta lo que falta más lo que ella ya llevaba.
  const abrirEditar = async (p, orden) => {
    const d = await pedirDetalle(p)
    const o = d?.ordenes.find((x) => x.id === orden.id)
    if (!o) return
    setForm({ numero: o.numero, archivo: null })
    setKilosOrden(Object.fromEntries(d.detalles.map((x) => [x.codigo, String(r3(o.detalles.find((y) => y.codigo === x.codigo)?.kilos))])))
    setLiberando({ ...d, editar: o })
  }
  const abrirFactura = (pedido, orden) => {
    setForm({ numero: orden.numeroFactura || '', archivo: null })
    setFacturando({ pedido, orden })
  }
  const abrirDividir = async (p) => {
    const d = await pedirDetalle(p)
    if (d) setDividiendo(d)
  }

  const liberar = async () => {
    if (!form.numero.trim()) return toast.advertencia('Indica el número de la orden de embarque')
    const editar = liberando.editar
    if (!editar && !form.archivo) return toast.advertencia('Sube el documento de la orden de embarque')
    const productos = []
    for (const d of liberando.detalles) {
      const k = r3(kilosOrden[d.codigo])
      if (!(k >= 0)) return toast.advertencia(`Revisa los kilos de ${d.descripcion}`)
      const llevaba = r3(editar?.detalles.find((x) => x.codigo === d.codigo)?.kilos)
      if (k > r3(d.pendiente) + llevaba + TOLERANCIA) return       toast.advertencia(`De ${d.descripcion} solo puede llevar ${kg(d.pendiente + llevaba)} kg`)
      if (k > 0) productos.push({ codigo: d.codigo, kilos: k })
    }
    if (productos.length === 0) return toast.advertencia('Indica al menos un producto con sus kilos')
    setGuardando(true)
    try {
      if (editar) {
        await editarOrdenEmbarque(editar.id, form.numero.trim(), form.archivo, productos)
        toast.exito(`Orden ${form.numero.trim()} actualizada`)
        setLiberando(null)
        cargar()
        return
      }
      const r = await liberarPedidoConsignacion(liberando.id, form.numero.trim(), form.archivo, productos)
      toast.exito(
        r.data.estado === 'Liberado'
          ? `Pedido ${liberando.numero} liberado por completo`
          : `Orden ${form.numero.trim()} creada: el pedido ${liberando.numero} sigue pendiente de lo que falta`,
      )
      setLiberando(null)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || (liberando.editar ? 'No se pudo actualizar la orden' : 'No se pudo liberar el pedido'))
    } finally {
      setGuardando(false)
    }
  }

  const subirFactura = async () => {
    if (!form.numero.trim()) return toast.advertencia('Indica el número de la factura')
    if (!form.archivo) return toast.advertencia('Sube el archivo de la factura')
    setGuardando(true)
    try {
      await subirFacturaOrden(facturando.orden.id, form.numero.trim(), form.archivo)
      toast.exito(`Factura de la orden ${facturando.orden.numero} guardada`)
      setFacturando(null)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la factura')
    } finally {
      setGuardando(false)
    }
  }

  // Pide confirmación y ejecuta una acción que deshace algo (se registra en Movimientos del admin).
  const pedirConfirmacion = (titulo, texto, boton, accion, exito, falla) =>
    setConfirmar({
      titulo,
      texto,
      boton,
      accion: async () => {
        try {
          await accion()
          toast.exito(exito)
          cargar()
        } catch (e) {
          toast.error(e.response?.data?.mensaje || falla)
        }
        setConfirmar(null)
      },
    })
  const quitarOrden = (p, o) =>
    pedirConfirmacion(
      `Quitar la orden ${o.numero}`,
      `Se quita la orden de embarque ${o.numero}${o.tieneFactura ? ` y su factura ${o.numeroFactura}` : ''}; el producto que llevaba vuelve a faltar en el pedido ${p.numero}.`,
      'Quitar orden',
      () => eliminarOrdenEmbarque(o.id),
      `Orden ${o.numero} quitada del pedido ${p.numero}`,
      'No se pudo quitar la orden',
    )
  const quitarFactura = (o) =>
    pedirConfirmacion(
      `Quitar la factura ${o.numeroFactura}`,
      `La orden ${o.numero} se queda sin factura (el documento sigue registrado).`,
      'Quitar factura',
      () => quitarFacturaOrden(o.id),
      `Factura de la orden ${o.numero} quitada`,
      'No se pudo quitar la factura',
    )
  const deshacerDivision = (p) =>
    pedirConfirmacion(
      `Deshacer la división de ${p.numero}`,
      `Desaparecen ${p.divididoEn.join(', ')} y el pedido ${p.numero} vuelve a Pendiente con todo su producto.`,
      'Deshacer división',
      () => deshacerDivisionPedido(p.id),
      `División del pedido ${p.numero} deshecha`,
      'No se pudo deshacer la división',
    )

  // La hoja del pedido como imagen, con el número del pedido de nombre (Ens-127.png).
  const descargarPng = async () => {
    setGenerandoPng(true)
    try {
      const nombre = await descargarPedidoPng(detalle)
      toast.exito(`Imagen ${nombre} descargada`)
    } catch {
      toast.error('No se pudo generar la imagen del pedido')
    } finally {
      setGenerandoPng(false)
    }
  }

  const ver = (idDocumento) => abrirArchivoDocumento(idDocumento).catch(() => toast.error('No se pudo abrir el documento'))

  const totalLiberando = liberando ? liberando.detalles.reduce((s, d) => s + r3(kilosOrden[d.codigo]), 0) : 0

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
                    <tr key={p.id} className={p.estado === 'Cancelado' ? 'text-gray-400' : ''}>
                      <td className="font-semibold">
                        {p.numero}
                        {p.divididoDe && <span className="block text-xs font-normal text-gray-400">Dividido de {p.divididoDe}</span>}
                      </td>
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
                          {p.estado === 'Cancelado' && p.divididoEn?.length > 0 && (
                            <span className="text-xs text-gray-400">Se dividió en {p.divididoEn.join(', ')}</span>
                          )}
                          {p.estado === 'Cancelado' && puedeEditar && (
                            <button className="text-xs font-semibold text-teal underline" onClick={() => deshacerDivision(p)}>
                              Deshacer división
                            </button>
                          )}
                          {p.estado === 'Pendiente' && p.ordenes.length > 0 && (
                            <span className="text-xs text-amber-700">Liberado en parte</span>
                          )}
                          {p.estado === 'Pendiente' && puedeEditar && (
                            <div className="flex gap-3">
                              <button className="text-xs font-semibold text-teal underline" onClick={() => abrirLiberar(p)}>
                                {p.ordenes.length > 0 ? 'Otra orden' : 'Liberar'}
                              </button>
                              {p.puedeDividir && (
                                <button className="text-xs font-semibold text-teal underline" onClick={() => abrirDividir(p)}>
                                  Dividir
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="text-sm">
                        {p.ordenes.length === 0
                          ? '—'
                          : p.ordenes.map((o) => (
                              <div key={o.id} className="flex min-h-[2.75rem] flex-col justify-center">
                                <div>
                                  <span className="font-semibold">{o.numero}</span>
                                  {o.tieneOrden && (
                                    <button className="ml-2 text-xs font-semibold text-marca underline" onClick={() => ver(o.idDocumentoOrden)}>
                                      Ver
                                    </button>
                                  )}
                                  {puedeEditar && (
                                    <>
                                      <button className="ml-2 text-xs font-semibold text-teal underline" onClick={() => abrirEditar(p, o)}>
                                        Editar
                                      </button>
                                      <button className="ml-2 text-xs font-semibold text-red-500 underline" onClick={() => quitarOrden(p, o)}>
                                        Quitar
                                      </button>
                                    </>
                                  )}
                                </div>
                                <span className="max-w-[16rem] truncate text-xs text-gray-400" title={o.productos}>
                                  {o.productos}
                                </span>
                              </div>
                            ))}
                      </td>
                      <td>
                        <button className="gm-pill" onClick={() => verDetalle(p)}>
                          Detalles
                        </button>
                      </td>
                      <td className="text-sm">
                        {p.ordenes.length === 0
                          ? '—'
                          : p.ordenes.map((o) => (
                              <div key={o.id} className="flex min-h-[2.75rem] items-center">
                                {o.tieneFactura ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{o.numeroFactura}</span>
                                    <button className="text-xs font-semibold text-marca underline" onClick={() => ver(o.idDocumentoFactura)}>
                                      Ver
                                    </button>
                                    {puedeEditar && (
                                      <>
                                        <button className="text-xs font-semibold text-teal underline" onClick={() => abrirFactura(p, o)}>
                                          Cambiar
                                        </button>
                                        <button className="text-xs font-semibold text-red-500 underline" onClick={() => quitarFactura(o)}>
                                          Quitar
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ) : puedeEditar ? (
                                  <button className="gm-pill" onClick={() => abrirFactura(p, o)}>
                                    Subir factura
                                  </button>
                                ) : (
                                  '—'
                                )}
                              </div>
                            ))}
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

      <Modal abierto={!!detalle} onCerrar={() => setDetalle(null)} ancho="max-w-2xl" titulo="Pedido de mercancía">
        {detalle && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="block text-xs text-gray-400">No. pedido</span>
                <span className="font-semibold">{detalle.numero}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Fecha</span>
                <span className="font-semibold">{fechaCorta(detalle.fecha)}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Estado</span>
                <span className="font-semibold">{detalle.estado}</span>
              </div>
            </div>
            <table className="gm-tabla-grid w-full">
              <thead>
                <tr>
                  <th className="text-right">Cantidad en kgs</th>
                  <th>Producto</th>
                  <th className="text-right">Cantidad en cajas</th>
                  {detalle.ordenes.length > 0 && (
                    <>
                      <th className="text-right">Liberado (kg)</th>
                      <th className="text-right">Falta (kg)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {detalle.detalles.map((d) => (
                  <tr key={d.id}>
                    <td className="text-right text-sm">{kg(d.kilos)}</td>
                    <td className="text-sm font-semibold">{d.descripcion}</td>
                    <td className="text-right text-sm">{d.cajas != null ? kg(d.cajas) : '—'}</td>
                    {detalle.ordenes.length > 0 && (
                      <>
                        <td className="text-right text-sm">{kg(d.liberado)}</td>
                        <td className={`text-right text-sm ${d.pendiente > TOLERANCIA ? 'font-semibold text-amber-700' : 'text-gray-400'}`}>
                          {kg(d.pendiente)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td className="text-right text-sm">{kg(detalle.detalles.reduce((s, d) => s + Number(d.kilos || 0), 0))}</td>
                  <td className="text-sm">Total</td>
                  <td className="text-right text-sm">{kg(detalle.detalles.reduce((s, d) => s + Number(d.cajas || 0), 0))}</td>
                  {detalle.ordenes.length > 0 && (
                    <>
                      <td className="text-right text-sm">{kg(detalle.detalles.reduce((s, d) => s + Number(d.liberado || 0), 0))}</td>
                      <td className="text-right text-sm">{kg(detalle.detalles.reduce((s, d) => s + Number(d.pendiente || 0), 0))}</td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>

            {detalle.ordenes.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-marca">Órdenes de embarque</h3>
                <div className="space-y-2">
                  {detalle.ordenes.map((o) => (
                    <div key={o.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{o.numero}</span>
                        <span className="text-xs text-gray-400">
                          {fechaCorta(o.fecha)} · {o.numeroFactura ? `Factura ${o.numeroFactura}` : 'Sin factura'}
                        </span>
                      </div>
                      <ul className="mt-1 text-xs text-gray-600">
                        {o.detalles.map((x) => (
                          <li key={x.codigo}>
                            {x.descripcion}: <span className="font-semibold">{kg(x.kilos)} kg</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div className="mt-6 flex justify-between">
          <button className="gm-pill" onClick={descargarPng} disabled={generandoPng}>
            {generandoPng ? 'Generando…' : 'PNG'}
          </button>
          <button className="gm-btn-guardar" onClick={() => setDetalle(null)}>
            Cerrar
          </button>
        </div>
      </Modal>

      <Modal
        abierto={!!liberando}
        onCerrar={() => setLiberando(null)}
        ancho="max-w-lg"
        titulo={
          liberando
            ? liberando.editar
              ? `Editar orden ${liberando.editar.numero} · pedido ${liberando.numero}`
              : `${liberando.ordenes.length > 0 ? 'Nueva orden' : 'Liberar'} · pedido ${liberando.numero}`
            : ''
        }
      >
        {liberando && (
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
              <span className="text-sm font-semibold text-marca">Documento de la orden de embarque{liberando.editar ? '' : ' *'}</span>
              {liberando.editar && <p className="text-xs text-gray-400">Déjalo vacío para conservar el documento actual.</p>}
              <CampoArchivo archivo={form.archivo} onElegir={elegirArchivo} />
            </div>
            <div>
              <span className="text-sm font-semibold text-marca">Producto que libera esta orden</span>
              <p className="mb-1 text-xs text-gray-400">
                Baja los kilos (o déjalos en 0) del producto que irá en otra orden: el pedido sigue pendiente hasta liberar todo.
              </p>
              <table className="gm-tabla-grid w-full">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-right">{liberando.editar ? 'Disponible (kg)' : 'Falta (kg)'}</th>
                    <th className="text-right">En esta orden (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {liberando.detalles
                    .map((d) => ({ d, tope: r3(d.pendiente) + r3(liberando.editar?.detalles.find((x) => x.codigo === d.codigo)?.kilos) }))
                    .filter(({ tope }) => tope > TOLERANCIA)
                    .map(({ d, tope }) => (
                      <tr key={d.codigo}>
                        <td className="text-sm font-semibold">{d.descripcion}</td>
                        <td className="text-right text-sm">{kg(tope)}</td>
                        <td className="text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            max={tope}
                            className="gm-input w-28 text-right"
                            value={kilosOrden[d.codigo] ?? ''}
                            onChange={(e) => setKilosOrden({ ...kilosOrden, [d.codigo]: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 font-bold">
                    <td className="text-sm">Total de la orden</td>
                    <td />
                    <td className="text-right text-sm">{kg(totalLiberando)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setLiberando(null)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={liberar} disabled={guardando}>
            {guardando ? 'Guardando…' : liberando?.editar ? 'Guardar' : 'Liberar'}
          </button>
        </div>
      </Modal>

      <Modal
        abierto={!!facturando}
        onCerrar={() => setFacturando(null)}
        ancho="max-w-md"
        titulo={facturando ? `Factura de la orden ${facturando.orden.numero}` : ''}
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
          {facturando?.orden.tieneFactura && (
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

      <Modal abierto={!!confirmar} onCerrar={() => setConfirmar(null)} ancho="max-w-md" titulo={confirmar?.titulo || ''}>
        <p className="text-sm text-gray-600">{confirmar?.texto}</p>
        <p className="mt-2 text-xs text-gray-400">Queda registrado en los movimientos del administrador.</p>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setConfirmar(null)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={confirmar?.accion}>
            {confirmar?.boton}
          </button>
        </div>
      </Modal>

      <DividirPedido
        pedido={dividiendo}
        onCerrar={() => setDividiendo(null)}
        onDividido={(nuevos) => {
          toast.exito(`Pedido ${dividiendo.numero} cancelado: se crearon ${nuevos.map((n) => n.numero).join(' y ')}`)
          setDividiendo(null)
          cargar()
        }}
      />
    </Layout>
  )
}

// Ventana para partir un pedido: cada producto se reparte (kilos) entre 2 o más pedidos nuevos; entre todos deben
// sumar lo que pedía el original, que queda Cancelado.
function DividirPedido({ pedido, onCerrar, onDividido }) {
  const toast = useToast()
  const [partes, setPartes] = useState(2)
  const [kilos, setKilos] = useState({}) // `${codigo}|${parte}` → kilos
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!pedido) return
    // Al abrir, todo en la parte 1: de ahí se mueve lo que va a las demás.
    setPartes(2)
    setKilos(Object.fromEntries(pedido.detalles.flatMap((d) => [[`${d.codigo}|0`, String(r3(d.kilos))], [`${d.codigo}|1`, '0']])))
  }, [pedido])

  if (!pedido) return null

  const valor = (codigo, i) => r3(kilos[`${codigo}|${i}`])
  const restante = (d) => r3(d.kilos - Array.from({ length: partes }, (_, i) => valor(d.codigo, i)).reduce((s, k) => s + k, 0))
  const totalParte = (i) => pedido.detalles.reduce((s, d) => s + valor(d.codigo, i), 0)
  const cuadra = pedido.detalles.every((d) => Math.abs(restante(d)) <= TOLERANCIA)
  const sinVacias = Array.from({ length: partes }, (_, i) => totalParte(i) > TOLERANCIA).every(Boolean)

  const agregarParte = () => setPartes((n) => Math.min(MAX_PARTES, n + 1))
  const quitarParte = () => {
    // Lo que tenía la última parte regresa a la primera.
    const ultima = partes - 1
    setKilos((k) => {
      const nuevo = { ...k }
      for (const d of pedido.detalles) {
        nuevo[`${d.codigo}|0`] = String(r3(Number(k[`${d.codigo}|0`] || 0) + Number(k[`${d.codigo}|${ultima}`] || 0)))
        delete nuevo[`${d.codigo}|${ultima}`]
      }
      return nuevo
    })
    setPartes((n) => Math.max(2, n - 1))
  }

  const dividir = async () => {
    if (!cuadra) return toast.advertencia('Reparte todo el producto: lo que falta debe quedar en 0 en cada renglón')
    if (!sinVacias) return toast.advertencia('Todas las partes deben llevar producto')
    setGuardando(true)
    try {
      const cuerpo = Array.from({ length: partes }, (_, i) =>
        pedido.detalles.map((d) => ({ codigo: d.codigo, kilos: valor(d.codigo, i) })).filter((l) => l.kilos > 0),
      )
      const r = await dividirPedido(pedido.id, cuerpo)
      onDividido(r.data.pedidos)
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo dividir el pedido')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} ancho="max-w-3xl" titulo={`Dividir pedido ${pedido.numero}`}>
      <p className="mb-3 text-sm text-gray-500">
        Reparte el producto entre los pedidos nuevos. El pedido {pedido.numero} quedará <strong>Cancelado</strong> y cada parte
        se crea como un pedido nuevo con su propio folio.
      </p>
      <div className="overflow-x-auto">
        <table className="gm-tabla-grid w-full">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="text-right">Pedido (kg)</th>
              {Array.from({ length: partes }, (_, i) => (
                <th key={i} className="text-right">
                  Pedido {i + 1}
                </th>
              ))}
              <th className="text-right">Falta repartir</th>
            </tr>
          </thead>
          <tbody>
            {pedido.detalles.map((d) => {
              const falta = restante(d)
              return (
                <tr key={d.codigo}>
                  <td className="text-sm font-semibold">{d.descripcion}</td>
                  <td className="text-right text-sm">{kg(d.kilos)}</td>
                  {Array.from({ length: partes }, (_, i) => (
                    <td key={i} className="text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className="gm-input w-24 text-right"
                        value={kilos[`${d.codigo}|${i}`] ?? ''}
                        onChange={(e) => setKilos({ ...kilos, [`${d.codigo}|${i}`]: e.target.value })}
                      />
                    </td>
                  ))}
                  <td className={`text-right text-sm font-semibold ${Math.abs(falta) <= TOLERANCIA ? 'text-green-600' : 'text-red-600'}`}>
                    {kg(falta)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-bold">
              <td className="text-sm">Total</td>
              <td className="text-right text-sm">{kg(pedido.detalles.reduce((s, d) => s + Number(d.kilos || 0), 0))}</td>
              {Array.from({ length: partes }, (_, i) => (
                <td key={i} className="text-right text-sm">
                  {kg(totalParte(i))}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-3 flex gap-4">
        {partes < MAX_PARTES && (
          <button type="button" className="text-sm font-semibold text-teal underline" onClick={agregarParte}>
            + Agregar otro pedido
          </button>
        )}
        {partes > 2 && (
          <button type="button" className="text-sm font-semibold text-gray-500 underline" onClick={quitarParte}>
            Quitar el último
          </button>
        )}
      </div>
      <div className="mt-8 flex justify-between">
        <button className="gm-btn-cancelar" onClick={onCerrar}>
          Cancelar
        </button>
        <button className="gm-btn-guardar" onClick={dividir} disabled={guardando || !cuadra || !sinVacias}>
          {guardando ? 'Dividiendo…' : `Dividir en ${partes} pedidos`}
        </button>
      </div>
    </Modal>
  )
}
