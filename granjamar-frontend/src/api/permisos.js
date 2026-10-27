import api from './config'
export const getPermisos = () => api.get('/Permisos')
export const getPermisosPorUsuario = (id) => api.get(`/Permisos/usuario/${id}`)
export const crearPermiso = (datos) => api.post('/Permisos', datos)
export const asignarPermiso = (datos) => api.post('/Permisos/asignar', datos)
export const quitarPermiso = (idUsuario, idPermiso) => api.delete(`/Permisos/quitar/${idUsuario}/${idPermiso}`)
export const getMisPermisos = () => api.get('/Permisos/mis-permisos')
