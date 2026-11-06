import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import NotaAdmin from '../../components/NotaAdmin'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import usePaginacion from '../../hooks/usePaginacion'
import { getMovimientos } from '../../api/historial'
import { formatearFecha, formatearHora, formatearFechaHora } from '../../utils/fecha'

const MODULOS = {
  venta: 'Venta',
  ventas: 'Venta',
  compras: 'Entrada / Compra',
  embarques: 'Embarque',
  embarque: 'Embarque',
  empresas: 'Empresa',
  direcciones: 'Destino',
  existencias: 'Existencia',
  clientes: 'Cliente',
  usuarios: 'Usuario',
  solicitudes_contrasena: 'Solicitud de contraseña',
  producciones: 'Producción',
  productos: 'Producto',
  claves_sat: 'Clave SAT',
  choferes: 'Operador',
  tractocamiones: 'Tractocamión',
  cajas_tractocamion: 'Caja de tractocamión',
  marcas_tractocamion: 'Marca de tractocamión',
  ubicacion_producto: 'Inventario (ubicación)',
  produccion_inventario: 'Producción (tabla general)',
  solicitudes_produccion: 'Solicitud de producción',
  pedidos_consignacion: 'Pedido de consignación',
  documentos: 'Documento',
  configuracion_documento: 'Configuración de documentos',
}

// Los módulos cuyos registros MUEVEN producto (entran, salen o cambian de lugar/cantidad); el resto es uso del sistema
// (usuarios, catálogos, permisos, documentos…).
const TABLAS_PRODUCTO = new Set([
  'compras',
  'embarque',
  'embarques',
  'venta',
  'ventas',
  'producciones',
  'produccion_inventario',
  'ubicacion_producto',
  'existencias',
])
const nombreModulo = (t) => MODULOS[t?.toLowerCase()] || (t ? t[0].toUpperCase() + t.slice(1) : '—')

const BADGE = {
  CREAR: 'bg-green-100 text-green-700',
  MODIFICAR: 'bg-amber-100 text-amber-700',
  ELIMINAR: 'bg-red-100 text-red-700',
}
const badge = (a) => BADGE[a?.toUpperCase()] || 'bg-gray-100 text-gray-600'

// "2027-03-01T00:00:00" → "01/03/2027" sin pasar por Date (la zona horaria movería el día).
const soloFecha = (v) => String(v).slice(0, 10).split('-').reverse().join('/')

const parse = (s) => {
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

// Las líneas de producto (Detalles) se guardan como [{ Producto, Descripcion, Kilos, Lote? }];
// se muestran como una lista legible en vez de JSON crudo.
const esListaDetalles = (v) =>
  Array.isArray(v) && v.every((x) => x && typeof x === 'object' && 'Descripcion' in x)

const n3 = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 3 })

const muestra = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  if (esListaDetalles(v)) {
    if (v.length === 0) return '—'
    return (
      <ul className="space-y-0.5">
        {v.map((d, i) => (
          <li key={i}>
            <span className="font-semibold">{d.Producto || '—'}</span>
            {d.Lote && <span className="text-gray-400"> (lote {d.Lote})</span>} — {d.Descripcion || '—'} —{' '}
            {n3(d.Kilos)} kg
          </li>
        ))}
      </ul>
    )
  }
  if (typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return soloFecha(v)
  return String(v)
}

