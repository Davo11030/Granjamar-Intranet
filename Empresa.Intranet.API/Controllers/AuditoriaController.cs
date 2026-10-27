using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[AdminOnly]
public class AuditoriaController : ControllerBase
{
    private readonly AppDbContext _context;
    public AuditoriaController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetTodos(
        [FromQuery] string? tabla,
        [FromQuery] string? registro,
        [FromQuery] string? accion,
        [FromQuery] string? usuario,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta)
    {
        var hastaFin = hasta?.Date.AddDays(1).AddTicks(-1);

        var lista = await _context.Auditorias
            .Include(a => a.Usuario)
            .Where(a => (tabla == null || a.Tabla == tabla)
                     && (registro == null || a.IdRegistro == registro)
                     && (accion == null || a.Accion == accion)
                     && (usuario == null || a.Usuario.Nombre == usuario)
                     && (desde == null || a.Fecha >= desde)
                     && (hastaFin == null || a.Fecha <= hastaFin))
            .OrderByDescending(a => a.Fecha)
            .Select(a => new
            {
                a.Id,
                a.Tabla,
                a.IdRegistro,
                a.Accion,
                a.DatosAnteriores,
                a.DatosNuevos,
                Usuario = a.Usuario.Nombre,
                Puesto = a.Usuario.Puesto,
                a.Fecha
            })
            .ToListAsync();

        // Los embarques se identifican por su NÚMERO (el que se guardó en la requisición), no por el id de la base de datos.
        var idsEmbarque = lista.Where(a => EsEmbarque(a.Tabla) && uint.TryParse(a.IdRegistro, out _))
            .Select(a => uint.Parse(a.IdRegistro)).Distinct().ToList();
        var numeros = idsEmbarque.Count == 0
            ? new Dictionary<uint, string?>()
            : await _context.Embarques.Where(e => idsEmbarque.Contains(e.Id)).ToDictionaryAsync(e => e.Id, e => e.Numero);

        return Ok(lista.Select(a => new
        {
            a.Id,
            a.Tabla,
            a.IdRegistro,
            // Lo que se muestra en lugar del id cuando el registro tiene un número propio.
            Referencia = EsEmbarque(a.Tabla) && uint.TryParse(a.IdRegistro, out var id) && numeros.GetValueOrDefault(id) is { Length: > 0 } n ? n : null,
            a.Accion,
            a.DatosAnteriores,
            a.DatosNuevos,
            a.Usuario,
            a.Puesto,
            a.Fecha
        }));
    }

    private static bool EsEmbarque(string tabla) => tabla is "embarques" or "embarque";
}
