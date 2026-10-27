import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <h1 className="text-8xl font-bold text-marca mb-4">404</h1>
      <p className="text-2xl text-teal mb-2">Página no encontrada</p>
      <p className="text-gray-400 mb-8">La página que buscas no existe o fue movida</p>
      <button onClick={() => navigate('/')} className="gm-btn-guardar">
        Regresar al inicio
      </button>
    </div>
  )
}
