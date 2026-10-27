using Empresa.Intranet.API.Extensiones;
using Empresa.Intranet.Application.DTOs;
using Empresa.Intranet.Infrastructure.Persistence;
using Empresa.Intranet.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EmpresasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;

    public EmpresasController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService)
    {
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
    }

    [HttpGet]
public async Task<IActionResult> GetTodos() =>
    Ok(await _context.Empresas
        .Where(e => e.Activo)
        .Select(e => new EmpresaDto
        {
            Id = e.Id,
            Nombre = e.Nombre,
            Rfc = e.Rfc,
            UrlLogo = e.UrlLogo,
            Tipo = e.Tipo
        })
        .ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var item = await _context.Empresas
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (item == null) return NotFound();
        return Ok(new EmpresaDto { Id = item.Id, Nombre = item.Nombre, Rfc = item.Rfc, UrlLogo = item.UrlLogo });
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearEmpresaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "empresas", "crear"))
            return this.SinPermiso();

        var item = new Domain.Entities.Empresa
        {
            Nombre = dto.Nombre,
            Rfc = dto.Rfc,
            UrlLogo = dto.UrlLogo,
            Tipo = dto.Tipo
        };
        _context.Empresas.Add(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("empresas", item.Id.ToString(), "CREAR", null, new
        {
            item.Id,
            item.Nombre,
            item.Rfc,
            item.UrlLogo
        }, dto.IdUsuario);

        return CreatedAtAction(nameof(GetPorId), new { id = item.Id },
            new EmpresaDto { Id = item.Id, Nombre = item.Nombre, Rfc = item.Rfc, Tipo = item.Tipo });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearEmpresaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "empresas", "editar"))
            return this.SinPermiso();

        var item = await _context.Empresas
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (item == null) return NotFound();

        var datosAnteriores = new { item.Nombre, item.Rfc, item.UrlLogo };

        item.Nombre = dto.Nombre;
        item.Rfc = dto.Rfc;
        item.UrlLogo = dto.UrlLogo;
        item.Tipo = dto.Tipo;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("empresas", id.ToString(), "MODIFICAR", datosAnteriores, new
        {
            item.Nombre,
            item.Rfc,
            item.UrlLogo
        }, dto.IdUsuario);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id, [FromQuery] uint idUsuario)
    {
        if (!await _permisoService.TienePermisoAsync(idUsuario, "empresas", "eliminar"))
            return this.SinPermiso();

        var item = await _context.Empresas
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (item == null) return NotFound();

        var datosAnteriores = new { item.Id, item.Nombre, item.Rfc };

        item.Activo = false;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("empresas", id.ToString(), "ELIMINAR",
            datosAnteriores, null, idUsuario);

        return NoContent();
    }
}