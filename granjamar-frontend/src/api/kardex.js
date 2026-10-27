import api from './config'
export const getKardex = () => api.get('/Productos')
export const crearProducto = (datos) => api.post('/Productos', datos)
export const actualizarProducto = (codigo, datos) => api.put(`/Productos/${codigo}`, datos)
export const getEspecies = () => api.get('/Especies')
export const getMarcas = () => api.get('/Marcas')
export const getTallas = () => api.get('/Tallas')
export const getPesosCaja = () => api.get('/PesosCaja')
export const getPresentaciones = () => api.get('/Presentaciones')