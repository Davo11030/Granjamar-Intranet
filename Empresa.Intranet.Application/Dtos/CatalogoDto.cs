namespace Empresa.Intranet.Application.DTOs;

public class CatalogoDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = null!;
}

public class CrearCatalogoDto
{
    public string Nombre { get; set; } = null!;
}
public class CrearEspecieDto
{
    public string Nombre { get; set; } = null!;
    public string CodigoClaveSat { get; set; } = null!;
}
public class CrearClaveSatDto
{
    public string Codigo { get; set; } = null!;
    public string Nombre { get; set; } = null!;
}