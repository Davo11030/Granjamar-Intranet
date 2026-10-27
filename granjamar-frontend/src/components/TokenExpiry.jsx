import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function TokenExpiry() {
  const { cerrarSesion } = useAuth()
  const [aviso, setAviso] = useState(false)
  const [segundos, setSegundos] = useState(300)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expiracion = payload.exp * 1000
      const ahora = Date.now()
      const diferencia = expiracion - ahora

      // Avisa 5 minutos antes
      const timerAviso = setTimeout(() => {
        setAviso(true)
      }, Math.max(0, diferencia - 5 * 60 * 1000))

      // Cierra sesión al expirar
      const timerExpiracion = setTimeout(() => {
        cerrarSesion()
      }, Math.max(0, diferencia))

      return () => {
        clearTimeout(timerAviso)
        clearTimeout(timerExpiracion)
      }
    } catch (e) {
      console.error('Error leyendo token:', e)
    }
  }, [])

  useEffect(() => {
    if (!aviso) return
    const interval = setInterval(() => {
      setSegundos(s => {
        if (s <= 1) { clearInterval(interval); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [aviso])

  if (!aviso) return null

  const minutos = Math.floor(segundos / 60)
  const segs = segundos % 60

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-50 border border-yellow-300 rounded-xl p-4 shadow-lg z-50 max-w-sm">
      <p className="font-semibold text-yellow-800 mb-1">⚠️ Sesión por expirar</p>
      <p className="text-sm text-yellow-700 mb-3">
        Tu sesión expira en {minutos}:{String(segs).padStart(2, '0')}. Guarda tu trabajo.
      </p>
      <div className="flex gap-2">
        <button onClick={cerrarSesion}
          className="text-sm bg-yellow-200 hover:bg-yellow-300 px-3 py-1 rounded-full">
          Cerrar sesión
        </button>
        <button onClick={() => setAviso(false)}
          className="text-sm text-yellow-600 hover:underline">
          Ignorar
        </button>
      </div>
    </div>
  )
}