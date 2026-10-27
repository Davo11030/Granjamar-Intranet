import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useToast } from '../../context/ToastContext'
import { getEmpresas } from '../../api/destinos'
import {
  getChoferes,
  crearChofer,
  actualizarChofer,
  eliminarChofer,
  getTractocamiones,
  crearTractocamion,
  actualizarTractocamion,
  eliminarTractocamion,
  getMarcasTractocamion,
  crearMarcaTractocamion,
  getCajas,
  crearCaja,
  actualizarCaja,
  eliminarCaja,
} from '../../api/operadores'

const TABS = [
  { id: 'operadores', label: 'Operadores' },
  { id: 'tractocamiones', label: 'Tractocamiones' },
  { id: 'cajas', label: 'Cajas' },
]

const FORM_CHOFER = { id: null, nombre: '', numeroTelefono: '', tipoTelefono: 'Movil' }
const FORM_TRACTO = { id: null, modelo: '', color: '', idMarca: '', placa: '', idEmpresa: '' }
const FORM_CAJA = { id: null, cajaPlaca: '', cajaTamano: '', cajaCapacidad: '', idEmpresa: '' }

const NUEVA_MARCA = '__nueva__'

// Solo la primera letra en mayúscula, el resto en minúsculas — p. ej. "KENWORTH" o
// "kenworth" siempre quedan guardadas como "Kenworth".
const normalizarMarca = (s) => {
  const t = s.trim().replace(/\s+/g, ' ')
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ''
}

