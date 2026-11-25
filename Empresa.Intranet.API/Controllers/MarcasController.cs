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
public class MarcasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    public MarcasController(AppDbContext context, AuditoriaService auditoria)
    {
        _context = context;
        _auditoria = auditoria;
    }

    // EnUso = cuántos producto(s) del kardex lo usan; la pantalla de catálogos lo muestra y no deja borrarlo.
    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Marcas
            .OrderBy(x => x.Nombre)
            .Select(x => new { x.Id, Nombre = x.Nombre, EnUso = x.Productos.Count() })
            .ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(int id)
    {
        var item = await _context.Marcas.FindAsync(id);
        if (item == null) return NotFound();
        return Ok(new CatalogoDto { Id = item.Id, Nombre = item.Nombre });
    }

    [RequierePermiso("catalogos", "crear")]
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearCatalogoDto dto)
    {
        var nombre = (dto.Nombre ?? "").Trim();
        if (nombre == "") return BadRequest(new { mensaje = "El nombre de la marca es obligatorio" });
        if (await _context.Marcas.AnyAsync(x => x.Nombre == nombre))
            return BadRequest(new { mensaje = $"Ya existe una marca \"{nombre}\"" });

        var item = new Marca { Nombre = nombre };
        _context.Marcas.Add(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("marca", item.Id.ToString(), "CREAR", null,
            new { item.Id, item.Nombre }, this.IdUsuarioActual());

        return CreatedAtAction(nameof(GetPorId), new { id = item.Id },
            new CatalogoDto { Id = item.Id, Nombre = item.Nombre });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(int id, [FromBody] CrearCatalogoDto dto)
    {
        var item = await _context.Marcas.FindAsync(id);
        if (item == null) return NotFound();

        var nombre = (dto.Nombre ?? "").Trim();
        if (nombre == "") return BadRequest(new { mensaje = "El nombre de la marca es obligatorio" });
        if (await _context.Marcas.AnyAsync(x => x.Id != id && x.Nombre == nombre))
            return BadRequest(new { mensaje = $"Ya existe una marca \"{nombre}\"" });

        var antes = new { item.Id, item.Nombre };
        item.Nombre = nombre;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("marca", id.ToString(), "MODIFICAR", antes,
            new { item.Id, item.Nombre }, this.IdUsuarioActual());

        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var item = await _context.Marcas.FindAsync(id);
        if (item == null) return NotFound();

        // Sin esta revisión la base rechaza el borrado con un error 500 si algún producto la usa.
        var enUso = await _context.Marcas.Where(x => x.Id == id).Select(x => x.Productos.Count()).FirstAsync();
        if (enUso > 0)
            return BadRequest(new { mensaje = $"No se puede eliminar: está en uso en {enUso} producto(s) del kardex. Cámbialos primero." });

        var antes = new { item.Id, item.Nombre };
        _context.Marcas.Remove(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("marca", id.ToString(), "ELIMINAR", antes, null,
            this.IdUsuarioActual());

        return NoContent();
    }
}
