namespace Empresa.Intranet.Domain.Entities;

public class Empresa
{
    public uint Id { get; set; }
    public string Nombre { get; set; } = null!;
    public string? Rfc { get; set; }
    public string? UrlLogo { get; set; }
    public bool Activo { get; set; } = true;
    public string? Tipo { get; set; }

    public ICollection<Direccion> Direcciones { get; set; } = new List<Direccion>();
    public ICollection<Tractocamion> Tractocamiones { get; set; } = new List<Tractocamion>();
    public ICollection<Compras> Compras { get; set; } = new List<Compras>();
}