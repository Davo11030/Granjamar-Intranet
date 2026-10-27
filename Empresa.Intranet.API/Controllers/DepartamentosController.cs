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
public class DepartamentosController : ControllerBase
{
    private readonly AppDbContext _context;
    public DepartamentosController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Departamentos
            .Select(d => new DepartamentoDto { Id = d.Id, Nombre = d.Nombre })
            .ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var item = await _context.Departamentos.FindAsync(id);
        if (item == null) return NotFound();
        return Ok(new DepartamentoDto { Id = item.Id, Nombre = item.Nombre });
    }

    [RequierePermiso("catalogos", "crear")]
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearDepartamentoDto dto)
    {
        var item = new Departamento { Nombre = dto.Nombre };
        _context.Departamentos.Add(item);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetPorId), new { id = item.Id },
            new DepartamentoDto { Id = item.Id, Nombre = item.Nombre });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearDepartamentoDto dto)
    {
        var item = await _context.Departamentos.FindAsync(id);
        if (item == null) return NotFound();
        item.Nombre = dto.Nombre;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id)
    {
        var item = await _context.Departamentos.FindAsync(id);
        if (item == null) return NotFound();
        _context.Departamentos.Remove(item);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}