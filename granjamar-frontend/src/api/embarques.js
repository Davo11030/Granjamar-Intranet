import api from './config'
export const getEmbarques = () => api.get('/Embarques')
export const getEmbarque = (id) => api.get(`/Embarques/${id}`)
export const getEmbarquesPorNumero = (numero) => api.get(`/Embarques/por-numero/${encodeURIComponent(numero)}`)
export const crearEmbarque = (datos) => api.post('/Embarques', datos)
export const actualizarEmbarque = (id, datos) => api.put(`/Embarques/${id}`, datos)
export const cambiarEstadoEmbarque = (id, datos) => api.put(`/Embarques/${id}/estado`, datos)
export const marcarDocumentoEmbarque = (id, datos) => api.put(`/Embarques/${id}/documento`, datos)
export const guardarSolicitud = (id, datos) => api.put(`/Embarques/${id}/solicitud`, datos)
export const guardarRt = (id, datos) => api.put(`/Embarques/${id}/rt`, datos)
export const eliminarEmbarque = (id, idUsuario) => api.delete(`/Embarques/${id}?idUsuario=${idUsuario}`)
// Todo lo que lleva la hoja de Requisición de ese embarque (destino) y la lista de datos que le faltan.
export const getRequisicion = (id) => api.get(`/Embarques/${id}/requisicion`)
// Todo lo que lleva la hoja de Solicitud del embarque (todos sus destinos) y la lista de datos que le faltan.
export const getSolicitudDocumento = (id) => api.get(`/Embarques/${id}/solicitud-documento`)
// Las tarimas del Ciego de carga (todos los destinos del embarque), con a qué sucursal va cada una y lo que le falta.
export const getCiegoDocumento = (id) => api.get(`/Embarques/${id}/ciego-documento`)
// La Carta responsiva de los sellos de seguridad (fecha, destino final, sellos y compañía de transporte) y lo que le falta.
export const getCartaDocumento = (id) => api.get(`/Embarques/${id}/carta-documento`)
// Guarda los números de sello de seguridad (el primero es obligatorio) en todos los destinos del mismo número de embarque.
export const guardarSellos = (id, datos) => api.put(`/Embarques/${id}/sellos`, datos)
// Los datos de la hoja de RT de un destino, los documentos que se anexan al PDF y lo que le falta.
export const getRtDocumento = (id) => api.get(`/Embarques/${id}/rt-documento`)
