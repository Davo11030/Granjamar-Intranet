import api from './config'

export const getPedidosConsignacion = (idEmpresa) => api.get(`/PedidosConsignacion?idEmpresa=${idEmpresa}`)
export const getPedidoConsignacion = (id) => api.get(`/PedidosConsignacion/${id}`)

// Crea una orden de embarque del pedido: su número, su documento y qué producto (y kilos) libera
// ([{ codigo, kilos }]). El pedido sigue Pendiente hasta que todo su producto tenga orden.
export const liberarPedidoConsignacion = (id, ordenEmbarque, archivo, productos) => {
  const datos = new FormData()
  datos.append('ordenEmbarque', ordenEmbarque)
  datos.append('archivo', archivo)
  if (productos) datos.append('productos', JSON.stringify(productos))
  return api.put(`/PedidosConsignacion/${id}/liberar`, datos)
}

// Sube la factura de una orden de embarque (o reemplaza la anterior): cada orden lleva la suya.
export const subirFacturaOrden = (idOrden, numeroFactura, archivo) => {
  const datos = new FormData()
  datos.append('numeroFactura', numeroFactura)
  datos.append('archivo', archivo)
  return api.put(`/PedidosConsignacion/ordenes/${idOrden}/factura`, datos)
}

// Divide un pedido en varios: partes = [[{ codigo, kilos }, …], …]. El original queda Cancelado.
export const dividirPedido = (id, partes) => api.post(`/PedidosConsignacion/${id}/dividir`, { partes })

// Corrige una orden de embarque: número, documento (solo si se manda otro archivo) y/o producto y kilos que libera.
export const editarOrdenEmbarque = (idOrden, ordenEmbarque, archivo, productos) => {
  const datos = new FormData()
  datos.append('ordenEmbarque', ordenEmbarque)
  if (archivo) datos.append('archivo', archivo)
  if (productos) datos.append('productos', JSON.stringify(productos))
  return api.put(`/PedidosConsignacion/ordenes/${idOrden}`, datos)
}

// Quita una orden de embarque (y su factura): el pedido vuelve a faltar ese producto.
export const eliminarOrdenEmbarque = (idOrden) => api.delete(`/PedidosConsignacion/ordenes/${idOrden}`)

// Quita la factura de una orden.
export const quitarFacturaOrden = (idOrden) => api.delete(`/PedidosConsignacion/ordenes/${idOrden}/factura`)

// Anula la cancelación de un pedido dividido: desaparecen los pedidos en que se dividió y vuelve a Pendiente.
export const deshacerDivisionPedido = (id) => api.post(`/PedidosConsignacion/${id}/deshacer-division`)
