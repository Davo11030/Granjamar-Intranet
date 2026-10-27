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
public class EspeciesController : ControllerBase
{
    private readonly AppDbContext _context;
    public EspeciesController(AppDbContext context) => _context = context;

    [HttpGet]
public async Task<IActionResult> GetTodos() =>
    Ok(await _context.Especies
        .Include(e => e.ClaveSat)
        .Select(e => new
        {
            e.Id,
            e.Nombre,
            e.CodigoClaveSat,
            DescripcionClaveSat = e.ClaveSat.Nombre
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
    var claveSat = await _context.ClavesSat.FirstOrDefaultAsync(c => c.Codigo == dto.CodigoClaveSat);
    if (claveSat == null) return BadRequest(new { mensaje = "No existe esa clave SAT" });

    var item = new Especie { Nombre = dto.Nombre, CodigoClaveSat = dto.CodigoClaveSat };
    _context.Especies.Add(item);
    await _context.SaveChangesAsync();
    return CreatedAtAction(nameof(GetPorId), new { id = item.Id }, new { item.Id, item.Nombre, item.CodigoClaveSat });
}

[RequierePermiso("catalogos", "editar")]
[HttpPut("{id}")]
public async Task<IActionResult> Actualizar(int id, [FromBody] CrearEspecieDto dto)
{
    var item = await _context.Especies.FindAsync(id);
    if (item == null) return NotFound();

    var claveSat = await _context.ClavesSat.FirstOrDefaultAsync(c => c.Codigo == dto.CodigoClaveSat);
    if (claveSat == null) return BadRequest(new { mensaje = "No existe esa clave SAT" });

    item.Nombre = dto.Nombre;
    item.CodigoClaveSat = dto.CodigoClaveSat;
    await _context.SaveChangesAsync();
    return NoContent();
}

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var item = await _context.Especies.FindAsync(id);
        if (item == null) return NotFound();
        _context.Especies.Remove(item);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}