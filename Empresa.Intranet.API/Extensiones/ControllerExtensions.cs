using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace Empresa.Intranet.API.Extensiones;

public static class ControllerExtensions
{
    /// <summary>Id del usuario autenticado, tomado del token JWT (claim NameIdentifier).</summary>
    public static uint IdUsuarioActual(this ControllerBase c) =>
        uint.TryParse(c.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    /// <summary>¿El token es de un administrador (puesto admin/administrador)?</summary>
    public static bool EsAdminActual(this ControllerBase c) =>
        new[] { "admin", "administrador" }.Contains((c.User.FindFirst("puesto")?.Value ?? "").Trim().ToLowerInvariant());

    /// <summary>403 con un mensaje que el cliente puede mostrar tal cual.</summary>
    public static IActionResult SinPermiso(this ControllerBase c) =>
        c.StatusCode(StatusCodes.Status403Forbidden, new { mensaje = "No tienes permiso para realizar esta acción." });
}
