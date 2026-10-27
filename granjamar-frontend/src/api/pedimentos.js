import api from './config'
export const getPedimentos = () => api.get('/Documentos')
export const crearPedimento = (datos) => api.post('/Documentos', datos)