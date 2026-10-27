using System.Security.Claims;
using Empresa.Intranet.Infrastructure.Services;

namespace Empresa.Intranet.API.Servicios;

public class UsuarioActualHttp : IUsuarioActual
{
    private static readonly string[] PuestosAdmin = { "admin", "administrador" };
    private readonly IHttpContextAccessor _http;

    public UsuarioActualHttp(IHttpContextAccessor http) => _http = http;

    public uint? Id =>
        uint.TryParse(_http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public bool EsAdmin =>
        PuestosAdmin.Contains((_http.HttpContext?.User.FindFirst("puesto")?.Value ?? "").Trim().ToLowerInvariant());
}
