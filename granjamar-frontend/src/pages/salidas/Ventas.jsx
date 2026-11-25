import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import IconoMas from '../../components/IconoMas'
import usePaginacion from '../../hooks/usePaginacion'
import { getVentas, getVenta, cambiarEstadoVenta, eliminarVenta } from '../../api/ventas'
import { formatearFecha, formatearHora, formatearFechaHora } from '../../utils/fecha'
import { imprimirTicketVenta, imprimirReporteVentas } from '../../utils/impresionVentas'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { avisar } from '../../utils/avisoCarga'

// Guardado por ahora (no se aplica todavía): para volver a mostrarlo basta ponerlo en true.
const MOSTRAR_ESTADO_RECOLECCION = false // columna "Estado recoleccion"
const MOSTRAR_DETALLES = true // botón "Detalles": abre la venta con lo que se vendió
const MOSTRAR_ESTADO = false // columna "Estado" (Programada / Pendiente entrega / Entregada) y botón "Marcar entregada"
const MOSTRAR_ACCIONES = MOSTRAR_ESTADO || MOSTRAR_DETALLES

const dinero = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const kilos = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })

const estadoClase = (estado = '') => {
  const e = estado.toLowerCase()
  if (e.includes('pend')) return 'bg-[color:var(--color-pendiente-bg)] text-red-700'
  if (e.includes('proceso')) return 'text-amber-600'
  return 'text-green-700'
}

const ESTADO_VENTA_CLASE = {
  Programada: 'bg-blue-100 text-blue-700',
  'Pendiente entrega': 'bg-amber-100 text-amber-700',
  Entregada: 'bg-green-100 text-green-700',
}

