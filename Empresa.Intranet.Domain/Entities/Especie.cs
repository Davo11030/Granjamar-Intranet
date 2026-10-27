namespace Empresa.Intranet.Domain.Entities;
public class Especie
{
    public int Id { get; set; }
    public string Nombre { get; set; } = null!;
    public string CodigoClaveSat { get; set; } = null!;
    public ClavesSat ClaveSat { get; set; } = null!;
    public ICollection<Producto> Productos { get; set; } = new List<Producto>();
}