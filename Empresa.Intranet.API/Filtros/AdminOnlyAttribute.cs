using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Empresa.Intranet.API.Filtros;

/// <summary>
/// Restringe la acción/controlador al personal con puesto de administrador.
/// Requiere que la petición ya esté autenticada (usar junto con [Authorize]).
/// </summary>
public sealed class AdminOnlyAttribute : ActionFilterAttribute
{
    private static readonly string[] PuestosAdmin = { "admin", "administrador" };

    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var puesto = context.HttpContext.User.FindFirst("puesto")?.Value ?? "";
        if (!PuestosAdmin.Contains(puesto.Trim().ToLowerInvariant()))
        {
            context.Result = new ObjectResult(
                new { mensaje = "Esta sección está disponible únicamente para el administrador." })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}
