namespace Empresa.Intranet.Domain.Entities;
public class ClavesSat
{
    public int Id { get; set; }
    public string Codigo { get; set; } = null!;
    public string Nombre { get; set; } = null!;
    public ICollection<Especie> Especies { get; set; } = new List<Especie>();
}