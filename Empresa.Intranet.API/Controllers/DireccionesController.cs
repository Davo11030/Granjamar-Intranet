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
public class DireccionesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;

    public DireccionesController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService)
    {
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
    }

    private async Task<object> Snapshot(Direccion item)
    {
        var empresa = item.IdEmpresa != null ? await _context.Empresas.FindAsync(item.IdEmpresa) : null;
        return new
        {
            item.DireccionTexto,
            item.Estado,
            item.Municipio,
            item.CodigoPostal,
            item.Segmento,
            Empresa = empresa?.Nombre
        };
    }

    private static string? LimpiarSegmento(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static string? LimpiarCp(string? cp) => string.IsNullOrWhiteSpace(cp) ? null : cp.Trim();

    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Direcciones
            .Include(d => d.Empresa)
            .Where(d => d.Activo)
            .Select(d => new DireccionDto
            {
                Id = d.Id,
                Direccion = d.DireccionTexto,
                Estado = d.Estado,
                Municipio = d.Municipio,
                CodigoPostal = d.CodigoPostal,
                Segmento = d.Segmento,
                IdEmpresa = d.IdEmpresa,
                Empresa = d.Empresa != null ? d.Empresa.Nombre : null
            })
            .ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var item = await _context.Direcciones
            .Include(d => d.Empresa)
            .FirstOrDefaultAsync(d => d.Id == id && d.Activo);
        if (item == null) return NotFound();
        return Ok(new DireccionDto
        {
            Id = item.Id,
            Direccion = item.DireccionTexto,
            Estado = item.Estado,
            Municipio = item.Municipio,
            CodigoPostal = item.CodigoPostal,
            Segmento = item.Segmento,
            IdEmpresa = item.IdEmpresa,
            Empresa = item.Empresa?.Nombre
        });
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearDireccionDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "direcciones", "crear"))
            return this.SinPermiso();

        var item = new Direccion
        {
            DireccionTexto = dto.Direccion,
            Estado = dto.Estado,
            Municipio = dto.Municipio,
            CodigoPostal = LimpiarCp(dto.CodigoPostal),
            Segmento = LimpiarSegmento(dto.Segmento),
            IdEmpresa = dto.IdEmpresa
        };
        _context.Direcciones.Add(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("direcciones", item.Id.ToString(), "CREAR", null,
            await Snapshot(item), this.IdUsuarioActual());

        return CreatedAtAction(nameof(GetPorId), new { id = item.Id },
            new DireccionDto { Id = item.Id, Direccion = item.DireccionTexto, Estado = item.Estado, Municipio = item.Municipio, CodigoPostal = item.CodigoPostal, Segmento = item.Segmento, IdEmpresa = item.IdEmpresa });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearDireccionDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "direcciones", "editar"))
            return this.SinPermiso();

        var item = await _context.Direcciones
            .FirstOrDefaultAsync(d => d.Id == id && d.Activo);
        if (item == null) return NotFound();

        var datosAnteriores = await Snapshot(item);

        item.DireccionTexto = dto.Direccion;
        item.Estado = dto.Estado;
        item.Municipio = dto.Municipio;
        item.CodigoPostal = LimpiarCp(dto.CodigoPostal);
        item.Segmento = LimpiarSegmento(dto.Segmento);
        item.IdEmpresa = dto.IdEmpresa;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("direcciones", id.ToString(), "MODIFICAR", datosAnteriores,
            await Snapshot(item), this.IdUsuarioActual());

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "direcciones", "eliminar"))
            return this.SinPermiso();

        var item = await _context.Direcciones
            .FirstOrDefaultAsync(d => d.Id == id && d.Activo);
        if (item == null) return NotFound();

        var kilos = await _context.UbicacionesProducto
            .Where(u => u.IdDireccion == id && u.CantidadKilos > 0)
            .SumAsync(u => (decimal?)u.CantidadKilos) ?? 0;
        if (kilos > 0)
            return BadRequest(new { mensaje = $"No se puede dar de baja: la dirección todavía tiene {kilos:N2} kg en inventario." });

        var datosAnteriores = await Snapshot(item);

        item.Activo = false;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("direcciones", id.ToString(), "ELIMINAR",
            datosAnteriores, null, this.IdUsuarioActual());

        return NoContent();
    }
}