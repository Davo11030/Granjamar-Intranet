import api from './config'
export const login = (datos) => api.post('/Usuarios/login', datos)