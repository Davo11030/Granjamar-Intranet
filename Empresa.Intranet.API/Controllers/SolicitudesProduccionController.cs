using Empresa.Intranet.API.Extensiones;
using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.API.Servicios;
using Empresa.Intranet.Infrastructure.Persistence;
using Empresa.Intranet.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Controllers;

// Lo que producción le pide a una empresa en consignación. Las solicitudes se agrupan a gusto en uno
// o varios pedidos de consignación (ver PedidosConsignacionController).
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SolicitudesProduccionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PedidosConsignacionService _pedidos;

    public SolicitudesProduccionController(AppDbContext context, AuditoriaService auditoria, PedidosConsignacionService pedidos)
    {
        _context = context;
        _auditoria = auditoria;
        _pedidos = pedidos;
    }

    // GET api/solicitudesproduccion?idEmpresa=3 — las sin pedido primero, del más nuevo al más viejo.
    [RequierePermiso("inventario", "ver", "produccion/ver")]
    [HttpGet]
    public async Task<IActionResult> GetTodas([FromQuery] uint? idEmpresa)
    {
        var lista = await _context.SolicitudesProduccion
            .Where(s => s.Activo && (idEmpresa == null || s.IdEmpresa == idEmpresa))
            .OrderBy(s => s.IdPedido != null).ThenByDescending(s => s.Fecha).ThenByDescending(s => s.Id)
            .Select(s => new
            {
                s.Id,
                s.Fecha,
                Codigo = s.CodigoProducto,
                Descripcion = s.Producto.Especie.Nombre,
                s.Kilos,
                Cajas = s.Producto.PesoCaja != null && s.Producto.PesoCaja.Peso > 0
                    ? Math.Round(s.Kilos / s.Producto.PesoCaja.Peso, 2) : (decimal?)null,
                Usuario = s.Usuario.Nombre,
                s.IdPedido,
                NumeroPedido = s.Pedido != null ? s.Pedido.Numero : null
            })
            .ToListAsync();
        return Ok(lista);
    }

    // POST api/solicitudesproduccion/crear-pedido — agrupa solicitudes en pedidos. "grupos" es una lista
    // de grupos de ids: cada grupo se vuelve UN pedido (un solo grupo con todas = un pedido; un grupo
    // por solicitud = un pedido por cada una; o cualquier combinación).
    [RequierePermiso("inventario", "editar")]
    [HttpPost("crear-pedido")]
    public async Task<IActionResult> CrearPedido([FromBody] CrearPedidoDeSolicitudesDto dto)
    {
        var grupos = dto.Grupos.Where(g => g.Count > 0).ToList();
        if (grupos.Count == 0) return BadRequest(new { mensaje = "Selecciona al menos una solicitud" });
        var todos = grupos.SelectMany(g => g).ToList();
        if (todos.Distinct().Count() != todos.Count)
            return BadRequest(new { mensaje = "Una solicitud no puede estar en dos pedidos a la vez" });

        var solicitudes = await _context.SolicitudesProduccion
            .Where(s => s.Activo && todos.Contains(s.Id)).ToListAsync();
        if (solicitudes.Count != todos.Count)
            return BadRequest(new { mensaje = "Alguna solicitud ya no existe" });
        if (solicitudes.Any(s => s.IdPedido != null))
            return BadRequest(new { mensaje = "Alguna solicitud ya está en un pedido" });
        if (solicitudes.Any(s => s.IdEmpresa != dto.IdEmpresa))
            return BadRequest(new { mensaje = "Las solicitudes de un pedido deben ser de la misma empresa" });

        var creados = new List<object>();
        foreach (var grupo in grupos)
        {
            var delGrupo = solicitudes.Where(s => grupo.Contains(s.Id)).ToList();
            var pedido = await _pedidos.CrearPedidoDeSolicitudesAsync(dto.IdEmpresa, delGrupo);
            await _auditoria.RegistrarAsync("pedidos_consignacion", pedido.Id.ToString(), "CREAR", null,
                new { pedido.Numero, Solicitudes = delGrupo.Count, Kilos = delGrupo.Sum(s => s.Kilos) }, this.IdUsuarioActual());
            creados.Add(new { pedido.Id, pedido.Numero });
        }
        return Ok(new { pedidos = creados });
    }

    // DELETE api/solicitudesproduccion/5 — quita una solicitud que aún no está en un pedido.
    [RequierePermiso("inventario", "editar", "produccion/crear")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Quitar(uint id)
    {
        var s = await _context.SolicitudesProduccion.FirstOrDefaultAsync(x => x.Id == id && x.Activo);
        if (s == null) return NotFound();
        if (s.IdPedido != null) return BadRequest(new { mensaje = "Esta solicitud ya está en un pedido" });
        if (s.IdLinea != null)
            return BadRequest(new { mensaje = "Esta solicitud viene de la tabla de Producción: quita o ajusta esa entrada desde Producción" });
        s.Activo = false;
        await _context.SaveChangesAsync();
        await _auditoria.RegistrarAsync("solicitudes_produccion", id.ToString(), "ELIMINAR",
            new { s.CodigoProducto, s.Kilos }, null, this.IdUsuarioActual());
        return NoContent();
    }
}

public class CrearPedidoDeSolicitudesDto
{
    public uint IdEmpresa { get; set; }
    public List<List<uint>> Grupos { get; set; } = new();
}
