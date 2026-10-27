namespace Empresa.Intranet.Domain.Entities;
public class FormaPago
{
    public uint Id { get; set; }
    public string? Nombre { get; set; }
    public ICollection<Venta> Ventas { get; set; } = new List<Venta>();
}