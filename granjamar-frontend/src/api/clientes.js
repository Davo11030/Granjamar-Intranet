import api from './config'
export const getClientes = () => api.get('/Clientes')
export const crearCliente = (datos) => api.post('/Clientes', datos)
export const actualizarCliente = (id, datos) => api.put(`/Clientes/${id}`, datos)
export const eliminarCliente = (id, idUsuario) => api.delete(`/Clientes/${id}?idUsuario=${idUsuario}`)