namespace Empresa.Intranet.Domain.Entities;
public class Talla
{
    public int Id { get; set; }
    public string Descripcion { get; set; } = null!;
    public ICollection<Producto> Productos { get; set; } = new List<Producto>();
}