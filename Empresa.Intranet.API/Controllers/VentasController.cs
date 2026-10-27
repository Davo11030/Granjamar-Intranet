using Empresa.Intranet.API.Servicios;
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
public class VentasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;
    private readonly PedidosConsignacionService _pedidos;
    public VentasController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService,
        PedidosConsignacionService pedidos)
    {
        _pedidos = pedidos;
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
    }

    // Convierte los DetalleMovimiento (que solo guardan IdExistencia) en algo legible para
    // la auditoría: código de producto, descripción y kilos — nada de ids sueltos.
    private async Task<List<object>> ResolverDetalles(IEnumerable<DetalleMovimiento> detalles)
    {
        var resultado = new List<object>();
        foreach (var d in detalles)
        {
            var existencia = d.IdExistencia != null ? await _context.Existencias.FindAsync(d.IdExistencia) : null;
            var producto = existencia != null
                ? await _context.Productos.Include(p => p.Especie).FirstOrDefaultAsync(p => p.Codigo == existencia.CodigoProducto)
                : null;
            resultado.Add(new
            {
                Producto = existencia?.CodigoProducto,
                Descripcion = producto?.Especie?.Nombre ?? existencia?.CodigoProducto,
                d.Kilos
            });
        }
        return resultado;
    }

    // Snapshot legible de una venta para la auditoría: resuelve cliente/forma de pago/lugar de
    // entrega/estado de recolección a su nombre en vez de dejar el id suelto.
    private async Task<object> SnapshotVenta(Venta venta, List<object>? detalles)
    {
        var cliente = venta.IdCliente != null ? await _context.Clientes.FindAsync(venta.IdCliente) : null;
        var formaPago = venta.IdFormaPago != null ? await _context.FormasPago.FindAsync(venta.IdFormaPago) : null;
        var lugarEntrega = venta.IdLugarEntrega != null ? await _context.LugaresEntrega.FindAsync(venta.IdLugarEntrega) : null;
        var estadoRecoleccion = venta.IdEstadoRecoleccion != null
            ? await _context.EstadosRecoleccion.FindAsync(venta.IdEstadoRecoleccion) : null;

        return new
        {
            Cliente = cliente?.Nombre,
            FormaPago = formaPago?.Nombre,
            LugarEntrega = lugarEntrega?.Nombre,
            EstadoRecoleccion = estadoRecoleccion?.Descripcion,
            venta.Total,
            venta.EfectivoRecibido,
            venta.Estado,
            Detalles = detalles
        };
    }

    // GET api/ventas — [desde/hasta] filtran por fecha (para el corte de caja); [idUsuario]
    // filtra al cajero que la registró (también para el corte de caja, "su caja").
    [RequierePermiso("ventas","ver","ventas/corte")]
    [HttpGet]
    public async Task<IActionResult> GetTodos(
        [FromQuery] DateTime? desde, [FromQuery] DateTime? hasta, [FromQuery] uint? idUsuario)
    {
        var hastaFin = hasta?.Date.AddDays(1).AddTicks(-1);
        // Con solo el permiso de corte de caja (sin "ver ventas") únicamente se ve la propia caja.
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "ventas", "ver"))
            idUsuario = this.IdUsuarioActual();

        return Ok(await _context.Ventas
            .Include(v => v.Cliente)
            .Include(v => v.FormaPago)
            .Include(v => v.LugarEntrega)
            .Include(v => v.EstadoRecoleccion)
            .Include(v => v.HistorialMovimiento).ThenInclude(h => h!.Usuario)
            .Where(v => v.Activo
                     && (desde == null || v.HistorialMovimiento!.FechaRegistro >= desde)
                     && (hastaFin == null || v.HistorialMovimiento!.FechaRegistro <= hastaFin)
                     && (idUsuario == null || v.HistorialMovimiento!.IdUsuario == idUsuario))
            .Select(v => new VentaDto
            {
                Id = v.Id,
                Cliente = v.Cliente != null ? v.Cliente.Nombre : null,
                FormaPago = v.FormaPago != null ? v.FormaPago.Nombre : null,
                LugarEntrega = v.LugarEntrega != null ? v.LugarEntrega.Nombre : null,
                EstadoRecoleccion = v.EstadoRecoleccion != null ? v.EstadoRecoleccion.Descripcion : null,
                FechaRegistro = v.HistorialMovimiento!.FechaRegistro,
                Usuario = v.HistorialMovimiento.Usuario.Nombre,
                Total = v.Total,
                EfectivoRecibido = v.EfectivoRecibido,
                Estado = v.Estado
            })
            .ToListAsync());
    }

    [RequierePermiso("ventas","ver")]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var v = await _context.Ventas
            .Include(v => v.Cliente)
            .Include(v => v.FormaPago)
            .Include(v => v.LugarEntrega)
            .Include(v => v.EstadoRecoleccion)
            .Include(v => v.HistorialMovimiento).ThenInclude(h => h!.Usuario)
            .Include(v => v.HistorialMovimiento!.DetallesMovimiento)
            .FirstOrDefaultAsync(v => v.Id == id && v.Activo);

        if (v == null) return NotFound();

        return Ok(new
        {
            v.Id,
            Cliente = v.Cliente?.Nombre,
            FormaPago = v.FormaPago?.Nombre,
            LugarEntrega = v.LugarEntrega?.Nombre,
            EstadoRecoleccion = v.EstadoRecoleccion?.Descripcion,
            v.HistorialMovimiento!.FechaRegistro,
            Usuario = v.HistorialMovimiento.Usuario.Nombre,
            v.Total,
            v.EfectivoRecibido,
            v.Estado,
            Detalles = v.HistorialMovimiento.DetallesMovimiento.Select(d => new
            {
                d.Id,
                d.IdExistencia,
                d.Kilos,
                d.Saldo
            })
        });
    }

    // Una venta nunca puede llevar kilos <= 0 (un renglón negativo SUMARÍA inventario), ni total
    // negativo, ni quedar sin renglones.
    private static string? ValidarDetallesVenta(CrearVentaDto dto)
    {
        if (dto.Detalles.Count == 0) return "Agrega al menos un producto";
        if (dto.Total < 0) return "El total de la venta no puede ser negativo";
        if (dto.Detalles.Any(d => d.Kilos <= 0)) return "Los kilos de cada producto deben ser mayores a 0";
        return null;
    }

    private async Task<string> DestinoVentaAsync(uint? idCliente)
    {
        var nombre = idCliente != null ? (await _context.Clientes.FindAsync(idCliente))?.Nombre : null;
        return nombre ?? "Venta mostrador";
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearVentaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "ventas", "crear"))
            return this.SinPermiso();
        var errorDetalles = ValidarDetallesVenta(dto);
        if (errorDetalles != null) return BadRequest(new { mensaje = errorDetalles });
        var tipoMovimiento = await _context.TiposMovimiento
            .FirstOrDefaultAsync(t => t.Nombre.ToLower().Contains("venta"));
        if (tipoMovimiento == null)
            return BadRequest(new { mensaje = "No existe tipo de movimiento 'Venta'" });

        var historial = new HistorialMovimiento
        {
            FechaRegistro = DateTime.UtcNow,
            IdUsuario = this.IdUsuarioActual()
        };
        _context.HistorialesMovimiento.Add(historial);
        await _context.SaveChangesAsync();

        var detallesCreados = new List<DetalleMovimiento>();
        foreach (var detalle in dto.Detalles)
        {
            var existencia = await _context.Existencias.FindAsync(detalle.IdExistencia);
            if (existencia == null)
                return BadRequest(new { mensaje = $"No existe la existencia {detalle.IdExistencia}" });

            var ubicacion = await _context.UbicacionesProducto
                .FirstOrDefaultAsync(u => u.IdExistencia == detalle.IdExistencia
                                       && u.IdDireccion == detalle.IdDireccion
                                       && u.IdDepartamento == detalle.IdDepartamento);

            if (ubicacion == null)
                return BadRequest(new { mensaje = "No hay stock en esa ubicación" });

            if (ubicacion.CantidadKilos < detalle.Kilos)
                return BadRequest(new { mensaje = $"Stock insuficiente. Disponible: {ubicacion.CantidadKilos} kg" });

            var nuevoDetalle = new DetalleMovimiento
            {
                IdHistorial = historial.Id,
                IdExistencia = detalle.IdExistencia,
                Kilos = detalle.Kilos,
                IdTipoMovimiento = tipoMovimiento.Id,
                IdDireccion = detalle.IdDireccion,
                IdDepartamento = detalle.IdDepartamento
            };
            _context.DetallesMovimiento.Add(nuevoDetalle);
            detallesCreados.Add(nuevoDetalle);

            ubicacion.CantidadKilos -= detalle.Kilos;
        }

        var venta = new Venta
        {
            IdHistorial = historial.Id,
            IdCliente = dto.IdCliente,
            IdFormaPago = dto.IdFormaPago,
            IdLugarEntrega = dto.IdLugarEntrega,
            IdEstadoRecoleccion = dto.IdEstadoRecoleccion,
            Total = dto.Total,
            EfectivoRecibido = dto.EfectivoRecibido,
            Estado = string.IsNullOrWhiteSpace(dto.Estado) ? "Pendiente entrega" : dto.Estado
        };

        _context.Ventas.Add(venta);
        await _context.SaveChangesAsync();

        // Producto de una empresa en consignación → solicitud de compra para esa empresa.
        await _pedidos.SincronizarAsync("Venta", venta.Id, "Cliente", await DestinoVentaAsync(dto.IdCliente),
            detallesCreados.Select(d => new LineaPedido(null, d.IdExistencia, d.Kilos, d.IdDireccion)));

        var detallesTexto = await ResolverDetalles(detallesCreados);
        await _auditoria.RegistrarAsync("venta", venta.Id.ToString(), "CREAR", null,
            await SnapshotVenta(venta, detallesTexto), dto.IdUsuario);

        return CreatedAtAction(nameof(GetPorId), new { id = venta.Id }, new { venta.Id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearVentaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "ventas", "editar"))
            return this.SinPermiso();
        var errorDetalles = ValidarDetallesVenta(dto);
        if (errorDetalles != null) return BadRequest(new { mensaje = errorDetalles });
        var venta = await _context.Ventas
            .Include(v => v.HistorialMovimiento)
                .ThenInclude(h => h!.DetallesMovimiento)
            .FirstOrDefaultAsync(v => v.Id == id && v.Activo);

        if (venta == null) return NotFound();

        var tipoMovimiento = await _context.TiposMovimiento
            .FirstOrDefaultAsync(t => t.Nombre.ToLower().Contains("venta"));
        if (tipoMovimiento == null)
            return BadRequest(new { mensaje = "No existe tipo de movimiento 'Venta'" });

        // Guardar datos anteriores para auditoría (antes de tocar los campos de venta)
        var datosAnteriores = await SnapshotVenta(venta, await ResolverDetalles(venta.HistorialMovimiento!.DetallesMovimiento));

        // Revertir stock anterior — devolver kilos
        foreach (var detalleAnterior in venta.HistorialMovimiento.DetallesMovimiento)
        {
            var ubicacion = await _context.UbicacionesProducto
                .FirstOrDefaultAsync(u => u.IdExistencia == detalleAnterior.IdExistencia
                                       && u.IdDireccion == detalleAnterior.IdDireccion
                                       && u.IdDepartamento == detalleAnterior.IdDepartamento);
            if (ubicacion != null)
                ubicacion.CantidadKilos += detalleAnterior.Kilos;
        }

        _context.DetallesMovimiento.RemoveRange(venta.HistorialMovimiento.DetallesMovimiento);
        await _context.SaveChangesAsync();

        // Validar y aplicar nuevos detalles
        var detallesNuevos = new List<DetalleMovimiento>();
        foreach (var detalle in dto.Detalles)
        {
            var existencia = await _context.Existencias.FindAsync(detalle.IdExistencia);
            if (existencia == null)
                return BadRequest(new { mensaje = $"No existe la existencia {detalle.IdExistencia}" });

            var ubicacion = await _context.UbicacionesProducto
                .FirstOrDefaultAsync(u => u.IdExistencia == detalle.IdExistencia
                                       && u.IdDireccion == detalle.IdDireccion
                                       && u.IdDepartamento == detalle.IdDepartamento);

            if (ubicacion == null)
                return BadRequest(new { mensaje = "No hay stock en esa ubicación" });

            if (ubicacion.CantidadKilos < detalle.Kilos)
                return BadRequest(new { mensaje = $"Stock insuficiente. Disponible: {ubicacion.CantidadKilos} kg" });

            var nuevoDetalle = new DetalleMovimiento
            {
                IdHistorial = venta.HistorialMovimiento.Id,
                IdExistencia = detalle.IdExistencia,
                Kilos = detalle.Kilos,
                IdTipoMovimiento = tipoMovimiento.Id,
                IdDireccion = detalle.IdDireccion,
                IdDepartamento = detalle.IdDepartamento
            };
            _context.DetallesMovimiento.Add(nuevoDetalle);
            detallesNuevos.Add(nuevoDetalle);

            ubicacion.CantidadKilos -= detalle.Kilos;
        }

        venta.IdCliente = dto.IdCliente;
        venta.IdFormaPago = dto.IdFormaPago;
        venta.IdLugarEntrega = dto.IdLugarEntrega;
        venta.IdEstadoRecoleccion = dto.IdEstadoRecoleccion;
        venta.Total = dto.Total;
        venta.EfectivoRecibido = dto.EfectivoRecibido;
        if (!string.IsNullOrWhiteSpace(dto.Estado)) venta.Estado = dto.Estado;
        venta.HistorialMovimiento.IdUsuario = this.IdUsuarioActual();

        await _context.SaveChangesAsync();
        await _pedidos.SincronizarAsync("Venta", venta.Id, "Cliente", await DestinoVentaAsync(dto.IdCliente),
            detallesNuevos.Select(d => new LineaPedido(null, d.IdExistencia, d.Kilos, d.IdDireccion)));

        var datosNuevos = await SnapshotVenta(venta, await ResolverDetalles(detallesNuevos));
        await _auditoria.RegistrarAsync("venta", id.ToString(), "MODIFICAR", datosAnteriores, datosNuevos, dto.IdUsuario);

        return NoContent();
    }

    // PUT api/ventas/5/estado — cambia solo el estado (ej. marcar entregada), sin tocar
    // detalles ni inventario.
    [HttpPut("{id}/estado")]
    public async Task<IActionResult> CambiarEstado(uint id, [FromBody] CambiarEstadoVentaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "ventas", "editar"))
            return this.SinPermiso();

        var venta = await _context.Ventas.FirstOrDefaultAsync(v => v.Id == id && v.Activo);
        if (venta == null) return NotFound();

        var antes = new { venta.Estado };
        venta.Estado = dto.Estado;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("venta", id.ToString(), "MODIFICAR", antes, new { venta.Estado }, dto.IdUsuario);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id, [FromQuery] uint idUsuario)
    {
        if (!await _permisoService.TienePermisoAsync(idUsuario, "ventas", "eliminar"))
            return this.SinPermiso();

        var venta = await _context.Ventas
            .Include(v => v.HistorialMovimiento)
                .ThenInclude(h => h!.DetallesMovimiento)
            .FirstOrDefaultAsync(v => v.Id == id && v.Activo);

        if (venta == null) return NotFound();

        var datosAnteriores = await SnapshotVenta(venta, await ResolverDetalles(venta.HistorialMovimiento!.DetallesMovimiento));

        // Revertir stock — devolver kilos
        foreach (var detalle in venta.HistorialMovimiento!.DetallesMovimiento)
        {
            var ubicacion = await _context.UbicacionesProducto
                .FirstOrDefaultAsync(u => u.IdExistencia == detalle.IdExistencia
                                       && u.IdDireccion == detalle.IdDireccion
                                       && u.IdDepartamento == detalle.IdDepartamento);
            if (ubicacion != null)
                ubicacion.CantidadKilos += detalle.Kilos;
        }

        venta.Activo = false;
        await _context.SaveChangesAsync();
        await _pedidos.AnularPendientesAsync("Venta", venta.Id);

        await _auditoria.RegistrarAsync("venta", id.ToString(), "ELIMINAR", datosAnteriores, null, idUsuario);

        return NoContent();
    }
}