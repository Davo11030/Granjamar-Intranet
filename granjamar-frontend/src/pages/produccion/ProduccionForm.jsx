import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import AgregarBoton from '../../components/AgregarBoton'
import Cargando from '../../components/Cargando'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getProductos } from '../../api/inventario'
import {
  crearProduccion,
  editarReporteProduccion,
  getDisponibleProduccion,
  getProducciones,
  getReporteProduccion,
} from '../../api/produccion'
import { fechaHoy } from '../../utils/fecha'

const EPS = 0.001
const n3 = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
const num = (v) => Number(v) || 0
const redondo = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d
// "2026-10-22" → "22/10/2026" (sin pasar por Date, para que la zona horaria no mueva el día)
const fechaLarga = (f) => String(f).slice(0, 10).split('-').reverse().join('/')

let contador = 0
const FILA = () => ({
  key: ++contador,
  codigo: '', articulo: '',
  entrada: '', mp: '', salida: '',
  lote: '', loteOriginal: false, loteNombre: '', // loteNombre: el lote con el que quedó (ver/editar)
  rendimiento: '', porcentaje: '', rendManual: false,
})

const etapaDe = (f) => (num(f.entrada) > 0 ? 'entrada' : num(f.mp) > 0 ? 'mp' : num(f.salida) > 0 ? 'salida' : null)

// Recorre los renglones en orden con la misma lógica del servidor. NO se captura lo que se usó: es TODO lo del
// renglón anterior.
//   Entrada → kilos que salen de lo desbloqueado (no pueden pasar de lo que hay).
//   M.P.    → resultó X; se usó todo lo de la entrada (o M.P.) anterior. Sin entrada antes solo REFERENCIA producto que
//             ya estaba en proceso de otro día (mismo producto y mismos kilos).
//   Salida  → se usó todo lo del renglón anterior; una salida justo después de otra es el rendimiento.
// Devuelve, por renglón, su etapa, el rendimiento/porcentaje sugeridos y un aviso si algo no cuadra.
function derivar(filas, disp) {
  const res = new Map()
  const desbloqueado = { ...(disp?.desbloqueado || {}) }
  const enProceso = { ...(disp?.enProceso || {}) }
  const usadoDesbloqueado = {}
  let prev = null
  let usadoCadena = 0
  for (const f of filas) {
    const etapa = etapaDe(f)
    if (!etapa) continue
    const kilos = num(f[etapa])
    const info = { etapa, rend: null, pct: null, aviso: null }
    if (etapa === 'entrada') {
      const disponible = num(desbloqueado[f.codigo]) - num(usadoDesbloqueado[f.codigo])
      if (disp && kilos > disponible + EPS)
        info.aviso = `Solo hay ${n3(Math.max(disponible, 0))} kg desbloqueados: solicita el desbloqueo de más producto en Producción`
    } else if (etapa === 'mp') {
      if (prev?.etapa === 'entrada') usadoDesbloqueado[prev.codigo] = num(usadoDesbloqueado[prev.codigo]) + prev.kilos
      else if (prev?.etapa === 'mp') enProceso[prev.codigo] = num(enProceso[prev.codigo]) - prev.kilos
      if (prev?.etapa === 'entrada' || prev?.etapa === 'mp') enProceso[f.codigo] = num(enProceso[f.codigo]) + kilos
      else if (disp && kilos > num(enProceso[f.codigo]) + EPS)
        info.aviso = `No hay ${n3(kilos)} kg de ${f.codigo} en proceso: para darle salida repite el mismo producto y los mismos kilos`
    } else {
      if (!prev) info.aviso = 'Una salida necesita un renglón anterior de entrada o de M.P. en procesos'
      else if (prev.etapa === 'salida') {
        info.rend = redondo(kilos)
        info.pct = usadoCadena > 0 ? redondo((kilos / usadoCadena) * 100, 2) : 0
      } else {
        if (prev.etapa === 'entrada') usadoDesbloqueado[prev.codigo] = num(usadoDesbloqueado[prev.codigo]) + prev.kilos
        else enProceso[prev.codigo] = num(enProceso[prev.codigo]) - prev.kilos
        usadoCadena = prev.kilos
        info.rend = redondo(kilos - prev.kilos)
        info.pct = prev.kilos > 0 ? redondo(((kilos - prev.kilos) / prev.kilos) * 100, 2) : 0
      }
    }
    res.set(f.key, info)
    prev = { etapa, codigo: f.codigo, kilos }
  }
  return res
}

