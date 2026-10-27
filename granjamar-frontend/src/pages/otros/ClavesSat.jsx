import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useToast } from '../../context/ToastContext'
import { getClavesSat, crearClaveSat, actualizarClaveSat } from '../../api/clavesSat'

export default function ClavesSat() {
  const { puede } = useAuth()
  const toast = useToast()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ codigo: '', nombre: '' })

  const cargar = () =>
    getClavesSat().then((r) => setDatos(r.data)).catch(console.error).finally(() => setCargando(false))
  useEffect(() => {
    cargar()
  }, [])

  const abrir = (item = null) => {
    setEditando(item)
    setForm(item ? { codigo: item.codigo, nombre: item.nombre } : { codigo: '', nombre: '' })
    setModal(true)
  }

  const guardar = async () => {
    if (!form.codigo.trim()) return toast.advertencia('El código SAT es obligatorio')
    if (!form.nombre.trim()) return toast.advertencia('La descripción es obligatoria')
    setGuardando(true)
    try {
      if (editando) await actualizarClaveSat(editando.id, form)
      else await crearClaveSat(form)
      toast.exito(editando ? 'Clave SAT actualizada' : 'Clave SAT agregada')
      setModal(false)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la clave SAT')
    } finally {
      setGuardando(false)
    }
  }

  const filtrados = datos.filter((d) => {
    const q = busqueda.toLowerCase()
    return (d.codigo || '').toLowerCase().includes(q) || (d.nombre || '').toLowerCase().includes(q)
  })

  return (
    <Layout>
      <PageHeader titulo="Claves del SAT" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar por código o descripción" className="w-80 max-w-full" />
          {puede('catalogos', 'crear') && <AgregarBoton onClick={() => abrir()}>Agregar</AgregarBoton>}
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Codigo SAT</th>
                  <th>Descripcion</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono">{item.codigo}</td>
                    <td>{item.nombre}</td>
                    <td className="text-right">
                      {puede('catalogos', 'editar') && (
                        <button className="gm-pill" onClick={() => abrir(item)}>
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={3} className="!py-12 text-center text-gray-400">
                      Sin claves SAT registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo={editando ? 'Editar clave SAT' : 'Nueva clave SAT'} ancho="max-w-md">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-teal">Código SAT *</span>
            <input className="gm-input mt-1 font-mono" placeholder="5012343" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-teal">Descripción *</span>
            <input className="gm-input mt-1" placeholder="Pescado congelado" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
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
    </Layout>
  )
}
