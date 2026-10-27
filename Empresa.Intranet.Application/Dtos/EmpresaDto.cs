namespace Empresa.Intranet.Application.DTOs;

public class EmpresaDto
{
    public uint Id { get; set; }
    public string Nombre { get; set; } = null!;
    public string? Rfc { get; set; }
    public string? UrlLogo { get; set; }
    public string? Tipo { get; set; }
}

public class CrearEmpresaDto
{
    public uint IdUsuario { get; set; }
    public string Nombre { get; set; } = null!;
    public string? Rfc { get; set; }
    public string? UrlLogo { get; set; }
    public string? Tipo { get; set; }
}