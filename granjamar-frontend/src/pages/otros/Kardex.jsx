import { useEffect, useState } from 'react'
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
import {
  getKardex,
  crearProducto,
  actualizarProducto,
  getEspecies,
  getMarcas,
  getTallas,
  getPesosCaja,
  getPresentaciones,
} from '../../api/kardex'

const FORM = { codigo: '', idEspecie: '', idTalla: '', idMarca: '', idPesoCaja: '', precioKilo: '', idsPresentacion: [] }
const money = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

export default function Kardex() {
  const { puede } = useAuth()
  const toast = useToast()
  const [datos, setDatos] = useState([])
  const [cat, setCat] = useState({ especies: [], marcas: [], tallas: [], pesosCaja: [], presentaciones: [] })
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ ...FORM })
  const [editando, setEditando] = useState(null) // código del producto que se edita; null = alta nueva

  const cargar = () => {
    Promise.all([getKardex(), getEspecies(), getMarcas(), getTallas(), getPesosCaja(), getPresentaciones()])
      .then(([k, e, m, t, p, pr]) => {
        setDatos(k.data)
        setCat({ especies: e.data, marcas: m.data, tallas: t.data, pesosCaja: p.data, presentaciones: pr.data })
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ ...FORM })
    setModal(true)
  }

  const abrirEdicion = (p) => {
    setEditando(p.codigo)
    setForm({
      codigo: p.codigo,
      idEspecie: String(p.idEspecie ?? ''),
      idTalla: p.idTalla != null ? String(p.idTalla) : '',
      idMarca: p.idMarca != null ? String(p.idMarca) : '',
      idPesoCaja: p.idPesoCaja != null ? String(p.idPesoCaja) : '',
      precioKilo: String(p.precioKilo ?? ''),
      idsPresentacion: (p.idsPresentacion || []).map(String),
    })
    setModal(true)
  }

  const guardar = async () => {
    if (!form.codigo.trim()) return toast.advertencia('El código es obligatorio')
    if (!form.idEspecie) return toast.advertencia('Selecciona la especie')
    if (form.precioKilo === '' || Number(form.precioKilo) <= 0) return toast.advertencia('Indica un precio por kilo válido')
    setGuardando(true)
    try {
      const datosProducto = {
        codigo: form.codigo.trim(),
        idEspecie: Number(form.idEspecie),
        idTalla: form.idTalla ? Number(form.idTalla) : null,
        idMarca: form.idMarca ? Number(form.idMarca) : null,
        idPesoCaja: form.idPesoCaja ? Number(form.idPesoCaja) : null,
        precioKilo: Number(form.precioKilo),
        idsPresentacion: form.idsPresentacion.map(Number),
      }
      if (editando) {
        await actualizarProducto(editando, datosProducto)
        toast.exito('Producto actualizado')
      } else {
        await crearProducto(datosProducto)
        toast.exito('Producto agregado al kardex')
      }
      setModal(false)
      setForm({ ...FORM })
      setEditando(null)
      cargar()
    } catch (e) {
      toast.error(
        e.response?.status === 403
          ? 'No tienes permiso para modificar productos'
          : e.response?.data?.mensaje || 'No se pudo guardar el producto',
      )
    } finally {
      setGuardando(false)
    }
  }

  const filtrados = datos.filter((d) => {
    const q = busqueda.toLowerCase()
    return (
      (d.codigo || '').toLowerCase().includes(q) ||
      (d.especie || '').toLowerCase().includes(q) ||
      (d.talla || '').toLowerCase().includes(q)
    )
  })
  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(filtrados, 20)

  return (
    <Layout>
      <PageHeader titulo="Kardex" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Buscador
            valor={busqueda}
            onChange={(v) => {
              setBusqueda(v)
              setPagina(1)
            }}
            placeholder="Buscar por código, especie o talla"
            className="w-80 max-w-full"
          />
          {puede('productos', 'crear') && <AgregarBoton onClick={abrirNuevo}>Agregar</AgregarBoton>}
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
                    <th>Talla</th>
                    <th className="text-right">Peso x caja kg</th>
                    <th className="text-right">Precio kg</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((item) => (
                    <tr key={item.codigo}>
                      <td className="font-mono text-sm">{item.codigo}</td>
                      <td>{[item.especie, item.marca].filter(Boolean).join(' ') || item.especie}</td>
                      <td>{item.talla || '—'}</td>
                      <td className="text-right">{item.pesoCaja ?? '—'}</td>
                      <td className="text-right">{money(item.precioKilo)}</td>
                      <td className="text-right">
                        {puede('productos', 'editar') && (
                          <button className="gm-pill" onClick={() => abrirEdicion(item)}>
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="!py-12 text-center text-gray-400">
                        {busqueda ? 'Sin resultados para esa búsqueda' : 'Sin productos en el kardex'}
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

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo={editando ? `Editar producto — ${editando}` : 'Nuevo producto'} ancho="max-w-lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-teal">Código *</span>
            <input className="gm-input mt-1 font-mono disabled:opacity-60" disabled={!!editando} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Especie *</span>
            <select className="gm-input mt-1" value={form.idEspecie} onChange={(e) => setForm({ ...form, idEspecie: e.target.value })}>
              <option value="">Selecciona…</option>
              {cat.especies.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Marca</span>
            <select className="gm-input mt-1" value={form.idMarca} onChange={(e) => setForm({ ...form, idMarca: e.target.value })}>
              <option value="">Sin marca</option>
              {cat.marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Talla</span>
            <select className="gm-input mt-1" value={form.idTalla} onChange={(e) => setForm({ ...form, idTalla: e.target.value })}>
              <option value="">Sin talla</option>
              {cat.tallas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Peso por caja</span>
            <select className="gm-input mt-1" value={form.idPesoCaja} onChange={(e) => setForm({ ...form, idPesoCaja: e.target.value })}>
              <option value="">Sin peso</option>
              {cat.pesosCaja.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.peso} kg
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-teal">Precio por kilo *</span>
            <input type="number" min="0" step="0.01" className="gm-input mt-1" value={form.precioKilo} onChange={(e) => setForm({ ...form, precioKilo: e.target.value })} />
          </label>
          <div className="sm:col-span-2">
            <span className="text-sm font-semibold text-teal">Presentaciones</span>
            <div className="mt-2 flex flex-wrap gap-3">
              {cat.presentaciones.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    className="accent-teal"
                    checked={form.idsPresentacion.includes(String(p.id))}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        idsPresentacion: e.target.checked
                          ? [...prev.idsPresentacion, String(p.id)]
                          : prev.idsPresentacion.filter((id) => id !== String(p.id)),
                      }))
                    }
                  />
                  {p.nombre}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setModal(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
