import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  getUsuarios,
  crearUsuario,
  actualizarUsuario,
  getSolicitudesRestablecimiento,
  aprobarSolicitud,
  rechazarSolicitud,
} from '../../api/usuarios'
import {
  getPermisos,
  getPermisosPorUsuario,
  asignarPermiso,
  quitarPermiso,
  crearPermiso,
} from '../../api/permisos'
import { formatearFechaHora } from '../../utils/fecha'

// Módulos con permisos (usuarios, movimientos y visitantes son solo del administrador y no aparecen).
const MODULOS = [
  ['inventario', 'Inventario (Conpaq, consignación, resguardo)'],
  ['productos', 'Kardex (productos y precios)'],
  ['existencias', 'Existencias y lotes'],
  ['documentos', 'Pedimentos y facturas (archivos)'],
  ['clientes', 'Clientes'],
  ['ventas', 'Ventas'],
  ['compras', 'Entradas'],
  ['embarques', 'Embarques (requisición, solicitud, RT, ciego)'],
  ['produccion', 'Producción'],
  ['empresas', 'Empresas'],
  ['direcciones', 'Destinos y direcciones'],
  ['catalogos', 'Catálogos (operadores, claves SAT, tallas…)'],
]
const ACCIONES = ['ver', 'crear', 'editar', 'eliminar', 'corte']
const ETIQUETA_ACCION = { corte: 'corte de caja' }
const PUESTOS = ['admin', 'lic', 'gerente', 'supervisor', 'inge']

