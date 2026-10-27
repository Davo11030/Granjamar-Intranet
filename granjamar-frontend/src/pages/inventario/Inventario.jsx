import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import { getEmpresas } from '../../api/destinos'
import { useAuth } from '../../context/AuthContext'

export default function Inventario() {
  const navigate = useNavigate()
  const { puedeAlguno } = useAuth()
  const [empresas, setEmpresas] = useState([])

  useEffect(() => {
    getEmpresas().then((r) => setEmpresas(r.data)).catch(console.error)
  }, [])

  const opciones = [
    { label: 'Conpaq', path: '/inventario/conpaq' },
    ...empresas
      .filter((e) => e.tipo?.toLowerCase() === 'consignacion')
      .map((e) => ({ label: e.nombre, path: `/inventario/consignacion/${e.id}` })),
    ...empresas
      .filter((e) => e.tipo?.toLowerCase() === 'resguardo')
      .map((e) => ({ label: e.nombre, path: `/inventario/resguardo/${e.id}` })),
    { label: 'Pedimentos', path: '/pedimentos', permiso: [['documentos', 'ver']] },
    { label: 'Otros', path: '/otros', permiso: [['productos', 'ver'], ['catalogos', 'ver'], ['direcciones', 'ver']] },
  ].filter((op) => !op.permiso || puedeAlguno(op.permiso))

  return (
    <Layout>
      <PageHeader titulo="Inventarios" />
      <div className="flex flex-wrap justify-center gap-8 px-8 pt-8">
        {opciones.map((op) => (
          <button
            key={op.path}
            onClick={() => navigate(op.path)}
            className="text-white font-bold text-2xl px-12 py-8 rounded-2xl shadow-md transition hover:brightness-95"
            style={{ backgroundColor: 'var(--color-teal)' }}
          >
            {op.label}
          </button>
        ))}
      </div>
    </Layout>
  )
}
