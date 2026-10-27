namespace Empresa.Intranet.Application.DTOs;

public class DireccionDto
{
    public uint Id { get; set; }
    public string Direccion { get; set; } = null!;
    public string Estado { get; set; } = null!;
    public string Municipio { get; set; } = null!;
    public uint? IdEmpresa { get; set; }
    public string? Empresa { get; set; }
}

public class CrearDireccionDto
{
    public uint IdUsuario { get; set; }
    public string Direccion { get; set; } = null!;
    public string Estado { get; set; } = null!;
    public string Municipio { get; set; } = null!;
    public uint? IdEmpresa { get; set; }
}