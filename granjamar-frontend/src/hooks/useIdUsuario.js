import { useAuth } from '../context/AuthContext'

export default function useIdUsuario() {
  const { usuario } = useAuth()
  return usuario?.id || null
}