namespace Empresa.Intranet.Domain.Entities;
public class MarcaTractocamion
{
    public uint Id { get; set; }
    public string Nombre { get; set; } = null!;
    public ICollection<Tractocamion> Tractocamiones { get; set; } = new List<Tractocamion>();
}