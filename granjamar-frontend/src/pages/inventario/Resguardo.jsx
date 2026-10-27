import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useToast } from '../../context/ToastContext'
import usePaginacion from '../../hooks/usePaginacion'
import { getUbicacionesPorEmpresa, getUbicaciones, getProductos, traspasoResguardo } from '../../api/inventario'
import { getEmpresas, getDirecciones } from '../../api/destinos'

const kg = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const money = (n) =>
  n == null ? '—' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

export default function InventarioResguardo() {
  const { puede } = useAuth()
  const { IdEmpresa, idEmpresa } = useParams()
  const empresaId = IdEmpresa || idEmpresa
  const navigate = useNavigate()
  const toast = useToast()

  const [datos, setDatos] = useState([])
  const [empresa, setEmpresa] = useState(null)
  const [productos, setProductos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modoHistorial, setModoHistorial] = useState(false)

  // modal "Producto" — traspaso: el producto ya lo tenemos en Conpaq (inventario local)
  // y aquí solo se traslada su custodia a la empresa de resguardo.
  const [modal, setModal] = useState(false)
  const [origenes, setOrigenes] = useState([])
  const [direcciones, setDirecciones] = useState([])
  const [form, setForm] = useState({ idOrigen: '', idDireccion: '', cantidadKilos: '' })
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    setCargando(true)
    Promise.all([getUbicacionesPorEmpresa(empresaId), getEmpresas(), getProductos()])
      .then(([ubs, emps, prods]) => {
        setDatos(ubs.data)
        setEmpresa(emps.data.find((e) => String(e.id) === String(empresaId)))
        setProductos(Object.fromEntries((prods.data || []).map((p) => [p.codigo, p])))
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [empresaId])

  const abrirModal = () => {
    setForm({ idOrigen: '', idDireccion: '', cantidadKilos: '' })
    setModal(true)
    Promise.all([getUbicaciones(), getEmpresas(), getDirecciones()])
      .then(([ubs, emps, dirs]) => {
        const interna = emps.data.find(
          (e) => e.tipo?.toLowerCase() === 'interna' || /granjamar/i.test(e.nombre),
        )
        const locales = interna
          ? ubs.data.filter((u) => String(u.idEmpresa) === String(interna.id) && Number(u.cantidadKilos) > 0)
          : []
        setOrigenes(locales)
        setDirecciones((dirs.data || []).filter((d) => String(d.idEmpresa) === String(empresaId)))
      })
      .catch(() => toast.error('No se pudieron cargar los catálogos'))
  }

  const origenSel = origenes.find((o) => String(o.id) === String(form.idOrigen))

  const guardarProducto = async () => {
    if (!origenSel) return toast.advertencia('Selecciona el producto de Conpaq a trasladar')
    if (!form.idDireccion) return toast.advertencia('Selecciona la bodega de resguardo destino')
    const cant = Number(form.cantidadKilos)
    if (!cant || cant <= 0) return toast.advertencia('Ingresa una cantidad de kilos a trasladar')
    if (cant > Number(origenSel.cantidadKilos))
      return toast.advertencia(`Solo hay ${kg(origenSel.cantidadKilos)} kg disponibles en Conpaq`)

    setGuardando(true)
    try {
      const r = await traspasoResguardo({ idOrigen: origenSel.id, idDireccionDestino: Number(form.idDireccion), kilos: cant })
      toast.exito(`Traspaso registrado (salida #${r.data.registro}): ${kg(cant)} kg a ${empresa?.nombre || 'resguardo'}`)
      setModal(false)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo registrar el traspaso')
    } finally {
      setGuardando(false)
    }
  }

  // Un solo renglón por producto (suma de todos sus lotes y bodegas): el detalle por lote
  // vive en el Historial del producto.
  const enriquecidos = useMemo(() => {
    const mapa = new Map()
    for (const d of datos) {
      const kilos = Number(d.cantidadKilos || 0)
      const previo = mapa.get(d.codigoProducto)
      if (previo) previo.cantidadKilos += kilos
      else mapa.set(d.codigoProducto, { codigoProducto: d.codigoProducto, cantidadKilos: kilos, lotes: [] })
      mapa.get(d.codigoProducto).lotes.push(d.lote)
    }
    return [...mapa.values()].map((d) => {
      const p = productos[d.codigoProducto] || {}
      const pesoCaja = Number(p.pesoCaja) || 0
      const costoU = Number(p.precioKilo) || 0
      return {
        ...d,
        descripcion: [p.especie, p.marca].filter(Boolean).join(' ') || d.codigoProducto,
        cajas: pesoCaja > 0 ? Math.round(d.cantidadKilos / pesoCaja) : null,
        costoUnitario: costoU || null,
        valorTotal: costoU ? costoU * d.cantidadKilos : null,
      }
    })
  }, [datos, productos])

  const filtrados = enriquecidos.filter((d) => {
    const q = busqueda.toLowerCase()
    return (
      d.codigoProducto?.toLowerCase().includes(q) ||
      d.descripcion?.toLowerCase().includes(q) ||
      d.lotes.some((l) => l?.toLowerCase().includes(q))
    )
  })

  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(filtrados, 20)
  const valorTotal = filtrados.reduce((s, d) => s + (d.valorTotal || 0), 0)

  return (
    <Layout>
      <PageHeader
        titulo={modoHistorial ? 'Historial de productos' : 'Producto resguardado'}
        subtitulo={`${modoHistorial ? 'resguardados en' : 'en'} ${empresa?.nombre || '…'}`}
      />

      <div className="px-6 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              className={`gm-pill ${modoHistorial ? 'ring-2 ring-teal' : ''}`}
              onClick={() => setModoHistorial((v) => !v)}
            >
              Historial completo
            </button>
            <Buscador
              valor={busqueda}
              onChange={(v) => {
                setBusqueda(v)
                setPagina(1)
              }}
              placeholder="Ingresa código producto o descripción"
              className="w-80 max-w-full"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-teal">Valor total: {money(valorTotal)}</span>
            {puede('inventario', 'editar') && <AgregarBoton onClick={abrirModal}>Producto</AgregarBoton>}
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
                    <th className="italic">Codigo</th>
                    <th>Descripcion</th>
                    <th className="text-right">Existencia KG</th>
                    <th className="text-right">Existencia Caja</th>
                    <th className="text-right">Costo unitario</th>
                    <th className="text-right">Valor total</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((item) => (
                    <tr key={item.codigoProducto}>
                      <td className="font-mono text-sm">{item.codigoProducto}</td>
                      <td>{item.descripcion}</td>
                      <td className="text-right font-semibold">{kg(item.cantidadKilos)}</td>
                      <td className="text-right">{item.cajas ?? '—'}</td>
                      <td className="text-right">{money(item.costoUnitario)}</td>
                      <td className="text-right">{money(item.valorTotal)}</td>
                      <td className="text-right">
                        <button
                          className="gm-pill"
                          onClick={() => navigate(`/inventario/resguardo/${empresaId}/${encodeURIComponent(item.codigoProducto)}`)}
                        >
                          Historial
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center !py-12 text-gray-400">
                        {busqueda
                          ? 'Sin resultados para esa búsqueda'
                          : `Sin producto resguardado en ${empresa?.nombre || 'esta empresa'}. Agrega uno con "Producto".`}
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

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo="Trasladar producto a resguardo" ancho="max-w-lg">
        <p className="mb-4 text-sm text-gray-500">
          El resguardo es un traspaso de nuestro inventario local (Conpaq): selecciona qué producto y
          cuántos kilos salen de Conpaq hacia {empresa?.nombre || 'esta empresa'}.
        </p>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Producto en Conpaq</span>
            <select
              className="gm-input mt-1"
              value={form.idOrigen}
              onChange={(e) => setForm({ ...form, idOrigen: e.target.value, cantidadKilos: '' })}
            >
              <option value="">Selecciona…</option>
              {origenes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.codigoProducto} — Lote {o.lote}{o.numeroDocumento ? ` · ${o.numeroDocumento}` : ""} (disponible: {kg(o.cantidadKilos)} kg)
                </option>
              ))}
            </select>
            {origenes.length === 0 && (
              <span className="gm-error">No hay existencias con stock en Conpaq para trasladar.</span>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Bodega de {empresa?.nombre || 'resguardo'} destino</span>
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
            {direcciones.length === 0 && (
              <span className="gm-error">
                {empresa?.nombre || 'Esta empresa'} no tiene direcciones. Agrégalas en Empresas o en Otros → Destinos.
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Kilos a trasladar</span>
            <input
              type="number"
              min="0"
              max={origenSel ? Number(origenSel.cantidadKilos) : undefined}
              step="0.01"
              className="gm-input mt-1"
              value={form.cantidadKilos}
              onChange={(e) => setForm({ ...form, cantidadKilos: e.target.value })}
            />
            {origenSel && (
              <span className="mt-1 block text-xs text-gray-400">
                Disponible en Conpaq: {kg(origenSel.cantidadKilos)} kg
              </span>
            )}
          </label>
        </div>

        <div className="flex justify-end gap-4 mt-8">
          <button className="gm-btn-cancelar" onClick={() => setModal(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardarProducto} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