export default function Movimientos() {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState({ tabla: '', accion: '', usuario: '', desde: '', hasta: '' })
  const [seleccion, setSeleccion] = useState(null)
  // Solo los movimientos de producto (entradas, embarques, ventas, producción, inventario), sin el uso del sistema.
  const [soloProducto, setSoloProducto] = useState(false)

  const cargar = (f = filtros) => {
    setCargando(true)
    setError('')
    const p = new URLSearchParams()
    Object.entries(f).forEach(([k, v]) => v && p.append(k, v))
    getMovimientos(p.toString())
      .then((r) => setDatos(r.data))
      .catch((e) => {
        setDatos([])
        setError(
          e.response?.status === 403
            ? 'Solo el administrador puede consultar la auditoría.'
            : 'No se pudo cargar la auditoría.',
        )
      })
      .finally(() => setCargando(false))
  }
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const datosVista = useMemo(
    () => (soloProducto ? datos.filter((d) => TABLAS_PRODUCTO.has(String(d.tabla || '').toLowerCase())) : datos),
    [datos, soloProducto],
  )
  const modulos = useMemo(() => [...new Set(datosVista.map((d) => d.tabla).filter(Boolean))].sort(), [datosVista])
  const usuarios = useMemo(
    () => [...new Set(datosVista.map((d) => d.usuario).filter(Boolean))].sort(),
    [datosVista],
  )

  // Un renglón por registro (p. ej. "Venta #3"), no uno por cada actualización — el detalle
  // completo de actualizaciones se ve con el botón Historial.
  const registros = useMemo(() => {
    const grupos = new Map()
    for (const ev of datosVista) {
      // Los registros con número propio (embarques) se agrupan por ese número: un embarque a varios destinos son
      // varios registros con el mismo número y se ve como uno solo.
      const clave = `${ev.tabla}#${ev.referencia ?? ev.idRegistro}`
      if (!grupos.has(clave)) grupos.set(clave, { tabla: ev.tabla, idRegistro: ev.idRegistro, referencia: ev.referencia, ids: new Set(), eventos: [] })
      grupos.get(clave).ids.add(ev.idRegistro)
      grupos.get(clave).eventos.push(ev)
    }
    return [...grupos.values()]
      .map((g) => {
        const ordenados = [...g.eventos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        return { ...g, ultimo: ordenados[0], total: ordenados.length }
      })
      .sort((a, b) => new Date(b.ultimo.fecha) - new Date(a.ultimo.fecha))
  }, [datosVista])

  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(registros, 20)

  const limpiar = () => {
    const vacio = { tabla: '', accion: '', usuario: '', desde: '', hasta: '' }
    setFiltros(vacio)
    setPagina(1)
    cargar(vacio)
  }

  return (
    <Layout>
      <PageHeader titulo="Movimientos" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex justify-center">
          <NotaAdmin>
            Bitácora de auditoría: registra <strong>quién</strong> hizo <strong>qué</strong> y{' '}
            <strong>cuándo</strong> (fecha y hora) en cada módulo. Un renglón por registro — usa{' '}
            <strong>Historial</strong> para ver todas sus actualizaciones. Disponible únicamente
            para el administrador.
          </NotaAdmin>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            aria-pressed={soloProducto}
            title="Ver solo lo que mueve producto (entradas, embarques, ventas, producción e inventario), sin el uso del sistema"
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              soloProducto ? 'bg-teal text-white' : 'border-2 border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => {
              setSoloProducto((v) => !v)
              // El módulo elegido antes ya no tiene por qué existir en la nueva vista: se recarga sin él.
              if (filtros.tabla) {
                const nuevos = { ...filtros, tabla: '' }
                setFiltros(nuevos)
                cargar(nuevos)
              }
              setPagina(1)
            }}
          >
            Solo movimientos de producto
          </button>
          {soloProducto && <span className="text-xs text-gray-400">Entradas, embarques, ventas, producción e inventario</span>}
        </div>

        {/* Filtros */}
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-gray-50 p-4">
          <label className="text-xs text-gray-500">
            Módulo
            <select
              className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm outline-none"
              value={filtros.tabla}
              onChange={(e) => setFiltros({ ...filtros, tabla: e.target.value })}
            >
              <option value="">Todos</option>
              {modulos.map((m) => (
                <option key={m} value={m}>
                  {nombreModulo(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Acción
            <select
              className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm outline-none"
              value={filtros.accion}
              onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })}
            >
              <option value="">Todas</option>
              <option value="CREAR">Creó</option>
              <option value="MODIFICAR">Modificó</option>
              <option value="ELIMINAR">Eliminó</option>
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Usuario
            <select
              className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm outline-none"
              value={filtros.usuario}
              onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })}
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Desde
            <input
              type="date"
              className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm outline-none"
              value={filtros.desde}
              onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
            />
          </label>
          <label className="text-xs text-gray-500">
            Hasta
            <input
              type="date"
              className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm outline-none"
              value={filtros.hasta}
              onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
            />
          </label>
          <button
            className="gm-btn-guardar py-1.5"
            onClick={() => {
              setPagina(1)
              cargar()
            }}
          >
            Filtrar
          </button>
          <button className="text-sm text-gray-500 hover:underline" onClick={limpiar}>
            Limpiar
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="gm-tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Usuario</th>
                    <th>Registro</th>
                    <th>Última acción</th>
                    <th>Actualizaciones</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((r) => (
                    <tr key={`${r.tabla}#${r.referencia ?? r.idRegistro}`}>
                      <td className="whitespace-nowrap">{formatearFecha(r.ultimo.fecha)}</td>
                      <td className="whitespace-nowrap">{formatearHora(r.ultimo.fecha)}</td>
                      <td>
                        {r.ultimo.usuario || '—'}
                        {r.ultimo.puesto && (
                          <span className="block text-xs capitalize text-gray-400">{r.ultimo.puesto}</span>
                        )}
                      </td>
                      <td className="font-semibold">
                        {nombreModulo(r.tabla)} #{r.referencia ?? r.idRegistro}
                        {(r.ultimo.productos || r.eventos.find((e) => e.productos)?.productos) && (
                          <span className="block text-xs font-normal text-gray-500">
                            {r.ultimo.productos || r.eventos.find((e) => e.productos)?.productos}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge(r.ultimo.accion)}`}>
                          {r.ultimo.accion}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500">
                        {r.total} {r.total === 1 ? 'evento' : 'eventos'}
                      </td>
                      <td className="text-right">
                        <button className="gm-pill" onClick={() => setSeleccion(r)}>
                          Historial
                        </button>
                      </td>
                    </tr>
                  ))}
                  {registros.length === 0 && !error && (
                    <tr>
                      <td colSpan={7} className="text-center !py-12 text-gray-400">
                        Sin movimientos registrados
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

      <HistorialRegistro registro={seleccion} onCerrar={() => setSeleccion(null)} />
    </Layout>
  )
}

// Todas las actualizaciones de un registro (Venta #3, Embarque #4, etc.), de más antigua a
// más reciente — se piden sin filtros para no ocultar eventos que no cumplan el filtro activo.
function HistorialRegistro({ registro, onCerrar }) {
  const [eventos, setEventos] = useState([])
  const [cargando, setCargando] = useState(false)
  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(eventos, 20)

  useEffect(() => {
    if (!registro) return
    setCargando(true)
    setPagina(1)
    // Un registro puede abarcar varios ids (embarque con varios destinos): se juntan todos sus eventos.
    const ids = registro.ids ? [...registro.ids] : [registro.idRegistro]
    Promise.all(ids.map((id) => getMovimientos(new URLSearchParams({ tabla: registro.tabla, registro: String(id) }).toString())))
      .then((rs) => setEventos(rs.flatMap((r) => r.data).sort((a, b) => new Date(a.fecha) - new Date(b.fecha))))
      .catch(() => setEventos([]))
      .finally(() => setCargando(false))
  }, [registro, setPagina])

  if (!registro) return null

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho="max-w-4xl"
      titulo={`${nombreModulo(registro.tabla)} #${registro.referencia ?? registro.idRegistro} — Historial`}
    >
      {cargando ? (
        <Cargando texto="Cargando historial…" />
      ) : eventos.length === 0 ? (
        <p className="text-sm text-gray-400">No se encontraron actualizaciones.</p>
      ) : (
        <>
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
            {datosPaginados.map((ev) => (
              <EventoHistorial key={ev.id} evento={ev} esUltimo={ev === eventos[eventos.length - 1]} />
            ))}
          </div>
          <Paginacion total={total} porPagina={porPagina} paginaActual={pagina} onCambiar={setPagina} />
        </>
      )}

      <div className="mt-6 flex justify-end">
        <button className="gm-btn-guardar" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}

// ── Detalle de PRODUCTO de un movimiento ────────────────────────────────────────────────────────────────
// Las líneas de producto de la auditoría (Detalles: producto, lote, bodega, kilos…) se muestran como una tabla; al
// MODIFICAR se marca qué renglones son nuevos, cuáles se quitaron y qué cambió en los que siguen.
const COLUMNAS_PRODUCTO = [
  ['Producto', 'Código'],
  ['Descripcion', 'Descripción'],
  ['Etapa', 'Etapa'],
  ['Lote', 'Lote'],
  ['Origen', 'Origen'],
  ['Bodega', 'Bodega'],
  ['Documento', 'Documento'],
  ['Costo', 'Costo'],
  ['Caducidad', 'Caducidad'],
  ['Entrada', 'Entrada (kg)'],
  ['Salida (desbloqueo)', 'Desbloqueo (kg)'],
  ['Kilos', 'Kilos'],
  ['Usado', 'Usó (kg)'],
  ['Rendimiento', 'Rendimiento (kg)'],
  ['Porcentaje', '%'],
]
const NUMERICAS = new Set(['Costo', 'Entrada', 'Salida (desbloqueo)', 'Kilos', 'Usado', 'Rendimiento', 'Porcentaje'])
const esLinea = (x) => x && typeof x === 'object' && !Array.isArray(x) && ('Producto' in x || 'Descripcion' in x)
const lineasDe = (obj) => {
  if (!obj) return null
  const k = Object.keys(obj).find((x) => x.toLowerCase() === 'detalles')
  return k && Array.isArray(obj[k]) && obj[k].every(esLinea) ? { clave: k, lineas: obj[k] } : null
}
const celda = (col, v) => {
  if (v === null || v === undefined || v === '') return '—'
  if (col === 'Caducidad' && typeof v === 'string') return soloFecha(v)
  if (typeof v === 'number') return col === 'Costo' ? v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : n3(v)
  return String(v)
}
// Misma línea en "antes" y "después": producto + lote + etapa + origen + bodega (y su número de aparición).
const claveLinea = (l, vistas) => {
  const base = [l.Producto, l.Lote, l.Etapa, l.Origen, l.Bodega].map((x) => x ?? '').join('|')
  const n = (vistas[base] = (vistas[base] || 0) + 1)
  return base + '#' + n
}

function TablaProductos({ antes, despues, accion }) {
  const modificar = accion === 'MODIFICAR' && antes && despues
  const actuales = despues ?? antes ?? []
  let filas
  if (modificar) {
    const va = {}
    const mapaAntes = new Map(antes.map((l) => [claveLinea(l, va), l]))
    const vd = {}
    filas = actuales.map((l) => {
      const k = claveLinea(l, vd)
      const previa = mapaAntes.get(k)
      mapaAntes.delete(k)
      const cambio = previa && JSON.stringify(previa) !== JSON.stringify(l)
      return { linea: l, previa, estado: !previa ? 'nuevo' : cambio ? 'cambio' : 'igual' }
    })
    for (const l of mapaAntes.values()) filas.push({ linea: l, previa: null, estado: 'quitado' })
  } else {
    filas = actuales.map((l) => ({ linea: l, previa: null, estado: 'igual' }))
  }
  const presentes = new Set(filas.flatMap((f) => [...Object.keys(f.linea), ...(f.previa ? Object.keys(f.previa) : [])]))
  const columnas = COLUMNAS_PRODUCTO.filter(([k]) => presentes.has(k))
  const total = (k) => filas.filter((f) => f.estado !== 'quitado').reduce((t, f) => t + Number(f.linea[k] || 0), 0)
  const colKg = ['Kilos', 'Entrada'].find((k) => presentes.has(k))
  const ESTILO = { nuevo: 'bg-green-50', cambio: 'bg-amber-50', quitado: 'bg-red-50 text-gray-400 line-through', igual: '' }
  const ETIQUETA = { nuevo: 'Nuevo', cambio: 'Cambió', quitado: 'Quitado', igual: '' }

  return (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            {modificar && <th className="py-1.5 pr-3" />}
            {columnas.map(([k, titulo]) => (
              <th key={k} className={`py-1.5 pr-3 ${NUMERICAS.has(k) ? 'text-right' : ''}`}>
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className={ESTILO[f.estado]}>
              {modificar && (
                <td className="py-1.5 pr-3 align-top text-xs font-semibold no-underline">
                  {f.estado !== 'igual' && (
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        f.estado === 'nuevo' ? 'bg-green-100 text-green-700' : f.estado === 'quitado' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {ETIQUETA[f.estado]}
                    </span>
                  )}
                </td>
              )}
              {columnas.map(([k]) => {
                const nuevo = f.linea[k]
                const previo = f.previa?.[k]
                const distinto = f.estado === 'cambio' && JSON.stringify(previo) !== JSON.stringify(nuevo)
                return (
                  <td key={k} className={`py-1.5 pr-3 align-top ${NUMERICAS.has(k) ? 'text-right' : ''} ${k === 'Producto' ? 'font-semibold' : ''}`}>
                    {distinto ? (
                      <>
                        <span className="text-gray-400 line-through">{celda(k, previo)}</span>
                        <span className="font-semibold text-amber-700"> → {celda(k, nuevo)}</span>
                      </>
                    ) : (
                      celda(k, nuevo)
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {colKg && filas.length > 1 && (
          <tfoot>
            <tr className="border-t border-gray-200 font-semibold">
              {modificar && <td />}
              {columnas.map(([k], i) => (
                <td key={k} className={`py-1.5 pr-3 ${NUMERICAS.has(k) ? 'text-right' : ''}`}>
                  {i === 0 ? 'Total' : k === colKg ? n3(total(k)) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

const etiquetaCampo = (k) => (k ? k[0].toUpperCase() + k.slice(1) : k)

function EventoHistorial({ evento, esUltimo }) {
  const antes = parse(evento.datosAnteriores)
  const despues = parse(evento.datosNuevos)
  const accion = evento.accion?.toUpperCase()
  const detAntes = lineasDe(antes)
  const detDespues = lineasDe(despues)
  const claveDetalles = (detDespues || detAntes)?.clave
  // Los renglones de producto van en su propia tabla; aquí quedan los demás datos del registro.
  const claves = [...new Set([...(antes ? Object.keys(antes) : []), ...(despues ? Object.keys(despues) : [])])].filter((k) => k !== claveDetalles)

  return (
    <div className={`rounded-xl border p-4 ${esUltimo ? 'border-teal/40 bg-teal/5' : 'border-gray-200'}`}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge(accion)}`}>{accion}</span>
        <span>
          <strong>{evento.usuario}</strong>
          {evento.puesto && <span className="capitalize text-gray-400"> ({evento.puesto})</span>}
        </span>
        <span>{formatearFechaHora(evento.fecha)}</span>
      </div>

      {(detAntes || detDespues) && (
        <>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-marca">Productos</p>
          <TablaProductos antes={detAntes?.lineas} despues={detDespues?.lineas} accion={accion} />
        </>
      )}

      {claves.length === 0 ? (
        !(detAntes || detDespues) && <p className="text-sm text-gray-400">Sin detalle guardado para este evento.</p>
      ) : accion === 'MODIFICAR' ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="py-1.5 pr-4">Campo</th>
              <th className="py-1.5 pr-4">Antes</th>
              <th className="py-1.5">Después</th>
            </tr>
          </thead>
          <tbody>
            {claves.map((k) => {
              const a = antes?.[k]
              const d = despues?.[k]
              const cambio = JSON.stringify(a) !== JSON.stringify(d)
              return (
                <tr key={k} className={cambio ? 'bg-amber-50' : ''}>
                  <td className="py-1.5 pr-4 align-top font-medium text-gray-700">{etiquetaCampo(k)}</td>
                  <td className="py-1.5 pr-4 align-top text-gray-500">{muestra(a)}</td>
                  <td className={`py-1.5 align-top ${cambio ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>
                    {muestra(d)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="py-1.5 pr-4">Campo</th>
              <th className="py-1.5">{accion === 'ELIMINAR' ? 'Valor eliminado' : 'Valor'}</th>
            </tr>
          </thead>
          <tbody>
            {claves.map((k) => (
              <tr key={k}>
                <td className="py-1.5 pr-4 align-top font-medium text-gray-700">{etiquetaCampo(k)}</td>
                <td className="py-1.5 align-top text-gray-600">{muestra((despues ?? antes)?.[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
