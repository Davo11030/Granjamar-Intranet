import api from './config'
export const getMovimientos = (params = '') => api.get(`/Auditoria${params ? '?' + params : ''}`)