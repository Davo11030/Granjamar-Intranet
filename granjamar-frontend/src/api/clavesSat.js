import api from './config'
export const getClavesSat = () => api.get('/ClavesSat')
export const crearClaveSat = (datos) => api.post('/ClavesSat', datos)
export const actualizarClaveSat = (id, datos) => api.put(`/ClavesSat/${id}`, datos)