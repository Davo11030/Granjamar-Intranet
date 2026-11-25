import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useToast } from '../../context/ToastContext'
import { getClavesSat } from '../../api/clavesSat'
import {
  getEspecies,
  getMarcas,
  getTallas,
  getPesosCaja,
  getPresentaciones,
  crearCatalogo,
  actualizarCatalogo,
  eliminarCatalogo,
  crearPesoCaja,
  actualizarPesoCaja,
} from '../../api/kardex'

// Cada pestaña es un catálogo que usa el alta de productos del kardex.
// `ruta` es el controlador de la API; `singular` se usa en botones y mensajes; `a` es la terminación
// femenina o masculina ("Nueva talla", "Nuevo peso").
const TABS = [
  { id: 'especies', label: 'Especies', singular: 'Especie', a: 'a', ruta: 'Especies', cargar: getEspecies },
  { id: 'marcas', label: 'Marcas', singular: 'Marca', a: 'a', ruta: 'Marcas', cargar: getMarcas },
  { id: 'tallas', label: 'Tallas', singular: 'Talla', a: 'a', ruta: 'Tallas', cargar: getTallas },
  { id: 'pesos', label: 'Pesos por caja', singular: 'Peso', a: 'o', ruta: 'PesosCaja', cargar: getPesosCaja },
  { id: 'presentaciones', label: 'Presentaciones', singular: 'Presentación', a: 'a', ruta: 'Presentaciones', cargar: getPresentaciones },
]

const FORM = { id: null, nombre: '', codigoClaveSat: '', peso: '' }

// Texto que se muestra y se busca de cada renglón.
const textoDe = (tab, item) => (tab === 'pesos' ? `${item.peso} kg` : item.nombre)

