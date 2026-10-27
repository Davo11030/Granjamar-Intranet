using Empresa.Intranet.API.Extensiones;
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
public class PermisosController : ControllerBase
{
    private readonly AppDbContext _context;
    public PermisosController(AppDbContext context) => _context = context;

    // Ver todos los permisos disponibles (para la matriz del administrador)
    [HttpGet]
    [AdminOnly]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Permisos
            .Select(p => new PermisoDto
            {
                Id = p.Id,
                Modulo = p.Modulo,
                Accion = p.Accion,
                Descripcion = p.Descripcion
            })
            .ToListAsync());

    // Permisos efectivos del usuario con sesión: el administrador los tiene todos. El cliente los usa
    // para mostrar u ocultar menús y botones (el servidor siempre vuelve a verificar).
    [HttpGet("mis-permisos")]
    public async Task<IActionResult> MisPermisos()
    {
        var consulta = _context.Permisos.AsQueryable();
        if (!this.EsAdminActual())
        {
            var id = this.IdUsuarioActual();
            consulta = consulta.Where(p => p.UsuariosPermiso.Any(up => up.IdUsuario == id));
        }
        return Ok(await consulta.Select(p => new PermisoDto { Id = p.Id, Modulo = p.Modulo, Accion = p.Accion, Descripcion = p.Descripcion }).ToListAsync());
    }

    // Ver permisos de un usuario (solo el administrador, o el propio usuario)
    [HttpGet("usuario/{idUsuario}")]
    public async Task<IActionResult> GetPorUsuario(uint idUsuario)
    {
        if (idUsuario != this.IdUsuarioActual() && !this.EsAdminActual()) return this.SinPermiso();
        return Ok(await _context.UsuariosPermiso
            .Include(up => up.Permiso)
            .Where(up => up.IdUsuario == idUsuario)
            .Select(up => new PermisoDto
            {
                Id = up.Permiso.Id,
                Modulo = up.Permiso.Modulo,
                Accion = up.Permiso.Accion,
                Descripcion = up.Permiso.Descripcion
            })
            .ToListAsync());
    }

    // Crear permiso
    [HttpPost]
    [AdminOnly]
    public async Task<IActionResult> Crear([FromBody] PermisoDto dto)
    {
        var existe = await _context.Permisos
            .AnyAsync(p => p.Modulo == dto.Modulo && p.Accion == dto.Accion);
        if (existe)
            return BadRequest(new { mensaje = "Ya existe ese permiso" });

        var permiso = new Permiso
        {
            Modulo = dto.Modulo,
            Accion = dto.Accion,
            Descripcion = dto.Descripcion
        };
        _context.Permisos.Add(permiso);
        await _context.SaveChangesAsync();
        return Ok(new { permiso.Id, permiso.Modulo, permiso.Accion });
    }

    // Asignar permiso a usuario
    [HttpPost("asignar")]
    [AdminOnly]
    public async Task<IActionResult> Asignar([FromBody] AsignarPermisoDto dto)
    {
        var existe = await _context.UsuariosPermiso
            .AnyAsync(up => up.IdUsuario == dto.IdUsuario && up.IdPermiso == dto.IdPermiso);
        if (existe)
            return BadRequest(new { mensaje = "El usuario ya tiene ese permiso" });

        _context.UsuariosPermiso.Add(new UsuarioPermiso
        {
            IdUsuario = dto.IdUsuario,
            IdPermiso = dto.IdPermiso
        });
        await _context.SaveChangesAsync();
        return Ok(new { mensaje = "Permiso asignado correctamente" });
    }

    // Quitar permiso a usuario
    [HttpDelete("quitar/{idUsuario}/{idPermiso}")]
    [AdminOnly]
    public async Task<IActionResult> Quitar(uint idUsuario, uint idPermiso)
    {
        var up = await _context.UsuariosPermiso
            .FirstOrDefaultAsync(up => up.IdUsuario == idUsuario && up.IdPermiso == idPermiso);
        if (up == null) return NotFound();
        _context.UsuariosPermiso.Remove(up);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // Quitar todos los permisos de un usuario
    [HttpDelete("quitar-todos/{idUsuario}")]
    [AdminOnly]
    public async Task<IActionResult> QuitarTodos(uint idUsuario)
    {
        var permisos = await _context.UsuariosPermiso
            .Where(up => up.IdUsuario == idUsuario)
            .ToListAsync();
        _context.UsuariosPermiso.RemoveRange(permisos);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}