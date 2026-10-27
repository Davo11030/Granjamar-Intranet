import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useToast } from '../../context/ToastContext'
import api from '../../api/config'
import { formatearFecha, formatearHora } from '../../utils/fecha'

export default function Visitantes() {
  const toast = useToast()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = () =>
    api.get('/Visitantes').then((r) => setDatos(r.data)).catch(console.error).finally(() => setCargando(false))
  useEffect(() => {
    cargar()
  }, [])

  const guardar = async () => {
    if (!nombre.trim()) return toast.advertencia('Escribe el nombre del visitante')
    setGuardando(true)
    try {
      await api.post('/Visitantes', { nombre: nombre.trim(), fecha: new Date().toISOString() })
      toast.exito('Visitante registrado')
      setModal(false)
      setNombre('')
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo registrar el visitante')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Layout>
      <PageHeader titulo="Visitantes" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex justify-end">
          <AgregarBoton onClick={() => setModal(true)}>Registrar</AgregarBoton>
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Nombre</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((v) => (
                  <tr key={v.id}>
                    <td className="font-semibold">{v.nombre}</td>
                    <td>{formatearFecha(v.fecha)}</td>
                    <td>{formatearHora(v.fecha)}</td>
                  </tr>
                ))}
                {datos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="!py-12 text-center text-gray-400">
                      Sin visitantes registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo="Registrar visitante" ancho="max-w-sm">
        <label className="block">
          <span className="text-sm font-semibold text-teal">Nombre del visitante *</span>
          <input
            className="gm-input mt-1"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guardar()}
            autoFocus
          />
        </label>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setModal(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