// Un reporte de producción por día. Tres modos con la misma pantalla: "nuevo", "ver" (solo lectura) y "editar".
// El origen del producto ya no se elige aquí: se declaró en la tabla general de Producción, y lo que se puede
// ingresar es solo lo que se desbloqueó allá.
export default function ProduccionForm({ modo = 'nuevo' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario, puede } = useAuth()
  const toast = useToast()
  const soloLectura = modo === 'ver'
  const existente = modo !== 'nuevo'

  const [fecha, setFecha] = useState(fechaHoy())
  const [productos, setProductos] = useState([])
  const [filas, setFilas] = useState([FILA()])
  const [disp, setDisp] = useState(null) // { desbloqueado, enProceso } al empezar ese día
  const [guardando, setGuardando] = useState(false)
  const [reporte, setReporte] = useState(null)
  const [cargandoReporte, setCargandoReporte] = useState(existente)
  const [prellenado, setPrellenado] = useState(false)
  const [reportes, setReportes] = useState([]) // todos, para detectar que ya hay uno ese día

  useEffect(() => {
    getProductos().then((r) => setProductos(r.data)).catch(console.error)
    if (!soloLectura) getProducciones().then((r) => setReportes(r.data)).catch(() => {})
  }, [soloLectura])

  useEffect(() => {
    if (!existente) return
    getReporteProduccion(id)
      .then((r) => {
        setReporte(r.data)
        setFecha(String(r.data.fecha).slice(0, 10))
      })
      .catch(console.error)
      .finally(() => setCargandoReporte(false))
  }, [existente, id])

  // Lo desbloqueado y lo que está en proceso (M.P.) al empezar el reporte de esa fecha.
  useEffect(() => {
    if (soloLectura) return
    getDisponibleProduccion(fecha)
      .then((r) => {
        const aMapa = (lista) => Object.fromEntries((lista || []).map((x) => [x.codigo, num(x.kilos)]))
        setDisp({ desbloqueado: aMapa(r.data.desbloqueado), enProceso: aMapa(r.data.enProceso) })
      })
      .catch(() => setDisp(null))
  }, [fecha, soloLectura])

  // Al abrir un reporte existente se llena con sus renglones.
  useEffect(() => {
    if (prellenado || !existente || !reporte || productos.length === 0) return
    const base = reporte.filas.map((r) => {
      const et = String(r.etapa).toLowerCase()
      return {
        ...FILA(), codigo: r.codigo, articulo: r.articulo || '',
        entrada: et === 'entrada' ? String(r.kilos) : '', mp: et === 'mp' ? String(r.kilos) : '', salida: et === 'salida' ? String(r.kilos) : '',
        lote: r.loteOriginal ? '' : r.lote || '', loteOriginal: !!r.loteOriginal, loteNombre: r.loteSalida || '',
        rendimiento: r.rendimiento != null ? String(r.rendimiento) : '', porcentaje: r.porcentaje != null ? String(r.porcentaje) : '',
      }
    })
    // Solo cuenta como "corregido a mano" lo que difiere de lo que se calcularía.
    const calculoBase = derivar(base, null)
    setFilas(
      base.map((f) => {
        const c = calculoBase.get(f.key)
        const manual =
          !!c && c.rend != null && f.rendimiento !== '' &&
          (Math.abs(num(f.rendimiento) - c.rend) > 0.01 || Math.abs(num(f.porcentaje) - c.pct) > 0.01)
        return { ...f, rendManual: manual }
      }),
    )
    setPrellenado(true)
  }, [existente, prellenado, reporte, productos])

  const calculo = derivar(filas, disp)

  const setFila = (key, cambio) => setFilas((p) => p.map((f) => (f.key === key ? { ...f, ...cambio } : f)))
  const elegirProducto = (key, codigo) => {
    const p = productos.find((x) => x.codigo === codigo)
    setFila(key, { codigo, articulo: p?.especie || '' })
  }

  // Un solo reporte por día: si ya hay uno en esa fecha (distinto del que se edita) no se puede crear otro.
  const reporteDelDia = soloLectura ? null : reportes.find((r) => r.fecha === fecha && r.fecha !== id)
  const bloqueadoPorDia = !!reporteDelDia

  const guardar = async () => {
    const validas = filas.filter((f) => etapaDe(f))
    if (validas.length === 0) return toast.advertencia('Captura al menos un movimiento')
    for (const f of validas) {
      if (!f.codigo) return toast.advertencia('Selecciona el producto de cada renglón')
      const aviso = calculo.get(f.key)?.aviso
      if (aviso) return toast.advertencia(`${f.articulo || f.codigo}: ${aviso}`)
    }
    setGuardando(true)
    try {
      const payload = {
        idUsuario: usuario?.id,
        fecha: new Date(fecha).toISOString(),
        filas: validas.map((f) => {
          const etapa = etapaDe(f)
          return {
            codigo: f.codigo, etapa, kilos: num(f[etapa]),
            ...(etapa === 'salida'
              ? {
                  loteOriginal: !!f.loteOriginal, lote: f.loteOriginal ? null : f.lote || null,
                  rendimiento: f.rendManual && f.rendimiento !== '' ? num(f.rendimiento) : null,
                  porcentaje: f.rendManual && f.porcentaje !== '' ? num(f.porcentaje) : null,
                }
              : {}),
          }
        }),
      }
      if (modo === 'editar') {
        await editarReporteProduccion(id, payload)
        toast.exito('Reporte actualizado')
        navigate(`/produccion/${fecha}`)
        return
      }
      await crearProduccion(payload)
      toast.exito('Reporte registrado')
      navigate('/produccion/reportes')
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar el reporte')
    } finally {
      setGuardando(false)
    }
  }

  const titulo = modo === 'ver' ? 'Reporte de producción' : modo === 'editar' ? 'Editar reporte de producción' : 'Produccion'

  if (existente && cargandoReporte) {
    return (
      <Layout>
        <PageHeader titulo={titulo} />
        <Cargando />
      </Layout>
    )
  }
  if (existente && !reporte) {
    return (
      <Layout>
        <PageHeader titulo={titulo} />
        <p className="py-12 text-center text-gray-400">No se encontró el reporte</p>
        <div className="flex justify-center">
          <button className="gm-btn-guardar" onClick={() => navigate('/produccion/reportes')}>
            ← Regresar
          </button>
        </div>
      </Layout>
    )
  }

  const claseKg = `w-24 rounded border border-gray-200 bg-transparent px-1 py-0.5 text-right text-sm outline-none disabled:cursor-not-allowed disabled:border-transparent ${
    soloLectura ? 'disabled:text-gray-700' : 'disabled:text-gray-300'
  }`

  return (
    <Layout>
      <PageHeader titulo={titulo} subtitulo={existente && reporte ? fechaLarga(reporte.fecha) : undefined} />

      <div className="px-6 md:px-10">
        <label className="mb-4 flex items-center gap-3 text-xl font-semibold text-teal">
          Fecha:
          <input
            type="date"
            className="gm-input-amarillo w-44"
            value={fecha}
            disabled={soloLectura}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>

        {bloqueadoPorDia && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-yellow-100 px-4 py-3 text-sm font-semibold text-amber-700">
            ⚠ Ya existe un reporte de producción de esa fecha: solo puede haber uno por día.
            <button className="gm-pill" onClick={() => navigate(`/produccion/${reporteDelDia.fecha}`)}>
              Abrir ese reporte
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="gm-tabla-grid !overflow-visible">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Articulo</th>
                <th>Entrada a produccion</th>
                <th>M.P. en procesos</th>
                <th>Salida de produccion</th>
                <th>Rendimiento</th>
                <th>Porcentaje</th>
                <th>Lote</th>
                {!soloLectura && <th aria-hidden="true" className="sticky right-0 w-8 !border-0 !bg-[var(--color-fondo)] align-middle" />}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const c = calculo.get(f.key)
                const etapa = c?.etapa || etapaDe(f)
                const esSalida = etapa === 'salida'
                const rend = f.rendManual ? f.rendimiento : c?.rend != null ? String(c.rend) : ''
                const pct = f.rendManual ? f.porcentaje : c?.pct != null ? String(c.pct) : ''
                const ocupada = (col) => !!etapa && etapa !== col
                return (
                  <tr key={f.key} className={c?.aviso && !soloLectura ? 'bg-amber-50' : ''}>
                    <td className="align-top">
                      <select
                        className="w-full bg-transparent text-sm outline-none disabled:appearance-none disabled:text-gray-700"
                        value={f.codigo}
                        disabled={soloLectura}
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
                    {['entrada', 'mp', 'salida'].map((col) => (
                      <td key={col} className={`align-top text-right ${ocupada(col) ? 'bg-gray-50' : ''}`}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={claseKg}
                          value={f[col]}
                          disabled={soloLectura || !f.codigo || ocupada(col)}
                          onChange={(e) => setFila(f.key, { [col]: e.target.value })}
                        />
                        {c?.aviso && etapa === col && !soloLectura && (
                          <p className="ml-auto mt-1 max-w-[11rem] text-right text-xs font-semibold text-amber-600">{c.aviso}</p>
                        )}
                      </td>
                    ))}
                    {['rendimiento', 'porcentaje'].map((k) => (
                      <td key={k} className={`align-top ${esSalida ? '' : 'bg-gray-50'}`}>
                        <input
                          type="number"
                          step="any"
                          className={`w-20 bg-transparent text-right text-sm outline-none disabled:cursor-not-allowed ${
                            soloLectura ? 'disabled:text-gray-700' : 'disabled:text-gray-300'
                          }`}
                          value={esSalida ? (k === 'rendimiento' ? rend : pct) : ''}
                          disabled={soloLectura || !esSalida}
                          placeholder="—"
                          onChange={(e) =>
                            setFila(f.key, {
                              rendManual: true,
                              rendimiento: k === 'rendimiento' ? e.target.value : rend,
                              porcentaje: k === 'porcentaje' ? e.target.value : pct,
                            })
                          }
                        />
                        {k === 'porcentaje' && esSalida && pct !== '' && <span className="ml-0.5 text-xs text-gray-400">%</span>}
                      </td>
                    ))}
                    <td className="align-top text-xs text-gray-500">
                      {esSalida &&
                        (soloLectura ? (
                          f.loteNombre || f.lote || '—'
                        ) : (
                          <div className="space-y-1">
                            <input
                              className="w-24 rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs text-gray-800 outline-none disabled:border-transparent disabled:text-gray-500"
                              placeholder="Lote"
                              value={f.loteOriginal ? f.loteNombre || 'Original' : f.lote}
                              disabled={f.loteOriginal}
                              onChange={(e) => setFila(f.key, { lote: e.target.value })}
                            />
                            <button
                              type="button"
                              className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                                f.loteOriginal ? 'bg-teal text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                              }`}
                              title="Guardarlo con el lote del que provenía el producto la primera vez"
                              onClick={() => setFila(f.key, { loteOriginal: !f.loteOriginal, lote: '', loteNombre: '' })}
                            >
                              Original
                            </button>
                          </div>
                        ))}
                    </td>
                    {!soloLectura && (
                      <td className="sticky right-0 w-8 !border-0 !bg-[var(--color-fondo)] align-top">
                        <button aria-label="Quitar fila" onClick={() => setFilas((p) => (p.length === 1 ? p : p.filter((x) => x.key !== f.key)))}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="var(--color-cancelar)" strokeWidth="2" fill="white" />
                            <path d="M7.5 12h9" stroke="var(--color-cancelar)" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!soloLectura && (
          <div className="mt-3">
            <AgregarBoton onClick={() => setFilas((p) => [...p, FILA()])}>Producto</AgregarBoton>
          </div>
        )}

        <div className="mt-8 flex justify-end gap-4">
          {soloLectura ? (
            <>
              <button className="gm-btn-cancelar" onClick={() => navigate('/produccion/reportes')}>
                ← Regresar
              </button>
              {puede('produccion', 'editar') && (
                <button className="gm-btn-guardar" onClick={() => navigate(`/produccion/${id}/editar`)}>
                  Editar
                </button>
              )}
            </>
          ) : (
            <>
              <button className="gm-btn-cancelar" onClick={() => navigate(modo === 'editar' ? `/produccion/${id}` : '/produccion/reportes')}>
                Cancelar
              </button>
              <button className="gm-btn-guardar" onClick={guardar} disabled={guardando || bloqueadoPorDia}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
