import api from './config'

export const getVentas = (params) => api.get('/Ventas', { params })
export const getVenta = (id) => api.get(`/Ventas/${id}`)
export const crearVenta = (datos) => api.post('/Ventas', datos)
export const actualizarVenta = (id, datos) => api.put(`/Ventas/${id}`, datos)
export const cambiarEstadoVenta = (id, datos) => api.put(`/Ventas/${id}/estado`, datos)
export const eliminarVenta = (id, idUsuario) => api.delete(`/Ventas/${id}?idUsuario=${idUsuario}`)

// Catálogos de venta
export const getFormasPago = () => api.get('/CatalogosVenta/formas-pago')
export const crearFormaPago = (nombre) => api.post('/CatalogosVenta/formas-pago', { nombre })
export const getLugaresEntrega = () => api.get('/CatalogosVenta/lugares-entrega')
export const crearLugarEntrega = (nombre) => api.post('/CatalogosVenta/lugares-entrega', { nombre })
export const getEstadosRecoleccion = () => api.get('/CatalogosVenta/estados-recoleccion')
export const crearEstadoRecoleccion = (nombre) =>
  api.post('/CatalogosVenta/estados-recoleccion', { nombre })

// Devuelve el id de un catálogo por nombre; si no existe, lo crea.
export async function idCatalogo(lista, nombre, crearFn, campo = 'nombre') {
  const encontrado = lista.find(
    (x) => (x[campo] || x.nombre || x.descripcion || '').toLowerCase() === nombre.toLowerCase(),
  )
  if (encontrado) return encontrado.id
  const { data } = await crearFn(nombre)
  return data.id
}
