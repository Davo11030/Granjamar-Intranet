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
}
const nombreModulo = (t) => MODULOS[t?.toLowerCase()] || (t ? t[0].toUpperCase() + t.slice(1) : '—')

const BADGE = {
  CREAR: 'bg-green-100 text-green-700',
  MODIFICAR: 'bg-amber-100 text-amber-700',
  ELIMINAR: 'bg-red-100 text-red-700',
}
const badge = (a) => BADGE[a?.toUpperCase()] || 'bg-gray-100 text-gray-600'

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
  return String(v)
}

export default function Movimientos() {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState({ tabla: '', accion: '', usuario: '', desde: '', hasta: '' })
  const [seleccion, setSeleccion] = useState(null)

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

  const modulos = useMemo(() => [...new Set(datos.map((d) => d.tabla).filter(Boolean))].sort(), [datos])
  const usuarios = useMemo(
    () => [...new Set(datos.map((d) => d.usuario).filter(Boolean))].sort(),
    [datos],
  )

  // Un renglón por registro (p. ej. "Venta #3"), no uno por cada actualización — el detalle
  // completo de actualizaciones se ve con el botón Historial.
  const registros = useMemo(() => {
    const grupos = new Map()
    for (const ev of datos) {
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
  }, [datos])

  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(registros, 25)

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

  useEffect(() => {
    if (!registro) return
    setCargando(true)
    // Un registro puede abarcar varios ids (embarque con varios destinos): se juntan todos sus eventos.
    const ids = registro.ids ? [...registro.ids] : [registro.idRegistro]
    Promise.all(ids.map((id) => getMovimientos(new URLSearchParams({ tabla: registro.tabla, registro: String(id) }).toString())))
      .then((rs) => setEventos(rs.flatMap((r) => r.data).sort((a, b) => new Date(a.fecha) - new Date(b.fecha))))
      .catch(() => setEventos([]))
      .finally(() => setCargando(false))
  }, [registro])

  if (!registro) return null

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      titulo={`${nombreModulo(registro.tabla)} #${registro.referencia ?? registro.idRegistro} — Historial`}
    >
      {cargando ? (
        <Cargando texto="Cargando historial…" />
      ) : eventos.length === 0 ? (
        <p className="text-sm text-gray-400">No se encontraron actualizaciones.</p>
      ) : (
        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {eventos.map((ev, i) => (
            <EventoHistorial key={ev.id} evento={ev} esUltimo={i === eventos.length - 1} />
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button className="gm-btn-guardar" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}

function EventoHistorial({ evento, esUltimo }) {
  const antes = parse(evento.datosAnteriores)
  const despues = parse(evento.datosNuevos)
  const accion = evento.accion?.toUpperCase()
  const claves = [...new Set([...(antes ? Object.keys(antes) : []), ...(despues ? Object.keys(despues) : [])])]

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

      {claves.length === 0 ? (
        <p className="text-sm text-gray-400">Sin detalle guardado para este evento.</p>
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
                  <td className="py-1.5 pr-4 align-top font-medium text-gray-700">{k}</td>
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
                <td className="py-1.5 pr-4 align-top font-medium text-gray-700">{k}</td>
                <td className="py-1.5 align-top text-gray-600">{muestra((despues ?? antes)?.[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
