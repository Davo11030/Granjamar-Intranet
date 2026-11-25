import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../Layout'
import PageHeader from '../PageHeader'
import AgregarBoton from '../AgregarBoton'
import Modal from '../Modal'
import BadgeStock from '../BadgeStock'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getProductos, getUbicaciones } from '../../api/inventario'
import { getClientes } from '../../api/clientes'
import { getEmpresas } from '../../api/destinos'
import {
  crearVenta,
  getFormasPago,
  crearFormaPago,
  getLugaresEntrega,
  crearLugarEntrega,
  getEstadosRecoleccion,
  crearEstadoRecoleccion,
  idCatalogo,
} from '../../api/ventas'
import { seleccionarUbicaciones } from '../../utils/stock'
import { idsEmpresaPermitidos, filtrarPorEmpresasPermitidas } from '../../utils/ubicaciones'
import { fechaHoy } from '../../utils/fecha'
import { desgloseCambio, sugerenciasEfectivo } from '../../utils/dinero'
import { avisar } from '../../utils/avisoCarga'

const money = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const n3 = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })

const FILA_VACIA = {
  codigo: '', descripcion: '', kilosCaja: 0, precioKilo: 0, desc: 0,
  cantCajas: 1, cantKilos: 0, precioCaja: 0, importe: 0, stockDisponible: 0,
}

const ENTREGAS = ['Mostrador', 'Rampa 1', 'Rampa 2', 'Rampa 3', 'Rampa 4 (puerta azul)']
const PAGOS = ['Efectivo', 'Tarjeta', 'SPEI', 'Credito', 'Pendiente']

// Iconos simples de cada forma de pago.
const IconoPago = ({ tipo }) => {
  const p = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (tipo === 'Efectivo')
    return (
      <svg {...p}>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6 9.5v.01M18 14.5v.01" />
      </svg>
    )
  if (tipo === 'Tarjeta')
    return (
      <svg {...p}>
        <rect x="2.5" y="5" width="19" height="14" rx="2" />
        <path d="M2.5 10h19M6.5 15h4" />
      </svg>
    )
  if (tipo === 'SPEI')
    return (
      <svg {...p}>
        <path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
      </svg>
    )
  if (tipo === 'Credito')
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  return (
    <svg {...p}>
      <path d="M7 3h10M7 21h10M8 3v3.5a4 4 0 0 0 1.6 3.2L12 12l2.4-2.3A4 4 0 0 0 16 6.5V3M8 21v-3.5a4 4 0 0 1 1.6-3.2L12 12l2.4 2.3A4 4 0 0 1 16 17.5V21" />
    </svg>
  )
}
const ROTULO_PAGO = { Credito: 'Crédito' }

