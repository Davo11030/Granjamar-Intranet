import api from './config'
// ── Tabla general de producción (un día a la vez; la fecha es yyyy-MM-dd)
export const getInventarioProduccion = (fecha) => api.get('/ProduccionInventario', { params: { fecha } })
export const guardarInventarioProduccion = (fecha, lineas) => api.put(`/ProduccionInventario/${fecha}`, { lineas })

// ── Reportes diarios
// Listado de reportes (uno por día).
export const getProducciones = () => api.get('/Producciones')
// Un reporte completo, para verlo o editarlo.
export const getReporteProduccion = (fecha) => api.get(`/Producciones/reporte/${fecha}`)
export const crearProduccion = (datos) => api.post('/Producciones', datos)
export const editarReporteProduccion = (fecha, datos) => api.put(`/Producciones/reporte/${fecha}`, datos)
// Elimina el reporte del día y deshace los lotes que sus salidas metieron a Conpaq.
export const eliminarReporteProduccion = (fecha) => api.delete(`/Producciones/reporte/${fecha}`)
// Lo desbloqueado y lo que está en proceso (M.P.) al empezar el reporte de ese día.
export const getDisponibleProduccion = (fecha) => api.get('/Producciones/disponible', { params: { fecha } })
