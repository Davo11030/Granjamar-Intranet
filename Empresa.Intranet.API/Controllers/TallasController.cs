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
public class TallasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    public TallasController(AppDbContext context, AuditoriaService auditoria)
    {
        _context = context;
        _auditoria = auditoria;
    }

    // EnUso = cuántos producto(s) del kardex lo usan; la pantalla de catálogos lo muestra y no deja borrarlo.
    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Tallas
            .OrderBy(x => x.Descripcion)
            .Select(x => new { x.Id, Nombre = x.Descripcion, EnUso = x.Productos.Count() })
            .ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(int id)
    {
        var item = await _context.Tallas.FindAsync(id);
        if (item == null) return NotFound();
        return Ok(new CatalogoDto { Id = item.Id, Nombre = item.Descripcion });
    }

    [RequierePermiso("catalogos", "crear")]
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearCatalogoDto dto)
    {
        var nombre = (dto.Nombre ?? "").Trim();
        if (nombre == "") return BadRequest(new { mensaje = "La talla es obligatoria" });
        if (await _context.Tallas.AnyAsync(x => x.Descripcion == nombre))
            return BadRequest(new { mensaje = $"Ya existe una talla \"{nombre}\"" });

        var item = new Talla { Descripcion = nombre };
        _context.Tallas.Add(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("talla", item.Id.ToString(), "CREAR", null,
            new { item.Id, item.Descripcion }, this.IdUsuarioActual());

        return CreatedAtAction(nameof(GetPorId), new { id = item.Id },
            new CatalogoDto { Id = item.Id, Nombre = item.Descripcion });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(int id, [FromBody] CrearCatalogoDto dto)
    {
        var item = await _context.Tallas.FindAsync(id);
        if (item == null) return NotFound();

        var nombre = (dto.Nombre ?? "").Trim();
        if (nombre == "") return BadRequest(new { mensaje = "La talla es obligatoria" });
        if (await _context.Tallas.AnyAsync(x => x.Id != id && x.Descripcion == nombre))
            return BadRequest(new { mensaje = $"Ya existe una talla \"{nombre}\"" });

        var antes = new { item.Id, item.Descripcion };
        item.Descripcion = nombre;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("talla", id.ToString(), "MODIFICAR", antes,
            new { item.Id, item.Descripcion }, this.IdUsuarioActual());

        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var item = await _context.Tallas.FindAsync(id);
        if (item == null) return NotFound();

        // Sin esta revisión la base rechaza el borrado con un error 500 si algún producto la usa.
        var enUso = await _context.Tallas.Where(x => x.Id == id).Select(x => x.Productos.Count()).FirstAsync();
        if (enUso > 0)
            return BadRequest(new { mensaje = $"No se puede eliminar: está en uso en {enUso} producto(s) del kardex. Cámbialos primero." });

        var antes = new { item.Id, item.Descripcion };
        _context.Tallas.Remove(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("talla", id.ToString(), "ELIMINAR", antes, null,
            this.IdUsuarioActual());

        return NoContent();
    }
}