export default function VentaForm({ modo }) {
  const esMayoreo = modo === 'mayoreo'
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const toast = useToast()

  const [productos, setProductos] = useState([])
  const [ubicacionesTodas, setUbicacionesTodas] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [clientes, setClientes] = useState([])
  const [articulos, setArticulos] = useState([{ ...FILA_VACIA }])

  const [cliente, setCliente] = useState('')
  const [idCliente, setIdCliente] = useState(null)
  const [sugerencias, setSugerencias] = useState([])

  // Descuento (%) al final de la cuenta (ventas de mostrador): ya no se descuenta renglón por renglón.
  const [descuento, setDescuento] = useState('')
  const [fecha, setFecha] = useState(fechaHoy())
  const [hora, setHora] = useState(new Date().toTimeString().slice(0, 5))
  const [estado, setEstado] = useState(esMayoreo ? 'Programada' : 'Pendiente entrega')

  const [modalDescuento, setModalDescuento] = useState(false) // confirmar el descuento antes de cerrar la venta
  const [modalEntrega, setModalEntrega] = useState(false)
  const [lugarEntrega, setLugarEntrega] = useState('Mostrador')
  const [modalPago, setModalPago] = useState(false)
  const [tipoPago, setTipoPago] = useState('')
  const [subtipoTarjeta, setSubtipoTarjeta] = useState('Credito')
  const [efectivoRecibido, setEfectivoRecibido] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getProductos().then((r) => setProductos(r.data)).catch(avisar('No se pudieron cargar los productos'))
    getUbicaciones().then((r) => setUbicacionesTodas(r.data)).catch(avisar('No se pudieron cargar las existencias por ubicación'))
    getEmpresas().then((r) => setEmpresas(r.data)).catch(avisar('No se pudieron cargar las empresas'))
    if (esMayoreo) getClientes().then((r) => setClientes(r.data)).catch(avisar('No se pudieron cargar los clientes'))
  }, [esMayoreo])

  // Ventas solo puede surtirse del inventario propio (Granjamar/Conpaq), nunca de
  // resguardo o consignación.
  const ubicaciones = useMemo(() => {
    const permitidas = idsEmpresaPermitidos(empresas, { interna: true })
    return filtrarPorEmpresasPermitidas(ubicacionesTodas, permitidas)
  }, [ubicacionesTodas, empresas])

  const stockDe = (codigo) =>
    ubicaciones.filter((u) => u.codigoProducto === codigo).reduce((s, u) => s + Number(u.cantidadKilos || 0), 0)

  const recalcular = (art) => {
    const factor = 1 - Number(art.desc || 0) / 100
    return {
      ...art,
      cantKilos: Number(art.cantCajas || 0) * Number(art.kilosCaja || 0),
      precioCaja: Number(art.kilosCaja || 0) * Number(art.precioKilo || 0) * factor,
      importe: Number(art.cantCajas || 0) * Number(art.kilosCaja || 0) * Number(art.precioKilo || 0) * factor,
    }
  }

  const setFila = (i, cambios) => {
    setArticulos((prev) => prev.map((a, idx) => (idx === i ? recalcular({ ...a, ...cambios }) : a)))
    setError('')
  }

  const elegirProducto = (i, codigo) => {
    const p = productos.find((x) => x.codigo === codigo)
    if (!p) return setFila(i, { ...FILA_VACIA })
    setFila(i, {
      codigo: p.codigo,
      descripcion: p.especie || p.codigo,
      kilosCaja: Number(p.pesoCaja) || 0,
      precioKilo: Number(p.precioKilo) || 0,
      desc: 0,
      cantCajas: 1,
      stockDisponible: stockDe(codigo),
    })
  }

  const agregarFila = () => setArticulos((p) => [...p, { ...FILA_VACIA }])
  const quitarFila = (i) => setArticulos((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)))

  const subtotal = useMemo(() => articulos.reduce((s, a) => s + (a.importe || 0), 0), [articulos])
  const descuentoPct = esMayoreo ? 0 : Math.min(100, Math.max(0, Number(descuento) || 0))
  const montoDescuento = Math.round(subtotal * descuentoPct) / 100
  const total = Math.round((subtotal - montoDescuento) * 100) / 100
  // Mayoreo: el descuento va por producto. Se juntan los renglones con descuento para confirmarlos antes de cerrar.
  const lineasConDescuento = esMayoreo ? articulos.filter((a) => a.codigo && Number(a.desc) > 0) : []
  const sinDescuentoDe = (a) => Number(a.cantCajas || 0) * Number(a.kilosCaja || 0) * Number(a.precioKilo || 0)
  const montoDescLineas = lineasConDescuento.reduce((acc, a) => acc + (sinDescuentoDe(a) - Number(a.importe || 0)), 0)
  const hayDescuento = esMayoreo ? lineasConDescuento.length > 0 : descuentoPct > 0
  const cambio = Number(efectivoRecibido || 0) - total
  // El botón de cerrar solo se habilita con una forma de pago elegida (y, en efectivo, con lo recibido completo).
  const montosSugeridos = useMemo(() => sugerenciasEfectivo(total), [total])
  const puedeCerrar = !!tipoPago && (tipoPago !== 'Efectivo' || Number(efectivoRecibido || 0) >= total)
  const piezasCambio = useMemo(() => desgloseCambio(Math.max(0, cambio)), [cambio])

  const buscarCliente = (texto) => {
    setCliente(texto)
    setIdCliente(null)
    setSugerencias(
      texto.length < 2
        ? []
        : clientes.filter((c) => c.nombre?.toLowerCase().includes(texto.toLowerCase())).slice(0, 6),
    )
  }

  const validar = () => {
    const conProducto = articulos.filter((a) => a.codigo)
    if (conProducto.length === 0) return 'Agrega al menos un artículo con producto'
    if (esMayoreo && !idCliente) return 'Selecciona un cliente de la lista'
    for (const a of conProducto) {
      if (Number(a.cantCajas) <= 0) return `Cantidad de cajas inválida en ${a.codigo}`
      if (a.cantKilos > a.stockDisponible)
        return `Stock insuficiente para ${a.codigo} (disponible ${n3(a.stockDisponible)} kg)`
    }
    if (esMayoreo && (!fecha || !hora)) return 'Indica fecha y hora del pedido'
    return ''
  }

  const iniciarCierre = () => {
    const msg = validar()
    if (msg) return toast.advertencia(msg)
    if (hayDescuento) setModalDescuento(true) // un descuento siempre se confirma antes de seguir
    else if (esMayoreo) setModalPago(true)
    else setModalEntrega(true)
  }

  const confirmar = async () => {
    if (!tipoPago) return setError('Selecciona la forma de pago')
    if (tipoPago === 'Efectivo' && Number(efectivoRecibido || 0) < total)
      return setError('El efectivo recibido es menor al total')
    setGuardando(true)
    setError('')
    try {
      const detalles = []
      for (const art of articulos.filter((a) => a.codigo && a.cantKilos > 0)) {
        const ubs = ubicaciones.filter((u) => u.codigoProducto === art.codigo)
        const sel = seleccionarUbicaciones(ubs, art.cantKilos)
        if (!sel) {
          setGuardando(false)
          return setError(`Stock insuficiente para ${art.codigo}`)
        }
        // El precio queda guardado en la venta (con el descuento del renglón, si lo hay) para que no cambie si después se
        // modifica el precio del producto.
        const precioKilo = Math.round(Number(art.precioKilo || 0) * (1 - Number(art.desc || 0) / 100) * 100) / 100
        detalles.push(...sel.map((x) => ({ ...x, precioKilo })))
      }

      const [fp, le, er] = await Promise.all([
        getFormasPago(),
        getLugaresEntrega(),
        getEstadosRecoleccion(),
      ])
      const nombrePago = tipoPago === 'Tarjeta' ? `Tarjeta ${subtipoTarjeta}` : tipoPago
      const idFormaPago = await idCatalogo(fp.data, nombrePago, crearFormaPago)
      const idLugarEntrega = esMayoreo
        ? null
        : await idCatalogo(le.data, lugarEntrega, crearLugarEntrega)
      // El estado de recolección no se usa por ahora: las ventas de mostrador ya no lo llevan.
      const idEstadoRecoleccion = esMayoreo
        ? await idCatalogo(er.data, 'Pendiente', crearEstadoRecoleccion, 'descripcion')
        : null

      await crearVenta({
        idUsuario: usuario?.id,
        idCliente: esMayoreo ? idCliente : null,
        // Venta de mostrador sin nombre: se guarda como "Público en general".
        nombreCliente: esMayoreo ? null : cliente.trim() || 'Público en general',
        idFormaPago,
        idLugarEntrega,
        idEstadoRecoleccion,
        total,
        descuento: descuentoPct > 0 ? descuentoPct : null,
        efectivoRecibido: tipoPago === 'Efectivo' ? Number(efectivoRecibido || 0) : null,
        estado,
        detalles,
      })

      toast.exito('Venta registrada correctamente')
      navigate('/salidas/ventas')
    } catch (e) {
      const msg = e.response?.data?.mensaje || 'No se pudo guardar la venta'
      setError(msg)
      toast.error(msg)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Layout>
      <PageHeader titulo={esMayoreo ? 'Ventas mayoreo' : 'Ventas mostrador'} />

      <div className="px-6 md:px-10">
        {/* Fila superior */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="relative flex items-center gap-3">
            <span className="text-teal font-semibold text-lg">Nombre cliente:</span>
            <input
              className="gm-input-amarillo w-56"
              placeholder={esMayoreo ? 'Escribe aqui' : 'Público en general'}
              value={cliente}
              onChange={(e) => (esMayoreo ? buscarCliente(e.target.value) : setCliente(e.target.value))}
            />
            {esMayoreo && idCliente && <span className="text-green-600 font-bold">✓</span>}
            {sugerencias.length > 0 && (
              <div className="absolute top-full left-32 z-20 mt-1 w-72 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {sugerencias.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCliente(c.nombre)
                      setIdCliente(c.id)
                      setSugerencias([])
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-[color:var(--color-panel-login)]"
                  >
                    <span className="font-semibold">{c.nombre}</span>
                    {c.rfc && <span className="ml-2 text-xs text-gray-400">— {c.rfc}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {esMayoreo ? (
            <div className="flex items-center gap-4">
              <label className="text-teal font-semibold">
                Fecha:{' '}
                <input
                  type="date"
                  className="gm-input-amarillo inline-block w-40 font-bold text-black"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </label>
              <label className="text-teal font-semibold">
                Hora:{' '}
                <input
                  type="time"
                  className="gm-input-amarillo inline-block w-28"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </label>
              <label className="text-teal font-semibold">
                Estado:{' '}
                <select
                  className="gm-input-amarillo inline-block w-40 font-bold text-black"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                >
                  <option value="Programada">Programada</option>
                  <option value="Pendiente entrega">Pendiente entrega</option>
                </select>
              </label>
            </div>
          ) : null}

          <AgregarBoton onClick={agregarFila}>Articulo</AgregarBoton>
        </div>

        <p className="mb-2 text-xs text-gray-400">
          El stock disponible es únicamente el de nuestro inventario (Granjamar/Conpaq).
        </p>

        {/* Tabla de artículos */}
        <div className="overflow-x-auto">
          <table className="gm-tabla">
            <thead>
              <tr>
                <th>Cant. Cajas</th>
                <th>Codigo</th>
                <th>Descripcion</th>
                <th className="text-right">Kilos x Caja</th>
                <th className="text-right">Precio x Kilo</th>
                {esMayoreo && <th className="text-right">Desc %</th>}
                <th className="text-right">Precio x caja</th>
                <th className="text-right">Cant. Kilos</th>
                <th className="text-right">Importe</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {articulos.map((art, i) => {
                const excede = art.codigo && art.cantKilos > art.stockDisponible
                return (
                  <tr key={i} className={excede ? 'bg-red-50' : ''}>
                    <td>
                      <input
                        type="number"
                        min="1"
                        max={art.codigo && art.kilosCaja > 0 ? Math.floor(art.stockDisponible / art.kilosCaja) : undefined}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-center"
                        value={art.cantCajas}
                        onChange={(e) => setFila(i, { cantCajas: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                        value={art.codigo}
                        onChange={(e) => elegirProducto(i, e.target.value)}
                      >
                        <option value="">▼</option>
                        {productos.map((p) => (
                          <option key={p.codigo} value={p.codigo}>
                            {p.codigo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-sm">
                      {art.descripcion || '—'}
                      {art.codigo && (
                        <div className="mt-1">
                          <BadgeStock kilos={art.stockDisponible} insuficiente={excede} />
                        </div>
                      )}
                    </td>
                    <td className="text-right text-sm">{n3(art.kilosCaja)}</td>
                    <td className="text-right text-sm">{money(art.precioKilo)}</td>
                    {esMayoreo && (
                      <td className="text-right">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-16 rounded border border-gray-300 px-2 py-1 text-right"
                          value={art.desc}
                          onChange={(e) => setFila(i, { desc: e.target.value })}
                        />
                      </td>
                    )}
                    <td className="text-right text-sm">{money(art.precioCaja)}</td>
                    <td className="text-right text-sm font-medium">{n3(art.cantKilos)}</td>
                    <td className="text-right font-semibold text-marca">{money(art.importe)}</td>
                    <td className="text-right">
                      <button
                        onClick={() => quitarFila(i)}
                        className="text-cancelar hover:brightness-90 text-xl"
                        aria-label="Quitar"
                      >
                        −
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Total + acciones */}
        <div className="mt-6 flex flex-wrap items-end justify-end gap-x-8 gap-y-4">
          {!esMayoreo && (
            <div className="flex flex-col items-end gap-2 text-sm font-semibold text-gray-600">
              <span>
                Subtotal <span className="ml-2 text-base text-gray-800">{money(subtotal)}</span>
              </span>
              <label className="flex items-center gap-2">
                Descuento %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-gray-800"
                  value={descuento}
                  onChange={(e) => {
                    setDescuento(e.target.value)
                    setError('')
                  }}
                />
                {descuentoPct > 0 && <span className="text-base text-red-600">−{money(montoDescuento)}</span>}
              </label>
            </div>
          )}
          <span className="text-2xl font-extrabold">
            <span style={{ color: 'var(--color-cancelar)' }}>Total </span>
            <span className="text-teal">{money(total)}</span>
          </span>
          <button
            onClick={iniciarCierre}
            className="rounded-full bg-purple-300 px-6 py-2 font-bold text-gray-800 transition hover:bg-purple-400"
          >
            Cerrar venta
          </button>
        </div>
      </div>

      {/* Confirmación del descuento (mostrador: el de la cuenta; mayoreo: el de cada producto) */}
      <Modal abierto={modalDescuento} onCerrar={() => setModalDescuento(false)} ancho="max-w-sm" titulo="Confirmar descuento">
        <p className="text-sm text-gray-600">Vas a cerrar esta venta con un descuento. Revisa que sea correcto:</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Subtotal</dt>
            <dd className="font-semibold">{money(esMayoreo ? subtotal + montoDescLineas : subtotal)}</dd>
          </div>
          {esMayoreo ? (
            lineasConDescuento.map((a, i) => (
              <div key={i} className="flex justify-between">
                <dt className="text-gray-500">
                  Descuento {a.codigo} ({Number(a.desc)}%)
                </dt>
                <dd className="font-semibold text-red-600">−{money(sinDescuentoDe(a) - Number(a.importe || 0))}</dd>
              </div>
            ))
          ) : (
            <div className="flex justify-between">
              <dt className="text-gray-500">Descuento ({descuentoPct}%)</dt>
              <dd className="font-semibold text-red-600">−{money(montoDescuento)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base">
            <dt className="font-bold">Total a cobrar</dt>
            <dd className="font-extrabold text-teal">{money(total)}</dd>
          </div>
        </dl>
        <div className="mt-6 flex gap-3">
          <button className="gm-btn-cancelar flex-1" onClick={() => setModalDescuento(false)}>
            Corregir
          </button>
          <button
            className="gm-btn-guardar flex-1"
            onClick={() => {
              setModalDescuento(false)
              if (esMayoreo) setModalPago(true)
              else setModalEntrega(true)
            }}
          >
            Confirmar descuento
          </button>
        </div>
      </Modal>

      {/* Modal entrega (solo mostrador) */}
      <Modal abierto={modalEntrega} onCerrar={() => setModalEntrega(false)} variante="cyan" ancho="max-w-sm" titulo="Entrega:">
        {ENTREGAS.map((l) => (
          <label key={l} className="mb-3 flex items-center gap-3 cursor-pointer">
            <input type="radio" name="entrega" checked={lugarEntrega === l} onChange={() => setLugarEntrega(l)} />
            {l}
          </label>
        ))}
        <div className="mt-4 flex gap-3">
          <button className="gm-btn-cancelar flex-1" onClick={() => setModalEntrega(false)}>
            Cancelar
          </button>
          <button
            className="gm-btn-guardar flex-1"
            onClick={() => {
              setModalEntrega(false)
              setModalPago(true)
            }}
          >
            Continuar
          </button>
        </div>
      </Modal>

      {/* Modal pago */}
      <Modal abierto={modalPago} onCerrar={() => setModalPago(false)} variante="cyan" ancho="max-w-xl" titulo="Forma de pago">
        {/* Total a cobrar */}
        <div className="mb-5 rounded-2xl bg-white/70 px-5 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total a cobrar</p>
          <p className="text-4xl font-extrabold text-teal">{money(total)}</p>
        </div>

        {/* Formas de pago */}
        <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PAGOS.map((t) => {
            const activo = tipoPago === t
            return (
              <button
                key={t}
                type="button"
                aria-pressed={activo}
                onClick={() => {
                  setTipoPago(t)
                  setError('')
                }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-xs font-bold transition ${
                  activo
                    ? 'border-marca-oscuro bg-marca text-white shadow-md'
                    : 'border-transparent bg-white/70 text-marca hover:bg-white hover:shadow-sm'
                }`}
              >
                <IconoPago tipo={t} />
                {ROTULO_PAGO[t] || t}
              </button>
            )
          })}
        </div>

        {tipoPago === '' && <p className="mb-5 text-center text-sm text-gray-500">Selecciona cómo va a pagar el cliente.</p>}

        <div className="mb-5 space-y-3">
          {tipoPago === 'Efectivo' && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-gray-700">Efectivo recibido</span>
                <div className="flex items-center rounded-xl px-4 py-2" style={{ backgroundColor: 'var(--color-campo-amarillo)' }}>
                  <span className="mr-2 text-lg font-bold text-gray-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    autoFocus
                    className="w-full bg-transparent text-right text-2xl font-bold outline-none"
                    placeholder="0.00"
                    value={efectivoRecibido}
                    onChange={(e) => setEfectivoRecibido(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && puedeCerrar && !guardando && confirmar()}
                  />
                </div>
              </label>

              {/* Montos rápidos */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEfectivoRecibido(String(total))}
                  className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-teal transition hover:bg-white"
                >
                  Exacto
                </button>
                {montosSugeridos.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEfectivoRecibido(String(m))}
                    className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-marca transition hover:bg-white"
                  >
                    {money(m)}
                  </button>
                ))}
              </div>

              {/* Cambio */}
              <div
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                  efectivoRecibido === '' ? 'bg-white/60 text-gray-500' : cambio >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}
              >
                <span className="text-sm font-semibold">{efectivoRecibido !== '' && cambio < 0 ? 'Faltan' : 'Cambio'}</span>
                <span className="text-2xl font-extrabold">{money(efectivoRecibido === '' ? 0 : Math.abs(cambio))}</span>
              </div>

              {cambio > 0 && piezasCambio.length > 0 && (
                <div className="rounded-xl bg-white/60 px-3 py-2">
                  <p className="mb-1.5 text-xs font-semibold text-gray-500">Entregar:</p>
                  <div className="flex flex-wrap gap-2">
                    {piezasCambio.map((p) => (
                      <span key={p.valor} className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        {p.cantidad} × {money(p.valor)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tipoPago === 'Tarjeta' && (
            <div className="grid grid-cols-2 gap-1 rounded-full bg-white/70 p-1" role="radiogroup" aria-label="Tipo de tarjeta">
              {['Credito', 'Debito'].map((sub) => (
                <button
                  key={sub}
                  type="button"
                  role="radio"
                  aria-checked={subtipoTarjeta === sub}
                  onClick={() => setSubtipoTarjeta(sub)}
                  className={`rounded-full py-2 text-sm font-bold transition ${
                    subtipoTarjeta === sub ? 'bg-marca text-white shadow' : 'text-marca hover:bg-white'
                  }`}
                >
                  {sub === 'Credito' ? 'Crédito' : 'Débito'}
                </button>
              ))}
            </div>
          )}

          {(tipoPago === 'SPEI' || tipoPago === 'Credito' || tipoPago === 'Pendiente') && (
            <p className="rounded-xl bg-white/60 px-4 py-3 text-sm text-gray-600">
              {tipoPago === 'SPEI'
                ? 'Verifica la transferencia antes de liberar el producto.'
                : tipoPago === 'Credito'
                  ? 'La venta quedará registrada como crédito pendiente de cobro.'
                  : 'La venta quedará pendiente de pago.'}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button className="gm-btn-cancelar flex-1" onClick={() => setModalPago(false)}>
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={guardando || !puedeCerrar}
            className="flex-1 rounded-full bg-purple-400 py-2.5 font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Cerrar venta'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
