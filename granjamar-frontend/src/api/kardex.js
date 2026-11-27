import api from './config'
export const getKardex = () => api.get('/Productos')
export const crearProducto = (datos) => api.post('/Productos', datos)
export const actualizarProducto = (codigo, datos) => api.put(`/Productos/${codigo}`, datos)
// Baja lógica: el producto deja de aparecer en el kardex (se reactiva en Administración → Dados de baja).
export const darDeBajaProducto = (codigo) => api.delete(`/Productos/${encodeURIComponent(codigo)}`)
export const getEspecies = () => api.get('/Especies')
export const getMarcas = () => api.get('/Marcas')
export const getTallas = () => api.get('/Tallas')
export const getPesosCaja = () => api.get('/PesosCaja')
export const getPresentaciones = () => api.get('/Presentaciones')

// Catálogos del kardex: alta, cambio y baja. Especies lleva { nombre, codigoClaveSat };
// marcas, tallas y presentaciones llevan { nombre }.
export const crearCatalogo = (ruta, datos) => api.post(`/${ruta}`, datos)
export const actualizarCatalogo = (ruta, id, datos) => api.put(`/${ruta}/${id}`, datos)
export const eliminarCatalogo = (ruta, id) => api.delete(`/${ruta}/${id}`)

// Pesos por caja: la API recibe solo el número en el cuerpo (p. ej. 10.5), no un objeto.
const comoJson = { headers: { 'Content-Type': 'application/json' } }
export const crearPesoCaja = (peso) => api.post('/PesosCaja', JSON.stringify(peso), comoJson)
export const actualizarPesoCaja = (id, peso) => api.put(`/PesosCaja/${id}`, JSON.stringify(peso), comoJson)
