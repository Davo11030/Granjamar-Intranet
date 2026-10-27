import { useEffect, useState } from 'react'
import Modal from './Modal'
import { useToast } from '../context/ToastContext'
import { getPerfil, actualizarPerfil, cambiarContrasena } from '../api/usuarios'

const FORMATO_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function ModalPerfil({ abierto, onCerrar }) {
  const toast = useToast()
  const [cargando, setCargando] = useState(true)
  const [nombre, setNombre] = useState('')
  const [puesto, setPuesto] = useState('')
  const [correo, setCorreo] = useState('')
  const [guardandoCorreo, setGuardandoCorreo] = useState(false)

  const [contrasenaActual, setContrasenaActual] = useState('')
  const [contrasenaNueva, setContrasenaNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cambiando, setCambiando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setCargando(true)
    getPerfil()
      .then((r) => {
        setNombre(r.data.nombre || '')
        setPuesto(r.data.puesto || '')
        setCorreo(r.data.correo || '')
      })
      .catch(() => toast.error('No se pudo cargar tu perfil'))
      .finally(() => setCargando(false))
    setContrasenaActual('')
    setContrasenaNueva('')
    setConfirmar('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  const guardarCorreo = async () => {
    const valor = correo.trim()
    if (valor && !FORMATO_CORREO.test(valor)) return toast.advertencia('Ese correo no se ve válido')
    setGuardandoCorreo(true)
    try {
      await actualizarPerfil({ correo: valor || null })
      toast.exito('Correo actualizado')
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo actualizar el correo')
    } finally {
      setGuardandoCorreo(false)
    }
  }

  const guardarContrasena = async () => {
    if (!contrasenaActual) return toast.advertencia('Escribe tu contraseña actual')
    if (contrasenaNueva.length < 4) return toast.advertencia('La nueva contraseña debe tener al menos 4 caracteres')
    if (contrasenaNueva !== confirmar) return toast.advertencia('Las contraseñas nuevas no coinciden')
    setCambiando(true)
    try {
      await cambiarContrasena({ contrasenaActual, contrasenaNueva })
      toast.exito('Contraseña actualizada')
      setContrasenaActual('')
      setContrasenaNueva('')
      setConfirmar('')
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo cambiar la contraseña')
    } finally {
      setCambiando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Mi perfil" ancho="max-w-md">
      {cargando ? (
        <p className="py-6 text-center text-sm text-gray-400">Cargando…</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
            <p className="font-semibold text-gray-700">{nombre}</p>
            <p className="capitalize text-gray-400">{puesto}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-teal">Correo electrónico</label>
            <p className="mb-2 text-xs text-gray-400">
              Se usa para poder restablecer tu contraseña si la olvidas.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                className="gm-input"
                placeholder="tucorreo@ejemplo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
              <button className="gm-btn-guardar shrink-0" onClick={guardarCorreo} disabled={guardandoCorreo}>
                {guardandoCorreo ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-semibold text-teal">Cambiar contraseña</label>
            <div className="mt-2 space-y-2">
              <input
                type="password"
                className="gm-input"
                placeholder="Contraseña actual"
                value={contrasenaActual}
                onChange={(e) => setContrasenaActual(e.target.value)}
              />
              <input
                type="password"
                className="gm-input"
                placeholder="Nueva contraseña"
                value={contrasenaNueva}
                onChange={(e) => setContrasenaNueva(e.target.value)}
              />
              <input
                type="password"
                className="gm-input"
                placeholder="Confirmar nueva contraseña"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && guardarContrasena()}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button className="gm-btn-guardar" onClick={guardarContrasena} disabled={cambiando}>
                {cambiando ? 'Cambiando…' : 'Cambiar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button className="gm-btn-cancelar" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
