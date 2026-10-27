import { useAuth } from '../context/AuthContext'

export default function useUsuarioId() {
  const { usuario } = useAuth()
  if (!usuario?.id) throw new Error('No hay sesión activa')
  return usuario.id
}