using Empresa.Intranet.API.Filtros;
using System.Globalization;
using System.Text.Json.Nodes;
using Empresa.Intranet.Domain.Entities;
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

        // Los movimientos de producción guardados antes de registrar su detalle de producto: se completan con los productos
        // que tiene hoy ese día, para que siempre se vea de qué producto se trata.
        var dias = lista.Where(a => EsProduccion(a.Tabla) && Dia(a.IdRegistro) != null).Select(a => Dia(a.IdRegistro)!.Value).Distinct().ToList();
        var reportes = dias.Count == 0 ? new List<ProduccionReporteFila>()
            : await _context.ProduccionReporte.AsNoTracking().Where(f => f.Activo && dias.Contains(f.Fecha)).OrderBy(f => f.Orden).ToListAsync();
        var lineas = dias.Count == 0 ? new List<ProduccionInventarioLinea>()
            : await _context.ProduccionInventario.AsNoTracking().Where(l => l.Activo && dias.Contains(l.Fecha)).OrderBy(l => l.Orden).ToListAsync();
        var codigos = reportes.Select(f => f.CodigoProducto).Concat(lineas.Select(l => l.CodigoProducto)).Distinct().ToList();
        var nombres = codigos.Count == 0 ? new Dictionary<string, string>()
            : await _context.Productos.AsNoTracking().Where(p => codigos.Contains(p.Codigo)).Select(p => new { p.Codigo, Nombre = p.Especie.Nombre })
                .ToDictionaryAsync(p => p.Codigo, p => p.Nombre);

        string? Completar(string? json, string tabla, string idRegistro)
        {
            if (json == null || !EsProduccion(tabla) || Dia(idRegistro) is not { } dia) return json;
            JsonObject? obj;
            try { obj = JsonNode.Parse(json) as JsonObject; } catch { return json; }
            if (obj == null || obj.Any(kv => kv.Key.Equals("detalles", StringComparison.OrdinalIgnoreCase))) return json;
            var arr = new JsonArray();
            if (tabla == "producciones")
                foreach (var f in reportes.Where(f => f.Fecha == dia))
                    arr.Add(new JsonObject
                    {
                        ["Producto"] = f.CodigoProducto,
                        ["Descripcion"] = nombres.GetValueOrDefault(f.CodigoProducto, f.CodigoProducto),
                        ["Etapa"] = f.Etapa switch { ProduccionReporteFila.Entrada => "Entrada a producción", ProduccionReporteFila.MP => "M.P. en procesos", _ => "Salida de producción" }
                    });
            else
                foreach (var l in lineas.Where(l => l.Fecha == dia))
                    arr.Add(new JsonObject
                    {
                        ["Producto"] = l.CodigoProducto,
                        ["Descripcion"] = nombres.GetValueOrDefault(l.CodigoProducto, l.CodigoProducto)
                    });
            if (arr.Count == 0) return json;
            obj["detalles"] = arr;
            obj["nota"] = "Productos de ese día según su estado actual (este movimiento se guardó antes de registrar el detalle)";
            return obj.ToJsonString();
        }

        // Códigos de producto que toca un movimiento, para verlos directo en el listado.
        static string? Productos(string? nuevos, string? anteriores)
        {
            var codigos = new List<string>();
            foreach (var json in new[] { nuevos, anteriores })
            {
                if (json == null) continue;
                try
                {
                    if (JsonNode.Parse(json) is not JsonObject o) continue;
                    var det = o.FirstOrDefault(kv => kv.Key.Equals("detalles", StringComparison.OrdinalIgnoreCase)).Value as JsonArray;
                    if (det == null) continue;
                    codigos.AddRange(det.OfType<JsonObject>().Select(d => d["Producto"]?.GetValue<string>()).Where(c => !string.IsNullOrWhiteSpace(c))!);
                }
                catch { /* auditoría con otro formato */ }
            }
            return codigos.Count == 0 ? null : string.Join(", ", codigos.Distinct());
        }

        return Ok(lista.Select(a =>
        {
            var nuevos = Completar(a.DatosNuevos, a.Tabla, a.IdRegistro);
            var anteriores = Completar(a.DatosAnteriores, a.Tabla, a.IdRegistro);
            return new
            {
                a.Id,
                a.Tabla,
                a.IdRegistro,
                // Lo que se muestra en lugar del id cuando el registro tiene un número propio.
                Referencia = EsEmbarque(a.Tabla) && uint.TryParse(a.IdRegistro, out var id) && numeros.GetValueOrDefault(id) is { Length: > 0 } n ? n : null,
                Productos = Productos(nuevos, anteriores),
                a.Accion,
                DatosAnteriores = anteriores,
                DatosNuevos = nuevos,
                a.Usuario,
                a.Puesto,
                a.Fecha
            };
        }));
    }

    private static bool EsProduccion(string tabla) => tabla is "producciones" or "produccion_inventario";
    private static DateTime? Dia(string idRegistro) =>
        DateTime.TryParseExact(idRegistro, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var d) ? d : null;

    private static bool EsEmbarque(string tabla) => tabla is "embarques" or "embarque";
}