export default function Ventas() {
  const [errorCarga, setErrorCarga] = useState(false)
  const navigate = useNavigate()
  const { usuario, puede, puedeAlguno } = useAuth()
  const toast = useToast()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [menu, setMenu] = useState(false)
  const [reporte, setReporte] = useState(false)
  const [rango, setRango] = useState({ desde: '', hasta: '' })
  const [detalle, setDetalle] = useState(null) // la venta abierta en "Detalles"
  const [abriendo, setAbriendo] = useState(false)
  const [cancelar, setCancelar] = useState(null) // la venta que se va a cancelar (pide confirmación)
  const [cancelando, setCancelando] = useState(false)
  const menuRef = useRef(null)

  const cargar = () => {
    getVentas().then((r) => setDatos(r.data)).catch(avisar('No se pudieron cargar las ventas', () => setErrorCarga(true))).finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  const marcarEntregada = async (id) => {
    try {
      await cambiarEstadoVenta(id, { estado: 'Entregada', idUsuario: usuario?.id })
      toast.exito('Venta marcada como entregada')
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo actualizar el estado')
    }
  }

  const verDetalle = async (id) => {
    setAbriendo(true)
    try {
      const { data } = await getVenta(id)
      setDetalle(data)
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo cargar la venta')
    } finally {
      setAbriendo(false)
    }
  }

  // Cancela la venta: sus kilos regresan al inventario y deja de contar en reportes y en el corte de caja.
  const confirmarCancelacion = async () => {
    setCancelando(true)
    try {
      await eliminarVenta(cancelar.id, usuario?.id)
      toast.exito(`Venta #${cancelar.id} cancelada; los kilos regresaron al inventario`)
      setCancelar(null)
      setDetalle(null)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo cancelar la venta')
    } finally {
      setCancelando(false)
    }
  }

  const imprimirTicket = (id) =>
    imprimirTicketVenta(() => getVenta(id).then((r) => r.data)).catch((e) =>
      toast.error(e.response?.data?.mensaje || e.message || 'No se pudo imprimir el ticket'),
    )

  const generarReporte = async () => {
    if (!rango.desde || !rango.hasta) return toast.advertencia('Elige la fecha de inicio y la de fin')
    if (rango.desde > rango.hasta) return toast.advertencia('La fecha de inicio no puede ser posterior a la de fin')
    try {
      await imprimirReporteVentas(
        () => getVentas({ desde: rango.desde, hasta: rango.hasta }).then((r) => r.data),
        rango.desde,
        rango.hasta,
      )
      setReporte(false)
    } catch (e) {
      toast.error(e.response?.data?.mensaje || e.message || 'No se pudo generar el reporte')
    }
  }

  useEffect(() => {
    const cerrar = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false)
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  // Subtotal de la venta abierta (antes del descuento): la suma de sus renglones; si alguno no trae precio (ventas
  // anteriores), se saca del total y el descuento.
  const subtotalDetalle = !detalle
    ? 0
    : (detalle.detalles || []).length > 0 && (detalle.detalles || []).every((d) => d.importe != null)
      ? detalle.detalles.reduce((acc, d) => acc + Number(d.importe), 0)
      : Number(detalle.total) / (1 - Number(detalle.descuento || 0) / 100)

  const filtrados = datos.filter((d) => (d.cliente || '').toLowerCase().includes(busqueda.toLowerCase()))
  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(filtrados, 20)

  return (
    <Layout>
      <PageHeader titulo="Ventas" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button className="gm-btn-guardar" onClick={() => setReporte(true)}>
              Reporte
            </button>
            {puedeAlguno([['ventas', 'corte'], ['ventas', 'ver']]) && (
              <button className="gm-pill" onClick={() => navigate('/salidas/ventas/corte')}>
                Corte de caja
              </button>
            )}
          </div>
          <Buscador
            valor={busqueda}
            onChange={(v) => {
              setBusqueda(v)
              setPagina(1)
            }}
            placeholder="Ingresa nombre de cliente"
            className="w-72 max-w-full"
          />
          <div className="relative" ref={menuRef}>
            {puede('ventas', 'crear') && (
              <button className="gm-agregar" onClick={() => setMenu((v) => !v)}>
                Venta <IconoMas />
              </button>
            )}
            {menu && (
              <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                <button
                  className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                  onClick={() => navigate('/salidas/ventas/mostrador')}
                >
                  Mostrador
                </button>
                <button
                  className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                  onClick={() => navigate('/salidas/ventas/mayoreo')}
                >
                  Mayoreo
                </button>
              </div>
            )}
          </div>
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="gm-tabla">
                <thead>
                  <tr>
                    <th aria-hidden="true" />
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Nombre cliente</th>
                    <th>Forma de pago</th>
                    <th className="text-right">Total</th>
                    {MOSTRAR_ESTADO_RECOLECCION && <th>Estado recoleccion</th>}
                    {MOSTRAR_ESTADO && <th>Estado</th>}
                    {MOSTRAR_ACCIONES && <th aria-hidden="true" />}
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <button
                          onClick={() => imprimirTicket(v.id)}
                          className="text-gray-400 hover:text-teal"
                          aria-label="Imprimir ticket"
                          title="Imprimir ticket"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M6 9V3h12v6M6 18H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-2M6 14h12v7H6z"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                      <td>{formatearFecha(v.fechaRegistro)}</td>
                      <td>{formatearHora(v.fechaRegistro)}</td>
                      <td>{v.cliente || 'Público en general'}</td>
                      <td>{v.formaPago || '—'}</td>
                      <td className="text-right font-semibold">
                        {`$${Number(v.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                      </td>
                      {MOSTRAR_ESTADO_RECOLECCION && (
                        <td>
                          {v.estadoRecoleccion ? (
                            <span className={`rounded px-3 py-1 text-sm font-medium ${estadoClase(v.estadoRecoleccion)}`}>
                              {v.estadoRecoleccion}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {MOSTRAR_ESTADO && (
                        <td>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              ESTADO_VENTA_CLASE[v.estado] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {v.estado || '—'}
                          </span>
                        </td>
                      )}
                      {MOSTRAR_ACCIONES && (
                        <td className="text-right whitespace-nowrap">
                          {MOSTRAR_ESTADO && v.estado !== 'Entregada' && puede('ventas', 'editar') && (
                            <button className="gm-pill mr-2" onClick={() => marcarEntregada(v.id)}>
                              Marcar entregada
                            </button>
                          )}
                          {MOSTRAR_DETALLES && (
                            <button className="gm-pill" onClick={() => verDetalle(v.id)} disabled={abriendo}>
                              Detalles
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={6 + (MOSTRAR_ESTADO_RECOLECCION ? 1 : 0) + (MOSTRAR_ESTADO ? 1 : 0) + (MOSTRAR_ACCIONES ? 1 : 0)} className="text-center !py-12 text-gray-400">
                        {errorCarga ? 'No se pudo cargar la información. Recarga la página para intentar de nuevo.' : 'Sin ventas registradas'}
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

      <Modal abierto={!!detalle} onCerrar={() => setDetalle(null)} titulo={`Venta #${detalle?.id ?? ''}`} ancho="max-w-2xl">
        {detalle && (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-xs font-semibold text-gray-500">Fecha y hora</dt>
                <dd>{formatearFechaHora(detalle.fechaRegistro)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500">Registró</dt>
                <dd>{detalle.usuario || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500">Cliente</dt>
                <dd>{detalle.cliente || 'Público en general'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500">Forma de pago</dt>
                <dd>{detalle.formaPago || '—'}</dd>
              </div>
              {detalle.lugarEntrega && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500">Lugar de entrega</dt>
                  <dd>{detalle.lugarEntrega}</dd>
                </div>
              )}
              {detalle.efectivoRecibido != null && Number(detalle.efectivoRecibido) > 0 && (
                <>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500">Efectivo recibido</dt>
                    <dd>{dinero(detalle.efectivoRecibido)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500">Cambio</dt>
                    <dd>{dinero(Math.max(0, Number(detalle.efectivoRecibido) - Number(detalle.total)))}</dd>
                  </div>
                </>
              )}
            </dl>

            <div className="mt-5 max-h-72 overflow-auto rounded-xl border border-gray-100">
              <table className="gm-tabla">
                <thead className="sticky top-0">
                  <tr>
                    <th>Codigo</th>
                    <th>Descripcion</th>
                    <th>Lote</th>
                    <th className="text-right">Kilos</th>
                    <th className="text-right">Precio x kilo</th>
                    <th className="text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {(detalle.detalles || []).map((d) => (
                    <tr key={d.id}>
                      <td className="font-mono text-sm">{d.producto || '—'}</td>
                      <td>{d.descripcion || '—'}</td>
                      <td className="font-mono text-sm">{d.lote || '—'}</td>
                      <td className="text-right">{kilos(d.kilos)}</td>
                      <td className="text-right">{d.precioKilo != null ? dinero(d.precioKilo) : '—'}</td>
                      <td className="text-right font-semibold">{d.importe != null ? dinero(d.importe) : '—'}</td>
                    </tr>
                  ))}
                  {(detalle.detalles || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="!py-8 text-center text-gray-400">
                        Esta venta no tiene productos registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-end justify-between gap-4 text-sm">
              <span className="text-gray-500">
                Total de kilos: <strong className="text-gray-800">{kilos((detalle.detalles || []).reduce((acc, d) => acc + Number(d.kilos || 0), 0))}</strong>
              </span>
              <div className="text-right">
                {Number(detalle.descuento) > 0 && (
                  <>
                    <p className="text-gray-500">
                      Subtotal: <strong className="text-gray-800">{dinero(subtotalDetalle)}</strong>
                    </p>
                    <p className="text-gray-500">
                      Descuento {Number(detalle.descuento)}%:{' '}
                      <strong className="text-red-600">−{dinero(subtotalDetalle - Number(detalle.total))}</strong>
                    </p>
                  </>
                )}
                <p className="text-lg font-bold text-teal">Total: {dinero(detalle.total)}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {puede('ventas', 'eliminar') && (
                  <button className="gm-pill text-red-600" onClick={() => setCancelar(detalle)}>
                    Cancelar venta
                  </button>
                )}
                {puede('ventas', 'editar') && (
                  <button className="gm-pill" onClick={() => navigate(`/salidas/ventas/${detalle.id}/editar`)}>
                    Corregir
                  </button>
                )}
              </div>
              <button className="gm-btn-cancelar" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal abierto={!!cancelar} onCerrar={() => !cancelando && setCancelar(null)} titulo="" ancho="max-w-sm">
        <p className="text-center text-lg">¿Deseas cancelar la venta #{cancelar?.id} de</p>
        <p className="mb-1 text-center text-xl font-bold text-marca">{cancelar?.cliente || 'Público en general'}?</p>
        <p className="mb-4 text-center text-sm text-gray-500">
          {cancelar && `${formatearFechaHora(cancelar.fechaRegistro)} · ${dinero(cancelar.total)}`}
        </p>
        <p className="mb-6 text-center text-sm text-gray-400">
          Los{' '}
          {kilos((cancelar?.detalles || []).reduce((acc, d) => acc + Number(d.kilos || 0), 0))} kg regresan al inventario
          y la venta deja de contar en los reportes y en el corte de caja. No se puede deshacer.
        </p>
        <div className="flex justify-center gap-4">
          <button className="gm-btn-guardar whitespace-nowrap !px-6" onClick={() => setCancelar(null)} disabled={cancelando}>
            Regresar
          </button>
          <button className="gm-btn-cancelar whitespace-nowrap !px-6" onClick={confirmarCancelacion} disabled={cancelando}>
            {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
          </button>
        </div>
      </Modal>

      <Modal abierto={reporte} onCerrar={() => setReporte(false)} titulo="Reporte de ventas" ancho="max-w-md">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Fecha inicio</span>
            <input
              type="date"
              className="gm-input mt-1"
              value={rango.desde}
              onChange={(e) => setRango({ ...rango, desde: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Fecha fin</span>
            <input
              type="date"
              className="gm-input mt-1"
              value={rango.hasta}
              onChange={(e) => setRango({ ...rango, hasta: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-8 flex justify-end gap-4">
          <button className="gm-btn-cancelar" onClick={() => setReporte(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={generarReporte}>
            Generar
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
