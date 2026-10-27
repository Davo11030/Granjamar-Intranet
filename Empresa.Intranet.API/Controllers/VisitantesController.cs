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
[AdminOnly]
public class VisitantesController : ControllerBase
{
    private readonly AppDbContext _context;
    public VisitantesController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Visitante
            .OrderByDescending(v => v.Fecha)
            .Select(v => new { v.Id, v.Nombre, v.Fecha })
            .ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearVisitanteDto dto)
    {
        var v = new Visitante { Nombre = dto.Nombre, Fecha = dto.Fecha ?? DateTime.UtcNow };
        _context.Visitante.Add(v);
        await _context.SaveChangesAsync();
        return Ok(new { v.Id, v.Nombre, v.Fecha });
    }
}

public class CrearVisitanteDto
{
    public string? Nombre { get; set; }
    public DateTime? Fecha { get; set; }
}