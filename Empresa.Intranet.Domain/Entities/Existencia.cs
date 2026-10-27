namespace Empresa.Intranet.Domain.Entities;
public class Existencia
{
    public uint Id { get; set; }
    public string Lote { get; set; } = null!;
    public string CodigoProducto { get; set; } = null!;
    public uint? IdDocumentoOrigen { get; set; }
    public decimal? Costo { get; set; }
    // Si el lote lo creó producción: el lote del que provenía el producto la primera vez.
    public string? LoteOrigen { get; set; }
    public DateTime? Caducidad { get; set; }
    public bool Activo { get; set; } = true;
    public Producto Producto { get; set; } = null!;
    public Documento? DocumentoOrigen { get; set; }
    public ICollection<UbicacionProducto> UbicacionesProducto { get; set; } = new List<UbicacionProducto>();
    public ICollection<DetalleMovimiento> DetallesMovimiento { get; set; } = new List<DetalleMovimiento>();
}