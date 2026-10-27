import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from './Layout'

const esAdmin = (puesto) => ['admin', 'administrador'].includes((puesto || '').toLowerCase())

// Envuelve rutas que solo debe ver el administrador (auditoría, usuarios, empresas, visitantes).
export default function RutaAdmin({ children }) {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return <div className="flex h-screen items-center justify-center text-teal">Cargando…</div>
  }
  if (!usuario) return <Navigate to="/login" replace />
  if (!esAdmin(usuario.puesto)) {
    return (
      <Layout>
        <div className="flex flex-col items-center gap-3 px-6 pt-24 text-center">
          <h1 className="gm-titulo">Acceso restringido</h1>
          <p className="text-gray-600">
            Esta sección está disponible únicamente para el administrador.
          </p>
        </div>
      </Layout>
    )
  }
  return children
}
