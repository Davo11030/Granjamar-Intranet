namespace Empresa.Intranet.Domain.Entities;
public class EstadoRecoleccion
{
    public uint Id { get; set; }
    public string? Descripcion { get; set; }
    public ICollection<Venta> Ventas { get; set; } = new List<Venta>();
}