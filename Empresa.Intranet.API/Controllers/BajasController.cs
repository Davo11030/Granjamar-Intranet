using Empresa.Intranet.API.Extensiones;
using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.Infrastructure.Persistence;
using Empresa.Intranet.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Controllers;

// Todo lo que se da de baja (usuarios, clientes, empresas, direcciones, productos del kardex, operadores, tractocamiones y
// cajas) es una baja lógica: el registro sigue en la base con Activo = false. Aquí el administrador ve lo dado de baja y
// lo puede reactivar. Antes no había forma de hacerlo desde la intranet.
[ApiController]
[Route("api/[controller]")]
[Authorize]
[AdminOnly]
public class BajasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;

    public BajasController(AppDbContext context, AuditoriaService auditoria)
    {
        _context = context;
        _auditoria = auditoria;
    }

    public record RegistroDadoDeBaja(string Tipo, string Id, string Nombre, string? Detalle);

    // GET api/bajas — todo lo dado de baja, agrupado por tipo.
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var lista = new List<RegistroDadoDeBaja>();
        lista.AddRange((await _context.Usuarios.Where(u => !u.Activo).OrderBy(u => u.Nombre).ToListAsync())
            .Select(u => new RegistroDadoDeBaja("usuario", u.Id.ToString(), u.Nombre, u.Puesto)));
        lista.AddRange((await _context.Clientes.Where(c => !c.Activo).OrderBy(c => c.Nombre).ToListAsync())
            .Select(c => new RegistroDadoDeBaja("cliente", c.Id.ToString(), c.Nombre, c.Rfc)));
        lista.AddRange((await _context.Empresas.Where(e => !e.Activo).OrderBy(e => e.Nombre).ToListAsync())
            .Select(e => new RegistroDadoDeBaja("empresa", e.Id.ToString(), e.Nombre, e.Tipo)));
        lista.AddRange((await _context.Direcciones.Include(d => d.Empresa).Where(d => !d.Activo)
                .OrderBy(d => d.DireccionTexto).ToListAsync())
            .Select(d => new RegistroDadoDeBaja("direccion", d.Id.ToString(), d.DireccionTexto,
                $"{d.Municipio} · {d.Empresa?.Nombre}{(d.Empresa is { Activo: false } ? " (empresa dada de baja)" : "")}")));
        lista.AddRange((await _context.Productos.Where(p => !p.Activo).OrderBy(p => p.Codigo).ToListAsync())
            .Select(p => new RegistroDadoDeBaja("producto", p.Codigo, p.Codigo, null)));
        lista.AddRange((await _context.Choferes.Where(c => !c.Activo).OrderBy(c => c.Nombre).ToListAsync())
            .Select(c => new RegistroDadoDeBaja("operador", c.Id.ToString(), c.Nombre, c.NumeroTelefono)));
        lista.AddRange((await _context.Tractocamiones.Include(t => t.Marca).Where(t => !t.Activo).OrderBy(t => t.Placa).ToListAsync())
            .Select(t => new RegistroDadoDeBaja("tractocamion", t.Id.ToString(), t.Placa ?? "(sin placa)", t.Marca?.Nombre)));
        lista.AddRange((await _context.CajasTractocamion.Where(c => !c.Activo).OrderBy(c => c.CajaPlaca).ToListAsync())
            .Select(c => new RegistroDadoDeBaja("caja", c.Id.ToString(), c.CajaPlaca ?? "(sin placa)", c.CajaTamano)));
        return Ok(lista);
    }

    // PUT api/bajas/{tipo}/{id}/reactivar
    [HttpPut("{tipo}/{id}/reactivar")]
    public async Task<IActionResult> Reactivar(string tipo, string id)
    {
        string tabla;
        object? datos;
        uint.TryParse(id, out var n);
        switch (tipo)
        {
            case "usuario":
            {
                var u = await _context.Usuarios.FirstOrDefaultAsync(x => x.Id == n && !x.Activo);
                if (u == null) return NotFound(new { mensaje = "No se encontró ese usuario dado de baja" });
                u.Activo = true; tabla = "usuarios"; datos = new { u.Id, u.Nombre, u.Puesto, u.Activo };
                break;
            }
            case "cliente":
            {
                var c = await _context.Clientes.FirstOrDefaultAsync(x => x.Id == n && !x.Activo);
                if (c == null) return NotFound(new { mensaje = "No se encontró ese cliente dado de baja" });
                c.Activo = true; tabla = "clientes"; datos = new { c.Id, c.Nombre, c.Rfc, c.Activo };
                break;
            }
            case "empresa":
            {
                var e = await _context.Empresas.FirstOrDefaultAsync(x => x.Id == n && !x.Activo);
                if (e == null) return NotFound(new { mensaje = "No se encontró esa empresa dada de baja" });
                // Sus direcciones se dieron de baja con ella: regresan junto con la empresa.
                var direcciones = await _context.Direcciones.Where(d => d.IdEmpresa == e.Id && !d.Activo).ToListAsync();
                e.Activo = true;
                foreach (var d in direcciones) d.Activo = true;
                tabla = "empresas"; datos = new { e.Id, e.Nombre, e.Tipo, e.Activo, Direcciones = direcciones.Count };
                break;
            }
            case "direccion":
            {
                var d = await _context.Direcciones.Include(x => x.Empresa).FirstOrDefaultAsync(x => x.Id == n && !x.Activo);
                if (d == null) return NotFound(new { mensaje = "No se encontró esa dirección dada de baja" });
                if (d.Empresa is { Activo: false })
                    return BadRequest(new { mensaje = $"Primero reactiva la empresa {d.Empresa.Nombre}" });
                d.Activo = true; tabla = "direcciones"; datos = new { d.Id, Direccion = d.DireccionTexto, d.Activo };
                break;
            }
            case "producto":
            {
                var p = await _context.Productos.FirstOrDefaultAsync(x => x.Codigo == id && !x.Activo);
                if (p == null) return NotFound(new { mensaje = "No se encontró ese producto dado de baja" });
                p.Activo = true; tabla = "productos"; datos = new { p.Codigo, p.Activo };
                id = p.Codigo;
                break;
            }
            case "operador":
            {
                var c = await _context.Choferes.FirstOrDefaultAsync(x => x.Id == n && !x.Activo);
                if (c == null) return NotFound(new { mensaje = "No se encontró ese operador dado de baja" });
                c.Activo = true; tabla = "choferes"; datos = new { c.Id, c.Nombre, c.Activo };
                break;
            }
            case "tractocamion":
            {
                var t = await _context.Tractocamiones.FirstOrDefaultAsync(x => x.Id == n && !x.Activo);
                if (t == null) return NotFound(new { mensaje = "No se encontró ese tractocamión dado de baja" });
                if (!string.IsNullOrWhiteSpace(t.Placa)
                    && await _context.Tractocamiones.AnyAsync(x => x.Activo && x.Placa == t.Placa))
                    return BadRequest(new { mensaje = $"Ya hay un tractocamión activo con la placa {t.Placa}" });
                t.Activo = true; tabla = "tractocamiones"; datos = new { t.Id, t.Placa, t.Activo };
                break;
            }
            case "caja":
            {
                var c = await _context.CajasTractocamion.FirstOrDefaultAsync(x => x.Id == n && !x.Activo);
                if (c == null) return NotFound(new { mensaje = "No se encontró esa caja dada de baja" });
                if (!string.IsNullOrWhiteSpace(c.CajaPlaca)
                    && await _context.CajasTractocamion.AnyAsync(x => x.Activo && x.CajaPlaca == c.CajaPlaca))
                    return BadRequest(new { mensaje = $"Ya hay una caja activa con la placa {c.CajaPlaca}" });
                c.Activo = true; tabla = "cajas_tractocamion"; datos = new { c.Id, c.CajaPlaca, c.Activo };
                break;
            }
            default:
                return BadRequest(new { mensaje = "Tipo de registro desconocido" });
        }

        await _context.SaveChangesAsync();
        await _auditoria.RegistrarAsync(tabla, id, "MODIFICAR", new { Activo = false }, datos, this.IdUsuarioActual());
        return NoContent();
    }
}
