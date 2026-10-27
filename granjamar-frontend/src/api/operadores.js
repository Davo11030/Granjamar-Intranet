import api from './config'

export const getChoferes = (params) => api.get('/CatalogosTransporte/choferes', { params })
export const crearChofer = (datos) => api.post('/CatalogosTransporte/choferes', datos)
export const actualizarChofer = (id, datos) => api.put(`/CatalogosTransporte/choferes/${id}`, datos)
export const eliminarChofer = (id) => api.delete(`/CatalogosTransporte/choferes/${id}`)

export const getTractocamiones = (params) => api.get('/CatalogosTransporte/tractocamiones', { params })
export const crearTractocamion = (datos) => api.post('/CatalogosTransporte/tractocamiones', datos)
export const actualizarTractocamion = (id, datos) => api.put(`/CatalogosTransporte/tractocamiones/${id}`, datos)
export const eliminarTractocamion = (id) => api.delete(`/CatalogosTransporte/tractocamiones/${id}`)

export const getMarcasTractocamion = () => api.get('/CatalogosTransporte/marcas-tractocamion')
export const crearMarcaTractocamion = (nombre) => api.post('/CatalogosTransporte/marcas-tractocamion', { nombre })

export const getCajas = (params) => api.get('/CatalogosTransporte/cajas-tractocamion', { params })
export const crearCaja = (datos) => api.post('/CatalogosTransporte/cajas-tractocamion', datos)
export const actualizarCaja = (id, datos) => api.put(`/CatalogosTransporte/cajas-tractocamion/${id}`, datos)
export const eliminarCaja = (id) => api.delete(`/CatalogosTransporte/cajas-tractocamion/${id}`)
