namespace Empresa.Intranet.Infrastructure.Services;

// El usuario autenticado de la petición actual (el del token JWT), no el que el cliente escribe en
// el cuerpo: los permisos y la auditoría deben depender de quién inició sesión de verdad. Null
// cuando no hay petición autenticada (procesos internos).
public interface IUsuarioActual
{
    uint? Id { get; }
    // Puesto de administrador: pasa todas las verificaciones de permiso (y nunca se queda fuera
    // del propio sistema de permisos).
    bool EsAdmin { get; }
}
