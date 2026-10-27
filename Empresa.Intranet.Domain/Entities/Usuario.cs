namespace Empresa.Intranet.Domain.Entities;
public class Usuario
{
    public uint Id { get; set; }
    public string? Nombre { get; set; }
    public string? Puesto { get; set; }
    public string? Contrasena { get; set; }
    public string? Correo { get; set; }
    public ICollection<HistorialMovimiento> HistorialesMovimiento { get; set; } = new List<HistorialMovimiento>();
    public ICollection<UsuarioPermiso> Permisos { get; set; } = new List<UsuarioPermiso>();
}