export default function CatalogosKardex() {
  const { puede } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('especies')
  const [datos, setDatos] = useState({ especies: [], marcas: [], tallas: [], pesos: [], presentaciones: [] })
  const [clavesSat, setClavesSat] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ ...FORM })
  const [guardando, setGuardando] = useState(false)
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const actual = TABS.find((t) => t.id === tab)

  const cargar = () => {
    Promise.all([...TABS.map((t) => t.cargar()), getClavesSat()])
      .then((respuestas) => {
        const nuevos = {}
        TABS.forEach((t, i) => (nuevos[t.id] = respuestas[i].data))
        setDatos(nuevos)
        setClavesSat(respuestas[TABS.length].data)
        setErrorCarga(false)
      })
      .catch(() => setErrorCarga(true))
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const cambiarTab = (id) => {
    setTab(id)
    setBusqueda('')
  }

  const abrir = (item = null) => {
    setForm(
      item
        ? { id: item.id, nombre: item.nombre ?? '', codigoClaveSat: item.codigoClaveSat ?? '', peso: item.peso != null ? String(item.peso) : '' }
        : { ...FORM },
    )
    setModal(true)
  }

  const guardar = async () => {
    const nombre = form.nombre.trim()
    if (tab === 'pesos') {
      const peso = Number(form.peso)
      if (form.peso === '' || !(peso > 0)) return toast.advertencia('Indica un peso mayor a cero')
    } else if (!nombre) {
      return toast.advertencia(tab === 'tallas' ? 'Escribe la talla' : 'Escribe el nombre')
    }
    if (tab === 'especies' && !form.codigoClaveSat) return toast.advertencia('Selecciona la clave SAT')

    setGuardando(true)
    try {
      if (tab === 'pesos') {
        const peso = Number(form.peso)
        if (form.id) await actualizarPesoCaja(form.id, peso)
        else await crearPesoCaja(peso)
      } else {
        const cuerpo = tab === 'especies' ? { nombre, codigoClaveSat: form.codigoClaveSat } : { nombre }
        if (form.id) await actualizarCatalogo(actual.ruta, form.id, cuerpo)
        else await crearCatalogo(actual.ruta, cuerpo)
      }
      toast.exito(form.id ? 'Cambios guardados' : `${actual.singular} agregad${actual.a} al catálogo`)
      setModal(false)
      cargar()
    } catch (e) {
      toast.error(
        e.response?.status === 403
          ? 'No tienes permiso para modificar catálogos'
          : e.response?.data?.mensaje || 'No se pudo guardar',
      )
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    setEliminando(true)
    try {
      await eliminarCatalogo(actual.ruta, porEliminar.id)
      toast.exito('Eliminado del catálogo')
      setPorEliminar(null)
      cargar()
    } catch (e) {
      toast.error(
        e.response?.status === 403
          ? 'No tienes permiso para eliminar de catálogos'
          : e.response?.data?.mensaje || 'No se pudo eliminar',
      )
    } finally {
      setEliminando(false)
    }
  }

  const q = busqueda.trim().toLowerCase()
  const lista = (datos[tab] || []).filter(
    (item) =>
      !q ||
      textoDe(tab, item).toLowerCase().includes(q) ||
      (tab === 'especies' && (item.codigoClaveSat || '').toLowerCase().includes(q)),
  )
  const columnas = tab === 'especies' ? 4 : 3

  return (
    <Layout>
      <PageHeader titulo="Catálogos del kardex" />

      <div className="px-6 md:px-10">
        <p className="mb-4 text-sm text-gray-500">
          Lo que des de alta aquí aparece en los selectores al crear o editar un producto en el{' '}
          <Link to="/otros/kardex" className="font-semibold text-teal hover:underline">
            Kardex
          </Link>
          .
        </p>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => cambiarTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  tab === t.id ? 'bg-teal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Buscador valor={busqueda} onChange={setBusqueda} placeholder={`Buscar en ${actual.label.toLowerCase()}`} className="w-64 max-w-full" />
            {puede('catalogos', 'crear') && <AgregarBoton onClick={() => abrir()}>{actual.singular}</AgregarBoton>}
          </div>
        </div>

        {errorCarga && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            No se pudieron cargar los catálogos. Revisa la conexión con el servidor y recarga la página.
          </p>
        )}

        {tab === 'especies' && !cargando && !errorCarga && clavesSat.length === 0 && (
          <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Cada especie necesita una clave SAT y todavía no hay ninguna.{' '}
            <Link to="/otros/claves-sat" className="font-semibold underline">
              Da de alta las claves del SAT
            </Link>{' '}
            primero.
          </p>
        )}

        {cargando ? (
          <Cargando />
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">{tab === 'pesos' ? 'Peso por caja' : tab === 'tallas' ? 'Talla' : 'Nombre'}</th>
                  {tab === 'especies' && <th>Clave SAT</th>}
                  <th className="text-right">Productos</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {lista.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold">{textoDe(tab, item)}</td>
                    {tab === 'especies' && (
                      <td>
                        <span className="font-mono text-sm">{item.codigoClaveSat}</span>
                        {item.descripcionClaveSat && <span className="ml-2 text-sm text-gray-500">{item.descripcionClaveSat}</span>}
                      </td>
                    )}
                    <td className="text-right">{item.enUso ?? '—'}</td>
                    <td className="whitespace-nowrap text-right">
                      {puede('catalogos', 'editar') && (
                        <button className="gm-pill mr-2" onClick={() => abrir(item)}>
                          Editar
                        </button>
                      )}
                      {puede('catalogos', 'eliminar') &&
                        (item.enUso > 0 ? (
                          <span className="text-sm text-gray-400" title="Está en uso en productos del kardex; cámbialos primero">
                            En uso
                          </span>
                        ) : (
                          <button className="text-cancelar hover:brightness-90" onClick={() => setPorEliminar(item)}>
                            Eliminar
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={columnas} className="!py-12 text-center text-gray-400">
                      {q ? 'Sin resultados para esa búsqueda' : `Sin ${actual.label.toLowerCase()} registrad${actual.a}s`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo={`${form.id ? 'Editar' : `Nuev${actual.a}`} ${actual.singular.toLowerCase()}`}>
        <div className="space-y-4">
          {tab === 'pesos' ? (
            <label className="block">
              <span className="text-sm font-semibold text-teal">Peso por caja (kg) *</span>
              <input
                type="number"
                min="0"
                step="0.001"
                autoFocus
                className="gm-input mt-1"
                value={form.peso}
                onChange={(e) => setForm({ ...form, peso: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && !guardando && guardar()}
              />
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-semibold text-teal">{tab === 'tallas' ? 'Talla *' : 'Nombre *'}</span>
              <input
                autoFocus
                className="gm-input mt-1"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && tab !== 'especies' && !guardando && guardar()}
              />
            </label>
          )}
          {tab === 'especies' && (
            <label className="block">
              <span className="text-sm font-semibold text-teal">Clave SAT *</span>
              <select className="gm-input mt-1" value={form.codigoClaveSat} onChange={(e) => setForm({ ...form, codigoClaveSat: e.target.value })}>
                <option value="">Selecciona…</option>
                {clavesSat.map((c) => (
                  <option key={c.id} value={c.codigo}>
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
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

      <Modal abierto={!!porEliminar} onCerrar={() => setPorEliminar(null)} titulo="¿Eliminar del catálogo?">
        <p className="text-gray-600">
          Se eliminará <span className="font-semibold">{porEliminar && textoDe(tab, porEliminar)}</span> de {actual.label.toLowerCase()}. Esta acción no se puede deshacer.
        </p>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-guardar" onClick={() => setPorEliminar(null)}>
            Conservar
          </button>
          <button className="gm-btn-cancelar disabled:opacity-50" onClick={eliminar} disabled={eliminando}>
            {eliminando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
