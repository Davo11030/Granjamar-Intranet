import { Fragment, useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import ConfirmarBaja from '../../components/ConfirmarBaja'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  getEmpresas,
  crearEmpresa,
  actualizarEmpresa,
  eliminarEmpresa,
  getDirecciones,
  eliminarDireccion,
} from '../../api/destinos'
import { avisar } from '../../utils/avisoCarga'

const TIPOS = ['INTERNA', 'Resguardo', 'Consignacion', 'Cliente', 'Proveedor']
const DIR_VACIA = { estado: '', municipio: '', direccion: '', codigoPostal: '', segmento: '' }
const FORM = { nombre: '', rfc: '', tipo: 'INTERNA', urlLogo: '', direcciones: [{ ...DIR_VACIA }] }

export default function Empresas() {
  const [errorCarga, setErrorCarga] = useState(false)
  const { usuario, puede } = useAuth()
  const toast = useToast()
  const [empresas, setEmpresas] = useState([])
  const [direcciones, setDirecciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [expandida, setExpandida] = useState(null)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ ...FORM })
  // { tipo: 'empresa' | 'direccion', item } — lo que se va a dar de baja
  const [baja, setBaja] = useState(null)

  const cargar = () => {
    Promise.all([getEmpresas(), getDirecciones()])
      .then(([e, d]) => {
        setEmpresas(e.data)
        setDirecciones(d.data)
      })
      .catch(avisar('No se pudieron cargar las empresas', () => setErrorCarga(true)))
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
    // Al editar, las direcciones que ya tiene entran al formulario (con su id) para poder modificarlas; las nuevas se agregan aparte.
    const existentes = empresa
      ? (dirPorEmpresa[String(empresa.id)] || []).map((d) => ({ id: d.id, direccion: d.direccion || '', municipio: d.municipio || '', estado: d.estado || '', codigoPostal: d.codigoPostal || '', segmento: d.segmento || '' }))
      : []
    setForm(
      empresa
        ? { nombre: empresa.nombre, rfc: empresa.rfc || '', tipo: empresa.tipo || 'INTERNA', urlLogo: empresa.urlLogo || '', direcciones: existentes }
        : { ...FORM, direcciones: [{ ...DIR_VACIA }] },
    )
    setModal(true)
  }

  const setDir = (i, c) =>
    setForm((p) => ({ ...p, direcciones: p.direcciones.map((d, idx) => (idx === i ? { ...d, ...c } : d)) }))

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.advertencia('El nombre de la empresa es obligatorio')
    // Las existentes no pueden quedar vacías; las nuevas en blanco se ignoran.
    const dirsValidas = form.direcciones.filter((d) => d.id || d.direccion.trim())
    for (const d of dirsValidas) {
      if (!d.direccion.trim()) return toast.advertencia('Una dirección existente no puede quedar vacía')
      if (!d.estado.trim() || !d.municipio.trim())
        return toast.advertencia('Cada dirección necesita estado y municipio')
    }
    setGuardando(true)
    try {
      // La empresa y sus direcciones se guardan en una sola operación: o queda todo o no queda nada.
      const payload = {
        idUsuario: usuario?.id,
        nombre: form.nombre.trim(),
        rfc: form.rfc.trim() || null,
        tipo: form.tipo,
        urlLogo: form.urlLogo.trim() || null,
        direcciones: dirsValidas.map((d) => ({
          id: d.id || null,
          direccion: d.direccion.trim(),
          estado: d.estado.trim(),
          municipio: d.municipio.trim(),
          codigoPostal: (d.codigoPostal || '').trim() || null,
          segmento: (d.segmento || '').trim() || null,
        })),
      }
      if (editando) await actualizarEmpresa(editando.id, payload)
      else await crearEmpresa(payload)
      toast.exito(editando ? 'Empresa actualizada' : 'Empresa registrada')
      setModal(false)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la empresa')
    } finally {
      setGuardando(false)
    }
  }

  const darDeBaja = async () => {
    setGuardando(true)
    try {
      if (baja.tipo === 'empresa') {
        await eliminarEmpresa(baja.item.id)
        toast.exito(`${baja.item.nombre} fue dada de baja`)
        if (expandida === baja.item.id) setExpandida(null)
      } else {
        await eliminarDireccion(baja.item.id)
        toast.exito('Dirección dada de baja')
      }
      setBaja(null)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo dar de baja')
    } finally {
      setGuardando(false)
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
                            }}
                          >
                            {dirs.length} — {abierta ? 'ocultar' : 'ver'}
                          </button>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button className="gm-pill" onClick={() => abrir(e)}>
                            Editar
                          </button>
                          {puede('empresas', 'eliminar') && (
                            <button className="gm-pill ml-2" onClick={() => setBaja({ tipo: 'empresa', item: e })}>
                              Dar de baja
                            </button>
                          )}
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
                              <ul className="mb-3 space-y-1">
                                {dirs.map((d) => (
                                  <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                                    <span>
                                      <span className="font-medium">{d.direccion}</span>
                                      <span className="text-gray-500">
                                        {' '}
                                        — {d.municipio}, {d.estado}
                                      </span>
                                    </span>
                                    {puede('direcciones', 'eliminar') && (
                                      <button
                                        className="text-xs font-semibold text-cancelar hover:underline"
                                        onClick={() => setBaja({ tipo: 'direccion', item: d })}
                                      >
                                        Dar de baja
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                              <p className="text-xs text-gray-400">Para agregar o modificar direcciones usa Editar.</p>
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
                      {errorCarga ? 'No se pudo cargar la información. Recarga la página para intentar de nuevo.' : 'Sin empresas registradas'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmarBaja
        abierto={!!baja}
        titulo={baja?.tipo === 'empresa' ? 'Dar de baja empresa' : 'Dar de baja dirección'}
        texto={
          baja?.tipo === 'empresa'
            ? `${baja.item.nombre} y todas sus direcciones dejarán de aparecer en listas y menús. No se permite si alguna de sus direcciones todavía tiene producto en inventario.`
            : baja
              ? `"${baja.item.direccion}" (${baja.item.municipio}) dejará de aparecer como destino. No se permite si todavía tiene producto en inventario.`
              : ''
        }
        procesando={guardando}
        onCancelar={() => setBaja(null)}
        onConfirmar={darDeBaja}
      />

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
              Direcciones
            </span>
            <button
              className="text-sm font-semibold text-teal"
              onClick={() => setForm((p) => ({ ...p, direcciones: [...p.direcciones, { ...DIR_VACIA }] }))}
            >
              + Agregar dirección
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
                <input
                  className="gm-input w-24 py-1.5"
                  placeholder="C.P."
                  inputMode="numeric"
                  maxLength={5}
                  value={d.codigoPostal || ''}
                  onChange={(e) => setDir(i, { codigoPostal: e.target.value.replace(/[^0-9]/g, '') })}
                />
                <input
                  className="gm-input w-28 py-1.5"
                  placeholder="# Segmento"
                  title="# Segmento o Cliente (se imprime en la Requisición)"
                  value={d.segmento || ''}
                  onChange={(e) => setDir(i, { segmento: e.target.value })}
                />
                {!d.id && (form.direcciones.length > 1 || editando) && (
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
            {editando ? 'Modifica las direcciones que ya tiene o agrega nuevas.' : 'Deja una dirección vacía si no quieres agregar ninguna ahora.'}
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
