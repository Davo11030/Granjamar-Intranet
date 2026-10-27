import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import usePaginacion from '../../hooks/usePaginacion'
import { getClientes, crearCliente, actualizarCliente, eliminarCliente } from '../../api/clientes'

const FORM = { nombre: '', rfc: '', telefono: '', calle: '', colonia: '', municipio: '', estado: '', codigoPostal: '' }

// Dirección en una línea: "Av. Reforma 123, Centro, Ensenada, Baja California, C.P. 22800".
const direccionTexto = (c) =>
  [c.calle, c.colonia, c.municipio, c.estado, c.codigoPostal ? `C.P. ${c.codigoPostal}` : null].filter(Boolean).join(', ')

export default function Clientes() {
  const { usuario, puede } = useAuth()
  const toast = useToast()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ ...FORM })

  const cargar = () =>
    getClientes().then((r) => setDatos(r.data)).catch(console.error).finally(() => setCargando(false))
  useEffect(() => {
    cargar()
  }, [])

  const abrir = (item = null) => {
    setEditando(item)
    setForm(
      item
        ? {
            nombre: item.nombre || '',
            rfc: item.rfc || '',
            telefono: item.telefono || '',
            calle: item.calle || '',
            colonia: item.colonia || '',
            municipio: item.municipio || '',
            estado: item.estado || '',
            codigoPostal: item.codigoPostal || '',
          }
        : { ...FORM },
    )
    setModal(true)
  }

  const guardar = async () => {
    // Todo es obligatorio salvo el teléfono.
    if (!form.nombre.trim()) return toast.advertencia('El nombre del cliente es obligatorio')
    if (!/^[A-Za-z&Ññ0-9]{12,13}$/.test(form.rfc.trim())) return toast.advertencia('El RFC debe tener 12 o 13 caracteres')
    if (!form.calle.trim()) return toast.advertencia('Indica la calle y número')
    if (!form.colonia.trim()) return toast.advertencia('Indica la colonia')
    if (!form.municipio.trim()) return toast.advertencia('Indica el municipio o ciudad')
    if (!form.estado.trim()) return toast.advertencia('Indica el estado')
    if (!/^\d{5}$/.test(form.codigoPostal.trim())) return toast.advertencia('El código postal debe tener 5 dígitos')
    setGuardando(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        rfc: form.rfc.trim().toUpperCase(),
        telefono: form.telefono.trim() || null,
        calle: form.calle.trim(),
        colonia: form.colonia.trim(),
        municipio: form.municipio.trim(),
        estado: form.estado.trim(),
        codigoPostal: form.codigoPostal.trim(),
        idUsuario: usuario?.id,
      }
      if (editando) await actualizarCliente(editando.id, payload)
      else await crearCliente(payload)
      toast.exito(editando ? 'Cliente actualizado' : 'Cliente registrado')
      setModal(false)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar el cliente')
    } finally {
      setGuardando(false)
    }
  }

  const desactivar = async () => {
    try {
      await eliminarCliente(confirmar.id, usuario?.id)
      toast.exito(`Cliente ${confirmar.nombre} desactivado`)
      setConfirmar(null)
      cargar()
    } catch {
      toast.error('No se pudo desactivar el cliente')
    }
  }

  const filtrados = datos.filter((d) => {
    const q = busqueda.toLowerCase()
    return (
      (d.nombre || '').toLowerCase().includes(q) ||
      (d.rfc || '').toLowerCase().includes(q) ||
      (d.telefono || '').toLowerCase().includes(q) ||
      direccionTexto(d).toLowerCase().includes(q)
    )
  })
  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(filtrados, 20)

  return (
    <Layout>
      <PageHeader titulo="Clientes" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Buscador
            valor={busqueda}
            onChange={(v) => {
              setBusqueda(v)
              setPagina(1)
            }}
            placeholder="Buscar por nombre, RFC, teléfono o dirección"
            className="w-80 max-w-full"
          />
          {puede('clientes', 'crear') && <AgregarBoton onClick={() => abrir()}>Cliente</AgregarBoton>}
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="gm-tabla">
                <thead>
                  <tr>
                    <th className="italic">Nombre</th>
                    <th>Teléfono</th>
                    <th>RFC</th>
                    <th>Dirección</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((c) => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.nombre}</td>
                      <td>{c.telefono || '—'}</td>
                      <td className="font-mono text-sm">{c.rfc || '—'}</td>
                      <td className="max-w-xs text-sm text-gray-600">{direccionTexto(c) || '—'}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          {puede('clientes', 'editar') && (
                            <button className="gm-pill" onClick={() => abrir(c)}>
                              Editar
                            </button>
                          )}
                          {puede('clientes', 'eliminar') && (
                            <button
                              className="rounded-full px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-95"
                              style={{ backgroundColor: 'var(--color-cancelar)' }}
                              onClick={() => setConfirmar(c)}
                            >
                              Desactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={5} className="!py-12 text-center text-gray-400">
                        {busqueda ? 'Sin resultados para esa búsqueda' : 'Sin clientes registrados'}
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

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo={editando ? 'Editar cliente' : 'Nuevo cliente'} ancho="max-w-lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-teal">Nombre *</span>
            <input className="gm-input mt-1" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">RFC *</span>
            <input
              className="gm-input mt-1 font-mono"
              maxLength={13}
              value={form.rfc}
              onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Teléfono (opcional)</span>
            <input className="gm-input mt-1" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </label>

          <p className="text-sm font-bold text-marca sm:col-span-2">Dirección completa</p>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-teal">Calle y número *</span>
            <input
              className="gm-input mt-1"
              placeholder="Ej. Av. Reforma 123, int. 4"
              value={form.calle}
              onChange={(e) => setForm({ ...form, calle: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Colonia *</span>
            <input className="gm-input mt-1" value={form.colonia} onChange={(e) => setForm({ ...form, colonia: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Código postal *</span>
            <input
              className="gm-input mt-1"
              inputMode="numeric"
              maxLength={5}
              value={form.codigoPostal}
              onChange={(e) => setForm({ ...form, codigoPostal: e.target.value.replace(/\D/g, '') })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Municipio o ciudad *</span>
            <input className="gm-input mt-1" value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Estado *</span>
            <input className="gm-input mt-1" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
          </label>
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

      <Modal abierto={!!confirmar} onCerrar={() => setConfirmar(null)} titulo="" ancho="max-w-sm">
        <p className="text-center text-lg">¿Deseas desactivar al cliente</p>
        <p className="mb-4 text-center text-xl font-bold text-marca">{confirmar?.nombre}?</p>
        <p className="mb-6 text-center text-sm text-gray-400">
          El cliente quedará inactivo pero sus ventas se conservan.
        </p>
        <div className="flex justify-center gap-4">
          <button className="gm-btn-guardar" onClick={() => setConfirmar(null)}>
            Cancelar
          </button>
          <button className="gm-btn-cancelar" onClick={desactivar}>
            Desactivar
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