export default function Operadores() {
  const { puede } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('operadores')
  const [empresas, setEmpresas] = useState([])
  const [filtroEmpresa, setFiltroEmpresa] = useState('')

  const [choferes, setChoferes] = useState([])
  const [tractocamiones, setTractocamiones] = useState([])
  const [marcas, setMarcas] = useState([])
  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [modalChofer, setModalChofer] = useState(false)
  const [formChofer, setFormChofer] = useState({ ...FORM_CHOFER })
  const [modalTracto, setModalTracto] = useState(false)
  const [formTracto, setFormTracto] = useState({ ...FORM_TRACTO })
  const [agregandoMarca, setAgregandoMarca] = useState(false)
  const [nuevaMarca, setNuevaMarca] = useState('')
  const [modalCaja, setModalCaja] = useState(false)
  const [formCaja, setFormCaja] = useState({ ...FORM_CAJA })

  const cargar = () => {
    const params = filtroEmpresa ? { idEmpresa: filtroEmpresa } : undefined
    setCargando(true)
    Promise.all([getChoferes(), getTractocamiones(params), getCajas(params), getMarcasTractocamion(), getEmpresas()])
      .then(([ch, tr, ca, ma, emp]) => {
        setChoferes(ch.data)
        setTractocamiones(tr.data)
        setCajas(ca.data)
        setMarcas(ma.data)
        setEmpresas(emp.data)
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [filtroEmpresa])

  // ── Operadores (choferes) ────────────────────────────────────
  const abrirChofer = (ch) => {
    setFormChofer(
      ch
        ? { id: ch.id, nombre: ch.nombre, numeroTelefono: ch.numeroTelefono, tipoTelefono: ch.tipoTelefono || 'Movil' }
        : { ...FORM_CHOFER },
    )
    setModalChofer(true)
  }

  const guardarChofer = async () => {
    if (!formChofer.nombre.trim()) return toast.advertencia('El nombre del operador es obligatorio')
    if (!formChofer.numeroTelefono.trim()) return toast.advertencia('El teléfono es obligatorio')
    setGuardando(true)
    try {
      const datos = {
        nombre: formChofer.nombre.trim(),
        numeroTelefono: formChofer.numeroTelefono.trim(),
        tipoTelefono: formChofer.tipoTelefono,
      }
      if (formChofer.id) await actualizarChofer(formChofer.id, datos)
      else await crearChofer(datos)
      toast.exito('Operador guardado')
      setModalChofer(false)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar el operador')
    } finally {
      setGuardando(false)
    }
  }

  const borrarChofer = async (ch) => {
    try {
      await eliminarChofer(ch.id)
      toast.exito('Operador eliminado')
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo eliminar')
    }
  }

  // ── Tractocamiones ────────────────────────────────────────────
  const abrirTracto = (t) => {
    setFormTracto(
      t
        ? { id: t.id, modelo: t.modelo || '', color: t.color || '', idMarca: t.idMarca || '', placa: t.placa || '', idEmpresa: t.idEmpresa || '' }
        : { ...FORM_TRACTO },
    )
    setAgregandoMarca(false)
    setNuevaMarca('')
    setModalTracto(true)
  }

  const elegirMarca = (valor) => {
    if (valor === NUEVA_MARCA) {
      setAgregandoMarca(true)
      return
    }
    setFormTracto({ ...formTracto, idMarca: valor })
  }

  // Alta rápida de marca desde el propio selector, sin duplicar por mayúsculas/minúsculas.
  const agregarMarca = async () => {
    const nombre = normalizarMarca(nuevaMarca)
    if (!nombre) return toast.advertencia('Escribe el nombre de la marca')

    const existente = marcas.find((m) => m.nombre.toLowerCase() === nombre.toLowerCase())
    if (existente) {
      setFormTracto({ ...formTracto, idMarca: String(existente.id) })
      setAgregandoMarca(false)
      setNuevaMarca('')
      toast.info(`"${existente.nombre}" ya existía, se seleccionó esa marca.`)
      return
    }

    try {
      const { data } = await crearMarcaTractocamion(nombre)
      const { data: listaMarcas } = await getMarcasTractocamion()
      setMarcas(listaMarcas)
      setFormTracto({ ...formTracto, idMarca: String(data.id) })
      setAgregandoMarca(false)
      setNuevaMarca('')
      toast.exito(`Marca "${nombre}" agregada`)
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo agregar la marca')
    }
  }

  const guardarTracto = async () => {
    if (!formTracto.placa.trim()) return toast.advertencia('La placa es obligatoria')
    if (!formTracto.idMarca) return toast.advertencia('Selecciona la marca')
    setGuardando(true)
    try {
      const datos = {
        modelo: formTracto.modelo ? Number(formTracto.modelo) : 0,
        color: formTracto.color || '',
        idMarca: Number(formTracto.idMarca),
        placa: formTracto.placa.trim(),
        idEmpresa: formTracto.idEmpresa ? Number(formTracto.idEmpresa) : null,
      }
      if (formTracto.id) await actualizarTractocamion(formTracto.id, datos)
      else await crearTractocamion(datos)
      toast.exito('Tractocamión guardado')
      setModalTracto(false)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar el tractocamión')
    } finally {
      setGuardando(false)
    }
  }

  const borrarTracto = async (t) => {
    try {
      await eliminarTractocamion(t.id)
      toast.exito('Tractocamión eliminado')
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo eliminar')
    }
  }

  // ── Cajas ─────────────────────────────────────────────────────
  const abrirCaja = (c) => {
    setFormCaja(
      c
        ? { id: c.id, cajaPlaca: c.cajaPlaca || '', cajaTamano: c.cajaTamano || '', cajaCapacidad: c.cajaCapacidad || '', idEmpresa: c.idEmpresa || '' }
        : { ...FORM_CAJA },
    )
    setModalCaja(true)
  }

  const guardarCaja = async () => {
    if (!formCaja.cajaPlaca.trim()) return toast.advertencia('La placa de la caja es obligatoria')
    setGuardando(true)
    try {
      const datos = {
        cajaPlaca: formCaja.cajaPlaca.trim(),
        cajaTamano: formCaja.cajaTamano || null,
        cajaCapacidad: formCaja.cajaCapacidad ? Number(formCaja.cajaCapacidad) : null,
        idEmpresa: formCaja.idEmpresa ? Number(formCaja.idEmpresa) : null,
      }
      if (formCaja.id) await actualizarCaja(formCaja.id, datos)
      else await crearCaja(datos)
      toast.exito('Caja guardada')
      setModalCaja(false)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la caja')
    } finally {
      setGuardando(false)
    }
  }

  const borrarCaja = async (c) => {
    try {
      await eliminarCaja(c.id)
      toast.exito('Caja eliminada')
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo eliminar')
    }
  }

  const agregar = () => {
    if (tab === 'operadores') abrirChofer(null)
    else if (tab === 'tractocamiones') abrirTracto(null)
    else abrirCaja(null)
  }

  return (
    <Layout>
      <PageHeader titulo="Operadores" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  tab === t.id ? 'bg-teal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {tab !== 'operadores' && (
              <label className="text-xs text-gray-500">
                Filtrar por empresa
                <select
                  className="ml-2 rounded border border-gray-300 px-3 py-1.5 text-sm outline-none"
                  value={filtroEmpresa}
                  onChange={(e) => setFiltroEmpresa(e.target.value)}
                >
                  <option value="">Todas</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {puede('catalogos', 'crear') && (
              <AgregarBoton onClick={agregar}>
                {tab === 'operadores' ? 'Operador' : tab === 'tractocamiones' ? 'Tractocamión' : 'Caja'}
              </AgregarBoton>
            )}
          </div>
        </div>

        {cargando ? (
          <Cargando />
        ) : tab === 'operadores' ? (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Nombre</th>
                  <th>Teléfono</th>
                  <th>Tipo</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {choferes.map((ch) => (
                  <tr key={ch.id}>
                    <td className="font-semibold">{ch.nombre}</td>
                    <td>{ch.numeroTelefono}</td>
                    <td>{ch.tipoTelefono || '—'}</td>
                    <td className="text-right whitespace-nowrap">
                      {puede('catalogos', 'editar') && (
                        <button className="gm-pill mr-2" onClick={() => abrirChofer(ch)}>
                          Editar
                        </button>
                      )}
                      {puede('catalogos', 'eliminar') && (
                        <button className="text-cancelar hover:brightness-90" onClick={() => borrarChofer(ch)}>
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {choferes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="!py-12 text-center text-gray-400">
                      Sin operadores registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : tab === 'tractocamiones' ? (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Placa</th>
                  <th>Marca</th>
                  <th>Año</th>
                  <th>Color</th>
                  <th>Empresa</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {tractocamiones.map((t) => (
                  <tr key={t.id}>
                    <td className="font-semibold">{t.placa || '—'}</td>
                    <td>{t.marca || '—'}</td>
                    <td>{t.modelo || '—'}</td>
                    <td>{t.color || '—'}</td>
                    <td>{t.empresa || '—'}</td>
                    <td className="text-right whitespace-nowrap">
                      {puede('catalogos', 'editar') && (
                        <button className="gm-pill mr-2" onClick={() => abrirTracto(t)}>
                          Editar
                        </button>
                      )}
                      {puede('catalogos', 'eliminar') && (
                        <button className="text-cancelar hover:brightness-90" onClick={() => borrarTracto(t)}>
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {tractocamiones.length === 0 && (
                  <tr>
                    <td colSpan={6} className="!py-12 text-center text-gray-400">
                      Sin tractocamiones registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Placa</th>
                  <th>Tamaño</th>
                  <th>Capacidad</th>
                  <th>Empresa</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {cajas.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.cajaPlaca || '—'}</td>
                    <td>{c.cajaTamano || '—'}</td>
                    <td>{c.cajaCapacidad ?? '—'}</td>
                    <td>{c.empresa || '—'}</td>
                    <td className="text-right whitespace-nowrap">
                      {puede('catalogos', 'editar') && (
                        <button className="gm-pill mr-2" onClick={() => abrirCaja(c)}>
                          Editar
                        </button>
                      )}
                      {puede('catalogos', 'eliminar') && (
                        <button className="text-cancelar hover:brightness-90" onClick={() => borrarCaja(c)}>
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {cajas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="!py-12 text-center text-gray-400">
                      Sin cajas registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Operador */}
      <Modal abierto={modalChofer} onCerrar={() => setModalChofer(false)} titulo={formChofer.id ? 'Editar operador' : 'Nuevo operador'} ancho="max-w-md">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-teal">Nombre operador *</span>
            <input className="gm-input mt-1" value={formChofer.nombre} onChange={(e) => setFormChofer({ ...formChofer, nombre: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">No. Teléfono *</span>
            <input className="gm-input mt-1" value={formChofer.numeroTelefono} onChange={(e) => setFormChofer({ ...formChofer, numeroTelefono: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Tipo</span>
            <select className="gm-input mt-1" value={formChofer.tipoTelefono} onChange={(e) => setFormChofer({ ...formChofer, tipoTelefono: e.target.value })}>
              <option>Movil</option>
              <option>Casa</option>
              <option>Oficina</option>
            </select>
          </label>
        </div>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setModalChofer(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardarChofer} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>

      {/* Modal Tractocamión */}
      <Modal abierto={modalTracto} onCerrar={() => setModalTracto(false)} titulo={formTracto.id ? 'Editar tractocamión' : 'Nuevo tractocamión'} ancho="max-w-md">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-teal">Placas *</span>
            <input className="gm-input mt-1" value={formTracto.placa} onChange={(e) => setFormTracto({ ...formTracto, placa: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Marca *</span>
            {agregandoMarca ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  className="gm-input"
                  placeholder="Nombre de la marca"
                  value={nuevaMarca}
                  autoFocus
                  onChange={(e) => setNuevaMarca(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && agregarMarca()}
                />
                <button type="button" className="gm-btn-guardar py-1.5 whitespace-nowrap" onClick={agregarMarca}>
                  Agregar
                </button>
                <button
                  type="button"
                  className="text-sm text-gray-500 hover:underline whitespace-nowrap"
                  onClick={() => {
                    setAgregandoMarca(false)
                    setNuevaMarca('')
                  }}
                >
                  cancelar
                </button>
              </div>
            ) : (
              <select className="gm-input mt-1" value={formTracto.idMarca} onChange={(e) => elegirMarca(e.target.value)}>
                <option value="">Selecciona…</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
                <option value={NUEVA_MARCA}>+ Agregar marca…</option>
              </select>
            )}
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Año</span>
            <input type="number" className="gm-input mt-1" value={formTracto.modelo} onChange={(e) => setFormTracto({ ...formTracto, modelo: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Color</span>
            <input className="gm-input mt-1" value={formTracto.color} onChange={(e) => setFormTracto({ ...formTracto, color: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Empresa</span>
            <select className="gm-input mt-1" value={formTracto.idEmpresa} onChange={(e) => setFormTracto({ ...formTracto, idEmpresa: e.target.value })}>
              <option value="">Sin empresa</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setModalTracto(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardarTracto} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>

      {/* Modal Caja */}
      <Modal abierto={modalCaja} onCerrar={() => setModalCaja(false)} titulo={formCaja.id ? 'Editar caja' : 'Nueva caja'} ancho="max-w-md">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-teal">Placas *</span>
            <input className="gm-input mt-1" value={formCaja.cajaPlaca} onChange={(e) => setFormCaja({ ...formCaja, cajaPlaca: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Tamaño</span>
            <input className="gm-input mt-1" value={formCaja.cajaTamano} onChange={(e) => setFormCaja({ ...formCaja, cajaTamano: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Capacidad</span>
            <input type="number" className="gm-input mt-1" value={formCaja.cajaCapacidad} onChange={(e) => setFormCaja({ ...formCaja, cajaCapacidad: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Empresa</span>
            <select className="gm-input mt-1" value={formCaja.idEmpresa} onChange={(e) => setFormCaja({ ...formCaja, idEmpresa: e.target.value })}>
              <option value="">Sin empresa</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setModalCaja(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardarCaja} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
