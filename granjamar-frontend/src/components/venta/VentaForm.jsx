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
import { desgloseCambio } from '../../utils/dinero'

const money = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const n3 = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })

const FILA_VACIA = {
  codigo: '', descripcion: '', kilosCaja: 0, precioKilo: 0, desc: 0,
  cantCajas: 1, cantKilos: 0, precioCaja: 0, importe: 0, stockDisponible: 0,
}

const ENTREGAS = ['Mostrador', 'Rampa 1', 'Rampa 2', 'Rampa 3', 'Rampa 4 (puerta azul)']
const PAGOS = ['Efectivo', 'Tarjeta', 'SPEI', 'Credito', 'Pendiente']

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

  const [recoleccion, setRecoleccion] = useState('Inmediata')
  const [fecha, setFecha] = useState(fechaHoy())
  const [hora, setHora] = useState(new Date().toTimeString().slice(0, 5))
  const [estado, setEstado] = useState(esMayoreo ? 'Programada' : 'Pendiente entrega')

  const [modalEntrega, setModalEntrega] = useState(false)
  const [lugarEntrega, setLugarEntrega] = useState('Mostrador')
  const [modalPago, setModalPago] = useState(false)
  const [tipoPago, setTipoPago] = useState('')
  const [subtipoTarjeta, setSubtipoTarjeta] = useState('Credito')
  const [efectivoRecibido, setEfectivoRecibido] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getProductos().then((r) => setProductos(r.data)).catch(console.error)
    getUbicaciones().then((r) => setUbicacionesTodas(r.data)).catch(console.error)
    getEmpresas().then((r) => setEmpresas(r.data)).catch(console.error)
    if (esMayoreo) getClientes().then((r) => setClientes(r.data)).catch(console.error)
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

  const total = useMemo(() => articulos.reduce((s, a) => s + (a.importe || 0), 0), [articulos])
  const cambio = Number(efectivoRecibido || 0) - total
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
    if (!esMayoreo && !cliente.trim()) return 'Ingresa el nombre del cliente'
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
    if (esMayoreo) setModalPago(true)
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
        detalles.push(...sel)
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
      const idEstadoRecoleccion = esMayoreo
        ? await idCatalogo(er.data, 'Pendiente', crearEstadoRecoleccion, 'descripcion')
        : await idCatalogo(er.data, recoleccion, crearEstadoRecoleccion, 'descripcion')

      await crearVenta({
        idUsuario: usuario?.id,
        idCliente: esMayoreo ? idCliente : null,
        idFormaPago,
        idLugarEntrega,
        idEstadoRecoleccion,
        total,
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
              placeholder="Escribe aqui"
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
          ) : (
            <div className="rounded-xl px-4 py-2" style={{ backgroundColor: 'var(--color-pill)' }}>
              <p className="text-sm font-semibold mb-1">Recoleccion:</p>
              {['Inmediata', 'Pendiente'].map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="recoleccion"
                    checked={recoleccion === r}
                    onChange={() => setRecoleccion(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
          )}

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
                <th className="text-right">Desc %</th>
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
        <div className="mt-6 flex flex-wrap items-center justify-end gap-4">
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
        <div className="mb-6 flex flex-wrap gap-2">
          {PAGOS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTipoPago(t)
                setError('')
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold text-white transition ${
                tipoPago === t ? 'bg-marca-oscuro' : 'bg-marca hover:brightness-95'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span
              className="rounded px-4 py-1 text-lg font-bold"
              style={{ backgroundColor: 'var(--color-campo-amarillo)' }}
            >
              {money(total)}
            </span>
          </div>

          {tipoPago === 'Efectivo' && (
            <>
              <div className="flex items-center justify-between">
                <span>Efectivo recibido</span>
                <input
                  type="number"
                  className="w-40 rounded px-4 py-1 text-right font-semibold outline-none"
                  style={{ backgroundColor: 'var(--color-campo-amarillo)' }}
                  value={efectivoRecibido}
                  onChange={(e) => setEfectivoRecibido(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Cambio</span>
                <span
                  className={`rounded px-4 py-1 font-bold ${
                    cambio >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {money(Math.max(0, cambio))}
                </span>
              </div>

              {cambio > 0 && piezasCambio.length > 0 && (
                <div className="rounded bg-white/60 px-3 py-2">
                  <p className="mb-1.5 text-xs font-semibold text-gray-500">Entregar:</p>
                  <div className="flex flex-wrap gap-2">
                    {piezasCambio.map((p) => (
                      <span
                        key={p.valor}
                        className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                      >
                        {p.cantidad} × {money(p.valor)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tipoPago === 'Tarjeta' && (
            <div className="flex gap-6 pt-1">
              {['Credito', 'Debito'].map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="subtarjeta"
                    checked={subtipoTarjeta === s}
                    onChange={() => setSubtipoTarjeta(s)}
                  />
                  {s === 'Credito' ? 'Crédito' : 'Débito'}
                </label>
              ))}
            </div>
          )}

          {(tipoPago === 'SPEI' || tipoPago === 'Credito' || tipoPago === 'Pendiente') && (
            <p className="rounded bg-white/60 px-3 py-2 text-sm text-gray-600">
              {tipoPago === 'SPEI'
                ? 'Verifica la transferencia antes de liberar el producto.'
                : tipoPago === 'Credito'
                ? 'La venta quedará registrada como crédito pendiente de cobro.'
                : 'La venta quedará pendiente de pago.'}
            </p>
          )}
        </div>

        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button className="gm-btn-cancelar flex-1" onClick={() => setModalPago(false)}>
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={guardando}
            className="flex-1 rounded-full bg-purple-400 py-2.5 font-bold text-white transition hover:bg-purple-500 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Cerrar venta'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
