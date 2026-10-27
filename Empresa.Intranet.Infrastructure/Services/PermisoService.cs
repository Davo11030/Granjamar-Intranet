using Empresa.Intranet.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.Infrastructure.Services;

public class PermisoService
{
    private readonly AppDbContext _context;
    private readonly IUsuarioActual _actual;

    public PermisoService(AppDbContext context, IUsuarioActual actual)
    {
        _context = context;
        _actual = actual;
    }

    // "idUsuario" es el que mandó el cliente; si hay un usuario autenticado (token), SE USA ESE —
    // si no, cualquiera podría escribir el id de otro usuario con permisos en el cuerpo de la petición.
    //  · El administrador (puesto del token) tiene todos los permisos.
    //  · "ver" de un módulo también lo tiene quien puede crear/editar/eliminar en él: quien captura
    //    algo necesita poder verlo.
    public async Task<bool> TienePermisoAsync(uint idUsuario, string modulo, string accion)
    {
        if (_actual.EsAdmin) return true;
        var id = _actual.Id ?? idUsuario;
        var propios = _context.UsuariosPermiso
            .Where(up => up.IdUsuario == id && up.Permiso.Modulo == modulo);
        return accion == "ver"
            ? await propios.AnyAsync(up => up.Permiso.Accion == "ver" || up.Permiso.Accion == "crear"
                                           || up.Permiso.Accion == "editar" || up.Permiso.Accion == "eliminar")
            : await propios.AnyAsync(up => up.Permiso.Accion == accion);
    }
}
