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
public class CatalogosTransporteController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    public CatalogosTransporteController(AppDbContext context, AuditoriaService auditoria)
    {
        _context = context;
        _auditoria = auditoria;
    }

    // ── Choferes ────────────────────────────────────────────────
    [HttpGet("choferes")]
    public async Task<IActionResult> GetChoferes() =>
        Ok(await _context.Choferes
            .Where(c => c.Activo)
            .Select(c => new { c.Id, c.Nombre, c.NumeroTelefono, c.TipoTelefono })
            .ToListAsync());

    [RequierePermiso("catalogos", "crear")]
    [HttpPost("choferes")]
    public async Task<IActionResult> CrearChofer([FromBody] CrearChoferDto dto)
    {
        var item = new Chofer
        {
            Nombre = dto.Nombre,
            NumeroTelefono = dto.NumeroTelefono,
            TipoTelefono = dto.TipoTelefono
        };
        _context.Choferes.Add(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("choferes", item.Id.ToString(), "CREAR", null,
            new { item.Nombre, item.NumeroTelefono, item.TipoTelefono }, this.IdUsuarioActual());
        return Ok(new { item.Id, item.Nombre });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("choferes/{id}")]
    public async Task<IActionResult> ActualizarChofer(uint id, [FromBody] CrearChoferDto dto)
    {
        var item = await _context.Choferes.FirstOrDefaultAsync(c => c.Id == id && c.Activo);
        if (item == null) return NotFound();

        var antes = new { item.Nombre, item.NumeroTelefono, item.TipoTelefono };

        item.Nombre = dto.Nombre;
        item.NumeroTelefono = dto.NumeroTelefono;
        item.TipoTelefono = dto.TipoTelefono;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("choferes", id.ToString(), "MODIFICAR", antes,
            new { item.Nombre, item.NumeroTelefono, item.TipoTelefono }, this.IdUsuarioActual());

        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("choferes/{id}")]
    public async Task<IActionResult> EliminarChofer(uint id)
    {
        var item = await _context.Choferes.FirstOrDefaultAsync(c => c.Id == id && c.Activo);
        if (item == null) return NotFound();

        item.Activo = false;
        await _context.SaveChangesAsync();
        await _auditoria.RegistrarAsync("choferes", id.ToString(), "ELIMINAR", new { item.Nombre }, null, this.IdUsuarioActual());
        return NoContent();
    }

    // ── Marcas Tractocamion ─────────────────────────────────────
    [HttpGet("marcas-tractocamion")]
    public async Task<IActionResult> GetMarcasTractocamion() =>
        Ok(await _context.MarcasTractocamion
            .Select(m => new { m.Id, m.Nombre })
            .ToListAsync());

    [RequierePermiso("catalogos", "crear")]
    [HttpPost("marcas-tractocamion")]
    public async Task<IActionResult> CrearMarcaTractocamion([FromBody] CrearMarcaTractocamionDto dto)
    {
        var item = new MarcaTractocamion { Nombre = dto.Nombre };
        _context.MarcasTractocamion.Add(item);
        await _context.SaveChangesAsync();
        await _auditoria.RegistrarAsync("marcas_tractocamion", item.Id.ToString(), "CREAR", null,
            new { item.Nombre }, this.IdUsuarioActual());
        return Ok(new { item.Id, item.Nombre });
    }

    // ── Cajas Tractocamion ──────────────────────────────────────
    [HttpGet("cajas-tractocamion")]
    public async Task<IActionResult> GetCajas([FromQuery] uint? idEmpresa)
    {
        var query = _context.CajasTractocamion.Include(c => c.Empresa).Where(c => c.Activo);
        if (idEmpresa.HasValue) query = query.Where(c => c.IdEmpresa == idEmpresa);

        return Ok(await query
            .Select(c => new
            {
                c.Id,
                c.CajaPlaca,
                c.CajaTamano,
                c.CajaCapacidad,
                c.IdEmpresa,
                Empresa = c.Empresa != null ? c.Empresa.Nombre : null
            })
            .ToListAsync());
    }

    [RequierePermiso("catalogos", "crear")]
    [HttpPost("cajas-tractocamion")]
    public async Task<IActionResult> CrearCaja([FromBody] CrearCajaTractocamionDto dto)
    {
        var item = new CajaTractocamion
        {
            CajaPlaca = dto.CajaPlaca,
            CajaTamano = dto.CajaTamano,
            CajaCapacidad = dto.CajaCapacidad,
            IdEmpresa = dto.IdEmpresa
        };
        _context.CajasTractocamion.Add(item);
        await _context.SaveChangesAsync();

        var empresa = item.IdEmpresa != null ? await _context.Empresas.FindAsync(item.IdEmpresa) : null;
        await _auditoria.RegistrarAsync("cajas_tractocamion", item.Id.ToString(), "CREAR", null,
            new { item.CajaPlaca, item.CajaTamano, item.CajaCapacidad, Empresa = empresa?.Nombre }, this.IdUsuarioActual());
        return Ok(new { item.Id, item.CajaPlaca });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("cajas-tractocamion/{id}")]
    public async Task<IActionResult> ActualizarCaja(uint id, [FromBody] CrearCajaTractocamionDto dto)
    {
        var item = await _context.CajasTractocamion.FirstOrDefaultAsync(c => c.Id == id && c.Activo);
        if (item == null) return NotFound();

        var empresaAntes = item.IdEmpresa != null ? await _context.Empresas.FindAsync(item.IdEmpresa) : null;
        var antes = new { item.CajaPlaca, item.CajaTamano, item.CajaCapacidad, Empresa = empresaAntes?.Nombre };

        item.CajaPlaca = dto.CajaPlaca;
        item.CajaTamano = dto.CajaTamano;
        item.CajaCapacidad = dto.CajaCapacidad;
        item.IdEmpresa = dto.IdEmpresa;
        await _context.SaveChangesAsync();

        var empresaDespues = item.IdEmpresa != null ? await _context.Empresas.FindAsync(item.IdEmpresa) : null;
        await _auditoria.RegistrarAsync("cajas_tractocamion", id.ToString(), "MODIFICAR", antes,
            new { item.CajaPlaca, item.CajaTamano, item.CajaCapacidad, Empresa = empresaDespues?.Nombre }, this.IdUsuarioActual());

        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("cajas-tractocamion/{id}")]
    public async Task<IActionResult> EliminarCaja(uint id)
    {
        var item = await _context.CajasTractocamion.FirstOrDefaultAsync(c => c.Id == id && c.Activo);
        if (item == null) return NotFound();

        item.Activo = false;
        await _context.SaveChangesAsync();
        await _auditoria.RegistrarAsync("cajas_tractocamion", id.ToString(), "ELIMINAR", new { item.CajaPlaca }, null, this.IdUsuarioActual());
        return NoContent();
    }

    // ── Tractocamiones ──────────────────────────────────────────
    [HttpGet("tractocamiones")]
    public async Task<IActionResult> GetTractocamiones([FromQuery] uint? idEmpresa)
    {
        var query = _context.Tractocamiones
            .Include(t => t.Marca)
            .Include(t => t.Empresa)
            .Where(t => t.Activo);
        if (idEmpresa.HasValue) query = query.Where(t => t.IdEmpresa == idEmpresa);

        return Ok(await query
            .Select(t => new
            {
                t.Id,
                t.Modelo,
                t.Color,
                t.Placa,
                t.IdMarca,
                Marca = t.Marca.Nombre,
                t.IdEmpresa,
                Empresa = t.Empresa != null ? t.Empresa.Nombre : null
            })
            .ToListAsync());
    }

    [RequierePermiso("catalogos", "crear")]
    [HttpPost("tractocamiones")]
    public async Task<IActionResult> CrearTractocamion([FromBody] CrearTractocamionDto dto)
    {
        var item = new Tractocamion
        {
            Modelo = dto.Modelo,
            Color = dto.Color,
            IdMarca = dto.IdMarca,
            IdEmpresa = dto.IdEmpresa,
            Placa = dto.Placa
        };
        _context.Tractocamiones.Add(item);
        await _context.SaveChangesAsync();

        var marca = await _context.MarcasTractocamion.FindAsync(item.IdMarca);
        var empresa = item.IdEmpresa != null ? await _context.Empresas.FindAsync(item.IdEmpresa) : null;
        await _auditoria.RegistrarAsync("tractocamiones", item.Id.ToString(), "CREAR", null,
            new { item.Modelo, item.Color, item.Placa, Marca = marca?.Nombre, Empresa = empresa?.Nombre },
            this.IdUsuarioActual());
        return Ok(new { item.Id, item.Modelo, item.Placa });
    }

    [RequierePermiso("catalogos", "editar")]
    [HttpPut("tractocamiones/{id}")]
    public async Task<IActionResult> ActualizarTractocamion(uint id, [FromBody] CrearTractocamionDto dto)
    {
        var item = await _context.Tractocamiones.FirstOrDefaultAsync(t => t.Id == id && t.Activo);
        if (item == null) return NotFound();

        var marcaAntes = await _context.MarcasTractocamion.FindAsync(item.IdMarca);
        var empresaAntes = item.IdEmpresa != null ? await _context.Empresas.FindAsync(item.IdEmpresa) : null;
        var antes = new { item.Modelo, item.Color, item.Placa, Marca = marcaAntes?.Nombre, Empresa = empresaAntes?.Nombre };

        item.Modelo = dto.Modelo;
        item.Color = dto.Color;
        item.IdMarca = dto.IdMarca;
        item.IdEmpresa = dto.IdEmpresa;
        item.Placa = dto.Placa;
        await _context.SaveChangesAsync();

        var marcaDespues = await _context.MarcasTractocamion.FindAsync(item.IdMarca);
        var empresaDespues = item.IdEmpresa != null ? await _context.Empresas.FindAsync(item.IdEmpresa) : null;
        await _auditoria.RegistrarAsync("tractocamiones", id.ToString(), "MODIFICAR", antes,
            new { item.Modelo, item.Color, item.Placa, Marca = marcaDespues?.Nombre, Empresa = empresaDespues?.Nombre },
            this.IdUsuarioActual());

        return NoContent();
    }

    [RequierePermiso("catalogos", "eliminar")]
    [HttpDelete("tractocamiones/{id}")]
    public async Task<IActionResult> EliminarTractocamion(uint id)
    {
        var item = await _context.Tractocamiones.FirstOrDefaultAsync(t => t.Id == id && t.Activo);
        if (item == null) return NotFound();

        item.Activo = false;
        await _context.SaveChangesAsync();
        await _auditoria.RegistrarAsync("tractocamiones", id.ToString(), "ELIMINAR", new { item.Placa }, null, this.IdUsuarioActual());
        return NoContent();
    }
}
