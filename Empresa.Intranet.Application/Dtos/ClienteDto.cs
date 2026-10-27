namespace Empresa.Intranet.Application.DTOs;

public class CrearClienteDto
{
    public uint IdUsuario { get; set; }
    public string? Nombre { get; set; }
    public string? Telefono { get; set; }
    public string? Rfc { get; set; }
    public string? Calle { get; set; }
    public string? Colonia { get; set; }
    public string? Municipio { get; set; }
    public string? Estado { get; set; }
    public string? CodigoPostal { get; set; }
}
