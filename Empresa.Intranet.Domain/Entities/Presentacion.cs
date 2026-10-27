namespace Empresa.Intranet.Domain.Entities;
public class Presentacion
{
    public int Id { get; set; }
    public string Nombre { get; set; } = null!;
    public ICollection<Descripcion> Descripciones { get; set; } = new List<Descripcion>();
}