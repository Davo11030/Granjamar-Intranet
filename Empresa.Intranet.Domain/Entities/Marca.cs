namespace Empresa.Intranet.Domain.Entities;
public class Marca
{
    public int Id { get; set; }
    public string Nombre { get; set; } = null!;
    public ICollection<Producto> Productos { get; set; } = new List<Producto>();
}