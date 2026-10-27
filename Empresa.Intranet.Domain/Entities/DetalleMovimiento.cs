namespace Empresa.Intranet.Domain.Entities;
public class DetalleMovimiento
{
    public uint Id { get; set; }
    public uint? IdExistencia { get; set; }
    // Producto pedido sin un lote específico todavía — usado por la Requisición de un Embarque,
    // que solo fija producto+ubicación+kilos; el lote real (Existencia) se decide hasta la
    // Solicitud. Para otros tipos de movimiento (Venta, Compra, Producción) esto queda null y
    // el producto se sigue resolviendo vía Existencia como siempre.
    public string? CodigoProducto { get; set; }
    public uint IdHistorial { get; set; }
    public decimal Kilos { get; set; }
    public uint IdTipoMovimiento { get; set; }
    public decimal? Saldo { get; set; }
    public uint? IdDireccion { get; set; }
    public uint? IdDepartamento { get; set; }
    public uint? IdDetalleTransporte { get; set; }
    public Existencia? Existencia { get; set; }
    public HistorialMovimiento HistorialMovimiento { get; set; } = null!;
    public TipoMovimiento TipoMovimiento { get; set; } = null!;
    public Direccion? Direccion { get; set; }
    public Departamento? Departamento { get; set; }
    public DetalleTransporte? DetalleTransporte { get; set; }
    public ICollection<Produccion> Producciones { get; set; } = new List<Produccion>();
}
