import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getDirecciones, crearDireccion, getEmpresas } from '../../api/destinos'

const FORM = { direccion: '', estado: '', municipio: '', idEmpresa: '' }

export default function Destinos() {
  const { usuario, puede } = useAuth()
  const toast = useToast()
  const [datos, setDatos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ ...FORM })

  const cargar = () => {
    Promise.all([getDirecciones(), getEmpresas()])
      .then(([d, e]) => {
        setDatos(d.data)
        setEmpresas(e.data)
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const rfcPorEmpresa = useMemo(
    () => Object.fromEntries(empresas.map((e) => [e.nombre, e.rfc])),
    [empresas],
  )

  const guardar = async () => {
    if (!form.direccion.trim()) return toast.advertencia('La dirección es obligatoria')
    if (!form.estado.trim() || !form.municipio.trim()) return toast.advertencia('Estado y municipio son obligatorios')
    setGuardando(true)
    try {
      await crearDireccion({
        direccion: form.direccion.trim(),
        estado: form.estado.trim(),
        municipio: form.municipio.trim(),
        idEmpresa: form.idEmpresa ? Number(form.idEmpresa) : null,
        idUsuario: usuario?.id,
      })
      toast.exito('Destino agregado')
      setModal(false)
      setForm({ ...FORM })
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar el destino')
    } finally {
      setGuardando(false)
    }
  }

  const filtrados = datos.filter((d) => {
    const q = busqueda.toLowerCase()
    return (
      (d.empresa || '').toLowerCase().includes(q) ||
      (d.direccion || '').toLowerCase().includes(q) ||
      (d.municipio || '').toLowerCase().includes(q) ||
      (d.estado || '').toLowerCase().includes(q)
    )
  })

  return (
    <Layout>
      <PageHeader titulo="Destinos" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar por empresa, estado o dirección" className="w-80 max-w-full" />
          {puede('direcciones', 'crear') && <AgregarBoton onClick={() => setModal(true)}>Agregar</AgregarBoton>}
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Empresa</th>
                  <th>Estado</th>
                  <th>Municipio</th>
                  <th>Direccion</th>
                  <th>RFC</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr key={d.id}>
                    <td>{d.empresa || '—'}</td>
                    <td>{d.estado || '—'}</td>
                    <td>{d.municipio || '—'}</td>
                    <td>{d.direccion}</td>
                    <td className="font-mono text-sm">{rfcPorEmpresa[d.empresa] || '—'}</td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="!py-12 text-center text-gray-400">
                      Sin destinos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo="Nuevo destino" ancho="max-w-md">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-teal">Empresa</span>
            <select className="gm-input mt-1" value={form.idEmpresa} onChange={(e) => setForm({ ...form, idEmpresa: e.target.value })}>
              <option value="">Sin empresa</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Dirección *</span>
            <input className="gm-input mt-1" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-teal">Estado *</span>
              <input className="gm-input mt-1" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-teal">Municipio *</span>
              <input className="gm-input mt-1" value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
            </label>
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
