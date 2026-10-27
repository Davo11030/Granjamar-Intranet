using Empresa.Intranet.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Empresa.Intranet.API.Filtros;

// Exige que el usuario del TOKEN (no uno escrito en el cuerpo de la petición) tenga el permiso
// módulo/acción. Para endpoints que no reciben un IdUsuario en su DTO, como los catálogos.
// "tambien": permisos alternativos ("modulo/accion") que también bastan — para datos que otros
// módulos necesitan consultar (ej. quien captura una venta debe poder leer el inventario).
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequierePermisoAttribute : ActionFilterAttribute
{
    private readonly string _modulo;
    private readonly string _accion;
    private readonly string[] _tambien;

    public RequierePermisoAttribute(string modulo, string accion, params string[] tambien)
    {
        _modulo = modulo;
        _accion = accion;
        _tambien = tambien;
    }

    public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var servicios = context.HttpContext.RequestServices;
        var actual = (IUsuarioActual)servicios.GetService(typeof(IUsuarioActual))!;
        var permisos = (PermisoService)servicios.GetService(typeof(PermisoService))!;

        var permitido = false;
        if (actual.Id is not null)
        {
            var id = actual.Id.Value;
            permitido = await permisos.TienePermisoAsync(id, _modulo, _accion);
            foreach (var alterno in _tambien)
            {
                if (permitido) break;
                var partes = alterno.Split('/');
                permitido = await permisos.TienePermisoAsync(id, partes[0], partes[1]);
            }
        }

        if (!permitido)
        {
            context.Result = new ObjectResult(
                new { mensaje = $"No tienes permiso para esta acción ({_modulo}/{_accion})." })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            return;
        }
        await next();
    }
}
