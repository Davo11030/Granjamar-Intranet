import api from './config'

export const getStockProducto = (codigo) =>
  api.get(`/UbicacionProducto/stock/${codigo}`)

export const getUbicaciones = () =>
  api.get('/UbicacionProducto')

export const getUbicacionesPorEmpresa = (idEmpresa) =>
  api.get(`/UbicacionProducto?idEmpresa=${idEmpresa}`)

export const getProductos = () =>
  api.get('/Productos')

export const getProducto = (codigo) =>
  api.get(`/Productos/${codigo}`)

export const getExistencias = () =>
  api.get('/Existencias')

export const getUbicacionesPorDireccion = (idDireccion) =>
  api.get(`/UbicacionProducto?idDireccion=${idDireccion}`)

export const getTrazabilidad = (idExistencia) =>
  api.get(`/UbicacionProducto/trazabilidad/${idExistencia}`)

export const crearUbicacion = (datos) =>
  api.post('/UbicacionProducto', datos)

export const actualizarUbicacion = (id, datos) =>
  api.put(`/UbicacionProducto/${id}`, datos)

export const crearExistencia = (datos) =>
  api.post('/Existencias', datos)

export const getPedimentosPorProducto = (codigoProducto) =>
  api.get(`/Existencias/pedimentos/${codigoProducto}`)
// Traspaso Conpaq → resguardo (baja origen, sube destino y deja el registro interno de salida).
export const traspasoResguardo = (datos) => api.post('/UbicacionProducto/traspaso-resguardo', datos)

// Historial de un producto dentro de una empresa de resguardo (todos sus lotes).
// Llega por páginas (del movimiento más reciente al más viejo): { total, pagina, porPagina, movimientos }.
export const getHistorialResguardo = (idEmpresa, codigoProducto, pagina = 1, porPagina = 20) =>
  api.get(`/UbicacionProducto/resguardo/${idEmpresa}/historial/${encodeURIComponent(codigoProducto)}`, {
    params: { pagina, porPagina },
  })

// Historial de un artículo dentro de una empresa (consignación o resguardo): todos sus lotes juntos, por páginas.
export const getHistorialEmpresa = (idEmpresa, codigoProducto, pagina = 1, porPagina = 20) =>
  api.get(`/UbicacionProducto/empresa/${idEmpresa}/historial/${encodeURIComponent(codigoProducto)}`, {
    params: { pagina, porPagina },
  })
