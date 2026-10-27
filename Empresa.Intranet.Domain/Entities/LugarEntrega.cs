namespace Empresa.Intranet.Domain.Entities;
public class LugarEntrega
{
    public uint Id { get; set; }
    public string? Nombre { get; set; }
    public ICollection<Venta> Ventas { get; set; } = new List<Venta>();
}