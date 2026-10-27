namespace Empresa.Intranet.Domain.Entities;
public class CajaTractocamion
{
    public uint Id { get; set; }
    public string? CajaPlaca { get; set; }
    public string? CajaTamano { get; set; }
    public int? CajaCapacidad { get; set; }
    public uint? IdEmpresa { get; set; }
    public bool Activo { get; set; } = true;
    public Empresa? Empresa { get; set; }
    public ICollection<DetalleTransporte> DetallesTransporte { get; set; } = new List<DetalleTransporte>();
}