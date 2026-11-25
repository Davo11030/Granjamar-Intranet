using Empresa.Intranet.API.Extensiones;
using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.Application.DTOs;
using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
using Empresa.Intranet.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EspeciesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    public EspeciesController(AppDbContext context, AuditoriaService auditoria)
    {
        _context = context;
        _auditoria = auditoria;
    }

    // EnUso = cuántos productos del kardex la usan; la pantalla de catálogos lo muestra y no deja borrarla.
    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Especies
            .OrderBy(e => e.Nombre)
            .Select(e => new
            {
                e.Id,
                e.Nombre,
                e.CodigoClaveSat,
                DescripcionClaveSat = e.ClaveSat.Nombre,
                EnUso = e.Productos.Count()
            })
            .ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(int id)
    {
        var item = await _context.Especies
            .Include(e => e.ClaveSat)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (item == null) return NotFound();
        return Ok(new { item.Id, item.Nombre, item.CodigoClaveSat, DescripcionClaveSat = item.ClaveSat.Nombre });
    }

    [RequierePermiso("catalogos", "crear")]
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearEspecieDto dto)
    {
        var (nombre, codigo, error) = await Validar(dto, null);
        if (error != null) return BadRequest(new { mensaje = error });

        var item = new Especie { Nombre = nombre, CodigoClaveSat = codigo };
        _context.Especies.Add(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("especie", item.Id.ToString(), "CREAR", null,
            new { item.Id, item.Nombre, item.CodigoClaveSat }, this.IdUsuarioActual());

        return CreatedAtAction(nameof(GetPorId), new { id = item.Id }, new { item.Id, item.Nombre, item.CodigoClaveSat });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(int id, [FromBody] CrearEspecieDto dto)
    {
        var item = await _context.Especies.FindAsync(id);
        if (item == null) return NotFound();

        var (nombre, codigo, error) = await Validar(dto, id);
        if (error != null) return BadRequest(new { mensaje = error });

        var antes = new { item.Id, item.Nombre, item.CodigoClaveSat };
        item.Nombre = nombre;
        item.CodigoClaveSat = codigo;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("especie", id.ToString(), "MODIFICAR", antes,
            new { item.Id, item.Nombre, item.CodigoClaveSat }, this.IdUsuarioActual());

        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var item = await _context.Especies.FindAsync(id);
        if (item == null) return NotFound();

        // La relación con producto borra en cascada: sin esta revisión, eliminar una especie
        // se llevaría con ella todos sus productos del kardex.
        var enUso = await _context.Productos.CountAsync(p => p.IdEspecie == id);
        if (enUso > 0)
            return BadRequest(new { mensaje = $"No se puede eliminar: la usan {enUso} producto(s) del kardex. Cámbialos primero." });

        var antes = new { item.Id, item.Nombre, item.CodigoClaveSat };
        _context.Especies.Remove(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("especie", id.ToString(), "ELIMINAR", antes, null,
            this.IdUsuarioActual());

        return NoContent();
    }

    private async Task<(string Nombre, string Codigo, string? Error)> Validar(CrearEspecieDto dto, int? idActual)
    {
        var nombre = (dto.Nombre ?? "").Trim();
        var codigo = (dto.CodigoClaveSat ?? "").Trim();
        if (nombre == "") return (nombre, codigo, "El nombre de la especie es obligatorio");
        if (codigo == "") return (nombre, codigo, "Selecciona la clave SAT");
        if (!await _context.ClavesSat.AnyAsync(c => c.Codigo == codigo))
            return (nombre, codigo, "No existe esa clave SAT");
        if (await _context.Especies.AnyAsync(e => e.Id != idActual && e.Nombre == nombre))
            return (nombre, codigo, $"Ya existe una especie \"{nombre}\"");
        return (nombre, codigo, null);
    }
}
