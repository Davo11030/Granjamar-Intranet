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
public class ClientesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;

    public ClientesController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService)
    {
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
    }

    [RequierePermiso("clientes","ver","ventas/crear","ventas/editar","embarques/crear","embarques/editar")]
    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Clientes
            .Where(c => c.Activo)
            .Select(c => new { c.Id, c.Nombre, c.Telefono, c.Rfc, c.Calle, c.Colonia, c.Municipio, c.Estado, c.CodigoPostal })
            .ToListAsync());

    [RequierePermiso("clientes","ver","ventas/crear","ventas/editar")]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var item = await _context.Clientes
            .FirstOrDefaultAsync(c => c.Id == id && c.Activo);
        if (item == null) return NotFound();
        return Ok(new { item.Id, item.Nombre, item.Telefono, item.Rfc, item.Calle, item.Colonia, item.Municipio, item.Estado, item.CodigoPostal });
    }

    // Todo es obligatorio salvo el teléfono: nombre, RFC y la dirección completa.
    private static string? ValidarCliente(CrearClienteDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre)) return "El nombre del cliente es obligatorio";
        var rfc = (dto.Rfc ?? "").Trim();
        if (rfc.Length == 0) return "El RFC es obligatorio";
        if (!System.Text.RegularExpressions.Regex.IsMatch(rfc, "^[A-Za-z&Ññ0-9]{12,13}$"))
            return "El RFC debe tener 12 o 13 caracteres";
        if (string.IsNullOrWhiteSpace(dto.Calle)) return "Indica la calle y número";
        if (string.IsNullOrWhiteSpace(dto.Colonia)) return "Indica la colonia";
        if (string.IsNullOrWhiteSpace(dto.Municipio)) return "Indica el municipio o ciudad";
        if (string.IsNullOrWhiteSpace(dto.Estado)) return "Indica el estado";
        if (!System.Text.RegularExpressions.Regex.IsMatch((dto.CodigoPostal ?? "").Trim(), "^[0-9]{5}$"))
            return "El código postal debe tener 5 dígitos";
        return null;
    }

    private static string? Limpio(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearClienteDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "clientes", "crear"))
            return this.SinPermiso();
        var error = ValidarCliente(dto);
        if (error != null) return BadRequest(new { mensaje = error });

        var item = new Cliente
        {
            Nombre = dto.Nombre!.Trim(),
            Telefono = Limpio(dto.Telefono),
            Rfc = dto.Rfc!.Trim().ToUpperInvariant(),
            Calle = Limpio(dto.Calle),
            Colonia = Limpio(dto.Colonia),
            Municipio = Limpio(dto.Municipio),
            Estado = Limpio(dto.Estado),
            CodigoPostal = Limpio(dto.CodigoPostal)
        };
        _context.Clientes.Add(item);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("clientes", item.Id.ToString(), "CREAR", null, new
        {
            item.Id,
            item.Nombre,
            item.Telefono,
            item.Rfc,
            item.Calle,
            item.Colonia,
            item.Municipio,
            item.Estado,
            item.CodigoPostal
        }, dto.IdUsuario);

        return CreatedAtAction(nameof(GetPorId), new { id = item.Id },
            new { item.Id, item.Nombre, item.Telefono, item.Rfc, item.Calle, item.Colonia, item.Municipio, item.Estado, item.CodigoPostal });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearClienteDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "clientes", "editar"))
            return this.SinPermiso();
        var error = ValidarCliente(dto);
        if (error != null) return BadRequest(new { mensaje = error });

        var item = await _context.Clientes
            .FirstOrDefaultAsync(c => c.Id == id && c.Activo);
        if (item == null) return NotFound();

        var datosAnteriores = new
        {
            item.Nombre,
            item.Telefono,
            item.Rfc,
            item.Calle,
            item.Colonia,
            item.Municipio,
            item.Estado,
            item.CodigoPostal
        };

        item.Nombre = dto.Nombre!.Trim();
        item.Telefono = Limpio(dto.Telefono);
        item.Rfc = dto.Rfc!.Trim().ToUpperInvariant();
        item.Calle = Limpio(dto.Calle);
        item.Colonia = Limpio(dto.Colonia);
        item.Municipio = Limpio(dto.Municipio);
        item.Estado = Limpio(dto.Estado);
        item.CodigoPostal = Limpio(dto.CodigoPostal);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("clientes", id.ToString(), "MODIFICAR", datosAnteriores, new
        {
            item.Nombre,
            item.Telefono,
            item.Rfc,
            item.Calle,
            item.Colonia,
            item.Municipio,
            item.Estado,
            item.CodigoPostal
        }, dto.IdUsuario);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id, [FromQuery] uint idUsuario)
    {
        if (!await _permisoService.TienePermisoAsync(idUsuario, "clientes", "eliminar"))
            return this.SinPermiso();

        var item = await _context.Clientes
            .FirstOrDefaultAsync(c => c.Id == id && c.Activo);
        if (item == null) return NotFound();

        var datosAnteriores = new
        {
            item.Id,
            item.Nombre,
            item.Telefono,
            item.Rfc
        };

        item.Activo = false;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("clientes", id.ToString(), "ELIMINAR",
            datosAnteriores, null, idUsuario);

        return NoContent();
    }
}