import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import AgregarBoton from '../../components/AgregarBoton'
import BadgeEmpresa from '../../components/BadgeEmpresa'
import Cargando from '../../components/Cargando'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getProductos, getUbicaciones } from '../../api/inventario'
import { getEmpresas } from '../../api/destinos'
import { getInventarioProduccion, guardarInventarioProduccion } from '../../api/produccion'
import { fechaHoy } from '../../utils/fecha'
import {
  idsEmpresaPermitidos,
  filtrarPorEmpresasPermitidas,
  nombreEmpresa,
  esEmpresaInterna,
  ordenarOpciones,
} from '../../utils/ubicaciones'

const EPS = 0.001
const n3 = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
const num = (v) => Number(v) || 0
const claveUbicacion = (idExistencia, idDireccion) => `${idExistencia}|${idDireccion}`

let contador = 0
const FILA = () => ({
  key: ++contador,
  id: null, // renglón ya guardado ese día
  codigo: '', articulo: '',
  idUbicacion: '', idExistencia: null, idDireccion: null, lote: '', esConsignacion: false,
  inicial: 0, // lo que cerró el día anterior en este producto y origen (solo en el primer renglón de ese origen)
  entrada: '', salida: '',
  guardadaEntrada: 0, // lo que ese renglón ya había sacado de Conpaq (sigue disponible para él)
  bloqueada: false, numeroPedido: null, // la entrada de consignación ya está en un pedido
})

