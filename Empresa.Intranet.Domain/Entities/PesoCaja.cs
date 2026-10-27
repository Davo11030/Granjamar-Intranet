namespace Empresa.Intranet.Domain.Entities;
public class PesoCaja
{
    public int Id { get; set; }
    public decimal Peso { get; set; }
    public ICollection<Producto> Productos { get; set; } = new List<Producto>();
}