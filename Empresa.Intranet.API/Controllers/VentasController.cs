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
    private readonly IConfiguration _config;
    public VentasController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService,
        PedidosConsignacionService pedidos, IConfiguration config)
    {
        _pedidos = pedidos;
        _config = config;
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
    }

    // Convierte los DetalleMovimiento (que solo guardan IdExistencia) en algo legible para
    // la auditoría: código de producto, descripción y kilos — nada de ids sueltos.
    private Task<List<object>> ResolverDetalles(IEnumerable<DetalleMovimiento> detalles) =>
        Empresa.Intranet.API.Servicios.AuditoriaDetalles.LineasAsync(_context, detalles);

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
            Cliente = cliente?.Nombre ?? venta.NombreCliente,
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
        // Los días son de Ensenada; la base guarda UTC (ver ZonaHoraria).
        DateTime? desdeUtc = desde == null ? null : ZonaHoraria.InicioDelDiaUtc(desde.Value);
        DateTime? hastaUtc = hasta == null ? null : ZonaHoraria.InicioDelDiaUtc(hasta.Value.Date.AddDays(1));
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
                     && (desdeUtc == null || v.HistorialMovimiento!.FechaRegistro >= desdeUtc)
                     && (hastaUtc == null || v.HistorialMovimiento!.FechaRegistro < hastaUtc)
                     && (idUsuario == null || v.HistorialMovimiento!.IdUsuario == idUsuario))
            .Select(v => new VentaDto
            {
                Id = v.Id,
                Cliente = v.Cliente != null ? v.Cliente.Nombre : (v.NombreCliente ?? "Público en general"),
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

        // Cada renglón con su producto, descripción y lote (no solo el id de la existencia), para poder ver qué se vendió.
        var detallesOrdenados = v.HistorialMovimiento!.DetallesMovimiento.OrderBy(d => d.Id).ToList();
        var lineas = new List<object>();
        foreach (var d in detallesOrdenados)
        {
            var l = await AuditoriaDetalles.LineaAsync(_context, d);
            lineas.Add(new
            {
                d.Id,
                d.IdExistencia,
                // Bodega de la que salió el renglón: al corregir la venta, la pantalla devuelve estos kilos ahí.
                d.IdDireccion,
                d.IdDepartamento,
                Producto = l.GetValueOrDefault("Producto"),
                Descripcion = l.GetValueOrDefault("Descripcion"),
                Lote = l.GetValueOrDefault("Lote"),
                d.Kilos,
                d.Saldo,
                // El precio con el que se vendió (queda fijo aunque después cambie el del producto) y su importe.
                d.PrecioKilo,
                Importe = d.PrecioKilo != null ? Math.Round(d.Kilos * d.PrecioKilo.Value, 2) : (decimal?)null
            });
        }

        return Ok(new
        {
            v.Id,
            v.IdCliente,
            Cliente = v.Cliente?.Nombre ?? v.NombreCliente ?? "Público en general",
            FormaPago = v.FormaPago?.Nombre,
            LugarEntrega = v.LugarEntrega?.Nombre,
            EstadoRecoleccion = v.EstadoRecoleccion?.Descripcion,
            v.HistorialMovimiento!.FechaRegistro,
            Usuario = v.HistorialMovimiento.Usuario.Nombre,
            v.Total,
            v.Descuento,
            v.EfectivoRecibido,
            v.Estado,
            Detalles = lineas
        });
    }

    // Una venta nunca puede llevar kilos <= 0 (un renglón negativo SUMARÍA inventario), ni total
    // negativo, ni quedar sin renglones.
    private static string? ValidarDetallesVenta(CrearVentaDto dto)
    {
        if (dto.Detalles.Count == 0) return "Agrega al menos un producto";
        if (dto.Total < 0) return "El total de la venta no puede ser negativo";
        if (dto.Descuento is < 0 or > 100) return "El descuento debe estar entre 0 y 100 %";
        if (dto.Detalles.Any(d => d.PrecioKilo < 0)) return "El precio por kilo no puede ser negativo";
        if (dto.Detalles.Any(d => d.Kilos <= 0)) return "Los kilos de cada producto deben ser mayores a 0";
        if (dto.Detalles.Any(d => d.PrecioKilo == null)) return "Cada producto de la venta debe llevar su precio por kilo";

        // El total lo calcula la pantalla, pero el servidor lo comprueba con los renglones: la suma de kilos × precio
        // (el precio ya trae el descuento del renglón) menos el descuento general. Se tolera una diferencia mínima por
        // redondeo de centavos; si no cuadra, la venta se rechaza en lugar de guardar un total que no corresponde.
        {
            var subtotal = dto.Detalles.Sum(d => d.Kilos * d.PrecioKilo!.Value);
            var esperado = Math.Round(subtotal * (1 - (dto.Descuento ?? 0) / 100m), 2);
            // Tolerancia: $1, o medio centavo por kilo si es más (el precio por kilo viaja redondeado a centavos).
            var tolerancia = Math.Max(1m, dto.Detalles.Sum(d => d.Kilos) * 0.005m + 0.01m);
            if (Math.Abs(esperado - dto.Total) > tolerancia)
                return $"El total ({dto.Total:N2}) no coincide con los productos ({esperado:N2}). Revisa la venta y vuelve a intentarlo.";
        }
        return null;
    }

    // El precio lo manda la pantalla, así que aquí se compara con el del kardex: el precio final por kilo (con el descuento
    // del renglón y el general) no puede quedar abajo del precio del kardex menos el descuento máximo permitido
    // (Ventas:DescuentoMaximo en appsettings, 50 % si no se configura). El administrador no tiene tope.
    private async Task<string?> ValidarPreciosAsync(CrearVentaDto dto)
    {
        if (this.EsAdminActual()) return null;
        var tope = Math.Clamp(_config.GetValue<decimal?>("Ventas:DescuentoMaximo") ?? 50m, 0m, 100m);
        var ids = dto.Detalles.Select(d => d.IdExistencia).Distinct().ToList();
        var precios = await _context.Existencias.Where(e => ids.Contains(e.Id))
            .Select(e => new { e.Id, e.CodigoProducto, e.Producto.PrecioKilo })
            .ToDictionaryAsync(e => e.Id);
        var factorGeneral = 1 - (dto.Descuento ?? 0) / 100m;
        foreach (var d in dto.Detalles)
        {
            if (!precios.TryGetValue(d.IdExistencia, out var p) || p.PrecioKilo <= 0) continue;
            var minimo = Math.Round(p.PrecioKilo * (1 - tope / 100m), 2);
            var final = Math.Round(d.PrecioKilo!.Value * factorGeneral, 2);
            if (final + 0.01m < minimo)
                return $"El precio de {p.CodigoProducto} (${final:N2}/kg con descuentos) es menor al permitido (${minimo:N2}/kg, {tope:0.#} % de descuento máximo). Pide a un administrador que registre la venta.";
        }
        return null;
    }

    // Nombre con el que se guarda una venta de mostrador: el que se escribió o, si no se puso ninguno, "Público en general".
    private static string? NombreMostrador(CrearVentaDto dto) =>
        dto.IdCliente != null ? null : (string.IsNullOrWhiteSpace(dto.NombreCliente) ? "Público en general" : dto.NombreCliente.Trim());

    private async Task<string> DestinoVentaAsync(uint? idCliente, string? nombreMostrador = null)
    {
        var nombre = idCliente != null ? (await _context.Clientes.FindAsync(idCliente))?.Nombre : null;
        return nombre ?? nombreMostrador ?? "Venta mostrador";
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearVentaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "ventas", "crear"))
            return this.SinPermiso();
        var errorDetalles = ValidarDetallesVenta(dto) ?? await ValidarPreciosAsync(dto);
        if (errorDetalles != null) return BadRequest(new { mensaje = errorDetalles });
        var tipoMovimiento = await _context.TiposMovimiento
            .FirstOrDefaultAsync(t => t.Nombre.ToLower().Contains("venta"));
        if (tipoMovimiento == null)
            return BadRequest(new { mensaje = "No existe tipo de movimiento 'Venta'" });

        // Validar TODOS los renglones antes de escribir nada. El stock se descuenta solo en memoria
        // (la entidad rastreada), así dos renglones del mismo lote se validan contra lo que queda;
        // si uno falla se responde sin haber guardado nada.
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

            ubicacion.CantidadKilos -= detalle.Kilos;
        }

        // Todo válido: recién aquí se escribe, dentro de una transacción (venta, pedido de
        // consignación y auditoría quedan juntos o no queda nada).
        await using var tx = await _context.Database.BeginTransactionAsync();
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
            var nuevoDetalle = new DetalleMovimiento
            {
                IdHistorial = historial.Id,
                IdExistencia = detalle.IdExistencia,
                Kilos = detalle.Kilos,
                PrecioKilo = detalle.PrecioKilo,
                IdTipoMovimiento = tipoMovimiento.Id,
                IdDireccion = detalle.IdDireccion,
                IdDepartamento = detalle.IdDepartamento
            };
            _context.DetallesMovimiento.Add(nuevoDetalle);
            detallesCreados.Add(nuevoDetalle);
        }

        var venta = new Venta
        {
            IdHistorial = historial.Id,
            IdCliente = dto.IdCliente,
            NombreCliente = NombreMostrador(dto),
            IdFormaPago = dto.IdFormaPago,
            IdLugarEntrega = dto.IdLugarEntrega,
            IdEstadoRecoleccion = dto.IdEstadoRecoleccion,
            Total = dto.Total,
            Descuento = dto.Descuento is > 0 ? dto.Descuento : null,
            EfectivoRecibido = dto.EfectivoRecibido,
            Estado = string.IsNullOrWhiteSpace(dto.Estado) ? "Pendiente entrega" : dto.Estado
        };

        _context.Ventas.Add(venta);
        await _context.SaveChangesAsync();

        // Producto de una empresa en consignación → solicitud de compra para esa empresa.
        await _pedidos.SincronizarAsync("Venta", venta.Id, "Cliente", await DestinoVentaAsync(dto.IdCliente, venta.NombreCliente),
            detallesCreados.Select(d => new LineaPedido(null, d.IdExistencia, d.Kilos, d.IdDireccion)));

        var detallesTexto = await ResolverDetalles(detallesCreados);
        await _auditoria.RegistrarAsync("venta", venta.Id.ToString(), "CREAR", null,
            await SnapshotVenta(venta, detallesTexto), this.IdUsuarioActual());
        await tx.CommitAsync();

        return CreatedAtAction(nameof(GetPorId), new { id = venta.Id }, new { venta.Id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearVentaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "ventas", "editar"))
            return this.SinPermiso();
        var errorDetalles = ValidarDetallesVenta(dto) ?? await ValidarPreciosAsync(dto);
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

        // Todo el cambio va en una transacción: si algo falla (validación, pedido de consignación o
        // auditoría) la venta queda exactamente como estaba.
        await using var tx = await _context.Database.BeginTransactionAsync();

        // Revertir stock anterior — devolver kilos (solo en memoria hasta el guardado final, así
        // una validación fallida abajo no deja la venta sin renglones ni el stock ya devuelto).
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
                PrecioKilo = detalle.PrecioKilo,
                IdTipoMovimiento = tipoMovimiento.Id,
                IdDireccion = detalle.IdDireccion,
                IdDepartamento = detalle.IdDepartamento
            };
            _context.DetallesMovimiento.Add(nuevoDetalle);
            detallesNuevos.Add(nuevoDetalle);

            ubicacion.CantidadKilos -= detalle.Kilos;
        }

        venta.IdCliente = dto.IdCliente;
        venta.NombreCliente = NombreMostrador(dto);
        venta.IdFormaPago = dto.IdFormaPago;
        venta.IdLugarEntrega = dto.IdLugarEntrega;
        venta.IdEstadoRecoleccion = dto.IdEstadoRecoleccion;
        venta.Total = dto.Total;
        venta.Descuento = dto.Descuento is > 0 ? dto.Descuento : null;
        venta.EfectivoRecibido = dto.EfectivoRecibido;
        if (!string.IsNullOrWhiteSpace(dto.Estado)) venta.Estado = dto.Estado;
        // La venta sigue siendo del cajero que la cobró (así no se sale de su corte de caja); quién la
        // corrigió queda en la auditoría.

        await _context.SaveChangesAsync();
        await _pedidos.SincronizarAsync("Venta", venta.Id, "Cliente", await DestinoVentaAsync(dto.IdCliente, venta.NombreCliente),
            detallesNuevos.Select(d => new LineaPedido(null, d.IdExistencia, d.Kilos, d.IdDireccion)));

        var datosNuevos = await SnapshotVenta(venta, await ResolverDetalles(detallesNuevos));
        await _auditoria.RegistrarAsync("venta", id.ToString(), "MODIFICAR", datosAnteriores, datosNuevos, this.IdUsuarioActual());
        await tx.CommitAsync();

        return NoContent();
    }

    // PUT api/ventas/5/estado — cambia solo el estado (ej. marcar entregada), sin tocar
    // detalles ni inventario.
    [HttpPut("{id}/estado")]
    public async Task<IActionResult> CambiarEstado(uint id, [FromBody] CambiarEstadoVentaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "ventas", "editar"))
            return this.SinPermiso();

        var venta = await _context.Ventas.FirstOrDefaultAsync(v => v.Id == id && v.Activo);
        if (venta == null) return NotFound();

        var antes = new { venta.Estado };
        venta.Estado = dto.Estado;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("venta", id.ToString(), "MODIFICAR", antes, new { venta.Estado }, this.IdUsuarioActual());

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "ventas", "eliminar"))
            return this.SinPermiso();

        var venta = await _context.Ventas
            .Include(v => v.HistorialMovimiento)
                .ThenInclude(h => h!.DetallesMovimiento)
            .FirstOrDefaultAsync(v => v.Id == id && v.Activo);

        if (venta == null) return NotFound();

        var datosAnteriores = await SnapshotVenta(venta, await ResolverDetalles(venta.HistorialMovimiento!.DetallesMovimiento));

        await using var tx = await _context.Database.BeginTransactionAsync();

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

        await _auditoria.RegistrarAsync("venta", id.ToString(), "ELIMINAR", datosAnteriores, null, this.IdUsuarioActual());
        await tx.CommitAsync();

        return NoContent();
    }
}