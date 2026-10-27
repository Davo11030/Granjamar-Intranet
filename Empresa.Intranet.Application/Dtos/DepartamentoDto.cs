namespace Empresa.Intranet.Application.DTOs;

public class DepartamentoDto
{
    public uint Id { get; set; }
    public string? Nombre { get; set; }
}

public class CrearDepartamentoDto
{
    public string? Nombre { get; set; }
}