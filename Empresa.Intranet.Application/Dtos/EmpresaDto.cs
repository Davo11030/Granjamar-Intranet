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
    // Opcional: las direcciones de la empresa, para guardarlas junto con ella en una sola operación. Las que traen Id
    // se actualizan; las que no, se crean. Las que no vienen no se tocan (la baja de una dirección va aparte).
    public List<DireccionEmpresaDto>? Direcciones { get; set; }
}

public class DireccionEmpresaDto
{
    public uint? Id { get; set; }
    public string Direccion { get; set; } = null!;
    public string Estado { get; set; } = null!;
    public string Municipio { get; set; } = null!;
    public string? CodigoPostal { get; set; }
    public string? Segmento { get; set; }
}