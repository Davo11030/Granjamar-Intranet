import api from './config'

export const getSolicitudesProduccion = (idEmpresa) => api.get(`/SolicitudesProduccion?idEmpresa=${idEmpresa}`)

// grupos: lista de grupos de ids; cada grupo se vuelve UN pedido de consignación.
export const crearPedidoDeSolicitudes = (idEmpresa, grupos) =>
  api.post('/SolicitudesProduccion/crear-pedido', { idEmpresa, grupos })

export const quitarSolicitudProduccion = (id) => api.delete(`/SolicitudesProduccion/${id}`)
