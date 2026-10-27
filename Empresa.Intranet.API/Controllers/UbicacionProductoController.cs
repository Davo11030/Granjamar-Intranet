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
public class UbicacionProductoController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;
    public UbicacionProductoController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService)
    {
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
    }

    // Mover/editar stock directamente exige el permiso de editar inventario, y nunca kilos negativos.
    private async Task<IActionResult?> ValidarEdicion(decimal cantidadKilos)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "inventario", "editar"))
            return this.SinPermiso();
        if (cantidadKilos < 0)
            return BadRequest(new { mensaje = "Los kilos no pueden ser negativos" });
        return null;
    }

    // Snapshot legible de una ubicación para la auditoría: producto, lote, dirección y
    // departamento por su nombre en vez de ids sueltos.
    private async Task<object> SnapshotUbicacion(UbicacionProducto u)
    {
        var existencia = await _context.Existencias.FindAsync(u.IdExistencia);
        var producto = existencia != null
            ? await _context.Productos.Include(p => p.Especie).FirstOrDefaultAsync(p => p.Codigo == existencia.CodigoProducto)
            : null;
        var direccion = await _context.Direcciones.FindAsync(u.IdDireccion);
        var departamento = u.IdDepartamento != null ? await _context.Departamentos.FindAsync(u.IdDepartamento) : null;

        return new
        {
            Producto = existencia?.CodigoProducto,
            Descripcion = producto?.Especie?.Nombre ?? existencia?.CodigoProducto,
            Lote = existencia?.Lote,
            Direccion = direccion?.DireccionTexto,
            Departamento = departamento?.Nombre,
            u.CantidadKilos
        };
    }
    [RequierePermiso("inventario","ver","existencias/ver","ventas/crear","ventas/editar","embarques/crear","embarques/editar","produccion/crear")]
    [HttpGet]
