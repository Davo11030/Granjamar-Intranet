import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { registrarAvisoError } from '../utils/avisoCarga'

const ToastContext = createContext()

// Contador propio: con Date.now() dos avisos en el mismo milisegundo compartían id.
let siguienteId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const agregar = useCallback((mensaje, tipo = 'exito', duracion = 3000) => {
    const id = ++siguienteId
    // Si el mismo aviso ya está en pantalla (p. ej. varias listas que fallan a la vez porque el servidor
    // está apagado), no se repite.
    setToasts(prev => prev.some(t => t.mensaje === mensaje && t.tipo === tipo) ? prev : [...prev, { id, mensaje, tipo }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duracion)
  }, [])

  const exito = useCallback((m) => agregar(m, 'exito'), [agregar])
  const error = useCallback((m) => agregar(m, 'error', 6000), [agregar])
  const info = useCallback((m) => agregar(m, 'info'), [agregar])

  // Los avisos de carga fallida (utils/avisoCarga.js) salen por aquí.
  useEffect(() => registrarAvisoError(error), [error])
  const advertencia = useCallback((m) => agregar(m, 'advertencia', 4000), [agregar])

  return (
    <ToastContext.Provider value={{ exito, error, info, advertencia }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div key={t.id}
            className={`px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all animate-fade-in
              ${t.tipo === 'exito' ? 'bg-green-500' : ''}
              ${t.tipo === 'error' ? 'bg-red-500' : ''}
              ${t.tipo === 'info' ? 'bg-[#00838F]' : ''}
              ${t.tipo === 'advertencia' ? 'bg-yellow-500' : ''}
            `}>
            <div className="flex items-center gap-2">
              <span>
                {t.tipo === 'exito' && '✓'}
                {t.tipo === 'error' && '✕'}
                {t.tipo === 'info' && 'ℹ'}
                {t.tipo === 'advertencia' && '⚠'}
              </span>
              {t.mensaje}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)