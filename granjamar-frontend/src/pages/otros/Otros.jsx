import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../context/AuthContext'

const opciones = [
  { label: 'Operadores', path: '/otros/operadores', permiso: ['catalogos', 'ver'] },
  { label: 'Kardex', path: '/otros/kardex', permiso: ['productos', 'ver'] },
  { label: 'Destinos', path: '/otros/destinos', permiso: ['direcciones', 'ver'] },
  { label: 'Claves del SAT', path: '/otros/claves-sat', permiso: ['catalogos', 'ver'] },
]

export default function Otros() {
  const navigate = useNavigate()
  const { puede } = useAuth()
  return (
    <Layout>
      <PageHeader titulo="Otros" />
      <div className="flex flex-wrap justify-center gap-8 px-8 pt-8">
        {opciones.filter((op) => puede(...op.permiso)).map((op) => (
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
