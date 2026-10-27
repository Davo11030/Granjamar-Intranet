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
public class CatalogosVentaController : ControllerBase
{
    private readonly AppDbContext _context;
    public CatalogosVentaController(AppDbContext context) => _context = context;

    // ── Formas de Pago ──────────────────────────────────────────
    [HttpGet("formas-pago")]
    public async Task<IActionResult> GetFormasPago() =>
        Ok(await _context.FormasPago
            .Select(f => new { f.Id, f.Nombre }).ToListAsync());

    [RequierePermiso("catalogos", "crear")]
    [HttpPost("formas-pago")]
    public async Task<IActionResult> CrearFormaPago([FromBody] CrearCatalogoDto dto)
    {
        var item = new FormaPago { Nombre = dto.Nombre };
        _context.FormasPago.Add(item);
        await _context.SaveChangesAsync();
        return Ok(new { item.Id, item.Nombre });
    }

    // ── Lugares de Entrega ──────────────────────────────────────
    [HttpGet("lugares-entrega")]
    public async Task<IActionResult> GetLugaresEntrega() =>
        Ok(await _context.LugaresEntrega
            .Select(l => new { l.Id, l.Nombre }).ToListAsync());

    [RequierePermiso("catalogos", "crear")]
    [HttpPost("lugares-entrega")]
    public async Task<IActionResult> CrearLugarEntrega([FromBody] CrearCatalogoDto dto)
    {
        var item = new LugarEntrega { Nombre = dto.Nombre };
        _context.LugaresEntrega.Add(item);
        await _context.SaveChangesAsync();
        return Ok(new { item.Id, item.Nombre });
    }

    // ── Estados de Recolección ──────────────────────────────────
    [HttpGet("estados-recoleccion")]
    public async Task<IActionResult> GetEstadosRecoleccion() =>
        Ok(await _context.EstadosRecoleccion
            .Select(e => new { e.Id, e.Descripcion }).ToListAsync());

    [RequierePermiso("catalogos", "crear")]
    [HttpPost("estados-recoleccion")]
    public async Task<IActionResult> CrearEstadoRecoleccion([FromBody] CrearCatalogoDto dto)
    {
        var item = new EstadoRecoleccion { Descripcion = dto.Nombre };
        _context.EstadosRecoleccion.Add(item);
        await _context.SaveChangesAsync();
        return Ok(new { item.Id, item.Descripcion });
    }

    // ── Tipos de Movimiento ─────────────────────────────────────
    [HttpGet("tipos-movimiento")]
    public async Task<IActionResult> GetTiposMovimiento() =>
        Ok(await _context.TiposMovimiento
            .Select(t => new { t.Id, t.Nombre }).ToListAsync());

    [RequierePermiso("catalogos", "crear")]
    [HttpPost("tipos-movimiento")]
    public async Task<IActionResult> CrearTipoMovimiento([FromBody] CrearCatalogoDto dto)
    {
        var item = new TipoMovimiento { Nombre = dto.Nombre };
        _context.TiposMovimiento.Add(item);
        await _context.SaveChangesAsync();
        return Ok(new { item.Id, item.Nombre });
    }
}