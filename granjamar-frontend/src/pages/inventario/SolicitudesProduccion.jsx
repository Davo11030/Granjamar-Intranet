import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { getEmpresas } from '../../api/destinos'
import { getSolicitudesProduccion, crearPedidoDeSolicitudes, quitarSolicitudProduccion } from '../../api/solicitudesProduccion'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fechaCorta = (f) => {
  const d = new Date(f)
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`
}
const kg = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Reparte `ids` (en orden) en `n` grupos lo más parejos posible: 10 en 3 → 4, 3 y 3.
const repartir = (ids, n) => {
  const asignacion = {}
  const base = Math.floor(ids.length / n)
  const extra = ids.length % n
  let i = 0
  for (let g = 0; g < n; g++) {
    const cuantos = base + (g < extra ? 1 : 0)
    for (let k = 0; k < cuantos; k++) asignacion[ids[i++]] = g
  }
  return asignacion
}

// Lo que Producción le pide a una empresa en consignación. Aún no descuenta inventario: aquí se marcan
// las solicitudes, se elige en cuántos pedidos repartirlas (y cuáles van en cada uno), y se crean.
export default function SolicitudesProduccion() {
  const { IdEmpresa, idEmpresa } = useParams()
  const empresaId = IdEmpresa || idEmpresa
  const navigate = useNavigate()
  const toast = useToast()
  const { puede } = useAuth()
  const puedeEditar = puede('inventario', 'editar')

  const [empresa, setEmpresa] = useState(null)
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [asignacion, setAsignacion] = useState({}) // {idSolicitud: número de pedido (0, 1, 2…)} — solo las marcadas
  const [numPedidos, setNumPedidos] = useState(1)
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    getSolicitudesProduccion(empresaId)
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

  const sinPedido = datos.filter((d) => !d.idPedido)
  const elegidas = sinPedido.filter((d) => asignacion[d.id] !== undefined)
  const idsElegidos = elegidas.map((d) => d.id)
  // No puede haber más pedidos que solicitudes marcadas.
  const maxPedidos = Math.max(1, elegidas.length)
  const pedidosEfectivos = Math.min(numPedidos, maxPedidos)

  const nuevaAsignacion = (ids, n) => repartir(ids, Math.max(1, Math.min(n, ids.length || 1)))

  const alternar = (id) => {
    const marcadas = sinPedido.map((d) => d.id).filter((x) => (x === id ? asignacion[x] === undefined : asignacion[x] !== undefined))
    setAsignacion(nuevaAsignacion(marcadas, numPedidos))
  }
  const todasMarcadas = sinPedido.length > 0 && elegidas.length === sinPedido.length
  const alternarTodas = () =>
    setAsignacion(todasMarcadas ? {} : nuevaAsignacion(sinPedido.map((d) => d.id), numPedidos))

  const cambiarNumero = (n) => {
    setNumPedidos(n)
    setAsignacion(nuevaAsignacion(idsElegidos, n))
  }
  const moverAPedido = (id, g) => setAsignacion((prev) => ({ ...prev, [id]: g }))

  const grupos = Array.from({ length: pedidosEfectivos }, (_, g) => elegidas.filter((d) => asignacion[d.id] === g))
  const hayVacio = grupos.some((g) => g.length === 0)

  const crearPedidos = async () => {
    if (elegidas.length === 0) return toast.advertencia('Marca al menos una solicitud')
    if (hayVacio) return toast.advertencia('Cada pedido necesita al menos una solicitud: reparte las marcadas o baja el número de pedidos')
    setGuardando(true)
    try {
      const r = await crearPedidoDeSolicitudes(Number(empresaId), grupos.map((g) => g.map((d) => d.id)))
      const numeros = r.data.pedidos.map((p) => p.numero).join(', ')
      toast.exito(r.data.pedidos.length === 1 ? `Pedido ${numeros} creado` : `Pedidos creados: ${numeros}`)
      setAsignacion({})
      setNumPedidos(1)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo crear el pedido')
    } finally {
      setGuardando(false)
    }
  }

  const quitar = async (s) => {
    try {
      await quitarSolicitudProduccion(s.id)
      toast.exito('Solicitud quitada')
      setAsignacion((prev) => {
        const nuevo = { ...prev }
        delete nuevo[s.id]
        return nuevo
      })
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo quitar la solicitud')
    }
  }

  return (
    <Layout>
      <PageHeader titulo="Solicitudes de producción" subtitulo={`a ${empresa?.nombre || '…'}`} />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-gray-500">
            Lo que Producción pide a {empresa?.nombre || 'esta empresa'}. Todavía no se descuenta del inventario: marca las que
            quieras, elige en cuántos pedidos repartirlas y crea los pedidos.
          </p>
          <div className="flex gap-2">
            <button className="gm-pill" onClick={() => navigate(`/inventario/consignacion/${empresaId}/pedidos`)}>
              Ver pedidos
            </button>
            <button className="gm-pill" onClick={() => navigate(`/inventario/consignacion/${empresaId}`)}>
              ← Consignación
            </button>
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
                    <th className="w-10">
                      {puedeEditar && sinPedido.length > 0 && (
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-teal"
                          checked={todasMarcadas}
                          onChange={alternarTodas}
                          title="Marcar todas las pendientes"
                        />
                      )}
                    </th>
                    <th className="italic">Fecha</th>
                    <th>Producto</th>
                    <th className="text-right">Cantidad en kgs</th>
                    <th className="text-right">Cantidad en cajas</th>
                    <th>Solicitó</th>
                    <th>Pedido</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {datos.map((s) => {
                    const marcada = asignacion[s.id] !== undefined
                    return (
                      <tr key={s.id} className={marcada ? 'bg-teal/5' : ''}>
                        <td>
                          {!s.idPedido && puedeEditar && (
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-teal"
                              checked={marcada}
                              onChange={() => alternar(s.id)}
                            />
                          )}
                        </td>
                        <td className="whitespace-nowrap">{fechaCorta(s.fecha)}</td>
                        <td className="text-sm font-semibold">{s.descripcion}</td>
                        <td className="text-right text-sm">{kg(s.kilos)}</td>
                        <td className="text-right text-sm">{s.cajas != null ? kg(s.cajas) : '—'}</td>
                        <td className="text-sm text-gray-500">{s.usuario}</td>
                        <td className="text-sm">
                          {s.numeroPedido ? (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{s.numeroPedido}</span>
                          ) : marcada && pedidosEfectivos > 1 ? (
                            <select
                              className="rounded-lg border border-teal bg-white px-2 py-1 text-xs font-semibold text-teal"
                              value={asignacion[s.id]}
                              onChange={(e) => moverAPedido(s.id, Number(e.target.value))}
                            >
                              {Array.from({ length: pedidosEfectivos }, (_, g) => (
                                <option key={g} value={g}>
                                  Pedido nuevo {g + 1}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                              {marcada ? 'Pedido nuevo' : 'Sin pedido'}
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          {!s.idPedido && puedeEditar && (
                            <button className="text-xs font-semibold text-cancelar underline" onClick={() => quitar(s)}>
                              Quitar
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {datos.length === 0 && (
                    <tr>
                      <td colSpan={8} className="!py-12 text-center text-gray-400">
                        Sin solicitudes: aparecen cuando en Producción se toma producto de {empresa?.nombre || 'esta empresa'}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {puedeEditar && elegidas.length > 0 && (
              <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-teal">
                    Repartir las {elegidas.length} marcadas en
                    <select
                      className="rounded-lg border-2 border-gray-300 px-2 py-1 text-black"
                      value={pedidosEfectivos}
                      onChange={(e) => cambiarNumero(Number(e.target.value))}
                    >
                      {Array.from({ length: maxPedidos }, (_, k) => (
                        <option key={k + 1} value={k + 1}>
                          {k + 1}
                        </option>
                      ))}
                    </select>
                    pedido{pedidosEfectivos === 1 ? '' : 's'}
                  </label>
                  <button className="gm-btn-guardar" disabled={guardando || hayVacio} onClick={crearPedidos}>
                    {pedidosEfectivos === 1 ? 'Crear pedido' : `Crear ${pedidosEfectivos} pedidos`}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {grupos.map((g, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-1.5 ${g.length === 0 ? 'bg-red-50 text-cancelar' : 'bg-teal/10 text-gray-700'}`}
                    >
                      <span className="font-bold">Pedido {pedidosEfectivos > 1 ? i + 1 : ''}</span>{' '}
                      {g.length} solicitud{g.length === 1 ? '' : 'es'} · {kg(g.reduce((s, d) => s + Number(d.kilos || 0), 0))} kg
                    </div>
                  ))}
                </div>
                {pedidosEfectivos > 1 && (
                  <p className="mt-2 text-xs text-gray-400">
                    Se repartieron parejo; si quieres otra distribución, cambia el "Pedido nuevo" de cada solicitud en la tabla.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