export default function Usuarios() {
  const { usuario: actual } = useAuth()
  const toast = useToast()
  const [datos, setDatos] = useState([])
  const [permisos, setPermisos] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalUsuario, setModalUsuario] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalPermisos, setModalPermisos] = useState(false)
  const [modalPermiso, setModalPermiso] = useState(false)
  const [sel, setSel] = useState(null)
  const [permisosUsuario, setPermisosUsuario] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ nombre: '', puesto: 'admin', contrasena: '', correo: '' })
  const [formEdit, setFormEdit] = useState({ id: null, nombre: '', puesto: '', correo: '', contrasena: '' })
  const [formP, setFormP] = useState({ modulo: '', accion: '', descripcion: '' })

  const cargar = () => {
    Promise.all([getUsuarios(), getPermisos(), getSolicitudesRestablecimiento()])
      .then(([u, p, s]) => {
        setDatos(u.data)
        setPermisos(p.data)
        setSolicitudes(s.data)
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const resolverSolicitud = async (id, accion) => {
    try {
      if (accion === 'aprobar') await aprobarSolicitud(id)
      else await rechazarSolicitud(id)
      toast.exito(accion === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada')
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo actualizar la solicitud')
    }
  }

  const abrirPermisos = async (u) => {
    setSel(u)
    try {
      const res = await getPermisosPorUsuario(u.id)
      setPermisosUsuario(res.data)
      setModalPermisos(true)
    } catch {
      toast.error('No se pudieron cargar los permisos')
    }
  }

  const toggle = async (permiso) => {
    const tiene = permisosUsuario.some((p) => p.id === permiso.id)
    try {
      if (tiene) {
        await quitarPermiso(sel.id, permiso.id)
        setPermisosUsuario((p) => p.filter((x) => x.id !== permiso.id))
      } else {
        await asignarPermiso({ idUsuario: sel.id, idPermiso: permiso.id })
        setPermisosUsuario((p) => [...p, permiso])
      }
    } catch {
      toast.error('No se pudo actualizar el permiso')
    }
  }

  const guardarUsuario = async () => {
    if (!form.nombre.trim()) return toast.advertencia('El nombre de usuario es obligatorio')
    if (!form.contrasena || form.contrasena.length < 4)
      return toast.advertencia('La contraseña debe tener al menos 4 caracteres')
    setGuardando(true)
    try {
      await crearUsuario({ ...form, nombre: form.nombre.trim(), idUsuario: actual?.id })
      toast.exito('Usuario creado')
      setModalUsuario(false)
      setForm({ nombre: '', puesto: 'admin', contrasena: '', correo: '' })
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo crear el usuario')
    } finally {
      setGuardando(false)
    }
  }

  const abrirEditar = (u) => {
    setFormEdit({ id: u.id, nombre: u.nombre || '', puesto: u.puesto || 'admin', correo: u.correo || '', contrasena: '' })
    setModalEditar(true)
  }

  const guardarEdicion = async () => {
    if (!formEdit.nombre.trim()) return toast.advertencia('El nombre de usuario es obligatorio')
    if (formEdit.contrasena && formEdit.contrasena.length < 4)
      return toast.advertencia('La contraseña debe tener al menos 4 caracteres')
    setGuardando(true)
    try {
      await actualizarUsuario(formEdit.id, {
        nombre: formEdit.nombre.trim(),
        puesto: formEdit.puesto,
        correo: formEdit.correo,
        contrasena: formEdit.contrasena || '',
      })
      toast.exito('Usuario actualizado')
      setModalEditar(false)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo actualizar el usuario')
    } finally {
      setGuardando(false)
    }
  }

  const guardarPermiso = async () => {
    if (!formP.modulo || !formP.accion) return toast.advertencia('Módulo y acción son obligatorios')
    setGuardando(true)
    try {
      await crearPermiso(formP)
      toast.exito('Permiso creado')
      setModalPermiso(false)
      setFormP({ modulo: '', accion: '', descripcion: '' })
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo crear el permiso')
    } finally {
      setGuardando(false)
    }
  }

  const grid = MODULOS.map(([modulo, etiqueta]) => ({
    modulo,
    etiqueta,
    acciones: ACCIONES.map((accion) => ({
      accion,
      permiso: permisos.find((p) => p.modulo === modulo && p.accion === accion),
    })),
  }))

  return (
    <Layout>
      <PageHeader titulo="Usuarios" />

      <div className="px-6 md:px-10">
        {solicitudes.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-3 text-sm font-semibold text-amber-800">
              Solicitudes de restablecimiento de contraseña
            </p>
            <div className="space-y-2">
              {solicitudes.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-4 py-2 text-sm shadow-sm"
                >
                  <div>
                    <span className="font-semibold">{s.nombreUsuario}</span>{' '}
                    <span className="text-gray-400">— {formatearFechaHora(s.fechaSolicitud)}</span>
                  </div>
                  {s.estado === 'Pendiente' ? (
                    <div className="flex gap-2">
                      <button className="gm-pill" onClick={() => resolverSolicitud(s.id, 'aprobar')}>
                        Aprobar
                      </button>
                      <button className="gm-pill" onClick={() => resolverSolicitud(s.id, 'rechazar')}>
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-teal">
                      Aprobada — esperando que el usuario ponga su nueva contraseña
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <button className="gm-pill" onClick={() => setModalPermiso(true)}>
            + Permiso
          </button>
          <AgregarBoton onClick={() => setModalUsuario(true)}>Usuario</AgregarBoton>
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Usuario</th>
                  <th>Puesto</th>
                  <th>Correo</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {datos.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.nombre}</td>
                    <td className="capitalize">{u.puesto || '—'}</td>
                    <td className="text-sm text-gray-500">{u.correo || '—'}</td>
                    <td className="text-right whitespace-nowrap">
                      <button className="gm-pill mr-2" onClick={() => abrirEditar(u)}>
                        Editar
                      </button>
                      <button className="gm-pill" onClick={() => abrirPermisos(u)}>
                        Ver permisos
                      </button>
                    </td>
                  </tr>
                ))}
                {datos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="!py-12 text-center text-gray-400">
                      Sin usuarios registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal abierto={modalUsuario} onCerrar={() => setModalUsuario(false)} titulo="Nuevo usuario" ancho="max-w-md">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-teal">Nombre de usuario *</span>
            <input className="gm-input mt-1" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Puesto</span>
            <select className="gm-input mt-1" value={form.puesto} onChange={(e) => setForm({ ...form, puesto: e.target.value })}>
              {PUESTOS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Contraseña *</span>
            <input type="password" className="gm-input mt-1" value={form.contrasena} onChange={(e) => setForm({ ...form, contrasena: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Correo electrónico</span>
            <input type="email" className="gm-input mt-1" placeholder="opcional" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
          </label>
        </div>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setModalUsuario(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardarUsuario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>

      <Modal abierto={modalEditar} onCerrar={() => setModalEditar(false)} titulo="Editar usuario" ancho="max-w-md">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-teal">Nombre de usuario *</span>
            <input className="gm-input mt-1" value={formEdit.nombre} onChange={(e) => setFormEdit({ ...formEdit, nombre: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Puesto</span>
            <select className="gm-input mt-1" value={formEdit.puesto} onChange={(e) => setFormEdit({ ...formEdit, puesto: e.target.value })}>
              {PUESTOS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Correo electrónico</span>
            <input type="email" className="gm-input mt-1" placeholder="opcional" value={formEdit.correo} onChange={(e) => setFormEdit({ ...formEdit, correo: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Nueva contraseña</span>
            <input type="password" className="gm-input mt-1" placeholder="dejar en blanco para no cambiarla" value={formEdit.contrasena} onChange={(e) => setFormEdit({ ...formEdit, contrasena: e.target.value })} />
          </label>
        </div>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setModalEditar(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardarEdicion} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>

      <Modal
        abierto={modalPermisos}
        onCerrar={() => setModalPermisos(false)}
        titulo={sel ? `Permisos — ${sel.nombre}` : 'Permisos'}
        ancho="max-w-2xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 px-3 text-left">Módulo</th>
                {ACCIONES.map((a) => (
                  <th key={a} className="py-2 px-3 text-center capitalize">
                    {ETIQUETA_ACCION[a] || a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map(({ modulo, etiqueta, acciones }) => (
                <tr key={modulo} className="border-b border-gray-100">
                  <td className="py-2 px-3 font-semibold">{etiqueta}</td>
                  {acciones.map(({ accion, permiso }) => (
                    <td key={accion} className="py-2 px-3 text-center">
                      {permiso ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-teal"
                          checked={permisosUsuario.some((p) => p.id === permiso.id)}
                          onChange={() => toggle(permiso)}
                        />
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Los cambios se aplican de inmediato en el servidor; el usuario ve los menús y botones nuevos al recargar la página.
          "Ver" lo tiene automáticamente quien pueda crear, editar o eliminar en ese módulo. Los administradores tienen todos los permisos.
        </p>
      </Modal>

      <Modal abierto={modalPermiso} onCerrar={() => setModalPermiso(false)} titulo="Nuevo permiso" ancho="max-w-md">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-teal">Módulo</span>
            <select className="gm-input mt-1" value={formP.modulo} onChange={(e) => setFormP({ ...formP, modulo: e.target.value })}>
              <option value="">Selecciona…</option>
              {MODULOS.map(([m]) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Acción</span>
            <select className="gm-input mt-1" value={formP.accion} onChange={(e) => setFormP({ ...formP, accion: e.target.value })}>
              <option value="">Selecciona…</option>
              {ACCIONES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Descripción</span>
            <input className="gm-input mt-1" value={formP.descripcion} onChange={(e) => setFormP({ ...formP, descripcion: e.target.value })} />
          </label>
        </div>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setModalPermiso(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardarPermiso} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
