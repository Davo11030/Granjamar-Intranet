using Empresa.Intranet.API.Extensiones;
using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
using Empresa.Intranet.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Controllers;

// El cuerpo de POST y PUT sigue siendo solo el número (p. ej. 10.5), como antes.
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PesosCajaController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    public PesosCajaController(AppDbContext context, AuditoriaService auditoria)
    {
        _context = context;
        _auditoria = auditoria;
    }

    // EnUso = cuántos productos del kardex lo usan; la pantalla de catálogos lo muestra y no deja borrarlo.
    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.PesosCaja
            .OrderBy(p => p.Peso)
            .Select(p => new { p.Id, p.Peso, EnUso = p.Productos.Count() })
            .ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(int id)
    {
        var item = await _context.PesosCaja.FindAsync(id);
        if (item == null) return NotFound();
        return Ok(new { item.Id, item.Peso });
    }

    [RequierePermiso("catalogos", "crear")]
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] decimal peso)
    {
        var error = await Validar(peso, null);
        if (error != null) return BadRequest(new { mensaje = error });

        var item = new PesoCaja { Peso = peso };
        _context.PesosCaja.Add(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("peso_caja", item.Id.ToString(), "CREAR", null,
            new { item.Id, item.Peso }, this.IdUsuarioActual());

        return CreatedAtAction(nameof(GetPorId), new { id = item.Id }, new { item.Id, item.Peso });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(int id, [FromBody] decimal peso)
    {
        var item = await _context.PesosCaja.FindAsync(id);
        if (item == null) return NotFound();

        var error = await Validar(peso, id);
        if (error != null) return BadRequest(new { mensaje = error });

        var antes = new { item.Id, item.Peso };
        item.Peso = peso;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("peso_caja", id.ToString(), "MODIFICAR", antes,
            new { item.Id, item.Peso }, this.IdUsuarioActual());

        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var item = await _context.PesosCaja.FindAsync(id);
        if (item == null) return NotFound();

        // Sin esta revisión la base rechaza el borrado con un error 500 si algún producto lo usa.
        var enUso = await _context.Productos.CountAsync(p => p.IdPesoCaja == id);
        if (enUso > 0)
            return BadRequest(new { mensaje = $"No se puede eliminar: lo usan {enUso} producto(s) del kardex. Cámbialos primero." });

        var antes = new { item.Id, item.Peso };
        _context.PesosCaja.Remove(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("peso_caja", id.ToString(), "ELIMINAR", antes, null,
            this.IdUsuarioActual());

        return NoContent();
    }

    // La columna es decimal(10,3): hasta 9,999,999.999 con 3 decimales.
    private async Task<string?> Validar(decimal peso, int? idActual)
    {
        if (peso <= 0) return "El peso debe ser mayor a cero";
        if (peso >= 10_000_000m || decimal.Round(peso, 3) != peso) return "El peso admite hasta 3 decimales";
        if (await _context.PesosCaja.AnyAsync(p => p.Id != idActual && p.Peso == peso))
            return $"Ya existe el peso {peso} kg";
        return null;
    }
}
