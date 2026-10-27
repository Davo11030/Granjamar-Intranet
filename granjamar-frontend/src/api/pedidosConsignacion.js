import api from './config'

export const getPedidosConsignacion = (idEmpresa) => api.get(`/PedidosConsignacion?idEmpresa=${idEmpresa}`)
export const getPedidoConsignacion = (id) => api.get(`/PedidosConsignacion/${id}`)

// Pendiente → Liberado: el número de la orden de embarque y su documento van juntos.
export const liberarPedidoConsignacion = (id, ordenEmbarque, archivo) => {
  const datos = new FormData()
  datos.append('ordenEmbarque', ordenEmbarque)
  datos.append('archivo', archivo)
  return api.put(`/PedidosConsignacion/${id}/liberar`, datos)
}

// Sube la factura del pedido (o reemplaza la anterior).
export const subirFacturaPedido = (id, numeroFactura, archivo) => {
  const datos = new FormData()
  datos.append('numeroFactura', numeroFactura)
  datos.append('archivo', archivo)
  return api.put(`/PedidosConsignacion/${id}/factura`, datos)
}
