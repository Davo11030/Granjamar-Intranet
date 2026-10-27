import api from './config'
export const getUsuarios = () => api.get('/Usuarios')
export const crearUsuario = (datos) => api.post('/Usuarios', datos)
export const actualizarUsuario = (id, datos) => api.put(`/Usuarios/${id}`, datos)
export const eliminarUsuario = (id, idUsuario) => api.delete(`/Usuarios/${id}?idUsuario=${idUsuario}`)

// Perfil propio (cualquier usuario autenticado, sin requerir ser admin)
export const getPerfil = () => api.get('/Usuarios/perfil')
export const actualizarPerfil = (datos) => api.put('/Usuarios/perfil', datos)
export const cambiarContrasena = (datos) => api.put('/Usuarios/perfil/contrasena', datos)

// Restablecer contraseña sin sesión iniciada, vía aprobación del administrador
export const solicitarRestablecimiento = (nombre) => api.post('/Usuarios/solicitar-restablecimiento', { nombre })
export const getEstadoSolicitud = (nombre) =>
  api.get(`/Usuarios/solicitud-restablecimiento/estado?nombre=${encodeURIComponent(nombre)}`)
export const restablecerConAprobacion = (datos) => api.post('/Usuarios/restablecer-con-aprobacion', datos)

// Panel de administración de solicitudes de restablecimiento
export const getSolicitudesRestablecimiento = () => api.get('/Usuarios/solicitudes-restablecimiento')
export const aprobarSolicitud = (id) => api.put(`/Usuarios/solicitudes-restablecimiento/${id}/aprobar`)
export const rechazarSolicitud = (id) => api.put(`/Usuarios/solicitudes-restablecimiento/${id}/rechazar`)
