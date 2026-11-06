namespace Empresa.Intranet.Domain.Entities;

// Solicitud de compra a una empresa en consignación (ej. Genitech): se genera sola cuando un
// embarque, una venta o una producción usa producto de su inventario en consignación.
public class PedidoConsignacion
{
    public uint Id { get; set; }
    // Folio del pedido, por empresa y consecutivo: Ens-01, Ens-02…
    public string Numero { get; set; } = null!;
    public uint IdEmpresa { get; set; }
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    // De dónde nació: "Embarque" | "Venta" | "Produccion" (+ su id) — para mantenerlo al día si cambia.
    public string TipoOrigen { get; set; } = null!;
    public uint IdOrigen { get; set; }
    // A dónde va: "Embarque" | "Cliente" | "Producción", y el texto a mostrar.
    public string TipoDestino { get; set; } = null!;
    public string Destino { get; set; } = null!;
    // Pendiente (aún falta liberar todo o parte) | Liberado (todo el producto ya tiene su orden de embarque) |
    // Cancelado (se dividió en otros pedidos).
    public string Estado { get; set; } = "Pendiente";
    // Si este pedido nació de dividir otro: el pedido que se dividió (queda Cancelado).
    public uint? IdPedidoDividido { get; set; }
    public bool Activo { get; set; } = true;
    public Empresa Empresa { get; set; } = null!;
    public PedidoConsignacion? PedidoDividido { get; set; }
    public ICollection<PedidoConsignacionDetalle> Detalles { get; set; } = new List<PedidoConsignacionDetalle>();
    // Cada orden de embarque libera una parte (o todo) del pedido y lleva su propia factura.
    public ICollection<PedidoConsignacionOrden> Ordenes { get; set; } = new List<PedidoConsignacionOrden>();
}

public class PedidoConsignacionDetalle
{
    public uint Id { get; set; }
    public uint IdPedido { get; set; }
    public string CodigoProducto { get; set; } = null!;
    public decimal Kilos { get; set; }
    public PedidoConsignacion Pedido { get; set; } = null!;
    public Producto Producto { get; set; } = null!;
}

// Una orden de embarque de un pedido: qué producto (y cuántos kilos) libera y la factura que le corresponde.
public class PedidoConsignacionOrden
{
    public uint Id { get; set; }
    public uint IdPedido { get; set; }
    // Número de la orden de embarque y su documento (tipo "Orden de embarque").
    public string Numero { get; set; } = null!;
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public uint? IdDocumentoOrden { get; set; }
    public uint? IdDocumentoFactura { get; set; }
    public PedidoConsignacion Pedido { get; set; } = null!;
    public Documento? DocumentoOrden { get; set; }
    public Documento? DocumentoFactura { get; set; }
    public ICollection<PedidoConsignacionOrdenDetalle> Detalles { get; set; } = new List<PedidoConsignacionOrdenDetalle>();
}

public class PedidoConsignacionOrdenDetalle
{
    public uint Id { get; set; }
    public uint IdOrden { get; set; }
    public string CodigoProducto { get; set; } = null!;
    public decimal Kilos { get; set; }
    public PedidoConsignacionOrden Orden { get; set; } = null!;
    public Producto Producto { get; set; } = null!;
}
