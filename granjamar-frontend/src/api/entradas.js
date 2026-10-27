import api from './config'
export const getEntradas = () => api.get('/Compras')
export const getEntrada = (id) => api.get(`/Compras/${id}`)
export const crearEntrada = (datos) => api.post('/Compras', datos)
export const actualizarEntrada = (id, datos) => api.put(`/Compras/${id}`, datos)
export const eliminarEntrada = (id, idUsuario) => api.delete(`/Compras/${id}?idUsuario=${idUsuario}`)
export const cambiarEstadoEntrada = (id, datos) => api.put(`/Compras/${id}/estado`, datos)
export const getHistorialEstadoEntrada = (id) => api.get(`/Compras/${id}/historial-estado`)