using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.API.Extensiones;
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
public class ClavesSatController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    public ClavesSatController(AppDbContext context, AuditoriaService auditoria)
    {
        _context = context;
        _auditoria = auditoria;
    }

    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.ClavesSat
            .Select(c => new { c.Id, c.Codigo, c.Nombre })
            .ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(int id)
    {
        var item = await _context.ClavesSat.FindAsync(id);
        if (item == null) return NotFound();
        return Ok(new { item.Id, item.Codigo, item.Nombre });
    }

    [RequierePermiso("catalogos", "crear")]
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearClaveSatDto dto)
    {
        var existe = await _context.ClavesSat.AnyAsync(c => c.Codigo == dto.Codigo);
        if (existe) return BadRequest(new { mensaje = "Ya existe esa clave SAT" });

        var item = new ClavesSat { Codigo = dto.Codigo, Nombre = dto.Nombre };
        _context.ClavesSat.Add(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("claves_sat", item.Id.ToString(), "CREAR", null,
            new { item.Id, item.Codigo, item.Nombre }, this.IdUsuarioActual());

        return CreatedAtAction(nameof(GetPorId), new { id = item.Id },
            new { item.Id, item.Codigo, item.Nombre });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(int id, [FromBody] CrearClaveSatDto dto)
    {
        var item = await _context.ClavesSat.FindAsync(id);
        if (item == null) return NotFound();

        var antes = new { item.Id, item.Codigo, item.Nombre };
        item.Codigo = dto.Codigo;
        item.Nombre = dto.Nombre;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("claves_sat", id.ToString(), "MODIFICAR", antes,
            new { item.Id, item.Codigo, item.Nombre }, this.IdUsuarioActual());

        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var item = await _context.ClavesSat.FindAsync(id);
        if (item == null) return NotFound();

        var antes = new { item.Id, item.Codigo, item.Nombre };
        _context.ClavesSat.Remove(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("claves_sat", id.ToString(), "ELIMINAR", antes, null,
            this.IdUsuarioActual());

        return NoContent();
    }
}
