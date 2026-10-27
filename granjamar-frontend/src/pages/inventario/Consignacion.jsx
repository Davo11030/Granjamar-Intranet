import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import usePaginacion from '../../hooks/usePaginacion'
import { getUbicacionesPorEmpresa, getProductos } from '../../api/inventario'
import { getSolicitudesProduccion } from '../../api/solicitudesProduccion'
import { crearEntrada } from '../../api/entradas'
import { getEmpresas, getDirecciones } from '../../api/destinos'
import { getChoferes, getTractocamiones } from '../../api/operadores'

const kg = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Un ingreso de consignación no lleva lote propio: lo identifica el folio de la empresa, y un mismo
// folio puede traer varios productos con kilos distintos.
const FILA_VACIA = { codigoProducto: '', kilos: '' }
const FORM_VACIO = { folio: '', idDireccion: '', idChofer: '', idTractocamion: '', filas: [{ ...FILA_VACIA }] }

export default function InventarioConsignacion() {
  const { idEmpresa, IdEmpresa } = useParams()
  const empresaId = idEmpresa || IdEmpresa
  const navigate = useNavigate()
  const toast = useToast()
  const { usuario, puede } = useAuth()

  const [datos, setDatos] = useState([])
  const [empresa, setEmpresa] = useState(null)
  const [productos, setProductos] = useState([])
  const [productosPorCodigo, setProductosPorCodigo] = useState({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0) // de Producción, sin pedido aún

  // modal "Producto" — producto NUEVO que llega directo a esta empresa (no viene de nuestro inventario local)
  const [modal, setModal] = useState(false)
  const [direcciones, setDirecciones] = useState([])
  const [choferes, setChoferes] = useState([])
  const [tractocamiones, setTractocamiones] = useState([])
  const [form, setForm] = useState({ ...FORM_VACIO })
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    setCargando(true)
    Promise.all([getUbicacionesPorEmpresa(empresaId), getEmpresas(), getProductos()])
      .then(([ubs, emps, prods]) => {
        setDatos(ubs.data)
        setEmpresa(emps.data.find((e) => String(e.id) === String(empresaId)))
        setProductos(prods.data || [])
        setProductosPorCodigo(Object.fromEntries((prods.data || []).map((p) => [p.codigo, p])))
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [empresaId])
  useEffect(() => {
    getSolicitudesProduccion(empresaId)
      .then((r) => setSolicitudesPendientes(r.data.filter((s) => !s.idPedido).length))
      .catch(() => {})
  }, [empresaId])

  const abrirModal = () => {
    setForm({ ...FORM_VACIO })
    setModal(true)
    Promise.all([getDirecciones(), getChoferes(), getTractocamiones()])
      .then(([dir, ch, tr]) => {
        setDirecciones((dir.data || []).filter((d) => String(d.idEmpresa) === String(empresaId)))
        setChoferes(ch.data || [])
        setTractocamiones(tr.data || [])
      })
      .catch(() => toast.error('No se pudieron cargar los catálogos'))
  }

  const setFila = (i, cambio) =>
    setForm((f) => ({ ...f, filas: f.filas.map((fila, k) => (k === i ? { ...fila, ...cambio } : fila)) }))

  const guardarIngreso = async () => {
    if (!form.folio.trim()) return toast.advertencia(`Indica el folio de ${empresa?.nombre || 'la empresa'}`)
    if (!form.idDireccion) return toast.advertencia(`Selecciona la dirección de ${empresa?.nombre || 'la empresa'}`)
    const filas = form.filas.filter((f) => f.codigoProducto || f.kilos)
    if (filas.length === 0) return toast.advertencia('Agrega al menos un producto')
    for (const f of filas) {
      if (!f.codigoProducto) return toast.advertencia('Selecciona el producto de cada renglón')
      if (!(Number(f.kilos) > 0)) return toast.advertencia(`Indica los kilos de ${f.codigoProducto}`)
    }
    const repetido = filas.find((f, i) => filas.findIndex((x) => x.codigoProducto === f.codigoProducto) !== i)
    if (repetido) return toast.advertencia(`${repetido.codigoProducto} está repetido: suma sus kilos en un solo renglón`)

    setGuardando(true)
    try {
      const transporte =
        form.idChofer || form.idTractocamion
          ? {
              idChofer: form.idChofer ? Number(form.idChofer) : null,
              idTractocamion: form.idTractocamion ? Number(form.idTractocamion) : null,
              idCaja: null,
            }
          : null
      const folio = form.folio.trim()

      // Una sola entrada con todos los productos del folio. Cada producto queda con el folio como
      // identificador interno (la existencia exige un nombre de lote).
      await crearEntrada({
        idUsuario: usuario?.id,
        idEmpresa: null,
        urlRemision: null,
        numeroEmbarque: null,
        urlFactura: null,
        folioEmpresa: folio,
        transporte,
        detalles: filas.map((f) => ({
          codigoProducto: f.codigoProducto,
          lote: folio,
          kilos: Number(f.kilos),
          costo: null,
          caducidad: null,
          idDireccion: Number(form.idDireccion),
          idDepartamento: null,
        })),
      })
      toast.exito(`Ingreso ${folio} registrado`)
      setModal(false)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo registrar el ingreso')
    } finally {
      setGuardando(false)
    }
  }

  // Un solo renglón por artículo (suma de todos sus lotes); el detalle y los lotes viven en su
  // Historial. El artículo se queda en la lista aunque su existencia llegue a 0.
  const enriquecidos = useMemo(() => {
    const mapa = new Map()
    for (const d of datos) {
      const previo = mapa.get(d.codigoProducto)
      if (previo) previo.cantidadKilos += Number(d.cantidadKilos || 0)
      else mapa.set(d.codigoProducto, { codigoProducto: d.codigoProducto, cantidadKilos: Number(d.cantidadKilos || 0) })
    }
    return [...mapa.values()].map((d) => {
      const p = productosPorCodigo[d.codigoProducto] || {}
      const pesoCaja = Number(p.pesoCaja) || 0
      return {
        ...d,
        descripcion: [p.especie, p.marca].filter(Boolean).join(' ') || d.codigoProducto,
        cajas: pesoCaja > 0 ? Math.round((d.cantidadKilos / pesoCaja) * 100) / 100 : null,
      }
    })
  }, [datos, productosPorCodigo])

  const filtrados = enriquecidos.filter((d) => {
    const q = busqueda.toLowerCase()
    return d.codigoProducto?.toLowerCase().includes(q) || d.descripcion?.toLowerCase().includes(q)
  })

  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(filtrados, 20)
  const totalKg = filtrados.reduce((s, d) => s + d.cantidadKilos, 0)

  return (
    <Layout>
      <PageHeader
        titulo="Producto a consignacion"
        subtitulo={`con ${empresa?.nombre || '…'}`}
      />

      <div className="px-6 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Buscador
            valor={busqueda}
            onChange={(v) => {
              setBusqueda(v)
              setPagina(1)
            }}
            placeholder="Ingresa artículo o código"
            className="w-80 max-w-full"
          />
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-teal">Existencia total: {kg(totalKg)} kg</span>
            <button className="gm-pill" onClick={() => navigate(`/inventario/consignacion/${empresaId}/solicitudes`)}>
              Solicitudes{solicitudesPendientes > 0 ? ` (${solicitudesPendientes})` : ''}
            </button>
            <button className="gm-pill" onClick={() => navigate(`/inventario/consignacion/${empresaId}/pedidos`)}>
              Pedidos
            </button>
            {puede('compras', 'crear') && <AgregarBoton onClick={abrirModal}>Ingreso</AgregarBoton>}
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
                    <th className="italic">Artículo</th>
                    <th className="text-right">Prod. nacional (kg)</th>
                    <th className="text-right">Existencia en cajas</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((item) => (
                    <tr key={item.codigoProducto}>
                      <td>
                        {item.descripcion}
                        <span className="block font-mono text-xs text-gray-400">{item.codigoProducto}</span>
                      </td>
                      <td className="text-right font-semibold">{kg(item.cantidadKilos)}</td>
                      <td className="text-right">{item.cajas ?? '—'}</td>
                      <td className="text-right">
                        <button
                          className="gm-pill"
                          onClick={() => navigate(`/inventario/consignacion/${empresaId}/${encodeURIComponent(item.codigoProducto)}`)}
                        >
                          Historial
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center !py-12 text-gray-400">
                        {busqueda
                          ? 'Sin resultados para esa búsqueda'
                          : `Sin producto en consignación con ${empresa?.nombre || 'esta empresa'}. Registra uno con "Ingreso".`}
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

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo={`Ingreso de ${empresa?.nombre || 'consignación'}`} ancho="max-w-xl">
        <p className="mb-4 text-sm text-gray-500">
          El ingreso se identifica con el folio de {empresa?.nombre || 'la empresa'}; un mismo folio puede
          traer varios productos con kilos distintos. No lleva lote.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Folio {empresa?.nombre || ''} *</span>
              <input
                className="gm-input mt-1"
                placeholder="Escribe el folio…"
                value={form.folio}
                onChange={(e) => setForm({ ...form, folio: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Dirección de {empresa?.nombre || 'la empresa'} *</span>
              <select
                className="gm-input mt-1"
                value={form.idDireccion}
                onChange={(e) => setForm({ ...form, idDireccion: e.target.value })}
              >
                <option value="">Selecciona…</option>
                {direcciones.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.direccion} {d.municipio ? `— ${d.municipio}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {direcciones.length === 0 && (
            <span className="gm-error">
              {empresa?.nombre || 'Esta empresa'} no tiene direcciones. Agrégalas en Empresas o en Otros → Destinos.
            </span>
          )}

          <div>
            <span className="text-sm font-semibold text-gray-700">Productos del folio *</span>
            <div className="mt-1 space-y-2">
              {form.filas.map((fila, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="gm-input flex-1"
                    value={fila.codigoProducto}
                    onChange={(e) => setFila(i, { codigoProducto: e.target.value })}
                  >
                    <option value="">Producto…</option>
                    {productos.map((p) => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.codigo} — {p.especie}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="gm-input w-32"
                    placeholder="Kilos"
                    value={fila.kilos}
                    onChange={(e) => setFila(i, { kilos: e.target.value })}
                  />
                  {form.filas.length > 1 && (
                    <button
                      type="button"
                      className="text-cancelar hover:brightness-90"
                      title="Quitar producto"
                      onClick={() => setForm((f) => ({ ...f, filas: f.filas.filter((_, k) => k !== i) }))}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="gm-pill mt-2"
              onClick={() => setForm((f) => ({ ...f, filas: [...f.filas, { ...FILA_VACIA }] }))}
            >
              + Producto
            </button>
            {productos.length === 0 && (
              <span className="gm-error">No hay productos. Créalos primero en Otros → Kardex.</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Chofer (opcional)</span>
              <select
                className="gm-input mt-1"
                value={form.idChofer}
                onChange={(e) => setForm({ ...form, idChofer: e.target.value })}
              >
                <option value="">Sin chofer</option>
                {choferes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Empresa transporte (opcional)</span>
              <select
                className="gm-input mt-1"
                value={form.idTractocamion}
                onChange={(e) => setForm({ ...form, idTractocamion: e.target.value })}
              >
                <option value="">Sin tractocamión</option>
                {tractocamiones.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.placa || t.placas} {t.empresa ? `— ${t.empresa}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button className="gm-btn-cancelar" onClick={() => setModal(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardarIngreso} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
