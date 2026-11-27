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
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "empresas", "crear"))
            return this.SinPermiso();
        var nombre = (dto.Nombre ?? "").Trim();
        if (nombre.Length == 0) return BadRequest(new { mensaje = "El nombre de la empresa es obligatorio" });
        var errorDirecciones = await ValidarDireccionesAsync(null, dto.Direcciones);
        if (errorDirecciones != null) return errorDirecciones;

        // Empresa y direcciones juntas: si algo falla no queda una empresa a medias (y reintentar no la duplica).
        await using var tx = await _context.Database.BeginTransactionAsync();
        var item = new Domain.Entities.Empresa
        {
            Nombre = nombre,
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
        }, this.IdUsuarioActual());
        await GuardarDireccionesAsync(item.Id, dto.Direcciones);
        await tx.CommitAsync();

        return CreatedAtAction(nameof(GetPorId), new { id = item.Id },
            new EmpresaDto { Id = item.Id, Nombre = item.Nombre, Rfc = item.Rfc, Tipo = item.Tipo });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearEmpresaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "empresas", "editar"))
            return this.SinPermiso();

        var item = await _context.Empresas
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (item == null) return NotFound();
        var nombre = (dto.Nombre ?? "").Trim();
        if (nombre.Length == 0) return BadRequest(new { mensaje = "El nombre de la empresa es obligatorio" });
        var errorDirecciones = await ValidarDireccionesAsync(id, dto.Direcciones);
        if (errorDirecciones != null) return errorDirecciones;

        await using var tx = await _context.Database.BeginTransactionAsync();
        var datosAnteriores = new { item.Nombre, item.Rfc, item.UrlLogo };

        item.Nombre = nombre;
        item.Rfc = dto.Rfc;
        item.UrlLogo = dto.UrlLogo;
        item.Tipo = dto.Tipo;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("empresas", id.ToString(), "MODIFICAR", datosAnteriores, new
        {
            item.Nombre,
            item.Rfc,
            item.UrlLogo
        }, this.IdUsuarioActual());
        await GuardarDireccionesAsync(id, dto.Direcciones);
        await tx.CommitAsync();

        return NoContent();
    }

    // Revisa las direcciones que vienen con la empresa: datos obligatorios, que las existentes sean de esta empresa y
    // los permisos de crear/editar direcciones. Se valida todo antes de escribir.
    private async Task<IActionResult?> ValidarDireccionesAsync(uint? idEmpresa, List<DireccionEmpresaDto>? direcciones)
    {
        if (direcciones == null || direcciones.Count == 0) return null;
        foreach (var d in direcciones)
        {
            if (string.IsNullOrWhiteSpace(d.Direccion)) return BadRequest(new { mensaje = "Una dirección no puede quedar vacía" });
            if (string.IsNullOrWhiteSpace(d.Estado) || string.IsNullOrWhiteSpace(d.Municipio))
                return BadRequest(new { mensaje = "Cada dirección necesita estado y municipio" });
        }
        var ids = direcciones.Where(d => d.Id != null).Select(d => d.Id!.Value).ToList();
        if (ids.Count > 0)
        {
            var propias = await _context.Direcciones.CountAsync(d => ids.Contains(d.Id) && d.Activo && d.IdEmpresa == idEmpresa);
            if (idEmpresa == null || propias != ids.Distinct().Count())
                return BadRequest(new { mensaje = "Una de las direcciones no pertenece a esta empresa; recarga la pantalla" });
            if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "direcciones", "editar"))
                return this.SinPermiso();
        }
        if (direcciones.Any(d => d.Id == null)
            && !await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "direcciones", "crear"))
            return this.SinPermiso();
        return null;
    }

    private async Task GuardarDireccionesAsync(uint idEmpresa, List<DireccionEmpresaDto>? direcciones)
    {
        if (direcciones == null) return;
        static string? Limpio(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        foreach (var d in direcciones)
        {
            if (d.Id == null)
            {
                var nueva = new Domain.Entities.Direccion
                {
                    DireccionTexto = d.Direccion.Trim(),
                    Estado = d.Estado.Trim(),
                    Municipio = d.Municipio.Trim(),
                    CodigoPostal = Limpio(d.CodigoPostal),
                    Segmento = Limpio(d.Segmento),
                    IdEmpresa = idEmpresa
                };
                _context.Direcciones.Add(nueva);
                await _context.SaveChangesAsync();
                await _auditoria.RegistrarAsync("direcciones", nueva.Id.ToString(), "CREAR", null,
                    new { nueva.Id, nueva.DireccionTexto, nueva.Estado, nueva.Municipio, nueva.CodigoPostal, nueva.Segmento, nueva.IdEmpresa },
                    this.IdUsuarioActual());
                continue;
            }
            var existente = await _context.Direcciones.FirstAsync(x => x.Id == d.Id);
            var antes = new { existente.DireccionTexto, existente.Estado, existente.Municipio, existente.CodigoPostal, existente.Segmento };
            var despues = new
            {
                DireccionTexto = d.Direccion.Trim(), Estado = d.Estado.Trim(), Municipio = d.Municipio.Trim(),
                CodigoPostal = Limpio(d.CodigoPostal), Segmento = Limpio(d.Segmento)
            };
            if (antes.Equals(despues)) continue; // sin cambios: no se toca ni se registra
            existente.DireccionTexto = despues.DireccionTexto;
            existente.Estado = despues.Estado;
            existente.Municipio = despues.Municipio;
            existente.CodigoPostal = despues.CodigoPostal;
            existente.Segmento = despues.Segmento;
            await _context.SaveChangesAsync();
            await _auditoria.RegistrarAsync("direcciones", existente.Id.ToString(), "MODIFICAR", antes, despues, this.IdUsuarioActual());
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "empresas", "eliminar"))
            return this.SinPermiso();

        var item = await _context.Empresas
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (item == null) return NotFound();

        var datosAnteriores = new { item.Id, item.Nombre, item.Rfc };

        // Sus direcciones se dan de baja junto con ella; si alguna todavía tiene producto, no se permite
        // (el inventario quedaría escondido).
        var direcciones = await _context.Direcciones
            .Where(d => d.IdEmpresa == id && d.Activo)
            .ToListAsync();
        var idsDirecciones = direcciones.Select(d => d.Id).ToList();
        var kilos = await _context.UbicacionesProducto
            .Where(u => idsDirecciones.Contains(u.IdDireccion) && u.CantidadKilos > 0)
            .SumAsync(u => (decimal?)u.CantidadKilos) ?? 0;
        if (kilos > 0)
            return BadRequest(new { mensaje = $"No se puede dar de baja: sus direcciones todavía tienen {kilos:N2} kg en inventario." });

        item.Activo = false;
        foreach (var d in direcciones) d.Activo = false;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("empresas", id.ToString(), "ELIMINAR",
            datosAnteriores, new { DireccionesDadasDeBaja = direcciones.Count }, this.IdUsuarioActual());

        return NoContent();
    }
}