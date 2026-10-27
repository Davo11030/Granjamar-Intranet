using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.API.Extensiones;
using System.Text.Json;
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
public class ComprasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;
    private readonly Empresa.Intranet.API.Servicios.ArchivosDocumentoService _archivos;

    public ComprasController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService,
        Empresa.Intranet.API.Servicios.ArchivosDocumentoService archivos)
    {
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
        _archivos = archivos;
    }

    // Convierte los DetalleMovimiento (solo guardan IdExistencia) en algo legible para la
    // auditoría: código de producto, lote, descripción y kilos — nada de ids sueltos.
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
                Lote = existencia?.Lote,
                Descripcion = producto?.Especie?.Nombre ?? existencia?.CodigoProducto,
                d.Kilos
            });
        }
        return resultado;
    }

    // Resuelve (o crea) el pedimento/documento de origen de un lote a partir de su tipo (ej. "A1",
    // "C1") y número — así cada Existencia queda ligada a un Documento real en vez de guardar el
    // pedimento como puro texto suelto en la compra. Reutiliza el tipo/documento si ya existen
    // (mismo tipo+número), para no duplicar un pedimento que cubre varios lotes de un mismo envío.
    private async Task<uint?> ResolverDocumentoOrigen(string? tipoDocumento, string? numeroDocumento)
    {
        if (string.IsNullOrWhiteSpace(numeroDocumento)) return null;
        var numero = numeroDocumento.Trim();
        var nombreTipo = string.IsNullOrWhiteSpace(tipoDocumento) ? "Pedimento" : tipoDocumento.Trim();

        var tipo = await _context.DocumentosTipo.FirstOrDefaultAsync(t => t.Nombre.ToLower() == nombreTipo.ToLower());
        if (tipo == null)
        {
            tipo = new DocumentoTipo { Nombre = nombreTipo };
            _context.DocumentosTipo.Add(tipo);
            await _context.SaveChangesAsync();
        }

        var documento = await _context.Documentos
            .FirstOrDefaultAsync(d => d.Numero == numero && d.IdDocumentoTipo == tipo.Id);
        if (documento == null)
        {
            documento = new Documento { Numero = numero, Fecha = DateTime.UtcNow, IdDocumentoTipo = tipo.Id };
            _context.Documentos.Add(documento);
            await _context.SaveChangesAsync();
        }

        return documento.Id;
    }

    // Snapshot legible de una compra para la auditoría: resuelve empresa a su nombre en vez de
    // dejar el id suelto.
    private async Task<object> SnapshotCompra(Compras compra, List<object>? detalles)
    {
        var empresa = compra.IdEmpresa != null ? await _context.Empresas.FindAsync(compra.IdEmpresa) : null;
        return new
        {
            Empresa = empresa?.Nombre,
            compra.UrlRemision,
            compra.NumeroEmbarque,
            compra.NumeroContenedor,
            compra.UrlFactura,
            compra.Estado,
            Detalles = detalles
        };
    }

    [RequierePermiso("compras","ver")]
    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Compras
            .Include(c => c.Empresa)
            .Include(c => c.HistorialMovimiento).ThenInclude(h => h!.Usuario)
            .Where(c => c.Activo)
            .Select(c => new ComprasDto
            {
                Id = c.Id,
                Empresa = c.Empresa != null ? c.Empresa.Nombre : null,
                FechaRegistro = c.HistorialMovimiento!.FechaRegistro,
                Usuario = c.HistorialMovimiento.Usuario.Nombre,
                UrlRemision = c.UrlRemision,
                NumeroEmbarque = c.NumeroEmbarque,
                NumeroContenedor = c.NumeroContenedor,
                UrlFactura = c.UrlFactura,
                Estado = c.Estado,
                FolioEmpresa = c.FolioEmpresa
            })
            .ToListAsync());

    [RequierePermiso("compras","ver")]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var c = await _context.Compras
            .Include(c => c.Empresa)
            .Include(c => c.HistorialMovimiento).ThenInclude(h => h!.Usuario)
            .Include(c => c.HistorialMovimiento!.DetallesMovimiento).ThenInclude(d => d.Existencia).ThenInclude(ex => ex!.Producto).ThenInclude(p => p.Especie)
            .Include(c => c.HistorialMovimiento!.DetallesMovimiento).ThenInclude(d => d.Existencia).ThenInclude(ex => ex!.DocumentoOrigen).ThenInclude(doc => doc!.DocumentoTipo)
            .Include(c => c.HistorialMovimiento!.DetallesMovimiento).ThenInclude(d => d.DetalleTransporte)
            .FirstOrDefaultAsync(c => c.Id == id && c.Activo);

        if (c == null) return NotFound();

        return Ok(new
        {
            c.Id,
            Empresa = c.Empresa?.Nombre,
            c.IdEmpresa,
            c.FolioEmpresa,
            IdChofer = c.HistorialMovimiento!.DetallesMovimiento.Select(d => d.DetalleTransporte?.IdChofer).FirstOrDefault(x => x != null),
            IdTractocamion = c.HistorialMovimiento.DetallesMovimiento.Select(d => d.DetalleTransporte?.IdTractocamion).FirstOrDefault(x => x != null),
            c.HistorialMovimiento!.FechaRegistro,
            Usuario = c.HistorialMovimiento.Usuario.Nombre,
            c.UrlRemision,
            c.NumeroEmbarque,
            c.NumeroContenedor,
            c.UrlFactura,
            c.Estado,
            // Cada renglón trae su propio documento de origen (pedimento O factura, mismo
            // mecanismo — Existencia.DocumentoOrigen) porque una misma entrada puede traer más
            // de un pedimento/factura, uno distinto por producto/lote.
            Detalles = c.HistorialMovimiento.DetallesMovimiento.Select(d => new
            {
                d.Id,
                d.IdDireccion,
                d.IdDepartamento,
                d.Existencia!.Lote,
                d.Existencia.CodigoProducto,
                Nombre = d.Existencia.Producto.Especie.Nombre,
                d.Kilos,
                d.Existencia.Costo,
                d.Existencia.Caducidad,
                TipoDocumento = d.Existencia.DocumentoOrigen != null ? d.Existencia.DocumentoOrigen.DocumentoTipo.Nombre : null,
                NumeroDocumento = d.Existencia.DocumentoOrigen != null ? d.Existencia.DocumentoOrigen.Numero : null,
                // Para abrir el archivo del documento desde el detalle de la entrada.
                IdDocumento = d.Existencia.IdDocumentoOrigen,
                TieneArchivo = d.Existencia.DocumentoOrigen != null && d.Existencia.DocumentoOrigen.ArchivoRuta != null
            })
        });
    }

    // Una entrada nunca puede traer kilos <= 0 (un renglón negativo restaría inventario) ni quedar
    // sin renglones ni sin lote.
    private static string? ValidarDetallesCompra(CrearCompraDto dto)
    {
        if (dto.Detalles.Count == 0) return "Agrega al menos un producto";
        foreach (var d in dto.Detalles)
        {
            if (d.Kilos <= 0) return "Los kilos de cada producto deben ser mayores a 0";
            if (string.IsNullOrWhiteSpace(d.Lote)) return "Cada producto necesita su lote";
        }
        return null;
    }

    // Documentos DISTINTOS de la entrada (tipo + número, sin importar mayúsculas): un mismo
    // pedimento/factura puede cubrir varios renglones, pero su archivo se sube una sola vez.
    private static List<(string Tipo, string Numero)> DocumentosDeEntrada(CrearCompraDto dto) =>
        dto.Detalles
            .Where(d => !string.IsNullOrWhiteSpace(d.NumeroDocumento))
            .Select(d => (Tipo: string.IsNullOrWhiteSpace(d.TipoDocumento) ? "Pedimento" : d.TipoDocumento.Trim(),
                          Numero: d.NumeroDocumento!.Trim()))
            .DistinctBy(x => (x.Tipo.ToLowerInvariant(), x.Numero.ToLowerInvariant()))
            .ToList();

    private static string? TokenDe(CrearCompraDto dto, string tipo, string numero) =>
        dto.Archivos.FirstOrDefault(a =>
            string.Equals((string.IsNullOrWhiteSpace(a.TipoDocumento) ? "Pedimento" : a.TipoDocumento.Trim()), tipo, StringComparison.OrdinalIgnoreCase)
            && string.Equals(a.NumeroDocumento.Trim(), numero, StringComparison.OrdinalIgnoreCase))?.Token;

    // Cada documento de la entrada debe tener su archivo: ya guardado de una entrada anterior, o
    // subido ahora. Se valida ANTES de guardar nada, así una entrada sin sus documentos no queda registrada.
    private async Task<string?> ValidarArchivosDocumentosAsync(CrearCompraDto dto)
    {
        foreach (var (tipo, numero) in DocumentosDeEntrada(dto))
        {
            var existente = await _context.Documentos.Include(d => d.DocumentoTipo)
                .FirstOrDefaultAsync(d => d.Numero == numero && d.DocumentoTipo.Nombre.ToLower() == tipo.ToLower());
            if (existente?.ArchivoRuta != null) continue;
            if (!_archivos.ExisteTemporal(TokenDe(dto, tipo, numero)))
                return $"Falta subir el archivo del documento {tipo} {numero}";
        }
        return null;
    }

    // Liga a cada documento el archivo que se subió (lo mueve de temporal a su lugar definitivo).
    // Corre después de guardar la entrada; si algo falla en el disco la entrada ya existe, así que
    // se avisa para subirlo desde Pedimentos en vez de perder el registro.
    private async Task<List<string>> AdjuntarArchivosDocumentosAsync(CrearCompraDto dto)
    {
        var advertencias = new List<string>();
        foreach (var (tipo, numero) in DocumentosDeEntrada(dto))
        {
            try
            {
                var doc = await _context.Documentos.Include(d => d.DocumentoTipo)
                    .FirstOrDefaultAsync(d => d.Numero == numero && d.DocumentoTipo.Nombre.ToLower() == tipo.ToLower());
                var token = TokenDe(dto, tipo, numero);
                if (doc == null || doc.ArchivoRuta != null || token == null) continue;
                var adjunto = await _archivos.AdjuntarTemporalAsync(doc.Id, token);
                if (adjunto == null) { advertencias.Add($"No se encontró el archivo de {tipo} {numero}; súbelo desde Pedimentos"); continue; }
                doc.ArchivoRuta = adjunto.Value.Ruta;
                doc.ArchivoTipo = adjunto.Value.Tipo;
                doc.ArchivoNombre = adjunto.Value.Nombre;
                doc.FechaArchivo = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            catch (IOException)
            {
                advertencias.Add($"No se pudo guardar el archivo de {tipo} {numero}; súbelo desde Pedimentos");
            }
        }
        return advertencias;
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearCompraDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "compras", "crear"))
            return this.SinPermiso();
        var errorDetalles = ValidarDetallesCompra(dto);
        if (errorDetalles != null) return BadRequest(new { mensaje = errorDetalles });
        var errorArchivos = await ValidarArchivosDocumentosAsync(dto);
        if (errorArchivos != null) return BadRequest(new { mensaje = errorArchivos });
        var tipoMovimiento = await _context.TiposMovimiento
            .FirstOrDefaultAsync(t => t.Nombre.ToLower().Contains("compra"));
        if (tipoMovimiento == null)
            return BadRequest(new { mensaje = "No existe tipo de movimiento 'Compra'" });

        var historial = new HistorialMovimiento
        {
            FechaRegistro = DateTime.UtcNow,
            IdUsuario = this.IdUsuarioActual()
        };
        _context.HistorialesMovimiento.Add(historial);
        await _context.SaveChangesAsync();

        DetalleTransporte? detalleTransporte = null;
        if (dto.Transporte != null && (dto.Transporte.IdChofer != null || dto.Transporte.IdTractocamion != null))
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

        var detallesCreados = new List<DetalleMovimiento>();
        foreach (var detalle in dto.Detalles)
        {
            var producto = await _context.Productos.FindAsync(detalle.CodigoProducto);
            if (producto == null)
                return BadRequest(new { mensaje = $"No existe el producto {detalle.CodigoProducto}" });

            var existencia = new Existencia
            {
                Lote = detalle.Lote,
                CodigoProducto = detalle.CodigoProducto,
                Costo = detalle.Costo,
                Caducidad = detalle.Caducidad,
                IdDocumentoOrigen = await ResolverDocumentoOrigen(detalle.TipoDocumento, detalle.NumeroDocumento)
            };
            _context.Existencias.Add(existencia);
            await _context.SaveChangesAsync();

            var nuevoDetalle = new DetalleMovimiento
            {
                IdHistorial = historial.Id,
                IdExistencia = existencia.Id,
                Kilos = detalle.Kilos,
                IdTipoMovimiento = tipoMovimiento.Id,
                IdDireccion = detalle.IdDireccion,
                IdDepartamento = detalle.IdDepartamento,
                IdDetalleTransporte = detalleTransporte?.Id
            };
            _context.DetallesMovimiento.Add(nuevoDetalle);
            detallesCreados.Add(nuevoDetalle);

            var ubicacion = await _context.UbicacionesProducto
                .FirstOrDefaultAsync(u => u.IdExistencia == existencia.Id
                                       && u.IdDireccion == detalle.IdDireccion
                                       && u.IdDepartamento == detalle.IdDepartamento);
            if (ubicacion != null)
                ubicacion.CantidadKilos += detalle.Kilos;
            else
                _context.UbicacionesProducto.Add(new UbicacionProducto
                {
                    IdExistencia = existencia.Id,
                    IdDireccion = detalle.IdDireccion,
                    CantidadKilos = detalle.Kilos,
                    IdDepartamento = detalle.IdDepartamento
                });
        }

        var compra = new Compras
        {
            IdHistorialMovimiento = historial.Id,
            IdEmpresa = dto.IdEmpresa,
            UrlRemision = dto.UrlRemision,
            NumeroEmbarque = dto.NumeroEmbarque,
            NumeroContenedor = dto.NumeroContenedor,
            FolioEmpresa = string.IsNullOrWhiteSpace(dto.FolioEmpresa) ? null : dto.FolioEmpresa.Trim(),
            UrlFactura = dto.UrlFactura
        };

        _context.Compras.Add(compra);
        await _context.SaveChangesAsync();

        // Los archivos de los documentos quedan ligados a cada documento (pedimento/factura).
        var advertencias = await AdjuntarArchivosDocumentosAsync(dto);

        var detallesTexto = await ResolverDetalles(detallesCreados);
        await _auditoria.RegistrarAsync("compras", compra.Id.ToString(), "CREAR", null,
            await SnapshotCompra(compra, detallesTexto), dto.IdUsuario);

        return CreatedAtAction(nameof(GetPorId), new { id = compra.Id }, new { compra.Id, advertencias });
    }

    private static readonly string[] EstadosValidos =
        { "Solicitado", "Pendiente por recibir", "Pendiente por pagar", "Completado" };

    // PUT api/compras/5/estado — cambia solo el estado (solicitado/recibido/pagado/completado),
    // sin tocar detalles ni inventario.
    [HttpPut("{id}/estado")]
    public async Task<IActionResult> CambiarEstado(uint id, [FromBody] CambiarEstadoCompraDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "compras", "editar"))
            return this.SinPermiso();

        if (!EstadosValidos.Contains(dto.Estado))
            return BadRequest(new { mensaje = "Estado inválido" });

        var compra = await _context.Compras.FirstOrDefaultAsync(c => c.Id == id && c.Activo);
        if (compra == null) return NotFound();

        var antes = new { compra.Estado };
        compra.Estado = dto.Estado;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("compras", id.ToString(), "MODIFICAR", antes, new { compra.Estado }, dto.IdUsuario);

        return NoContent();
    }

    // GET api/compras/5/historial-estado — línea de tiempo de cómo fue avanzando el estado,
    // tomada directamente de la auditoría (CREAR + cada cambio de estado).
    [RequierePermiso("compras","ver")]
    [HttpGet("{id}/historial-estado")]
    public async Task<IActionResult> HistorialEstado(uint id)
    {
        var auditorias = await _context.Auditorias
            .Include(a => a.Usuario)
            .Where(a => a.Tabla == "compras" && a.IdRegistro == id.ToString() && a.DatosNuevos != null)
            .OrderBy(a => a.Fecha)
            .ToListAsync();

        var historial = new List<object>();
        foreach (var a in auditorias)
        {
            using var doc = JsonDocument.Parse(a.DatosNuevos!);
            if (doc.RootElement.TryGetProperty("Estado", out var estadoProp) && estadoProp.ValueKind == JsonValueKind.String)
            {
                historial.Add(new { Estado = estadoProp.GetString(), a.Fecha, Usuario = a.Usuario.Nombre });
            }
        }

        return Ok(historial);
    }

    // ¿Este lote ya lo usa algo más (otro movimiento, un embarque, producción)? Entonces no se puede cambiar de producto
    // ni de bodega, ni quitar.
    private async Task<bool> LoteEnUsoAsync(uint idExistencia, uint idDetalle) =>
        await _context.DetallesMovimiento.AnyAsync(x => x.IdExistencia == idExistencia && x.Id != idDetalle)
        || await _context.SolicitudesDetalle.AnyAsync(x => x.IdExistencia == idExistencia)
        || await _context.ProduccionInventario.AnyAsync(x => x.Activo && x.IdExistencia == idExistencia)
        || await _context.ProduccionReporte.AnyAsync(x => x.Activo && (x.IdExistenciaOrigen == idExistencia || x.IdExistenciaSalida == idExistencia || x.IdExistenciaExtra == idExistencia))
        || await _context.SolicitudesProduccion.AnyAsync(x => x.Activo && x.IdExistencia == idExistencia);

    // PUT api/compras/5 — modifica una entrada ya cargada a Conpaq. Los renglones que ya existían se modifican EN SU LUGAR
    // (el lote sigue siendo el mismo para embarques, documentos y producción): lote, costo, caducidad, documento y kilos
    // cambian sin problema mientras no dejen el stock del lote en negativo; el producto y la bodega solo cambian si
    // nadie más usa ese lote. Los renglones nuevos se agregan y los quitados solo si su lote no se ha usado.
    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearCompraDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "compras", "editar"))
            return this.SinPermiso();
        var errorDetalles = ValidarDetallesCompra(dto);
        if (errorDetalles != null) return BadRequest(new { mensaje = errorDetalles });
        var errorArchivos = await ValidarArchivosDocumentosAsync(dto);
        if (errorArchivos != null) return BadRequest(new { mensaje = errorArchivos });

        var compra = await _context.Compras
            .Include(c => c.HistorialMovimiento)
                .ThenInclude(h => h!.DetallesMovimiento)
            .FirstOrDefaultAsync(c => c.Id == id && c.Activo);
        if (compra == null) return NotFound();
        if (compra.FolioEmpresa != null)
            return BadRequest(new { mensaje = "Las entradas de una empresa en consignación se modifican desde su menú de Consignación" });

        var tipoMovimiento = await _context.TiposMovimiento
            .FirstOrDefaultAsync(t => t.Nombre.ToLower().Contains("compra"));
        if (tipoMovimiento == null)
            return BadRequest(new { mensaje = "No existe tipo de movimiento 'Compra'" });

        var existentes = compra.HistorialMovimiento!.DetallesMovimiento.ToList();
        var datosAnteriores = await SnapshotCompra(compra, await ResolverDetalles(existentes));

        // ── Emparejar los renglones del formulario con los que ya existían.
        var pares = new List<(DetalleMovimiento Detalle, CrearDetalleCompraDto Nuevo)>();
        var nuevos = new List<CrearDetalleCompraDto>();
        foreach (var n in dto.Detalles)
        {
            var viejo = n.IdDetalle.HasValue ? existentes.FirstOrDefault(d => d.Id == n.IdDetalle.Value) : null;
            if (viejo != null && pares.All(p => p.Detalle.Id != viejo.Id)) pares.Add((viejo, n));
            else nuevos.Add(n);
        }
        var quitados = existentes.Where(d => pares.All(p => p.Detalle.Id != d.Id)).ToList();

        // ── Validar todo ANTES de tocar nada.
        foreach (var n in dto.Detalles)
            if (await _context.Productos.FindAsync(n.CodigoProducto) == null)
                return BadRequest(new { mensaje = $"No existe el producto {n.CodigoProducto}" });

        foreach (var d in quitados)
        {
            var ub = await _context.UbicacionesProducto.FirstOrDefaultAsync(u => u.IdExistencia == d.IdExistencia && u.IdDireccion == d.IdDireccion && u.IdDepartamento == d.IdDepartamento);
            var lote = (await _context.Existencias.FindAsync(d.IdExistencia))?.Lote;
            if ((ub?.CantidadKilos ?? 0) + 0.0005m < d.Kilos || (d.IdExistencia.HasValue && await LoteEnUsoAsync(d.IdExistencia.Value, d.Id)))
                return BadRequest(new { mensaje = $"El lote {lote} ya se usó (embarques, producción u otros movimientos): no se puede quitar de la entrada." });
        }
        foreach (var (d, n) in pares)
        {
            var ex = await _context.Existencias.FindAsync(d.IdExistencia);
            var cambiaProducto = ex!.CodigoProducto != n.CodigoProducto;
            var cambiaBodega = d.IdDireccion != n.IdDireccion || d.IdDepartamento != n.IdDepartamento;
            if ((cambiaProducto || cambiaBodega) && await LoteEnUsoAsync(d.IdExistencia!.Value, d.Id))
                return BadRequest(new { mensaje = $"El lote {ex.Lote} ya se usó (embarques, producción u otros movimientos): no se puede cambiar su producto ni su bodega." });
            var ub = await _context.UbicacionesProducto.FirstOrDefaultAsync(u => u.IdExistencia == d.IdExistencia && u.IdDireccion == d.IdDireccion && u.IdDepartamento == d.IdDepartamento);
            var nuevoStock = (ub?.CantidadKilos ?? 0) + (n.Kilos - d.Kilos);
            if (nuevoStock < -0.0005m)
                return BadRequest(new { mensaje = $"Del lote {ex.Lote} ya salieron {d.Kilos - (ub?.CantidadKilos ?? 0):0.###} kg: no puedes dejar la entrada en menos de eso." });
        }

        // ── Aplicar.
        foreach (var d in quitados)
        {
            var ub = await _context.UbicacionesProducto.FirstOrDefaultAsync(u => u.IdExistencia == d.IdExistencia && u.IdDireccion == d.IdDireccion && u.IdDepartamento == d.IdDepartamento);
            if (ub != null) ub.CantidadKilos -= d.Kilos;
            var ex = await _context.Existencias.FindAsync(d.IdExistencia);
            if (ex != null) ex.Activo = false;
            _context.DetallesMovimiento.Remove(d);
        }
        foreach (var (d, n) in pares)
        {
            var ex = (await _context.Existencias.FindAsync(d.IdExistencia))!;
            var ub = await _context.UbicacionesProducto.FirstOrDefaultAsync(u => u.IdExistencia == d.IdExistencia && u.IdDireccion == d.IdDireccion && u.IdDepartamento == d.IdDepartamento);
            ex.Lote = n.Lote.Trim();
            ex.CodigoProducto = n.CodigoProducto;
            ex.Costo = n.Costo;
            ex.Caducidad = n.Caducidad;
            ex.IdDocumentoOrigen = await ResolverDocumentoOrigen(n.TipoDocumento, n.NumeroDocumento);
            if (d.IdDireccion != n.IdDireccion || d.IdDepartamento != n.IdDepartamento)
            {
                // Solo llega aquí si nadie más usa el lote: el stock se mueve completo a la nueva bodega.
                if (ub != null) _context.UbicacionesProducto.Remove(ub);
                _context.UbicacionesProducto.Add(new UbicacionProducto
                {
                    IdExistencia = ex.Id, IdDireccion = n.IdDireccion, IdDepartamento = n.IdDepartamento, CantidadKilos = n.Kilos
                });
                d.IdDireccion = n.IdDireccion;
                d.IdDepartamento = n.IdDepartamento;
            }
            else if (ub != null)
                ub.CantidadKilos += n.Kilos - d.Kilos;
            d.Kilos = n.Kilos;
        }
        await _context.SaveChangesAsync();

        // Transporte: se actualiza el que tenía la entrada o se crea.
        var idsTransporte = compra.HistorialMovimiento.DetallesMovimiento.Where(d => d.IdDetalleTransporte != null).Select(d => d.IdDetalleTransporte!.Value).Distinct().ToList();
        var transporte = idsTransporte.Count > 0 ? await _context.DetallesTransporte.FirstOrDefaultAsync(t => t.Id == idsTransporte[0]) : null;
        var traeTransporte = dto.Transporte != null && (dto.Transporte.IdChofer != null || dto.Transporte.IdTractocamion != null);
        if (traeTransporte)
        {
            if (transporte == null)
            {
                transporte = new DetalleTransporte();
                _context.DetallesTransporte.Add(transporte);
            }
            transporte.IdChofer = dto.Transporte!.IdChofer;
            transporte.IdTractocamion = dto.Transporte.IdTractocamion;
            transporte.IdCaja = dto.Transporte.IdCaja;
            await _context.SaveChangesAsync();
        }

        // Los renglones nuevos (el lote y sus tablas se crean como en una entrada nueva).
        foreach (var n in nuevos)
        {
            var existencia = new Existencia
            {
                Lote = n.Lote.Trim(),
                CodigoProducto = n.CodigoProducto,
                Costo = n.Costo,
                Caducidad = n.Caducidad,
                IdDocumentoOrigen = await ResolverDocumentoOrigen(n.TipoDocumento, n.NumeroDocumento)
            };
            _context.Existencias.Add(existencia);
            await _context.SaveChangesAsync();
            _context.DetallesMovimiento.Add(new DetalleMovimiento
            {
                IdHistorial = compra.HistorialMovimiento.Id, IdExistencia = existencia.Id, Kilos = n.Kilos, IdTipoMovimiento = tipoMovimiento.Id,
                IdDireccion = n.IdDireccion, IdDepartamento = n.IdDepartamento, IdDetalleTransporte = transporte?.Id
            });
            _context.UbicacionesProducto.Add(new UbicacionProducto
            {
                IdExistencia = existencia.Id, IdDireccion = n.IdDireccion, CantidadKilos = n.Kilos, IdDepartamento = n.IdDepartamento
            });
        }
        // Los renglones que ya existían pasan al transporte actual (o lo pierden si se quitó).
        foreach (var (d, _) in pares) d.IdDetalleTransporte = traeTransporte ? transporte?.Id : null;

        compra.IdEmpresa = dto.IdEmpresa;
        compra.UrlRemision = dto.UrlRemision;
        compra.NumeroEmbarque = dto.NumeroEmbarque;
        compra.NumeroContenedor = dto.NumeroContenedor;
        compra.UrlFactura = dto.UrlFactura;
        compra.HistorialMovimiento.IdUsuario = this.IdUsuarioActual();

        await _context.SaveChangesAsync();
        var advertencias = await AdjuntarArchivosDocumentosAsync(dto);

        // Registrar auditoría
        var detallesFinales = await _context.DetallesMovimiento.Where(d => d.IdHistorial == compra.HistorialMovimiento.Id).ToListAsync();
        var datosNuevos = await SnapshotCompra(compra, await ResolverDetalles(detallesFinales));
        await _auditoria.RegistrarAsync("compras", id.ToString(), "MODIFICAR", datosAnteriores, datosNuevos, dto.IdUsuario);

        return Ok(new { advertencias });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id, [FromQuery] uint idUsuario)
    {
        if (!await _permisoService.TienePermisoAsync(idUsuario, "compras", "eliminar"))
            return this.SinPermiso();
        var compra = await _context.Compras
            .Include(c => c.HistorialMovimiento)
                .ThenInclude(h => h!.DetallesMovimiento)
            .FirstOrDefaultAsync(c => c.Id == id && c.Activo);

        if (compra == null) return NotFound();

        var datosAnteriores = await SnapshotCompra(compra, await ResolverDetalles(compra.HistorialMovimiento!.DetallesMovimiento));

        // Revertir stock
        foreach (var detalle in compra.HistorialMovimiento!.DetallesMovimiento)
        {
            var ubicacion = await _context.UbicacionesProducto
                .FirstOrDefaultAsync(u => u.IdExistencia == detalle.IdExistencia
                                       && u.IdDireccion == detalle.IdDireccion
                                       && u.IdDepartamento == detalle.IdDepartamento);
            if (ubicacion != null)
                ubicacion.CantidadKilos -= detalle.Kilos;
        }

        // Soft delete
        compra.Activo = false;
        foreach (var detalle in compra.HistorialMovimiento.DetallesMovimiento)
        {
            var existencia = await _context.Existencias.FindAsync(detalle.IdExistencia);
            if (existencia != null) existencia.Activo = false;
        }

        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("compras", id.ToString(), "ELIMINAR", datosAnteriores, null, idUsuario);

        return NoContent();
    }
}