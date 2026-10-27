import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import ModalRecuperarContrasena from '../components/ModalRecuperarContrasena'

export default function Login() {
  const [form, setForm] = useState({ nombre: '', contrasena: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [recuperarAbierto, setRecuperarAbierto] = useState(false)
  const { iniciarSesion } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async () => {
    const nombre = form.nombre.trim()
    if (!nombre || !form.contrasena) {
      setError('Ingresa usuario y contraseña')
      return
    }
    setCargando(true)
    setError('')
    try {
      const res = await login({ nombre, contrasena: form.contrasena })
      iniciarSesion(res.data)
      navigate('/')
    } catch (e) {
      setError(
        e.response?.status === 401
          ? 'Usuario o contraseña incorrectos'
          : 'No se pudo conectar con el servidor',
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-fondo px-4">
      <h1
        className="gm-titulo mt-24 mb-16 animate-fade-in"
        style={{ fontSize: 'clamp(3rem, 8vw, 5rem)' }}
      >
        GRANJAMAR
      </h1>

      <div
        className="rounded-3xl px-10 py-12 w-full max-w-lg animate-fade-in"
        style={{
          backgroundColor: 'var(--color-panel-login)',
          boxShadow: '0 20px 44px -16px rgb(6 147 164 / 0.22)',
          animationDelay: '80ms',
          animationFillMode: 'backwards',
        }}
      >
        <div className="flex items-center mb-6 gap-4">
          <label htmlFor="usuario" className="text-marca text-xl w-36 shrink-0">
            Usuario:
          </label>
          <input
            id="usuario"
            type="text"
            autoFocus
            placeholder="Escribe aqui.."
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="flex-1 bg-white text-gray-800 placeholder-gray-400 rounded-xl px-4 py-2.5 border border-transparent outline-none transition-all duration-200 focus:border-teal focus:ring-4 focus:ring-teal/10"
          />
        </div>

        <div className="flex items-center mb-8 gap-4">
          <label htmlFor="contrasena" className="text-marca text-xl w-36 shrink-0">
            Contraseña:
          </label>
          <input
            id="contrasena"
            type="password"
            value={form.contrasena}
            onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="flex-1 bg-white text-gray-800 rounded-xl px-4 py-2.5 border border-transparent outline-none transition-all duration-200 focus:border-teal focus:ring-4 focus:ring-teal/10"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm mb-4 text-center font-medium animate-fade-in">{error}</p>
        )}

        <div className="flex justify-between items-center gap-4">
          <button
            onClick={handleSubmit}
            disabled={cargando}
            className="text-marca font-bold px-10 py-2.5 rounded-full transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            style={{ backgroundColor: 'var(--color-entrar)' }}
          >
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => setRecuperarAbierto(true)}
            className="text-marca px-5 py-2 rounded-full text-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            style={{ backgroundColor: '#f9d3d3' }}
          >
            Olvide contraseña
          </button>
        </div>
      </div>

      <ModalRecuperarContrasena abierto={recuperarAbierto} onCerrar={() => setRecuperarAbierto(false)} />
    </div>
  )
}
