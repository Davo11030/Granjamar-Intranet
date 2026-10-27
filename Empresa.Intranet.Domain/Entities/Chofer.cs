namespace Empresa.Intranet.Domain.Entities;
public class Chofer
{
    public uint Id { get; set; }
    public string Nombre { get; set; } = null!;
    public string NumeroTelefono { get; set; } = null!;
    public string? TipoTelefono { get; set; }
    public bool Activo { get; set; } = true;
    public ICollection<DetalleTransporte> DetallesTransporte { get; set; } = new List<DetalleTransporte>();
}