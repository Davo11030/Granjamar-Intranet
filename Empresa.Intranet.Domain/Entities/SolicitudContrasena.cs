namespace Empresa.Intranet.Domain.Entities;

public class SolicitudContrasena
{
    public uint Id { get; set; }
    public uint IdUsuario { get; set; }
    public Usuario Usuario { get; set; } = null!;
    public DateTime FechaSolicitud { get; set; }
    public string Estado { get; set; } = "Pendiente"; // Pendiente | Aprobada | Rechazada | Completada
    public DateTime? FechaResolucion { get; set; }
    public uint? IdUsuarioResolucion { get; set; }
}
