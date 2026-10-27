namespace Empresa.Intranet.Domain.Entities;
public class Tractocamion
{
    public uint Id { get; set; }
    public int Modelo { get; set; }
    public string Color { get; set; } = null!;
    public uint IdMarca { get; set; }
    public uint? IdEmpresa { get; set; }
    public string? Placa { get; set; }
    public bool Activo { get; set; } = true;
    public MarcaTractocamion Marca { get; set; } = null!;
    public Empresa? Empresa { get; set; }
    public ICollection<DetalleTransporte> DetallesTransporte { get; set; } = new List<DetalleTransporte>();
}