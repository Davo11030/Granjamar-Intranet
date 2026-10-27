using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.Application.DTOs;
using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
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
    public MarcasController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Marcas
            .Select(m => new CatalogoDto { Id = m.Id, Nombre = m.Nombre })
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
        var item = new Marca { Nombre = dto.Nombre };
        _context.Marcas.Add(item);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetPorId), new { id = item.Id },
            new CatalogoDto { Id = item.Id, Nombre = item.Nombre });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(int id, [FromBody] CrearCatalogoDto dto)
    {
        var item = await _context.Marcas.FindAsync(id);
        if (item == null) return NotFound();
        item.Nombre = dto.Nombre;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var item = await _context.Marcas.FindAsync(id);
        if (item == null) return NotFound();
        _context.Marcas.Remove(item);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}