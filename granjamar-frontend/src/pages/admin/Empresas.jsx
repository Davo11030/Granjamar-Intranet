import { Fragment, useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  getEmpresas,
  crearEmpresa,
  actualizarEmpresa,
  getDirecciones,
  crearDireccion,
} from '../../api/destinos'

const TIPOS = ['INTERNA', 'Resguardo', 'Consignacion', 'Cliente', 'Proveedor']
const DIR_VACIA = { estado: '', municipio: '', direccion: '' }
const FORM = { nombre: '', rfc: '', tipo: 'INTERNA', urlLogo: '', direcciones: [{ ...DIR_VACIA }] }

export default function Empresas() {
  const { usuario } = useAuth()
  const toast = useToast()
  const [empresas, setEmpresas] = useState([])
  const [direcciones, setDirecciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [expandida, setExpandida] = useState(null)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ ...FORM })

  // formulario rápido "+ Dirección" dentro de una fila expandida
  const [dirRapida, setDirRapida] = useState({ ...DIR_VACIA })
  const [guardandoDir, setGuardandoDir] = useState(false)

  const cargar = () => {
    Promise.all([getEmpresas(), getDirecciones()])
      .then(([e, d]) => {
        setEmpresas(e.data)
        setDirecciones(d.data)
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const dirPorEmpresa = useMemo(() => {
    const map = {}
    for (const d of direcciones) {
      const k = String(d.idEmpresa ?? '')
      if (!k) continue
      ;(map[k] ||= []).push(d)
    }
    return map
  }, [direcciones])

  const abrir = (empresa = null) => {
    setEditando(empresa)
    setForm(
      empresa
        ? { nombre: empresa.nombre, rfc: empresa.rfc || '', tipo: empresa.tipo || 'INTERNA', urlLogo: empresa.urlLogo || '', direcciones: [{ ...DIR_VACIA }] }
        : { ...FORM, direcciones: [{ ...DIR_VACIA }] },
    )
    setModal(true)
  }

  const setDir = (i, c) =>
    setForm((p) => ({ ...p, direcciones: p.direcciones.map((d, idx) => (idx === i ? { ...d, ...c } : d)) }))

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.advertencia('El nombre de la empresa es obligatorio')
    const dirsValidas = form.direcciones.filter((d) => d.direccion.trim())
    for (const d of dirsValidas) {
      if (!d.estado.trim() || !d.municipio.trim())
        return toast.advertencia('Cada dirección necesita estado y municipio')
    }
    setGuardando(true)
    try {
      const payload = {
        idUsuario: usuario?.id,
        nombre: form.nombre.trim(),
        rfc: form.rfc.trim() || null,
        tipo: form.tipo,
        urlLogo: form.urlLogo.trim() || null,
      }
      let idEmpresa
      if (editando) {
        await actualizarEmpresa(editando.id, payload)
        idEmpresa = editando.id
      } else {
        const { data } = await crearEmpresa(payload)
        idEmpresa = data.id
      }
      for (const d of dirsValidas) {
        await crearDireccion({
          direccion: d.direccion.trim(),
          estado: d.estado.trim(),
          municipio: d.municipio.trim(),
          idEmpresa: Number(idEmpresa),
          idUsuario: usuario?.id,
        })
      }
      toast.exito(editando ? 'Empresa actualizada' : 'Empresa registrada')
      setModal(false)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la empresa')
    } finally {
      setGuardando(false)
    }
  }

  const agregarDireccionRapida = async (idEmpresa) => {
    if (!dirRapida.direccion.trim()) return toast.advertencia('Escribe la dirección')
    if (!dirRapida.estado.trim() || !dirRapida.municipio.trim())
      return toast.advertencia('Indica estado y municipio')
    setGuardandoDir(true)
    try {
      await crearDireccion({
        direccion: dirRapida.direccion.trim(),
        estado: dirRapida.estado.trim(),
        municipio: dirRapida.municipio.trim(),
        idEmpresa: Number(idEmpresa),
        idUsuario: usuario?.id,
      })
      toast.exito('Dirección agregada')
      setDirRapida({ ...DIR_VACIA })
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo agregar la dirección')
    } finally {
      setGuardandoDir(false)
    }
  }

  return (
    <Layout>
      <PageHeader titulo="Empresas" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex justify-end">
          <AgregarBoton onClick={() => abrir()}>Empresa</AgregarBoton>
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Nombre</th>
                  <th>RFC</th>
                  <th>Tipo</th>
                  <th>Direcciones</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => {
                  const dirs = dirPorEmpresa[String(e.id)] || []
                  const abierta = expandida === e.id
                  return (
                    <Fragment key={e.id}>
                      <tr>
                        <td className="font-semibold">{e.nombre}</td>
                        <td className="font-mono text-sm">{e.rfc || '—'}</td>
                        <td>{e.tipo || '—'}</td>
                        <td>
                          <button
                            className="gm-pill"
                            onClick={() => {
                              setExpandida(abierta ? null : e.id)
                              setDirRapida({ ...DIR_VACIA })
                            }}
                          >
                            {dirs.length} — {abierta ? 'ocultar' : 'ver'}
                          </button>
                        </td>
                        <td className="text-right">
                          <button className="gm-pill" onClick={() => abrir(e)}>
                            Editar
                          </button>
                        </td>
                      </tr>
                      {abierta && (
                        <tr>
                          <td colSpan={5} className="!py-4">
                            <div className="rounded-xl bg-[color:var(--color-panel-login)] p-4">
                              <p className="mb-2 text-sm font-semibold text-marca">
                                Direcciones de {e.nombre}
                              </p>
                              {dirs.length === 0 && (
                                <p className="mb-3 text-sm text-gray-500">Aún no tiene direcciones registradas.</p>
                              )}
                              <ul className="mb-4 space-y-1">
                                {dirs.map((d) => (
                                  <li key={d.id} className="text-sm">
                                    <span className="font-medium">{d.direccion}</span>
                                    <span className="text-gray-500">
                                      {' '}
                                      — {d.municipio}, {d.estado}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <div className="flex flex-wrap items-end gap-2">
                                <input
                                  className="gm-input w-56 py-1.5"
                                  placeholder="Dirección"
                                  value={dirRapida.direccion}
                                  onChange={(ev) => setDirRapida({ ...dirRapida, direccion: ev.target.value })}
                                />
                                <input
                                  className="gm-input w-36 py-1.5"
                                  placeholder="Municipio"
                                  value={dirRapida.municipio}
                                  onChange={(ev) => setDirRapida({ ...dirRapida, municipio: ev.target.value })}
                                />
                                <input
                                  className="gm-input w-36 py-1.5"
                                  placeholder="Estado"
                                  value={dirRapida.estado}
                                  onChange={(ev) => setDirRapida({ ...dirRapida, estado: ev.target.value })}
                                />
                                <button
                                  className="gm-btn-guardar py-1.5"
                                  disabled={guardandoDir}
                                  onClick={() => agregarDireccionRapida(e.id)}
                                >
                                  + Dirección
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {empresas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="!py-12 text-center text-gray-400">
                      Sin empresas registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        abierto={modal}
        onCerrar={() => setModal(false)}
        titulo={editando ? 'Editar empresa' : 'Nueva empresa'}
        ancho="max-w-xl"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-teal">Nombre *</span>
            <input className="gm-input mt-1" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">RFC</span>
            <input className="gm-input mt-1 font-mono" value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Tipo</span>
            <select className="gm-input mt-1" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-marca">
              Direcciones {editando ? '(se agregan a las existentes)' : ''}
            </span>
            <button
              className="text-sm font-semibold text-teal"
              onClick={() => setForm((p) => ({ ...p, direcciones: [...p.direcciones, { ...DIR_VACIA }] }))}
            >
              + Agregar otra
            </button>
          </div>
          <div className="space-y-2">
            {form.direcciones.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  className="gm-input w-52 py-1.5"
                  placeholder="Dirección"
                  value={d.direccion}
                  onChange={(e) => setDir(i, { direccion: e.target.value })}
                />
                <input
                  className="gm-input w-32 py-1.5"
                  placeholder="Municipio"
                  value={d.municipio}
                  onChange={(e) => setDir(i, { municipio: e.target.value })}
                />
                <input
                  className="gm-input w-32 py-1.5"
                  placeholder="Estado"
                  value={d.estado}
                  onChange={(e) => setDir(i, { estado: e.target.value })}
                />
                {form.direcciones.length > 1 && (
                  <button
                    className="text-cancelar"
                    aria-label="Quitar dirección"
                    onClick={() =>
                      setForm((p) => ({ ...p, direcciones: p.direcciones.filter((_, idx) => idx !== i) }))
                    }
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Deja una dirección vacía si no quieres agregar ninguna ahora.
          </p>
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
