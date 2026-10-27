import api from './config'
export const getDirecciones = () => api.get('/Direcciones')
export const crearDireccion = (datos) => api.post('/Direcciones', datos)
export const actualizarDireccion = (id, datos) => api.put(`/Direcciones/${id}`, datos)
export const getEmpresas = () => api.get('/Empresas')
export const crearEmpresa = (datos) => api.post('/Empresas', datos)
export const actualizarEmpresa = (id, datos) => api.put(`/Empresas/${id}`, datos)
export const eliminarEmpresa = (id, idUsuario) => api.delete(`/Empresas/${id}?idUsuario=${idUsuario}`)
export const getEmpresa = (id) => api.get(`/Empresas/${id}`)