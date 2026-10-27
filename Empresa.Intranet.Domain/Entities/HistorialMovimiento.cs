namespace Empresa.Intranet.Domain.Entities;
public class HistorialMovimiento
{
    public uint Id { get; set; }
    public DateTime FechaRegistro { get; set; }
    public uint IdUsuario { get; set; }
    public Usuario Usuario { get; set; } = null!;
    public ICollection<DetalleMovimiento> DetallesMovimiento { get; set; } = new List<DetalleMovimiento>();
    public ICollection<Embarque> Embarques { get; set; } = new List<Embarque>();
    public ICollection<Venta> Ventas { get; set; } = new List<Venta>();
    public ICollection<Compras> Compras { get; set; } = new List<Compras>();
}