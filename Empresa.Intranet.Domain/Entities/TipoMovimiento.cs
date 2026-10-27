namespace Empresa.Intranet.Domain.Entities;
public class TipoMovimiento
{
    public uint Id { get; set; }
    public string Nombre { get; set; } = null!;
    public ICollection<DetalleMovimiento> DetallesMovimiento { get; set; } = new List<DetalleMovimiento>();
}