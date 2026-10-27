import { useEffect, useState } from 'react'
import Modal from './Modal'
import { useToast } from '../context/ToastContext'
import { solicitarRestablecimiento, getEstadoSolicitud, restablecerConAprobacion } from '../api/usuarios'

// Pasos: 'usuario' -> pide el nombre y consulta su estado
//        'ninguna'  -> no hay solicitud activa, ofrece enviarla
//        'pendiente'-> ya se envió, espera aprobación del administrador
//        'aprobada' -> el administrador ya aprobó, puede poner su nueva contraseña
export default function ModalRecuperarContrasena({ abierto, onCerrar }) {
  const toast = useToast()
  const [paso, setPaso] = useState('usuario')
  const [nombre, setNombre] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setPaso('usuario')
    setNombre('')
    setNueva('')
    setConfirmar('')
    setError('')
  }, [abierto])

  const consultarEstado = async () => {
    setError('')
    if (!nombre.trim()) return setError('Ingresa tu usuario')
    setCargando(true)
    try {
      const res = await getEstadoSolicitud(nombre.trim())
      const estado = (res.data.estado || 'Ninguna').toLowerCase()
      if (estado === 'aprobada') setPaso('aprobada')
      else if (estado === 'pendiente') setPaso('pendiente')
      else setPaso('ninguna')
    } catch {
      setError('No se pudo consultar tu solicitud')
    } finally {
      setCargando(false)
    }
  }

  const enviarSolicitud = async () => {
    setCargando(true)
    setError('')
    try {
      await solicitarRestablecimiento(nombre.trim())
      toast.exito('Solicitud enviada. Un administrador debe aprobarla.')
      setPaso('pendiente')
    } catch {
      setError('No se pudo enviar la solicitud')
    } finally {
      setCargando(false)
    }
  }

  const restablecer = async () => {
    setError('')
    if (nueva.length < 4) return setError('La nueva contraseña debe tener al menos 4 caracteres')
    if (nueva !== confirmar) return setError('Las contraseñas no coinciden')
    setCargando(true)
    try {
      await restablecerConAprobacion({ nombre: nombre.trim(), contrasenaNueva: nueva })
      toast.exito('Contraseña actualizada. Ya puedes iniciar sesión.')
      onCerrar()
    } catch (e) {
      setError(e.response?.data?.mensaje || 'No se pudo restablecer la contraseña')
    } finally {
      setCargando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Restablecer contraseña" ancho="max-w-md">
      {paso === 'usuario' && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Escribe tu usuario. Si nunca has hecho una solicitud, se le avisará a un administrador
            para que la autorice.
          </p>
          <input
            type="text"
            className="gm-input"
            placeholder="Usuario"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && consultarEstado()}
            autoFocus
          />
          {error && <p className="text-red-600 text-sm mt-3 text-center font-medium">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button className="gm-btn-cancelar" onClick={onCerrar}>
              Cancelar
            </button>
            <button className="gm-btn-guardar" onClick={consultarEstado} disabled={cargando}>
              {cargando ? 'Consultando…' : 'Continuar'}
            </button>
          </div>
        </>
      )}

      {paso === 'ninguna' && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            No tienes una solicitud activa. Podemos avisarle a un administrador para que autorice
            que <strong>{nombre}</strong> restablezca su contraseña.
          </p>
          {error && <p className="text-red-600 text-sm mb-3 text-center font-medium">{error}</p>}
          <div className="flex justify-end gap-3">
            <button className="gm-btn-cancelar" onClick={() => setPaso('usuario')}>
              Volver
            </button>
            <button className="gm-btn-guardar" onClick={enviarSolicitud} disabled={cargando}>
              {cargando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </>
      )}

      {paso === 'pendiente' && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Tu solicitud ya fue enviada y está esperando que un administrador la apruebe. Vuelve a
            intentarlo más tarde con el botón "Olvidé contraseña".
          </p>
          <div className="flex justify-end">
            <button className="gm-btn-guardar" onClick={onCerrar}>
              Entendido
            </button>
          </div>
        </>
      )}

      {paso === 'aprobada' && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Tu solicitud fue aprobada. Escribe tu nueva contraseña para <strong>{nombre}</strong>.
          </p>
          <div className="space-y-3">
            <input
              type="password"
              className="gm-input"
              placeholder="Nueva contraseña"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              autoFocus
            />
            <input
              type="password"
              className="gm-input"
              placeholder="Confirmar nueva contraseña"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && restablecer()}
            />
          </div>
          {error && <p className="text-red-600 text-sm mt-3 text-center font-medium">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button className="gm-btn-cancelar" onClick={onCerrar}>
              Cancelar
            </button>
            <button className="gm-btn-guardar" onClick={restablecer} disabled={cargando}>
              {cargando ? 'Guardando…' : 'Restablecer'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
