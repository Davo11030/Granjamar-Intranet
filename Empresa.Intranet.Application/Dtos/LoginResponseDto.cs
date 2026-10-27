namespace Empresa.Intranet.Application.DTOs;

public class LoginResponseDto
{
    public uint Id { get; set; }
    public string Token { get; set; } = null!;
    public string Nombre { get; set; } = null!;
    public string? Puesto { get; set; }
    public DateTime Expiracion { get; set; }
}