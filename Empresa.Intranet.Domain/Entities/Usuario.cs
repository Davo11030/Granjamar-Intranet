namespace Empresa.Intranet.Domain.Entities;
public class Usuario
{
    public uint Id { get; set; }
    public string? Nombre { get; set; }
    public string? Puesto { get; set; }
    public string? Contrasena { get; set; }
    public string? Correo { get; set; }
    // Baja lógica: el usuario no se borra (sus ventas, movimientos y auditoría lo siguen nombrando),
    // solo deja de poder entrar y de aparecer en la lista.
    public bool Activo { get; set; } = true;
    public ICollection<HistorialMovimiento> HistorialesMovimiento { get; set; } = new List<HistorialMovimiento>();
    public ICollection<UsuarioPermiso> Permisos { get; set; } = new List<UsuarioPermiso>();
}
