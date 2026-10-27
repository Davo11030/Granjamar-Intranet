import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from './Layout'

// Exige sesión y, si se indica, un permiso: `permiso={['ventas', 'ver']}` o, cuando basta con
// cualquiera de varios, `permiso={[['ventas', 'ver'], ['ventas', 'corte']]}`.
export default function ProtectedRoute({ children, permiso }) {
  const { usuario, cargando, permisosListos, puedeAlguno } = useAuth()
  if (cargando) return <div className="flex items-center justify-center h-screen text-teal">Cargando...</div>
  if (!usuario) return <Navigate to="/login" replace />
  if (!permiso) return children
  if (!permisosListos) return <div className="flex items-center justify-center h-screen text-teal">Cargando...</div>

  const lista = Array.isArray(permiso[0]) ? permiso : [permiso]
  if (!puedeAlguno(lista)) {
    return (
      <Layout>
        <div className="flex flex-col items-center gap-3 px-6 pt-24 text-center">
          <h1 className="gm-titulo">Sin permiso</h1>
          <p className="text-gray-600">
            No tienes permiso para entrar a esta sección. Si la necesitas, pídele al administrador que te la habilite.
          </p>
        </div>
      </Layout>
    )
  }
  return children
}
