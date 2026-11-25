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

    // Quien registra ventas también puede dar de alta una forma de pago, un lugar de entrega o un
    // estado de recolección: la pantalla de venta los crea al vuelo la primera vez que se usan.
    // Si ya existe uno con el mismo nombre se devuelve ese (no se duplica).
    [RequierePermiso("catalogos", "crear", "ventas/crear", "ventas/editar")]
    [HttpPost("formas-pago")]
    public async Task<IActionResult> CrearFormaPago([FromBody] CrearCatalogoDto dto)
    {
        var nombre = (dto.Nombre ?? "").Trim();
        if (nombre.Length == 0) return BadRequest(new { mensaje = "Escribe el nombre de la forma de pago" });
        var existente = await _context.FormasPago.FirstOrDefaultAsync(f => f.Nombre == nombre);
        if (existente != null) return Ok(new { existente.Id, existente.Nombre });

        var item = new FormaPago { Nombre = nombre };
        _context.FormasPago.Add(item);
        await _context.SaveChangesAsync();
        return Ok(new { item.Id, item.Nombre });
    }

    // ── Lugares de Entrega ──────────────────────────────────────
    [HttpGet("lugares-entrega")]
    public async Task<IActionResult> GetLugaresEntrega() =>
        Ok(await _context.LugaresEntrega
            .Select(l => new { l.Id, l.Nombre }).ToListAsync());

    [RequierePermiso("catalogos", "crear", "ventas/crear", "ventas/editar")]
    [HttpPost("lugares-entrega")]
    public async Task<IActionResult> CrearLugarEntrega([FromBody] CrearCatalogoDto dto)
    {
        var nombre = (dto.Nombre ?? "").Trim();
        if (nombre.Length == 0) return BadRequest(new { mensaje = "Escribe el nombre del lugar de entrega" });
        var existente = await _context.LugaresEntrega.FirstOrDefaultAsync(l => l.Nombre == nombre);
        if (existente != null) return Ok(new { existente.Id, existente.Nombre });

        var item = new LugarEntrega { Nombre = nombre };
        _context.LugaresEntrega.Add(item);
        await _context.SaveChangesAsync();
        return Ok(new { item.Id, item.Nombre });
    }

    // ── Estados de Recolección ──────────────────────────────────
    [HttpGet("estados-recoleccion")]
    public async Task<IActionResult> GetEstadosRecoleccion() =>
        Ok(await _context.EstadosRecoleccion
            .Select(e => new { e.Id, e.Descripcion }).ToListAsync());

    [RequierePermiso("catalogos", "crear", "ventas/crear", "ventas/editar")]
    [HttpPost("estados-recoleccion")]
    public async Task<IActionResult> CrearEstadoRecoleccion([FromBody] CrearCatalogoDto dto)
    {
        var nombre = (dto.Nombre ?? "").Trim();
        if (nombre.Length == 0) return BadRequest(new { mensaje = "Escribe la descripción del estado" });
        var existente = await _context.EstadosRecoleccion.FirstOrDefaultAsync(e => e.Descripcion == nombre);
        if (existente != null) return Ok(new { existente.Id, existente.Descripcion });

        var item = new EstadoRecoleccion { Descripcion = nombre };
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