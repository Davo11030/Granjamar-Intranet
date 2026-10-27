namespace Empresa.Intranet.Application.DTOs;

public class LoginRequestDto
{
    public string Nombre { get; set; } = null!;
    public string Contrasena { get; set; } = null!;
}