namespace Empresa.Intranet.Application.DTOs;

public class UsuarioDto
{
    public uint Id { get; set; }
    public string? Nombre { get; set; }
    public string? Puesto { get; set; }
    public string? Correo { get; set; }
}

public class CrearUsuarioDto
{
    public string Nombre { get; set; } = null!;
    public string? Puesto { get; set; }
    public string Contrasena { get; set; } = null!;
    public string? Correo { get; set; }
}

// Un usuario editando su propio correo (cualquier puesto, no requiere ser admin).
public class ActualizarPerfilDto
{
    public string? Correo { get; set; }
}

// Cambiar la propia contraseña estando ya autenticado: exige la actual.
public class CambiarContrasenaDto
{
    public string ContrasenaActual { get; set; } = null!;
    public string ContrasenaNueva { get; set; } = null!;
}

// Solicitar a un administrador que autorice restablecer la contraseña (sin sesión).
public class SolicitarRestablecimientoDto
{
    public string Nombre { get; set; } = null!;
}

// Estado de la solicitud de restablecimiento para un usuario (consulta sin sesión).
public class EstadoSolicitudDto
{
    public string Estado { get; set; } = null!; // Ninguna | Pendiente | Aprobada
}

// Una vez aprobada la solicitud, el propio usuario define su nueva contraseña (sin sesión).
public class RestablecerConAprobacionDto
{
    public string Nombre { get; set; } = null!;
    public string ContrasenaNueva { get; set; } = null!;
}

// Vista de una solicitud para el panel de administración.
public class SolicitudContrasenaDto
{
    public uint Id { get; set; }
    public string? NombreUsuario { get; set; }
    public string Estado { get; set; } = null!;
    public DateTime FechaSolicitud { get; set; }
}
