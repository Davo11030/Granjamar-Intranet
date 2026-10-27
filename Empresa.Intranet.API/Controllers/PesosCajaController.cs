using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PesosCajaController : ControllerBase
{
    private readonly AppDbContext _context;
    public PesosCajaController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.PesosCaja
            .Select(p => new { p.Id, p.Peso })
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
        var item = new PesoCaja { Peso = peso };
        _context.PesosCaja.Add(item);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetPorId), new { id = item.Id }, new { item.Id, item.Peso });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(int id, [FromBody] decimal peso)
    {
        var item = await _context.PesosCaja.FindAsync(id);
        if (item == null) return NotFound();
        item.Peso = peso;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var item = await _context.PesosCaja.FindAsync(id);
        if (item == null) return NotFound();
        _context.PesosCaja.Remove(item);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}