public async Task<IActionResult> GetTodos(
    [FromQuery] uint? idDireccion,
    [FromQuery] uint? idEmpresa)
{
    var query = _context.UbicacionesProducto
        .Include(u => u.Existencia)
            .ThenInclude(e => e.Producto)
        .Include(u => u.Existencia)
            .ThenInclude(e => e.DocumentoOrigen)
                .ThenInclude(doc => doc!.DocumentoTipo)
        .Include(u => u.Direccion)
            .ThenInclude(d => d.Empresa)
        .Where(u => u.Existencia.Activo)
        .AsQueryable();

    if (idDireccion.HasValue)
        query = query.Where(u => u.IdDireccion == idDireccion.Value);

    if (idEmpresa.HasValue)
        query = query.Where(u => u.Direccion.IdEmpresa == idEmpresa.Value);

    return Ok(await query.Select(u => new
    {
        u.Id,
        u.IdExistencia,
        Lote = u.Existencia.Lote,
        CodigoProducto = u.Existencia.CodigoProducto,
        u.IdDireccion,
        Direccion = u.Direccion.DireccionTexto,
        Empresa = u.Direccion.Empresa != null
            ? u.Direccion.Empresa.Nombre
            : null,
        IdEmpresa = u.Direccion.IdEmpresa,
        u.CantidadKilos,
        u.IdDepartamento,
        // Pedimento/factura del lote — mismo mecanismo que ya usan RT y el detalle de Entradas,
        // viene de Existencia.DocumentoOrigen, no se captura a mano aquí.
        TipoDocumento = u.Existencia.DocumentoOrigen != null ? u.Existencia.DocumentoOrigen.DocumentoTipo.Nombre : null,
        NumeroDocumento = u.Existencia.DocumentoOrigen != null ? u.Existencia.DocumentoOrigen.Numero : null
    }).ToListAsync());
}

    [RequierePermiso("inventario","ver","existencias/ver","ventas/crear","ventas/editar","embarques/crear","embarques/editar","produccion/crear")]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var u = await _context.UbicacionesProducto
            .Include(u => u.Existencia).ThenInclude(e => e.Producto)
            .Include(u => u.Direccion)
            .FirstOrDefaultAsync(u => u.Id == id);
        if (u == null) return NotFound();
        return Ok(new UbicacionProductoDto
        {
            Id = u.Id,
            IdExistencia = u.IdExistencia,
            Lote = u.Existencia.Lote,
            CodigoProducto = u.Existencia.CodigoProducto,
            IdDireccion = u.IdDireccion,
            Direccion = u.Direccion.DireccionTexto,
            CantidadKilos = u.CantidadKilos,
            IdDepartamento = u.IdDepartamento
        });
    }

    // Stock por producto
    [RequierePermiso("inventario","ver","existencias/ver","ventas/crear","ventas/editar","embarques/crear","embarques/editar","produccion/crear")]
    [HttpGet("stock/{codigoProducto}")]
    public async Task<IActionResult> GetStockPorProducto(string codigoProducto)
    {
        var stock = await _context.UbicacionesProducto
            .Include(u => u.Existencia)
            .Include(u => u.Direccion)
            .Where(u => u.Existencia.CodigoProducto == codigoProducto)
            .GroupBy(u => u.Existencia.CodigoProducto)
            .Select(g => new
            {
                CodigoProducto = g.Key,
                TotalKilos = g.Sum(u => u.CantidadKilos),
                Ubicaciones = g.Select(u => new
                {
                    u.Id,
                    u.Existencia.Lote,
                    u.CantidadKilos,
                    Direccion = u.Direccion.DireccionTexto
                }).ToList()
            })
            .FirstOrDefaultAsync();

        if (stock == null) return NotFound(new { mensaje = "No hay stock para ese producto" });
        return Ok(stock);
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearUbicacionProductoDto dto)
    {
        var rechazo = await ValidarEdicion(dto.CantidadKilos);
        if (rechazo != null) return rechazo;

        var existencia = await _context.Existencias.FindAsync(dto.IdExistencia);
        if (existencia == null) return BadRequest(new { mensaje = "No existe esa existencia" });

        var direccion = await _context.Direcciones.FindAsync(dto.IdDireccion);
        if (direccion == null) return BadRequest(new { mensaje = "No existe esa dirección" });

        var ubicacion = new UbicacionProducto
        {
            IdExistencia = dto.IdExistencia,
            IdDireccion = dto.IdDireccion,
            CantidadKilos = dto.CantidadKilos,
            IdDepartamento = dto.IdDepartamento
        };

        _context.UbicacionesProducto.Add(ubicacion);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("ubicacion_producto", ubicacion.Id.ToString(), "CREAR", null,
            await SnapshotUbicacion(ubicacion), this.IdUsuarioActual());

        return CreatedAtAction(nameof(GetPorId), new { id = ubicacion.Id },
            new { ubicacion.Id, ubicacion.IdExistencia, ubicacion.CantidadKilos });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearUbicacionProductoDto dto)
    {
        var rechazo = await ValidarEdicion(dto.CantidadKilos);
        if (rechazo != null) return rechazo;

        var ubicacion = await _context.UbicacionesProducto.FindAsync(id);
        if (ubicacion == null) return NotFound();

        var antes = await SnapshotUbicacion(ubicacion);

        ubicacion.IdExistencia = dto.IdExistencia;
        ubicacion.IdDireccion = dto.IdDireccion;
        ubicacion.CantidadKilos = dto.CantidadKilos;
        ubicacion.IdDepartamento = dto.IdDepartamento;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("ubicacion_producto", id.ToString(), "MODIFICAR", antes,
            await SnapshotUbicacion(ubicacion), this.IdUsuarioActual());

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id)
    {
        var rechazo = await ValidarEdicion(0);
        if (rechazo != null) return rechazo;

        var ubicacion = await _context.UbicacionesProducto.FindAsync(id);
        if (ubicacion == null) return NotFound();

        var antes = await SnapshotUbicacion(ubicacion);
        _context.UbicacionesProducto.Remove(ubicacion);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("ubicacion_producto", id.ToString(), "ELIMINAR", antes, null,
            this.IdUsuarioActual());

        return NoContent();
    }
    // Traspaso de Conpaq (inventario propio) a una empresa de resguardo. Todo en una transacción:
    // baja el origen, sube el destino y deja UN registro interno (HistorialMovimiento) con su salida
    // de Conpaq y su entrada al resguardo — el número de ese registro es la "salida" del historial.
    [HttpPost("traspaso-resguardo")]
    public async Task<IActionResult> TraspasoResguardo([FromBody] TraspasoResguardoDto dto)
    {
        var rechazo = await ValidarEdicion(dto.Kilos);
        if (rechazo != null) return rechazo;
        if (dto.Kilos <= 0) return BadRequest(new { mensaje = "Indica los kilos a trasladar" });

        var origen = await _context.UbicacionesProducto
            .Include(u => u.Direccion).ThenInclude(d => d.Empresa)
            .FirstOrDefaultAsync(u => u.Id == dto.IdOrigen);
        if (origen == null) return BadRequest(new { mensaje = "No existe esa ubicación de origen" });
        var empresaOrigen = origen.Direccion.Empresa;
        if (empresaOrigen == null
            || !(string.Equals(empresaOrigen.Tipo, "interna", StringComparison.OrdinalIgnoreCase)
                 || empresaOrigen.Nombre.Contains("granjamar", StringComparison.OrdinalIgnoreCase)))
            return BadRequest(new { mensaje = "El origen debe ser inventario de Conpaq" });
        if (dto.Kilos > origen.CantidadKilos)
            return BadRequest(new { mensaje = $"Solo hay {origen.CantidadKilos:0.##} kg disponibles en Conpaq" });

        var destino = await _context.Direcciones.Include(d => d.Empresa)
            .FirstOrDefaultAsync(d => d.Id == dto.IdDireccionDestino && d.Activo);
        if (destino == null) return BadRequest(new { mensaje = "No existe esa bodega de destino" });
        if (destino.Empresa == null
            || !string.Equals(destino.Empresa.Tipo, "resguardo", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { mensaje = "La bodega destino debe ser de una empresa de resguardo" });

        await using var tx = await _context.Database.BeginTransactionAsync();

        var tipoSalida = await TipoMovimientoAsync("Salida a resguardo");
        var tipoEntrada = await TipoMovimientoAsync("Traspaso a resguardo");

        var historial = new HistorialMovimiento { FechaRegistro = DateTime.UtcNow, IdUsuario = this.IdUsuarioActual() };
        _context.HistorialesMovimiento.Add(historial);
        await _context.SaveChangesAsync();

        origen.CantidadKilos -= dto.Kilos;

        var destinoUb = await _context.UbicacionesProducto
            .FirstOrDefaultAsync(u => u.IdExistencia == origen.IdExistencia && u.IdDireccion == destino.Id);
        if (destinoUb != null) destinoUb.CantidadKilos += dto.Kilos;
        else
        {
            destinoUb = new UbicacionProducto
            {
                IdExistencia = origen.IdExistencia,
                IdDireccion = destino.Id,
                CantidadKilos = dto.Kilos
            };
            _context.UbicacionesProducto.Add(destinoUb);
        }

        _context.DetallesMovimiento.Add(new DetalleMovimiento
        {
            IdExistencia = origen.IdExistencia, IdHistorial = historial.Id, Kilos = dto.Kilos,
            IdTipoMovimiento = tipoSalida.Id, IdDireccion = origen.IdDireccion
        });
        _context.DetallesMovimiento.Add(new DetalleMovimiento
        {
            IdExistencia = origen.IdExistencia, IdHistorial = historial.Id, Kilos = dto.Kilos,
            IdTipoMovimiento = tipoEntrada.Id, IdDireccion = destino.Id
        });
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("ubicacion_producto", origen.Id.ToString(), "MODIFICAR", null,
            new { Traspaso = "Conpaq → resguardo", dto.Kilos, Registro = historial.Id, Destino = destino.DireccionTexto },
            this.IdUsuarioActual());

        await tx.CommitAsync();
        return Ok(new { registro = historial.Id });
    }

    private async Task<TipoMovimiento> TipoMovimientoAsync(string nombre)
    {
        var tipo = await _context.TiposMovimiento.FirstOrDefaultAsync(t => t.Nombre == nombre);
        if (tipo != null) return tipo;
        tipo = new TipoMovimiento { Nombre = nombre };
        _context.TiposMovimiento.Add(tipo);
        await _context.SaveChangesAsync();
        return tipo;
    }

    // Historial de UN producto dentro de una empresa de resguardo: todos sus lotes juntos, con el
    // inventario final corriendo. Lo que ya estaba en el resguardo antes de que se registraran
    // movimientos (stock sin historial) aparece como primer renglón "Saldo previo".
    [RequierePermiso("inventario","ver","existencias/ver","ventas/crear","ventas/editar","embarques/crear","embarques/editar","produccion/crear")]
    [HttpGet("resguardo/{idEmpresa}/historial/{codigoProducto}")]
    [HttpGet("empresa/{idEmpresa}/historial/{codigoProducto}")]
    public async Task<IActionResult> GetHistorialResguardo(uint idEmpresa, string codigoProducto)
    {
        var producto = await _context.Productos
            .Include(p => p.Especie).Include(p => p.Talla).Include(p => p.Marca).Include(p => p.PesoCaja)
            .FirstOrDefaultAsync(p => p.Codigo == codigoProducto);
        var empresa = await _context.Empresas.FindAsync(idEmpresa);
        if (producto == null || empresa == null) return NotFound();
        var pesoCaja = producto.PesoCaja?.Peso ?? 0;

        var movs = await _context.DetallesMovimiento
            .Include(d => d.HistorialMovimiento)
            .Include(d => d.TipoMovimiento)
            .Include(d => d.Direccion)
            .Include(d => d.Existencia).ThenInclude(e => e!.DocumentoOrigen).ThenInclude(doc => doc!.DocumentoTipo)
            .Include(d => d.DetalleTransporte!).ThenInclude(dt => dt.Chofer)
            .Include(d => d.DetalleTransporte!).ThenInclude(dt => dt.Tractocamion).ThenInclude(t => t!.Empresa)
            .Where(d => d.IdExistencia != null && d.Existencia!.CodigoProducto == codigoProducto
                && d.Direccion != null && d.Direccion.IdEmpresa == idEmpresa)
            .ToListAsync();

        var stock = await _context.UbicacionesProducto
            .Include(u => u.Existencia).ThenInclude(e => e.DocumentoOrigen).ThenInclude(doc => doc!.DocumentoTipo)
            .Include(u => u.Direccion)
            .Where(u => u.Existencia.CodigoProducto == codigoProducto && u.Direccion.IdEmpresa == idEmpresa)
            .ToListAsync();

        // Los embarques descuentan stock a través de su SOLICITUD (lote por lote), que no deja un
        // movimiento con existencia. Se incluyen como salidas — salvo los embarques viejos que sí dejaron
        // sus movimientos con existencia, para no contarlos dos veces.
        var solicitudes = await _context.SolicitudesDetalle
            .Include(s => s.Existencia).ThenInclude(e => e.DocumentoOrigen).ThenInclude(doc => doc!.DocumentoTipo)
            .Include(s => s.Embarque).ThenInclude(e => e.HistorialMovimiento)
            .Include(s => s.Embarque).ThenInclude(e => e.DetalleTransporte).ThenInclude(dt => dt!.Chofer)
            .Include(s => s.Embarque).ThenInclude(e => e.DetalleTransporte).ThenInclude(dt => dt!.Tractocamion).ThenInclude(t => t!.Empresa)
            .Where(s => s.Embarque.Activo
                && s.Existencia.CodigoProducto == codigoProducto
                && _context.Direcciones.Any(d => d.Id == s.IdDireccion && d.IdEmpresa == idEmpresa)
                && !_context.DetallesMovimiento.Any(d => d.IdHistorial == s.Embarque.IdHistorial && d.IdExistencia != null))
            .ToListAsync();
        var idsDireccionSol = solicitudes.Select(s => s.IdDireccion).Distinct().ToList();
        var textoDireccion = await _context.Direcciones
            .Where(d => idsDireccionSol.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, d => d.DireccionTexto);

        var idsExistencia = movs.Select(m => m.IdExistencia!.Value)
            .Union(stock.Select(s => s.IdExistencia))
            .Union(solicitudes.Select(s => s.IdExistencia)).ToList();

        // Contenedor: el de la compra con la que entró cada lote.
        var comprasDetalle = await _context.DetallesMovimiento
            .Where(d => d.IdExistencia != null && idsExistencia.Contains(d.IdExistencia.Value)
                && d.TipoMovimiento.Nombre.ToLower().Contains("compra"))
            .Select(d => new { Existencia = d.IdExistencia!.Value, d.IdHistorial })
            .ToListAsync();
        var historialIds = comprasDetalle.Select(c => c.IdHistorial).Distinct().ToList();
        var contenedorPorHistorial = await _context.Compras
            .Where(c => c.IdHistorialMovimiento != null && historialIds.Contains(c.IdHistorialMovimiento.Value))
            .ToDictionaryAsync(c => c.IdHistorialMovimiento!.Value, c => c.NumeroContenedor);
        var contenedorPorExistencia = comprasDetalle
            .GroupBy(c => c.Existencia)
            .ToDictionary(g => g.Key, g => g
                .Select(c => contenedorPorHistorial.GetValueOrDefault(c.IdHistorial))
                .FirstOrDefault(n => !string.IsNullOrWhiteSpace(n)));

        static bool EsEntrada(string nombre)
        {
            var n = nombre.ToLower();
            return n.Contains("compra") || n.Contains("traspaso");
        }

        // Folio de la empresa (solo las entradas por compra lo tienen) y número de embarque (solo las
        // salidas por embarque), según el registro interno de cada movimiento.
        var historialesMov = movs.Select(m => m.IdHistorial).Distinct().ToList();
        var folioPorHistorial = await _context.Compras
            .Where(c => c.IdHistorialMovimiento != null && historialesMov.Contains(c.IdHistorialMovimiento.Value) && c.FolioEmpresa != null)
            .ToDictionaryAsync(c => c.IdHistorialMovimiento!.Value, c => c.FolioEmpresa!);
        // El transportista de un embarque vive en el propio embarque (los movimientos viejos no lo traen).
        var embarquePorHistorial = (await _context.Embarques
                .Where(e => historialesMov.Contains(e.IdHistorial))
                .Select(e => new
                {
                    e.IdHistorial, e.Id, e.Numero,
                    Chofer = e.DetalleTransporte != null && e.DetalleTransporte.Chofer != null ? e.DetalleTransporte.Chofer.Nombre : null,
                    EmpresaTransporte = e.DetalleTransporte != null && e.DetalleTransporte.Tractocamion != null && e.DetalleTransporte.Tractocamion.Empresa != null
                        ? e.DetalleTransporte.Tractocamion.Empresa.Nombre : null
                }).ToListAsync())
            .GroupBy(e => e.IdHistorial)
            .ToDictionary(g => g.Key, g => (Numero: g.First().Numero ?? g.First().Id.ToString(), g.First().Chofer, g.First().EmpresaTransporte));

        var filas = new List<FilaResguardo>();
        string? Doc(Existencia e) => e.DocumentoOrigen?.DocumentoTipo?.Nombre;
        decimal? Cajas(decimal kilos) => pesoCaja > 0 ? Math.Round(kilos / pesoCaja, 2) : null;

        // Saldo previo: lo que hay hoy menos lo que explican los movimientos registrados.
        foreach (var idEx in idsExistencia)
        {
            var neto = movs.Where(m => m.IdExistencia == idEx)
                .Sum(m => EsEntrada(m.TipoMovimiento.Nombre) ? m.Kilos : -m.Kilos)
                - solicitudes.Where(x => x.IdExistencia == idEx).Sum(x => x.Kilos);
            var actual = stock.Where(s => s.IdExistencia == idEx).Sum(s => s.CantidadKilos);
            var dif = actual - neto;
            if (Math.Abs(dif) < 0.0005m) continue;
            var ex = stock.FirstOrDefault(s => s.IdExistencia == idEx)?.Existencia
                ?? movs.FirstOrDefault(m => m.IdExistencia == idEx)?.Existencia
                ?? solicitudes.First(x => x.IdExistencia == idEx).Existencia;
            filas.Add(new FilaResguardo(
                $"previo-{idEx}", null, null, null, ex.Lote, contenedorPorExistencia.GetValueOrDefault(idEx),
                Doc(ex), ex.DocumentoOrigen?.Numero, null,
                dif > 0 ? "Saldo previo (sin registro)" : "Ajuste (sin registro)",
                dif > 0, Math.Abs(dif), Cajas(Math.Abs(dif)), null, idEx));
        }

        foreach (var m in movs)
        {
            var entrada = EsEntrada(m.TipoMovimiento.Nombre);
            var ex = m.Existencia!;
            var esTraspaso = m.TipoMovimiento.Nombre.ToLower().Contains("resguardo");
            filas.Add(new FilaResguardo(
                m.Id.ToString(), m.HistorialMovimiento.FechaRegistro,
                m.DetalleTransporte?.Tractocamion?.Empresa?.Nombre
                    ?? (embarquePorHistorial.TryGetValue(m.IdHistorial, out var emb1) ? emb1.EmpresaTransporte : null),
                m.DetalleTransporte?.Chofer?.Nombre
                    ?? (embarquePorHistorial.TryGetValue(m.IdHistorial, out var emb2) ? emb2.Chofer : null),
                ex.Lote, contenedorPorExistencia.GetValueOrDefault(m.IdExistencia!.Value),
                Doc(ex), ex.DocumentoOrigen?.Numero, m.Direccion?.DireccionTexto, m.TipoMovimiento.Nombre,
                entrada, m.Kilos, Cajas(m.Kilos),
                // Número de registro interno de la salida (el traspaso comparte el de su salida de Conpaq).
                !entrada || esTraspaso ? m.IdHistorial : null, m.Id,
                Folio: folioPorHistorial.GetValueOrDefault(m.IdHistorial),
                NumeroEmbarque: m.TipoMovimiento.Nombre.ToLower().Contains("embarque") && embarquePorHistorial.TryGetValue(m.IdHistorial, out var emb3) ? emb3.Numero : null));
        }

        foreach (var sol in solicitudes)
        {
            var ex = sol.Existencia;
            var emb = sol.Embarque;
            filas.Add(new FilaResguardo(
                $"sol-{sol.Id}", emb.HistorialMovimiento.FechaRegistro,
                emb.DetalleTransporte?.Tractocamion?.Empresa?.Nombre, emb.DetalleTransporte?.Chofer?.Nombre,
                ex.Lote, contenedorPorExistencia.GetValueOrDefault(ex.Id),
                Doc(ex), ex.DocumentoOrigen?.Numero, textoDireccion.GetValueOrDefault(sol.IdDireccion), "Embarque",
                false, sol.Kilos, Cajas(sol.Kilos),
                emb.IdHistorial, 1_000_000 + sol.Id,
                Folio: null, NumeroEmbarque: emb.Numero ?? emb.Id.ToString()));
        }

        decimal inv = 0;
        var resultado = filas
            .OrderBy(f => f.Fecha.HasValue).ThenBy(f => f.Fecha).ThenBy(f => f.Orden)
            .Select(f =>
            {
                inv += f.EsEntrada ? f.Kilos : -f.Kilos;
                return f with { InvFinal = inv };
            })
            .ToList();

        return Ok(new
        {
            Empresa = empresa.Nombre,
            Producto = new
            {
                producto.Codigo,
                Descripcion = producto.Especie.Nombre,
                Marca = producto.Marca?.Nombre,
                Talla = producto.Talla?.Descripcion
            },
            Movimientos = resultado
        });
    }

[RequierePermiso("inventario","ver","existencias/ver","ventas/crear","ventas/editar","embarques/crear","embarques/editar","produccion/crear")]
[HttpGet("trazabilidad/{idExistencia}")]
public async Task<IActionResult> GetTrazabilidad(uint idExistencia)
{
    var existencia = await _context.Existencias
        .Include(e => e.Producto)
        .FirstOrDefaultAsync(e => e.Id == idExistencia);

    if (existencia == null) return NotFound();

    var movimientos = await _context.DetallesMovimiento
        .Include(d => d.HistorialMovimiento).ThenInclude(h => h.Usuario)
        .Include(d => d.TipoMovimiento)
        .Include(d => d.Direccion)
        .Include(d => d.DetalleTransporte!).ThenInclude(dt => dt.Chofer)
        .Include(d => d.DetalleTransporte!).ThenInclude(dt => dt.Tractocamion).ThenInclude(t => t!.Empresa)
        .Where(d => d.IdExistencia == idExistencia)
        .OrderBy(d => d.HistorialMovimiento.FechaRegistro)
        .ToListAsync();

    decimal saldo = 0;
    var resultado = movimientos.Select(d => {
        bool esEntrada = d.TipoMovimiento.Nombre.ToLower().Contains("compra") ||
                         d.TipoMovimiento.Nombre.ToLower().Contains("traspaso");
        if (esEntrada) saldo += d.Kilos;
        else saldo -= d.Kilos;

        return new {
            d.Id,
            Fecha = d.HistorialMovimiento.FechaRegistro,
            Usuario = d.HistorialMovimiento.Usuario.Nombre,
            TipoMovimiento = d.TipoMovimiento.Nombre,
            EsEntrada = esEntrada,
            d.Kilos,
            Saldo = saldo,
            Direccion = d.Direccion != null ? d.Direccion.DireccionTexto : null,
            NombreChofer = d.DetalleTransporte != null && d.DetalleTransporte.Chofer != null
                ? d.DetalleTransporte.Chofer.Nombre : null,
            EmpresaTransporte = d.DetalleTransporte != null
                && d.DetalleTransporte.Tractocamion != null
                && d.DetalleTransporte.Tractocamion.Empresa != null
                ? d.DetalleTransporte.Tractocamion.Empresa.Nombre : null
        };
    });

    return Ok(new {
        existencia.Id,
        existencia.Lote,
        existencia.CodigoProducto,
        Producto = existencia.Producto.Codigo,
        Movimientos = resultado
    });
}
}
public record TraspasoResguardoDto(uint IdOrigen, uint IdDireccionDestino, decimal Kilos);

// Un renglón del historial de resguardo; InvFinal se completa al recorrer en orden cronológico.
public record FilaResguardo(
    string Id, DateTime? Fecha, string? EmpresaTransporte, string? NombreChofer, string Lote, string? Contenedor,
    string? TipoDocumento, string? NumeroDocumento, string? Bodega, string TipoMovimiento, bool EsEntrada,
    decimal Kilos, decimal? Cajas, uint? Salida, uint Orden, string? Folio = null, string? NumeroEmbarque = null,
    decimal InvFinal = 0);
