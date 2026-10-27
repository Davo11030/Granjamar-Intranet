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
public class EmbarquesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;
    private readonly PedidosConsignacionService _pedidos;

    public EmbarquesController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService,
        PedidosConsignacionService pedidos)
    {
        _pedidos = pedidos;
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
    }

    // Convierte los DetalleMovimiento (solo guardan IdExistencia) en algo legible para la
    // auditoría: código de producto, descripción y kilos — nada de ids sueltos.
    private async Task<List<object>> ResolverDetalles(IEnumerable<DetalleMovimiento> detalles)
    {
        var resultado = new List<object>();
        foreach (var d in detalles)
        {
            var existencia = d.IdExistencia != null ? await _context.Existencias.FindAsync(d.IdExistencia) : null;
            var codigoProducto = existencia?.CodigoProducto ?? d.CodigoProducto;
            var producto = codigoProducto != null
                ? await _context.Productos.Include(p => p.Especie).FirstOrDefaultAsync(p => p.Codigo == codigoProducto)
                : null;
            resultado.Add(new
            {
                Producto = codigoProducto,
                Descripcion = producto?.Especie?.Nombre ?? codigoProducto,
                d.Kilos
            });
        }
        return resultado;
    }

    // Suma el stock disponible de un producto en TODOS los lotes de una misma ubicación
    // (empresa/dirección) — la Requisición trabaja a este nivel, no por lote específico.
    private async Task<decimal> StockDisponibleEnDireccion(string codigoProducto, uint idDireccion) =>
        await _context.UbicacionesProducto
            .Where(u => u.Existencia.CodigoProducto == codigoProducto && u.IdDireccion == idDireccion && u.Existencia.Activo)
            .SumAsync(u => (decimal?)u.CantidadKilos) ?? 0;

    // "Nombre — calle, colonia, municipio, estado, C.P." de un cliente.
    private static string TextoCliente(Cliente c) =>
        c.Nombre + " — " + string.Join(", ", new[] { c.Calle, c.Colonia, c.Municipio, c.Estado,
            string.IsNullOrWhiteSpace(c.CodigoPostal) ? null : $"C.P. {c.CodigoPostal}" }
            .Where(x => !string.IsNullOrWhiteSpace(x)));

    // El destino de un embarque en una línea: la dirección, o el cliente con su dirección.
    private static string? TextoDestino(Embarque e) =>
        e.Direccion?.DireccionTexto ?? (e.Cliente != null ? TextoCliente(e.Cliente) : null);

    // Snapshot legible de un embarque para la auditoría: resuelve dirección/chofer/tractocamión
    // a su nombre en vez de dejar el id suelto.
    private async Task<object> SnapshotEmbarque(Embarque embarque, List<object>? detalles)
    {
        var direccion = embarque.IdDireccion != null ? await _context.Direcciones.FindAsync(embarque.IdDireccion) : null;
        var cliente = embarque.IdCliente != null ? await _context.Clientes.FindAsync(embarque.IdCliente) : null;
        var detalleTransporte = embarque.IdDetalleTransporte != null
            ? await _context.DetallesTransporte
                .Include(dt => dt.Chofer).Include(dt => dt.Tractocamion).Include(dt => dt.Caja)
                .FirstOrDefaultAsync(dt => dt.Id == embarque.IdDetalleTransporte)
            : null;

        return new
        {
            embarque.Numero,
            Direccion = direccion?.DireccionTexto ?? (cliente != null ? TextoCliente(cliente) : null),
            Chofer = detalleTransporte?.Chofer?.Nombre,
            Tractocamion = detalleTransporte?.Tractocamion?.Placa,
            embarque.Estado,
            Detalles = detalles
        };
    }

    [RequierePermiso("embarques","ver")]
    [HttpGet]
    public async Task<IActionResult> GetTodos()
    {
        var lista = await _context.Embarques
            .Include(e => e.HistorialMovimiento).ThenInclude(h => h.Usuario)
            .Include(e => e.Direccion)
            .Include(e => e.Cliente)
            .Include(e => e.DetalleTransporte).ThenInclude(dt => dt!.Chofer)
            .Include(e => e.DetalleTransporte).ThenInclude(dt => dt!.Tractocamion)
            .Include(e => e.DetalleTransporte).ThenInclude(dt => dt!.Caja)
            .Where(e => e.Activo)
            .ToListAsync();
        return Ok(lista
            .Select(e => new
            {
                e.Id,
                e.Numero,
                e.HistorialMovimiento.FechaRegistro,
                Usuario = e.HistorialMovimiento.Usuario.Nombre,
                e.IdDireccion,
                e.IdCliente,
                Direccion = TextoDestino(e),
                e.RutaCiego,
                e.RutaRequisision,
                e.RutaRt,
                e.RutaSolicitud,
                e.Estado,
                Chofer = e.DetalleTransporte != null && e.DetalleTransporte.Chofer != null
                    ? e.DetalleTransporte.Chofer.Nombre : null,
                Tractocamion = e.DetalleTransporte != null && e.DetalleTransporte.Tractocamion != null
                    ? e.DetalleTransporte.Tractocamion.Placa : null,
                Caja = e.DetalleTransporte != null && e.DetalleTransporte.Caja != null
                    ? e.DetalleTransporte.Caja.CajaPlaca : null
            })
            .ToList());
    }

    // Incluye todo lo que necesita la proyección completa de un embarque (GetPorId y GetPorNumero
    // comparten esta misma forma — ver Proyectar).
    private IQueryable<Embarque> ConIncludesCompletos() =>
        _context.Embarques
            .Include(e => e.HistorialMovimiento).ThenInclude(h => h.Usuario)
            .Include(e => e.HistorialMovimiento.DetallesMovimiento).ThenInclude(d => d.Existencia).ThenInclude(ex => ex!.DocumentoOrigen).ThenInclude(doc => doc!.DocumentoTipo)
            .Include(e => e.Direccion)
            .Include(e => e.Cliente)
            .Include(e => e.DetalleTransporte).ThenInclude(dt => dt!.Chofer)
            .Include(e => e.DetalleTransporte).ThenInclude(dt => dt!.Tractocamion)
            .Include(e => e.DetalleTransporte).ThenInclude(dt => dt!.Caja)
            .Include(e => e.SolicitudDetalles).ThenInclude(d => d.Existencia).ThenInclude(ex => ex.Producto).ThenInclude(p => p.Especie)
            .Include(e => e.SolicitudDetalles).ThenInclude(d => d.Existencia).ThenInclude(ex => ex.Producto).ThenInclude(p => p.PesoCaja)
            .Include(e => e.SolicitudDetalles).ThenInclude(d => d.Existencia).ThenInclude(ex => ex.DocumentoOrigen).ThenInclude(doc => doc!.DocumentoTipo)
            .Include(e => e.SolicitudTarimas)
            .Include(e => e.RtDetalles).ThenInclude(d => d.Documentos);

    private static object Proyectar(Embarque e) => new
    {
        e.Id,
        e.Numero,
        e.IdDireccion,
        e.IdCliente,
        e.HistorialMovimiento.FechaRegistro,
        Usuario = e.HistorialMovimiento.Usuario.Nombre,
        Direccion = TextoDestino(e),
        e.RutaCiego,
        e.RutaRequisision,
        e.RutaRt,
        e.RutaSolicitud,
        e.Estado,
        e.RequisicionCompleta,
        e.SolicitudCompleta,
        e.RtCompleta,
        e.CiegoCompleto,
        e.CartaCompleta,
        Chofer = e.DetalleTransporte?.Chofer?.Nombre,
        IdChofer = e.DetalleTransporte?.IdChofer,
        Tractocamion = e.DetalleTransporte?.Tractocamion?.Placa,
        IdTractocamion = e.DetalleTransporte?.IdTractocamion,
        Caja = e.DetalleTransporte?.Caja?.CajaPlaca,
        IdCaja = e.DetalleTransporte?.IdCaja,
        Detalles = e.HistorialMovimiento.DetallesMovimiento.Select(d => new
        {
            d.Id,
            d.IdExistencia,
            d.Kilos,
            d.IdDireccion,
            d.IdDepartamento,
            CodigoProducto = d.Existencia != null ? d.Existencia.CodigoProducto : d.CodigoProducto,
            Lote = d.Existencia != null ? d.Existencia.Lote : null
        }),
        SolicitudDetalles = e.SolicitudDetalles.Select(d => new
        {
            d.Id,
            d.IdExistencia,
            d.IdDireccion,
            CodigoProducto = d.Existencia.CodigoProducto,
            Nombre = d.Existencia.Producto.Especie.Nombre,
            PesoCaja = d.Existencia.Producto.PesoCaja != null ? d.Existencia.Producto.PesoCaja.Peso : 0,
            Lote = d.Existencia.Lote,
            d.NumTarimas,
            d.CajasPorTarima,
            d.Kilos,
            d.CajaIncompleta,
            d.LoteEspecificaciones,
            // Pedimento del lote de este renglón — viene de Existencia.DocumentoOrigen, no se captura a mano.
            // IdDocumentoOrigen identifica el documento sin ambigüedad (un mismo nombre de lote
            // puede ingresar con documentos distintos).
            IdDocumentoOrigen = d.Existencia.IdDocumentoOrigen,
            TipoDocumento = d.Existencia.DocumentoOrigen != null ? d.Existencia.DocumentoOrigen.DocumentoTipo.Nombre : null,
            NumeroDocumento = d.Existencia.DocumentoOrigen != null ? d.Existencia.DocumentoOrigen.Numero : null,
            FechaDocumento = d.Existencia.DocumentoOrigen != null ? (DateTime?)d.Existencia.DocumentoOrigen.Fecha : null
        }),
        // Las tarimas físicas capturadas en la Solicitud (por producto y ubicación de origen).
        SolicitudTarimas = e.SolicitudTarimas.Select(t => new
        {
            t.CodigoProducto,
            t.IdDireccion,
            t.NumTarimas,
            t.CajasPorTarima
        }),
        RtDetalles = e.RtDetalles.Select(d => new
        {
            d.Id,
            d.CodigoProducto,
            d.PrecioUnitario,
            d.ClaveSat,
            d.DescripcionSat,
            d.Pedimentos,
            // Uso legal por documento de este renglón (cuántos kilos se descontaron de cada uno).
            Documentos = d.Documentos.Select(x => new { x.IdDocumento, x.Kilos })
        })
    };

    [RequierePermiso("embarques","ver")]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var e = await ConIncludesCompletos().FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (e == null) return NotFound();
        return Ok(Proyectar(e));
    }

    // GET api/embarques/por-numero/ABC123 — todos los embarques activos que comparten un mismo
    // "No. Embarque" (un número puede repetirse: una requisición con varios destinos crea un
    // Embarque por destino, todos con el mismo número). Usado para mostrar/editar el grupo
    // completo en vez de solo el registro individual.
    [RequierePermiso("embarques","ver")]
    [HttpGet("por-numero/{numero}")]
    public async Task<IActionResult> GetPorNumero(string numero)
    {
        var lista = await ConIncludesCompletos()
            .Where(e => e.Numero == numero && e.Activo)
            .OrderBy(e => e.Id)
            .ToListAsync();
        return Ok(lista.Select(Proyectar));
    }

    // Una requisición debe pedir al menos un producto y cada uno con kilos > 0 (con kilos
    // negativos o en cero la Solicitud/RT quedarían sin base y el stock disponible se calcularía mal).
    private static string? ValidarRequisicion(CrearEmbarqueDto dto)
    {
        if (dto.IdDireccion == null && dto.IdCliente == null) return "Selecciona el destino del embarque";
        if (dto.IdDireccion != null && dto.IdCliente != null) return "El destino es una dirección o un cliente, no los dos";
        // Un embarque no se envía a sí mismo: el destino no puede ser el lugar del que sale la mercancía.
        if (dto.IdDireccion != null && dto.Detalles.Any(d => d.IdDireccion == dto.IdDireccion))
            return "El destino no puede ser el mismo lugar de origen: un embarque no se envía a sí mismo";
        if (dto.Detalles.Count == 0) return "Agrega al menos un producto";
        if (dto.Detalles.Any(d => d.Kilos <= 0)) return "Los kilos de cada producto deben ser mayores a 0";
        return null;
    }

    // A las bodegas de consignación solo se ingresa desde su propio menú: un embarque no puede ir a ellas (a resguardo sí).
    private async Task<string?> ValidarDestinoAsync(uint? idDireccion, uint? direccionActual = null)
    {
        if (idDireccion == null || idDireccion == direccionActual) return null;
        var tipo = await _context.Direcciones.Where(d => d.Id == idDireccion)
            .Select(d => d.Empresa != null ? d.Empresa.Tipo : null).FirstOrDefaultAsync();
        if (tipo != null && tipo.Equals("consignacion", StringComparison.OrdinalIgnoreCase))
            return "Los embarques no pueden ir a bodegas de consignación: el ingreso se hace desde su menú";
        return null;
    }

    // Texto del destino de un embarque para los pedidos de consignación: "Empresa — dirección".
    private async Task<(string Tipo, string Texto)> DestinoEmbarqueAsync(uint? idDireccion, uint? idCliente)
    {
        if (idCliente != null)
        {
            var c = await _context.Clientes.FindAsync(idCliente);
            return ("Cliente", c != null ? TextoCliente(c) : "Sin destino");
        }
        if (idDireccion == null) return ("Embarque", "Sin destino");
        var d = await _context.Direcciones.Include(x => x.Empresa).FirstOrDefaultAsync(x => x.Id == idDireccion);
        if (d == null) return ("Embarque", "Sin destino");
        return ("Embarque", d.Empresa != null ? $"{d.Empresa.Nombre} — {d.DireccionTexto}" : d.DireccionTexto);
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearEmbarqueDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "embarques", "crear"))
            return this.SinPermiso();
        var errorRequisicion = ValidarRequisicion(dto) ?? await ValidarDestinoAsync(dto.IdDireccion);
        if (errorRequisicion != null) return BadRequest(new { mensaje = errorRequisicion });
        var tipoMovimiento = await _context.TiposMovimiento
            .FirstOrDefaultAsync(t => t.Nombre.ToLower().Contains("embarque"));
        if (tipoMovimiento == null)
            return BadRequest(new { mensaje = "No existe tipo de movimiento 'Embarque'" });

        var historial = new HistorialMovimiento
        {
            FechaRegistro = DateTime.UtcNow,
            IdUsuario = this.IdUsuarioActual()
        };
        _context.HistorialesMovimiento.Add(historial);
        await _context.SaveChangesAsync();

        DetalleTransporte? detalleTransporte = null;
        if (dto.Transporte != null)
        {
            detalleTransporte = new DetalleTransporte
            {
                IdChofer = dto.Transporte.IdChofer,
                IdTractocamion = dto.Transporte.IdTractocamion,
                IdCaja = dto.Transporte.IdCaja
            };
            _context.DetallesTransporte.Add(detalleTransporte);
            await _context.SaveChangesAsync();
        }

        // La Requisición solo planea (producto + ubicación + kilos) — no descuenta stock real
        // todavía. Eso pasa hasta que la Solicitud elige los lotes específicos.
        var detallesCreados = new List<DetalleMovimiento>();
        foreach (var detalle in dto.Detalles)
        {
            var producto = await _context.Productos.FindAsync(detalle.CodigoProducto);
            if (producto == null)
                return BadRequest(new { mensaje = $"No existe el producto {detalle.CodigoProducto}" });

            var disponible = await StockDisponibleEnDireccion(detalle.CodigoProducto, detalle.IdDireccion);
            if (disponible < detalle.Kilos)
                return BadRequest(new { mensaje = $"Stock insuficiente en esa ubicación. Disponible: {disponible} kg" });

            var nuevoDetalle = new DetalleMovimiento
            {
                IdHistorial = historial.Id,
                CodigoProducto = detalle.CodigoProducto,
                Kilos = detalle.Kilos,
                IdTipoMovimiento = tipoMovimiento.Id,
                IdDireccion = detalle.IdDireccion,
                IdDepartamento = detalle.IdDepartamento,
                IdDetalleTransporte = detalleTransporte?.Id
            };
            _context.DetallesMovimiento.Add(nuevoDetalle);
            detallesCreados.Add(nuevoDetalle);
        }

        var embarque = new Embarque
        {
            Numero = dto.Numero,
            IdHistorial = historial.Id,
            IdDireccion = dto.IdDireccion,
            IdCliente = dto.IdCliente,
            RutaCiego = dto.RutaCiego,
            RutaRequisision = dto.RutaRequisision,
            RutaRt = dto.RutaRt,
            RutaSolicitud = dto.RutaSolicitud,
            IdDetalleTransporte = detalleTransporte?.Id
        };

        _context.Embarques.Add(embarque);
        await _context.SaveChangesAsync();

        // Producto de una empresa en consignación → solicitud de compra para esa empresa.
        var destinoCrear = await DestinoEmbarqueAsync(dto.IdDireccion, dto.IdCliente);
        await _pedidos.SincronizarAsync("Embarque", embarque.Id, destinoCrear.Tipo, destinoCrear.Texto,
            dto.Detalles.Select(d => new LineaPedido(d.CodigoProducto, null, d.Kilos, d.IdDireccion)));

        var detallesTexto = await ResolverDetalles(detallesCreados);
        await _auditoria.RegistrarAsync("embarque", embarque.Id.ToString(), "CREAR", null,
            await SnapshotEmbarque(embarque, detallesTexto), dto.IdUsuario);

        return CreatedAtAction(nameof(GetPorId), new { id = embarque.Id }, new { embarque.Id });
    }

    // PUT api/embarques/5/estado — cambia solo el estado (ej. marcar completado), sin tocar
    // detalles ni inventario.
    [HttpPut("{id}/estado")]
    public async Task<IActionResult> CambiarEstado(uint id, [FromBody] CambiarEstadoEmbarqueDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "embarques", "editar"))
            return this.SinPermiso();

        var embarque = await _context.Embarques.FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (embarque == null) return NotFound();

        var antes = new { embarque.Estado };
        embarque.Estado = dto.Estado;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("embarque", id.ToString(), "MODIFICAR", antes, new { embarque.Estado }, dto.IdUsuario);

        return NoContent();
    }

    // PUT api/embarques/5/documento — marca (o desmarca) el ciego de carga como completo; esto es
    // lo que pinta de verde su pestaña en EmbarqueDetalle. Requisición se marca sola al crearse,
    // Solicitud/RT se marcan solas al guardarse (ver GuardarSolicitud/GuardarRt), y Carta
    // responsiva ya no se marca manualmente — será un PDF autogenerado a partir de la Requisición.
    [HttpPut("{id}/documento")]
    public async Task<IActionResult> MarcarDocumento(uint id, [FromBody] MarcarDocumentoDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "embarques", "editar"))
            return this.SinPermiso();

        if ((dto.Documento ?? "").ToLower() != "ciego")
            return BadRequest(new { mensaje = "Documento inválido" });

        var embarque = await _context.Embarques.FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (embarque == null) return NotFound();

        var antes = new { embarque.CiegoCompleto };
        embarque.CiegoCompleto = dto.Completo;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("embarque", id.ToString(), "MODIFICAR", antes, new { embarque.CiegoCompleto }, dto.IdUsuario);

        return NoContent();
    }

    // PUT api/embarques/5/solicitud — reemplaza el detalle de tarimas de la Solicitud. Cada
    // renglón debe corresponder a una existencia ya pedida en la Requisición de este embarque, y
    // la suma de kilos (tarimas × cajas × peso de caja) no puede exceder lo ahí solicitado.
    [HttpPut("{id}/solicitud")]
    public async Task<IActionResult> GuardarSolicitud(uint id, [FromBody] GuardarSolicitudDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "embarques", "editar"))
            return this.SinPermiso();

        var embarque = await _context.Embarques
            .Include(e => e.HistorialMovimiento).ThenInclude(h => h.DetallesMovimiento).ThenInclude(d => d.Existencia)
            .Include(e => e.SolicitudDetalles)
            .Include(e => e.SolicitudTarimas)
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (embarque == null) return NotFound();

        if (dto.Detalles.Count == 0)
            return BadRequest(new { mensaje = "Agrega al menos un producto" });

        // Lo que la Requisición de este embarque pidió, por producto (ya no por lote — el lote
        // específico se decide aquí, en la Solicitud).
        var pedidosPorProducto = embarque.HistorialMovimiento.DetallesMovimiento
            .Select(d => new { Codigo = d.Existencia != null ? d.Existencia.CodigoProducto : d.CodigoProducto, d.Kilos })
            .Where(x => x.Codigo != null)
            .GroupBy(x => x.Codigo!)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Kilos));

        // Las tarimas físicas capturadas deben ser de productos que esta requisición pidió.
        foreach (var t in dto.Tarimas)
        {
            if (t.NumTarimas <= 0 || t.CajasPorTarima <= 0)
                return BadRequest(new { mensaje = "Las tarimas (enteras) y las cajas por tarima deben ser mayores a 0" });
            if (!pedidosPorProducto.ContainsKey(t.CodigoProducto))
                return BadRequest(new { mensaje = $"El producto {t.CodigoProducto} no está en la requisición de este embarque" });
        }

        // 1) Devolver, solo en memoria todavía (nada se guarda hasta el final), el stock que la
        //    Solicitud anterior ya tenía reservado — así el paso 2 valida contra el stock "real"
        //    resultante y un guardado sin cambios no se rechaza a sí mismo por falta de stock.
        foreach (var anterior in embarque.SolicitudDetalles)
        {
            // Se devuelve exactamente lo que ese renglón había descontado (anterior.Kilos, ya
            // guardado tal cual se descontó) — no NumTarimas×CajasPorTarima×PesoCaja, que para un
            // renglón de caja incompleta daría el peso nominal completo en vez del real, más chico.
            var kilosAnteriores = anterior.Kilos;

            var ubicacionAnterior = await _context.UbicacionesProducto
                .FirstOrDefaultAsync(u => u.IdExistencia == anterior.IdExistencia && u.IdDireccion == anterior.IdDireccion);
            if (ubicacionAnterior != null)
                ubicacionAnterior.CantidadKilos += kilosAnteriores;
        }

        // 2) Validar el nuevo detalle y acumular, por lote (UbicacionProducto), cuánto habría
        //    que descontar — sin tocar nada todavía.
        var kilosAsignadosPorProducto = new Dictionary<string, decimal>();
        var porUbicacion = new Dictionary<uint, (UbicacionProducto ubicacion, decimal kilos)>();
        var kilosPorDetalle = new Dictionary<SolicitudDetalleDto, decimal>();
        foreach (var d in dto.Detalles)
        {
            if (d.NumTarimas <= 0 || d.CajasPorTarima <= 0)
                return BadRequest(new { mensaje = "Número de tarimas y cajas por tarima deben ser mayores a 0" });
            if (d.CajaIncompleta && (d.NumTarimas != 1 || d.CajasPorTarima != 1))
                return BadRequest(new { mensaje = "Una caja incompleta debe capturarse como 1 tarima x 1 caja" });

            var existencia = await _context.Existencias
                .Include(ex => ex.Producto).ThenInclude(p => p.PesoCaja)
                .FirstOrDefaultAsync(ex => ex.Id == d.IdExistencia);
            if (existencia == null)
                return BadRequest(new { mensaje = $"No existe la existencia {d.IdExistencia}" });

            if (!pedidosPorProducto.ContainsKey(existencia.CodigoProducto))
                return BadRequest(new { mensaje = $"El producto {existencia.CodigoProducto} no está en la requisición de este embarque" });

            var ubicacion = await _context.UbicacionesProducto
                .FirstOrDefaultAsync(u => u.IdExistencia == d.IdExistencia && u.IdDireccion == d.IdDireccion);
            if (ubicacion == null)
                return BadRequest(new { mensaje = "Ese lote no tiene stock en la ubicación indicada" });

            decimal kilos;
            if (d.CajaIncompleta)
            {
                // Una caja incompleta nunca recalcula kilos por peso nominal — se usan los kilos
                // reales que el usuario confirmó en pantalla (acotados al stock real, por si
                // cambió desde que se marcó), precisamente porque el lote no alcanza para una
                // caja completa.
                if (d.Kilos is not > 0)
                    return BadRequest(new { mensaje = "Una caja incompleta necesita los kilos reales a usar" });
                kilos = d.Kilos.Value;
            }
            else
            {
                var pesoCaja = existencia.Producto.PesoCaja?.Peso ?? 0;
                kilos = d.NumTarimas * d.CajasPorTarima * pesoCaja;
            }
            kilosPorDetalle[d] = kilos;
            kilosAsignadosPorProducto[existencia.CodigoProducto] = kilosAsignadosPorProducto.GetValueOrDefault(existencia.CodigoProducto) + kilos;

            var kilosPrevios = porUbicacion.TryGetValue(ubicacion.Id, out var previo) ? previo.kilos : 0m;
            porUbicacion[ubicacion.Id] = (ubicacion, kilosPrevios + kilos);
        }

        foreach (var (codigo, kilos) in kilosAsignadosPorProducto)
        {
            if (kilos > pedidosPorProducto[codigo] + 0.01m)
                return BadRequest(new { mensaje = $"Excede los kilos pedidos en la requisición para {codigo}" });
        }
        foreach (var (ubicacion, kilos) in porUbicacion.Values)
        {
            if (ubicacion.CantidadKilos < kilos)
                return BadRequest(new { mensaje = $"Stock insuficiente en un lote seleccionado. Disponible: {ubicacion.CantidadKilos} kg" });
        }

        // 3) Todo válido: recién aquí se descuenta el stock real y se reemplazan los renglones.
        foreach (var (ubicacion, kilos) in porUbicacion.Values)
            ubicacion.CantidadKilos -= kilos;

        var antes = embarque.SolicitudDetalles
            .Select(d => new { d.IdExistencia, d.IdDireccion, d.NumTarimas, d.CajasPorTarima, d.LoteEspecificaciones }).ToList();

        _context.SolicitudesDetalle.RemoveRange(embarque.SolicitudDetalles);
        foreach (var d in dto.Detalles)
        {
            _context.SolicitudesDetalle.Add(new SolicitudDetalle
            {
                IdEmbarque = id,
                IdExistencia = d.IdExistencia,
                IdDireccion = d.IdDireccion,
                NumTarimas = d.NumTarimas,
                CajasPorTarima = d.CajasPorTarima,
                Kilos = kilosPorDetalle[d],
                CajaIncompleta = d.CajaIncompleta,
                LoteEspecificaciones = d.LoteEspecificaciones
            });
        }
        // Las tarimas físicas se reemplazan junto con los renglones (mismo guardado).
        _context.SolicitudTarimas.RemoveRange(embarque.SolicitudTarimas);
        foreach (var t in dto.Tarimas)
        {
            _context.SolicitudTarimas.Add(new SolicitudTarima
            {
                IdEmbarque = id,
                CodigoProducto = t.CodigoProducto,
                IdDireccion = t.IdDireccion,
                NumTarimas = t.NumTarimas,
                CajasPorTarima = t.CajasPorTarima
            });
        }
        embarque.SolicitudCompleta = true;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("embarque", id.ToString(), "MODIFICAR",
            new { Solicitud = antes }, new { Solicitud = dto.Detalles, Tarimas = dto.Tarimas }, dto.IdUsuario);

        return NoContent();
    }

    // PUT api/embarques/5/rt — reemplaza el detalle de la RT. Un renglón por PRODUCTO (nunca por
    // lote): cada código debe corresponder a algún producto ya presente en la Solicitud de este
    // mismo embarque (no se puede facturar algo que no se solicitó).
    [HttpPut("{id}/rt")]
    public async Task<IActionResult> GuardarRt(uint id, [FromBody] GuardarRtDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "embarques", "editar"))
            return this.SinPermiso();

        var embarque = await _context.Embarques
            .Include(e => e.SolicitudDetalles).ThenInclude(d => d.Existencia)
            .Include(e => e.RtDetalles).ThenInclude(d => d.Documentos)
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (embarque == null) return NotFound();

        if (dto.Detalles.Count == 0)
            return BadRequest(new { mensaje = "Agrega al menos un renglón" });

        // Se valida TODO antes de tocar nada (un PUT rechazado no debe alterar la RT anterior).
        var productosSolicitud = embarque.SolicitudDetalles.Select(d => d.Existencia.CodigoProducto).ToHashSet();
        foreach (var d in dto.Detalles)
        {
            if (!productosSolicitud.Contains(d.CodigoProducto))
                return BadRequest(new { mensaje = $"El producto {d.CodigoProducto} no está en la solicitud de este embarque" });

            // No se puede enviar un producto sin documento que lo respalde.
            if (d.Documentos.Count == 0)
                return BadRequest(new { mensaje = $"El producto {d.CodigoProducto} necesita al menos un documento (pedimento/factura)" });
            if (d.Documentos.Select(x => x.IdDocumento).Distinct().Count() != d.Documentos.Count)
                return BadRequest(new { mensaje = $"El producto {d.CodigoProducto} repite un documento" });

            // Conteo legal por documento: los kilos que se le descuentan nunca pueden pasar de lo
            // que le queda (lo que entró menos lo que otras RT ya usaron — el uso anterior de
            // ESTE embarque se reemplaza, por eso se excluye).
            var originales = await _context.KilosOriginalesPorDocumento(d.CodigoProducto);
            var usados = await _context.KilosUsadosPorDocumento(d.CodigoProducto, id);
            foreach (var doc in d.Documentos)
            {
                if (doc.Kilos < 0)
                    return BadRequest(new { mensaje = "Los kilos de un documento no pueden ser negativos" });
                if (!originales.TryGetValue(doc.IdDocumento, out var original))
                {
                    // Un documento sin kilos registrados para este código se puede referenciar (cualquier
                    // pedimento o factura existente) pero no descuenta nada: abajo, sus kilos máximos son 0.
                    if (!await _context.Documentos.AnyAsync(x => x.Id == doc.IdDocumento))
                        return BadRequest(new { mensaje = $"No existe el documento {doc.IdDocumento}" });
                }
                var restante = original - usados.GetValueOrDefault(doc.IdDocumento);
                if (doc.Kilos > Math.Max(restante, 0) + 0.001m)
                {
                    var nombre = await _context.Documentos.Where(x => x.Id == doc.IdDocumento)
                        .Select(x => x.DocumentoTipo.Nombre + " " + x.Numero).FirstOrDefaultAsync();
                    return BadRequest(new { mensaje = $"El documento {nombre} solo tiene {Math.Max(restante, 0)} kg restantes para {d.CodigoProducto}" });
                }
            }
        }

        var antes = embarque.RtDetalles
            .Select(d => new { d.CodigoProducto, d.PrecioUnitario, d.ClaveSat, d.DescripcionSat, d.Pedimentos }).ToList();

        _context.RtDetalleDocumentos.RemoveRange(embarque.RtDetalles.SelectMany(d => d.Documentos));
        _context.RtDetalles.RemoveRange(embarque.RtDetalles);
        foreach (var d in dto.Detalles)
        {
            _context.RtDetalles.Add(new RtDetalle
            {
                IdEmbarque = id,
                CodigoProducto = d.CodigoProducto,
                PrecioUnitario = d.PrecioUnitario,
                ClaveSat = d.ClaveSat,
                DescripcionSat = d.DescripcionSat,
                Pedimentos = d.Pedimentos,
                Documentos = d.Documentos
                    .Select(x => new RtDetalleDocumento { IdDocumento = x.IdDocumento, Kilos = x.Kilos })
                    .ToList()
            });
        }
        embarque.RtCompleta = true;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("embarque", id.ToString(), "MODIFICAR",
            new { Rt = antes }, new { Rt = dto.Detalles }, dto.IdUsuario);

        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearEmbarqueDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "embarques", "editar"))
            return this.SinPermiso();
        var errorRequisicion = ValidarRequisicion(dto);
        if (errorRequisicion != null) return BadRequest(new { mensaje = errorRequisicion });
        var embarque = await _context.Embarques
            .Include(e => e.HistorialMovimiento)
                .ThenInclude(h => h.DetallesMovimiento)
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);

        if (embarque == null) return NotFound();

        // Un embarque viejo que ya iba a una de esas bodegas conserva su destino al editarlo; no se puede elegir uno nuevo.
        var errorDestino = await ValidarDestinoAsync(dto.IdDireccion, embarque.IdDireccion);
        if (errorDestino != null) return BadRequest(new { mensaje = errorDestino });

        var tipoMovimiento = await _context.TiposMovimiento
            .FirstOrDefaultAsync(t => t.Nombre.ToLower().Contains("embarque"));
        if (tipoMovimiento == null)
            return BadRequest(new { mensaje = "No existe tipo de movimiento 'Embarque'" });

        var datosAnteriores = await SnapshotEmbarque(embarque, await ResolverDetalles(embarque.HistorialMovimiento.DetallesMovimiento));

        // Validar TODO primero, sin tocar la base de datos todavía — si algún detalle nuevo no
        // pasa (producto inexistente, stock insuficiente), se corta aquí sin haber borrado nada
        // de lo viejo. Antes esto se validaba después de un RemoveRange+SaveChangesAsync ya
        // persistido, así que una validación fallida dejaba el embarque sin ningún detalle
        // (bug real encontrado en vivo — un PUT rechazado SÍ alteraba datos).
        foreach (var detalle in dto.Detalles)
        {
            var producto = await _context.Productos.FindAsync(detalle.CodigoProducto);
            if (producto == null)
                return BadRequest(new { mensaje = $"No existe el producto {detalle.CodigoProducto}" });

            var disponible = await StockDisponibleEnDireccion(detalle.CodigoProducto, detalle.IdDireccion);
            if (disponible < detalle.Kilos)
                return BadRequest(new { mensaje = $"Stock insuficiente en esa ubicación. Disponible: {disponible} kg" });
        }

        // Todo válido: recién aquí se reemplazan los renglones planeados (la Requisición no
        // descuenta stock real — ver Crear — así que no hay nada que revertir, solo reemplazar).
        _context.DetallesMovimiento.RemoveRange(embarque.HistorialMovimiento.DetallesMovimiento);

        // Actualizar transporte si viene
        if (dto.Transporte != null && embarque.IdDetalleTransporte != null)
        {
            var detalleTransporte = await _context.DetallesTransporte
                .FindAsync(embarque.IdDetalleTransporte);
            if (detalleTransporte != null)
            {
                detalleTransporte.IdChofer = dto.Transporte.IdChofer;
                detalleTransporte.IdTractocamion = dto.Transporte.IdTractocamion;
                detalleTransporte.IdCaja = dto.Transporte.IdCaja;
            }
        }
        else if (dto.Transporte != null)
        {
            var detalleTransporte = new DetalleTransporte
            {
                IdChofer = dto.Transporte.IdChofer,
                IdTractocamion = dto.Transporte.IdTractocamion,
                IdCaja = dto.Transporte.IdCaja
            };
            _context.DetallesTransporte.Add(detalleTransporte);
            await _context.SaveChangesAsync();
            embarque.IdDetalleTransporte = detalleTransporte.Id;
        }

        var detallesNuevos = new List<DetalleMovimiento>();
        foreach (var detalle in dto.Detalles)
        {
            var nuevoDetalle = new DetalleMovimiento
            {
                IdHistorial = embarque.HistorialMovimiento.Id,
                CodigoProducto = detalle.CodigoProducto,
                Kilos = detalle.Kilos,
                IdTipoMovimiento = tipoMovimiento.Id,
                IdDireccion = detalle.IdDireccion,
                IdDepartamento = detalle.IdDepartamento
            };
            _context.DetallesMovimiento.Add(nuevoDetalle);
            detallesNuevos.Add(nuevoDetalle);
        }

        embarque.Numero = dto.Numero;
        embarque.IdDireccion = dto.IdDireccion;
        embarque.IdCliente = dto.IdCliente;
        embarque.RutaCiego = dto.RutaCiego;
        embarque.RutaRequisision = dto.RutaRequisision;
        embarque.RutaRt = dto.RutaRt;
        embarque.RutaSolicitud = dto.RutaSolicitud;
        embarque.HistorialMovimiento.IdUsuario = this.IdUsuarioActual();

        await _context.SaveChangesAsync();

        var destinoActualizar = await DestinoEmbarqueAsync(dto.IdDireccion, dto.IdCliente);
        await _pedidos.SincronizarAsync("Embarque", embarque.Id, destinoActualizar.Tipo, destinoActualizar.Texto,
            dto.Detalles.Select(d => new LineaPedido(d.CodigoProducto, null, d.Kilos, d.IdDireccion)));

        var datosNuevos = await SnapshotEmbarque(embarque, await ResolverDetalles(detallesNuevos));
        await _auditoria.RegistrarAsync("embarque", id.ToString(), "MODIFICAR", datosAnteriores, datosNuevos, dto.IdUsuario);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id, [FromQuery] uint idUsuario)
    {
         if (!await _permisoService.TienePermisoAsync(idUsuario, "embarques", "eliminar"))
            return this.SinPermiso();
        var embarque = await _context.Embarques
            .Include(e => e.HistorialMovimiento)
                .ThenInclude(h => h.DetallesMovimiento)
            .Include(e => e.SolicitudDetalles)
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);

        if (embarque == null) return NotFound();

        var datosAnteriores = await SnapshotEmbarque(embarque, await ResolverDetalles(embarque.HistorialMovimiento.DetallesMovimiento));

        // La Requisición (HistorialMovimiento.DetallesMovimiento) ya no tiene stock real que
        // devolver — eso solo lo reserva la Solicitud (ver GuardarSolicitud), así que es lo único
        // que hay que revertir aquí al eliminar el embarque.
        foreach (var detalle in embarque.SolicitudDetalles)
        {
            // Igual que en GuardarSolicitud: se devuelve lo que ese renglón realmente descontó
            // (detalle.Kilos), no el peso nominal recalculado — para una caja incompleta serían
            // kilos distintos.
            var kilos = detalle.Kilos;

            var ubicacion = await _context.UbicacionesProducto
                .FirstOrDefaultAsync(u => u.IdExistencia == detalle.IdExistencia && u.IdDireccion == detalle.IdDireccion);
            if (ubicacion != null)
                ubicacion.CantidadKilos += kilos;
        }

        embarque.Activo = false;
        await _context.SaveChangesAsync();
        await _pedidos.AnularPendientesAsync("Embarque", embarque.Id);

        await _auditoria.RegistrarAsync("embarque", id.ToString(), "ELIMINAR", datosAnteriores, null, idUsuario);

        return NoContent();
    }
}