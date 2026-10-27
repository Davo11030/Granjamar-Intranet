namespace Empresa.Intranet.Domain.Entities;

// Producto que producción pide a una empresa en consignación. NO descuenta inventario ni registra
// el ingreso a producción todavía: solo deja constancia de lo solicitado, para agruparlo después en
// uno o varios pedidos de consignación.
public class SolicitudProduccion
{
    public uint Id { get; set; }
    public uint IdEmpresa { get; set; }          // la empresa en consignación a la que se le pide
    public string CodigoProducto { get; set; } = null!;
    public decimal Kilos { get; set; }
    // De qué lote/ubicación se tomaría (informativo mientras no haya descuento).
    public uint? IdExistencia { get; set; }
    public uint? IdDireccion { get; set; }
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public uint IdUsuario { get; set; }
    // El renglón de la tabla general de producción que la generó (el producto ya está en producción sin esperar el pedido).
    public uint? IdLinea { get; set; }
    public ProduccionInventarioLinea? Linea { get; set; }
    // Pedido en el que se agrupó (null = aún sin pedido).
    public uint? IdPedido { get; set; }
    public bool Activo { get; set; } = true;
    public Empresa Empresa { get; set; } = null!;
    public Producto Producto { get; set; } = null!;
    public Usuario Usuario { get; set; } = null!;
    public PedidoConsignacion? Pedido { get; set; }
}
