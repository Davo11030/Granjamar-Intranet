using System.Text.RegularExpressions;
using Empresa.Intranet.API.Extensiones;
using Empresa.Intranet.API.Filtros;
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
public class UsuariosController : ControllerBase
{
    private static readonly Regex FormatoCorreo = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

    private readonly AppDbContext _context;
    private readonly TokenService _tokenService;
    private readonly AuditoriaService _auditoria;

    public UsuariosController(AppDbContext context, TokenService tokenService, AuditoriaService auditoria)
    {
        _context = context;
        _tokenService = tokenService;
        _auditoria = auditoria;
    }

    // POST api/usuarios/login
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
    {
        var usuario = await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Nombre == request.Nombre);

        if (usuario == null || !BCrypt.Net.BCrypt.Verify(request.Contrasena, usuario.Contrasena))
            return Unauthorized(new { mensaje = "Usuario o contraseña incorrectos" });

        var (token, expiracion) = _tokenService.GenerarToken(usuario);

        return Ok(new LoginResponseDto
        {
            Id = usuario.Id,
            Token = token,
            Nombre = usuario.Nombre ?? "",
            Puesto = usuario.Puesto,
            Expiracion = expiracion
        });
    }

    // GET api/usuarios
    [HttpGet]
    [Authorize]
    [AdminOnly]
    public async Task<IActionResult> GetTodos()
    {
        var usuarios = await _context.Usuarios
            .Select(u => new UsuarioDto
            {
                Id = u.Id,
                Nombre = u.Nombre,
                Puesto = u.Puesto,
                Correo = u.Correo
            })
            .ToListAsync();

        return Ok(usuarios);
    }

    // GET api/usuarios/perfil — el propio usuario autenticado, sin necesidad de ser admin.
    [HttpGet("perfil")]
    [Authorize]
    public async Task<IActionResult> GetPerfil()
    {
        var usuario = await _context.Usuarios.FindAsync(this.IdUsuarioActual());
        if (usuario == null) return NotFound();

        return Ok(new UsuarioDto
        {
            Id = usuario.Id,
            Nombre = usuario.Nombre,
            Puesto = usuario.Puesto,
            Correo = usuario.Correo
        });
    }

    // PUT api/usuarios/perfil — el propio usuario agrega/edita su correo.
    [HttpPut("perfil")]
    [Authorize]
    public async Task<IActionResult> ActualizarPerfil([FromBody] ActualizarPerfilDto dto)
    {
        var usuario = await _context.Usuarios.FindAsync(this.IdUsuarioActual());
        if (usuario == null) return NotFound();

        var correo = string.IsNullOrWhiteSpace(dto.Correo) ? null : dto.Correo.Trim();
        if (correo != null && !FormatoCorreo.IsMatch(correo))
            return BadRequest(new { mensaje = "El correo electrónico no es válido" });

        var antes = new { usuario.Correo };
        usuario.Correo = correo;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("usuarios", usuario.Id.ToString(), "MODIFICAR", antes,
            new { usuario.Correo }, usuario.Id);

        return Ok(new UsuarioDto { Id = usuario.Id, Nombre = usuario.Nombre, Puesto = usuario.Puesto, Correo = usuario.Correo });
    }

    // PUT api/usuarios/perfil/contrasena — cambiar la propia contraseña estando logueado.
    [HttpPut("perfil/contrasena")]
    [Authorize]
    public async Task<IActionResult> CambiarContrasena([FromBody] CambiarContrasenaDto dto)
    {
        var usuario = await _context.Usuarios.FindAsync(this.IdUsuarioActual());
        if (usuario == null) return NotFound();

        if (!BCrypt.Net.BCrypt.Verify(dto.ContrasenaActual, usuario.Contrasena))
            return BadRequest(new { mensaje = "La contraseña actual no es correcta" });

        if (string.IsNullOrEmpty(dto.ContrasenaNueva) || dto.ContrasenaNueva.Length < 4)
            return BadRequest(new { mensaje = "La nueva contraseña debe tener al menos 4 caracteres" });

        usuario.Contrasena = BCrypt.Net.BCrypt.HashPassword(dto.ContrasenaNueva);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("usuarios", usuario.Id.ToString(), "MODIFICAR",
            new { contrasenaCambiada = false }, new { contrasenaCambiada = true }, usuario.Id);

        return NoContent();
    }

    // POST api/usuarios/solicitar-restablecimiento — sin sesión: crea una solicitud que
    // el administrador debe aprobar (aparece en Movimientos). No se envía ningún correo.
    [HttpPost("solicitar-restablecimiento")]
    [AllowAnonymous]
    public async Task<IActionResult> SolicitarRestablecimiento([FromBody] SolicitarRestablecimientoDto dto)
    {
        var nombre = (dto.Nombre ?? "").Trim();
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Nombre == nombre);

        if (usuario != null)
        {
            var yaActiva = await _context.SolicitudesContrasena.AnyAsync(s =>
                s.IdUsuario == usuario.Id && (s.Estado == "Pendiente" || s.Estado == "Aprobada"));

            if (!yaActiva)
            {
                var solicitud = new SolicitudContrasena
                {
                    IdUsuario = usuario.Id,
                    FechaSolicitud = DateTime.UtcNow,
                    Estado = "Pendiente"
                };
                _context.SolicitudesContrasena.Add(solicitud);
                await _context.SaveChangesAsync();

                await _auditoria.RegistrarAsync("solicitudes_contrasena", solicitud.Id.ToString(), "CREAR",
                    null, new { usuario.Nombre, Estado = "Pendiente" }, usuario.Id);
            }
        }

        // Mensaje genérico: no revela si el usuario existe.
        return Ok(new { mensaje = "Si el usuario existe, se envió una solicitud al administrador para autorizar el restablecimiento." });
    }

    // GET api/usuarios/solicitud-restablecimiento/estado?nombre=xxx — sin sesión: para que el
    // login sepa si debe mostrar "espera aprobación" o ya dejar poner una nueva contraseña.
    [HttpGet("solicitud-restablecimiento/estado")]
    [AllowAnonymous]
    public async Task<IActionResult> EstadoSolicitud([FromQuery] string nombre)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Nombre == (nombre ?? "").Trim());
        if (usuario == null) return Ok(new EstadoSolicitudDto { Estado = "Ninguna" });

        var solicitud = await _context.SolicitudesContrasena
            .Where(s => s.IdUsuario == usuario.Id && (s.Estado == "Pendiente" || s.Estado == "Aprobada"))
            .OrderByDescending(s => s.FechaSolicitud)
            .FirstOrDefaultAsync();

        return Ok(new EstadoSolicitudDto { Estado = solicitud?.Estado ?? "Ninguna" });
    }

    // POST api/usuarios/restablecer-con-aprobacion — sin sesión: solo funciona si el admin
    // ya aprobó una solicitud para este usuario.
    [HttpPost("restablecer-con-aprobacion")]
    [AllowAnonymous]
    public async Task<IActionResult> RestablecerConAprobacion([FromBody] RestablecerConAprobacionDto dto)
    {
        if (string.IsNullOrEmpty(dto.ContrasenaNueva) || dto.ContrasenaNueva.Length < 4)
            return BadRequest(new { mensaje = "La nueva contraseña debe tener al menos 4 caracteres" });

        var nombre = (dto.Nombre ?? "").Trim();
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Nombre == nombre);
        if (usuario == null)
            return BadRequest(new { mensaje = "No hay una solicitud aprobada para este usuario" });

        var solicitud = await _context.SolicitudesContrasena
            .Where(s => s.IdUsuario == usuario.Id && s.Estado == "Aprobada")
            .OrderByDescending(s => s.FechaSolicitud)
            .FirstOrDefaultAsync();
        if (solicitud == null)
            return BadRequest(new { mensaje = "No hay una solicitud aprobada para este usuario" });

        usuario.Contrasena = BCrypt.Net.BCrypt.HashPassword(dto.ContrasenaNueva);
        solicitud.Estado = "Completada";
        solicitud.FechaResolucion = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("usuarios", usuario.Id.ToString(), "MODIFICAR",
            new { contrasenaCambiada = false, via = "solicitud_aprobada" },
            new { contrasenaCambiada = true, via = "solicitud_aprobada" }, usuario.Id);

        return Ok(new { mensaje = "Contraseña actualizada. Ya puedes iniciar sesión." });
    }

    // GET api/usuarios/solicitudes-restablecimiento — panel del administrador.
    [HttpGet("solicitudes-restablecimiento")]
    [Authorize]
    [AdminOnly]
    public async Task<IActionResult> GetSolicitudes()
    {
        var solicitudes = await _context.SolicitudesContrasena
            .Include(s => s.Usuario)
            .Where(s => s.Estado == "Pendiente" || s.Estado == "Aprobada")
            .OrderByDescending(s => s.FechaSolicitud)
            .Select(s => new SolicitudContrasenaDto
            {
                Id = s.Id,
                NombreUsuario = s.Usuario.Nombre,
                Estado = s.Estado,
                FechaSolicitud = s.FechaSolicitud
            })
            .ToListAsync();

        return Ok(solicitudes);
    }

    // PUT api/usuarios/solicitudes-restablecimiento/5/aprobar
    [HttpPut("solicitudes-restablecimiento/{id}/aprobar")]
    [Authorize]
    [AdminOnly]
    public async Task<IActionResult> AprobarSolicitud(uint id)
    {
        var solicitud = await _context.SolicitudesContrasena.Include(s => s.Usuario)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (solicitud == null) return NotFound();
        if (solicitud.Estado != "Pendiente")
            return BadRequest(new { mensaje = "Esta solicitud ya fue resuelta" });

        solicitud.Estado = "Aprobada";
        solicitud.FechaResolucion = DateTime.UtcNow;
        solicitud.IdUsuarioResolucion = this.IdUsuarioActual();
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("solicitudes_contrasena", solicitud.Id.ToString(), "MODIFICAR",
            new { Estado = "Pendiente" }, new { Estado = "Aprobada", solicitud.Usuario.Nombre },
            this.IdUsuarioActual());

        return NoContent();
    }

    // PUT api/usuarios/solicitudes-restablecimiento/5/rechazar
    [HttpPut("solicitudes-restablecimiento/{id}/rechazar")]
    [Authorize]
    [AdminOnly]
    public async Task<IActionResult> RechazarSolicitud(uint id)
    {
        var solicitud = await _context.SolicitudesContrasena.Include(s => s.Usuario)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (solicitud == null) return NotFound();
        if (solicitud.Estado != "Pendiente")
            return BadRequest(new { mensaje = "Esta solicitud ya fue resuelta" });

        solicitud.Estado = "Rechazada";
        solicitud.FechaResolucion = DateTime.UtcNow;
        solicitud.IdUsuarioResolucion = this.IdUsuarioActual();
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("solicitudes_contrasena", solicitud.Id.ToString(), "MODIFICAR",
            new { Estado = "Pendiente" }, new { Estado = "Rechazada", solicitud.Usuario.Nombre },
            this.IdUsuarioActual());

        return NoContent();
    }

    // GET api/usuarios/5
    [HttpGet("{id}")]
    [Authorize]
    [AdminOnly]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var usuario = await _context.Usuarios.FindAsync(id);
        if (usuario == null) return NotFound();

        return Ok(new UsuarioDto
        {
            Id = usuario.Id,
            Nombre = usuario.Nombre,
            Puesto = usuario.Puesto,
            Correo = usuario.Correo
        });
    }

    // POST api/usuarios
    [HttpPost]
    [Authorize]
    [AdminOnly]
    public async Task<IActionResult> Crear([FromBody] CrearUsuarioDto dto)
    {
        var existe = await _context.Usuarios.AnyAsync(u => u.Nombre == dto.Nombre);
        if (existe) return BadRequest(new { mensaje = "Ya existe un usuario con ese nombre" });

        var correo = string.IsNullOrWhiteSpace(dto.Correo) ? null : dto.Correo.Trim();
        if (correo != null && !FormatoCorreo.IsMatch(correo))
            return BadRequest(new { mensaje = "El correo electrónico no es válido" });

        var usuario = new Usuario
        {
            Nombre = dto.Nombre,
            Puesto = dto.Puesto,
            Correo = correo,
            Contrasena = BCrypt.Net.BCrypt.HashPassword(dto.Contrasena)
        };

        _context.Usuarios.Add(usuario);
        await _context.SaveChangesAsync();

        // Nunca se registra la contraseña en la auditoría.
        await _auditoria.RegistrarAsync("usuarios", usuario.Id.ToString(), "CREAR", null,
            new { usuario.Id, usuario.Nombre, usuario.Puesto, usuario.Correo }, this.IdUsuarioActual());

        return CreatedAtAction(nameof(GetPorId), new { id = usuario.Id },
            new UsuarioDto { Id = usuario.Id, Nombre = usuario.Nombre, Puesto = usuario.Puesto, Correo = usuario.Correo });
    }

    // PUT api/usuarios/5
    [HttpPut("{id}")]
    [Authorize]
    [AdminOnly]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearUsuarioDto dto)
    {
        var usuario = await _context.Usuarios.FindAsync(id);
        if (usuario == null) return NotFound();

        var correo = string.IsNullOrWhiteSpace(dto.Correo) ? null : dto.Correo.Trim();
        if (correo != null && !FormatoCorreo.IsMatch(correo))
            return BadRequest(new { mensaje = "El correo electrónico no es válido" });

        var antes = new { usuario.Id, usuario.Nombre, usuario.Puesto, usuario.Correo };
        var cambioContrasena = !string.IsNullOrEmpty(dto.Contrasena);

        usuario.Nombre = dto.Nombre;
        usuario.Puesto = dto.Puesto;
        usuario.Correo = correo;

        if (cambioContrasena)
            usuario.Contrasena = BCrypt.Net.BCrypt.HashPassword(dto.Contrasena);

        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("usuarios", id.ToString(), "MODIFICAR", antes,
            new { usuario.Id, usuario.Nombre, usuario.Puesto, usuario.Correo, contrasenaCambiada = cambioContrasena },
            this.IdUsuarioActual());

        return NoContent();
    }

    // DELETE api/usuarios/5
    [HttpDelete("{id}")]
    [Authorize]
    [AdminOnly]
    public async Task<IActionResult> Eliminar(uint id)
    {
        var usuario = await _context.Usuarios.FindAsync(id);
        if (usuario == null) return NotFound();

        var antes = new { usuario.Id, usuario.Nombre, usuario.Puesto };
        _context.Usuarios.Remove(usuario);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("usuarios", id.ToString(), "ELIMINAR", antes, null,
            this.IdUsuarioActual());

        return NoContent();
    }
}