// TABLA GENERAL de producción: siempre disponible, un día a la vez.
//   Inicial     = lo que cerró el día anterior (bloqueado, no se edita).
//   Entradas    = producto que ingresa a producción (bloqueado): de Conpaq, o se pide a consignación.
//   Salida      = kilos que se DESBLOQUEAN para usarlos en los reportes.
//   Existencia  = Inicial + Entradas − Salida (con 0 el producto ya no aparece al día siguiente).
export default function Produccion() {
  const navigate = useNavigate()
  const { puede } = useAuth()
  const toast = useToast()
  const puedeEditar = puede('produccion', 'editar') || puede('produccion', 'crear')

  const [fecha, setFecha] = useState(fechaHoy())
  const [productos, setProductos] = useState([])
  const [ubicacionesTodas, setUbicacionesTodas] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [desbloqueado, setDesbloqueado] = useState({})
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getProductos().then((r) => setProductos(r.data)).catch(console.error)
    getUbicaciones().then((r) => setUbicacionesTodas(r.data)).catch(console.error)
    getEmpresas().then((r) => setEmpresas(r.data)).catch(console.error)
  }, [])

  const cargar = () => {
    setCargando(true)
    return getInventarioProduccion(fecha)
      .then((r) => {
        setDesbloqueado(r.data.desbloqueado || {})
        setFilas(
          (r.data.filas || []).map((x) => ({
            ...FILA(), id: x.id, codigo: x.codigo, articulo: x.articulo || '', idExistencia: x.idExistencia, idDireccion: x.idDireccion,
            lote: x.lote || '', esConsignacion: !!x.esConsignacion,
            inicial: num(x.inicial), entrada: num(x.entrada) > 0 ? String(x.entrada) : '', salida: num(x.salida) > 0 ? String(x.salida) : '',
            guardadaEntrada: x.esConsignacion ? 0 : num(x.entrada), bloqueada: !!x.bloqueada, numeroPedido: x.numeroPedido,
          })),
        )
      })
      .catch((e) => toast.error(e.response?.data?.mensaje || 'No se pudo cargar la tabla de producción'))
      .finally(() => setCargando(false))
  }
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  // Producción solo puede tomar producto de nuestro inventario (Granjamar/Conpaq) o de consignación — nunca de resguardo.
  const permitidas = idsEmpresaPermitidos(empresas, { interna: true, consignacion: true })
  const ubicaciones = filtrarPorEmpresasPermitidas(ubicacionesTodas, permitidas)
  const esConsignacionEmpresa = (idEmpresa) =>
    empresas.find((e) => String(e.id) === String(idEmpresa))?.tipo?.toLowerCase() === 'consignacion'

  // Lo que los renglones guardados ya sacaron de cada lote de Conpaq: sigue "disponible" para ellos.
  const devueltoPor = new Map()
  for (const f of filas)
    if (f.guardadaEntrada > 0 && f.idExistencia)
      devueltoPor.set(claveUbicacion(f.idExistencia, f.idDireccion), (devueltoPor.get(claveUbicacion(f.idExistencia, f.idDireccion)) || 0) + f.guardadaEntrada)
  const disponibleDe = (u) => num(u.cantidadKilos) + (devueltoPor.get(claveUbicacion(u.idExistencia, u.idDireccion)) || 0)
  const opcionesPara = (codigo) =>
    ubicaciones.filter((u) => u.codigoProducto === codigo && (num(u.cantidadKilos) > 0 || devueltoPor.has(claveUbicacion(u.idExistencia, u.idDireccion))))

  const setFila = (key, cambio) => setFilas((p) => p.map((f) => (f.key === key ? { ...f, ...cambio } : f)))

  // El origen NO se propone: se elige en la primera entrada de cada renglón y desde entonces queda fijo.
  const elegirProducto = (key, codigo) => {
    const p = productos.find((x) => x.codigo === codigo)
    setFila(key, { codigo, articulo: p?.especie || '', idUbicacion: '', idExistencia: null, idDireccion: null, lote: '', esConsignacion: false })
  }
  const elegirOrigen = (key, idUbicacion) => {
    const f = filas.find((x) => x.key === key)
    const u = opcionesPara(f.codigo).find((x) => String(x.id) === idUbicacion)
    setFila(key, {
      idUbicacion, idExistencia: u?.idExistencia || null, idDireccion: u?.idDireccion || null, lote: u?.lote || '',
      esConsignacion: !!u && esConsignacionEmpresa(u.idEmpresa),
    })
  }

  // Cada producto y origen es su propio grupo de renglones: su Inicial, sus entradas y lo que se desbloquea.
  const claveGrupo = (f) => `${f.codigo}|${f.idExistencia || ''}|${f.idDireccion || ''}`
  const delGrupo = (f) => filas.filter((x) => claveGrupo(x) === claveGrupo(f))
  const existenciaDe = (f) => num(f.inicial) + num(f.entrada) - num(f.salida)
  // Lo que se puede desbloquear de un origen = su Inicial + sus entradas de hoy.
  const totalGrupo = (f) => delGrupo(f).reduce((t, x) => t + num(x.inicial) + num(x.entrada), 0)
  const salidaGrupo = (f) => delGrupo(f).reduce((t, x) => t + num(x.salida), 0)

  const guardar = async () => {
    for (const f of filas) {
      if (!(num(f.entrada) > 0 || num(f.salida) > 0)) continue
      const nombre = f.articulo || f.codigo
      if (!f.codigo) return toast.advertencia('Selecciona el producto de cada renglón')
      if (!f.idExistencia) return toast.advertencia(`Selecciona el origen de ${nombre}`)
      if (num(f.entrada) > 0 && !f.esConsignacion && !f.bloqueada) {
        const u = ubicaciones.find((x) => x.idExistencia === f.idExistencia && x.idDireccion === f.idDireccion)
        if (u && num(f.entrada) > disponibleDe(u) + EPS)
          return toast.advertencia(`La entrada de ${nombre} supera el stock del origen (${n3(disponibleDe(u))} kg)`)
      }
      if (salidaGrupo(f) > totalGrupo(f) + EPS)
        return toast.advertencia(`No puedes desbloquear más ${nombre} del que hay en producción de ese origen (${n3(totalGrupo(f))} kg)`)
    }
    const lineas = filas
      .filter((f) => num(f.entrada) > 0 || num(f.salida) > 0)
      .map((f) => ({
        id: f.id, codigo: f.codigo, entrada: num(f.entrada), salida: num(f.salida), idExistencia: f.idExistencia, idDireccion: f.idDireccion,
      }))
    setGuardando(true)
    try {
      await guardarInventarioProduccion(fecha, lineas)
      toast.exito('Tabla de producción guardada')
      await cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la tabla de producción')
    } finally {
      setGuardando(false)
    }
  }

  const hayDesbloqueado = Object.entries(desbloqueado).filter(([, k]) => num(k) > EPS)

  return (
    <Layout>
      <PageHeader titulo="Produccion" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-3 text-xl font-semibold text-teal">
            Fecha:
            <input type="date" className="gm-input-amarillo w-44" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button className="gm-pill" onClick={() => navigate('/produccion/reportes')}>
              Reportes diarios
            </button>
            {puede('produccion', 'crear') && (
              <button className="gm-pill" onClick={() => navigate('/produccion/nueva')}>
                Nuevo reporte
              </button>
            )}
          </div>
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="gm-tabla-grid !overflow-visible">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Descripcion</th>
                    <th>Origen</th>
                    <th>Inicial</th>
                    <th>Entradas</th>
                    <th>Salida</th>
                    <th>Existencia</th>
                    {puedeEditar && <th aria-hidden="true" className="sticky right-0 w-8 !border-0 !bg-[var(--color-fondo)] align-middle" />}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const opciones = opcionesPara(f.codigo)
                    const seleccionada = ubicaciones.find((o) => String(o.idExistencia) === String(f.idExistencia) && String(o.idDireccion) === String(f.idDireccion))
                    // Un renglón que ya trae producto de días anteriores tiene su origen fijo desde su primera entrada.
                    const origenFijo = num(f.inicial) > 0
                    const existencia = existenciaDe(f)
                    const excede = salidaGrupo(f) > totalGrupo(f) + EPS
                    return (
                      <tr key={f.key} className={excede ? 'bg-red-50' : ''}>
                        <td className="align-top">
                          <select
                            className="w-full bg-transparent text-sm outline-none disabled:appearance-none disabled:text-gray-700"
                            value={f.codigo}
                            disabled={!puedeEditar || !f.nueva}
                            onChange={(e) => elegirProducto(f.key, e.target.value)}
                          >
                            <option value="">▼</option>
                            {productos.map((p) => (
                              <option key={p.codigo} value={p.codigo}>
                                {p.codigo}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="align-top text-sm">{f.articulo || '—'}</td>
                        <td className="align-top">
                          {f.codigo && (
                            <>
                              <select
                                className="w-full bg-transparent text-xs outline-none disabled:appearance-none disabled:text-gray-700"
                                value={f.idUbicacion || (seleccionada ? String(seleccionada.id) : '')}
                                disabled={!puedeEditar || f.bloqueada || origenFijo}
                                onChange={(e) => elegirOrigen(f.key, e.target.value)}
                              >
                                <option value="">{f.idExistencia && !opciones.some((o) => seleccionada && o.id === seleccionada.id) ? f.lote || 'Origen' : 'Selecciona…'}</option>
                                {ordenarOpciones(opciones, empresas).map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {nombreEmpresa(empresas, u.idEmpresa)} — {u.lote} ({n3(disponibleDe(u))} kg)
                                  </option>
                                ))}
                              </select>
                              {(seleccionada || f.numeroPedido) && (
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  {seleccionada && (
                                    <BadgeEmpresa
                                      nombre={nombreEmpresa(empresas, seleccionada.idEmpresa)}
                                      esPropia={esEmpresaInterna(empresas, seleccionada.idEmpresa)}
                                    />
                                  )}
                                  {f.numeroPedido && (
                                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">{f.numeroPedido}</span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="bg-gray-50 align-top text-right text-sm text-gray-600">{num(f.inicial) > 0 ? n3(f.inicial) : '—'}</td>
                        <td className="align-top">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="w-24 bg-transparent text-right text-sm outline-none disabled:cursor-not-allowed disabled:text-gray-400"
                            value={f.entrada}
                            disabled={!puedeEditar || !f.codigo}
                            onChange={(e) => setFila(f.key, { entrada: e.target.value })}
                          />
                        </td>
                        <td className="align-top">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className={`w-24 bg-transparent text-right text-sm outline-none disabled:cursor-not-allowed disabled:text-gray-400 ${excede ? 'text-red-600' : ''}`}
                            value={f.salida}
                            disabled={!puedeEditar || !f.codigo}
                            onChange={(e) => setFila(f.key, { salida: e.target.value })}
                          />
                        </td>
                        <td className="bg-gray-50 align-top text-right text-sm font-semibold">{f.codigo ? n3(existencia) : '—'}</td>
                        {puedeEditar && (
                          <td className="sticky right-0 w-8 !border-0 !bg-[var(--color-fondo)] align-top">
                            {!f.bloqueada && f.nueva && (
                              <button aria-label="Quitar fila" onClick={() => setFilas((p) => p.filter((x) => x.key !== f.key))}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="var(--color-cancelar)" strokeWidth="2" fill="white" />
                                  <path d="M7.5 12h9" stroke="var(--color-cancelar)" strokeWidth="2.2" strokeLinecap="round" />
                                </svg>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {filas.length === 0 && (
                    <tr>
                      <td colSpan={8} className="!py-12 text-center text-gray-400">
                        No hay producto en producción: agrega un producto para ingresarlo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {puedeEditar && (
              <div className="mt-3">
                <AgregarBoton onClick={() => setFilas((p) => [...p, { ...FILA(), nueva: true }])}>Producto</AgregarBoton>
              </div>
            )}

            {hayDesbloqueado.length > 0 && (
              <p className="mt-4 text-sm text-gray-500">
                Desbloqueado para los reportes:{' '}
                {hayDesbloqueado.map(([codigo, k]) => `${codigo} ${n3(k)} kg`).join(' · ')}
              </p>
            )}

            {puedeEditar && (
              <div className="mt-8 flex justify-end">
                <button className="gm-btn-guardar" onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
