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
    private readonly ConfiguracionDocumentosService _documentos;

    public EmbarquesController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService,
        PedidosConsignacionService pedidos, ConfiguracionDocumentosService documentos)
    {
        _pedidos = pedidos;
        _documentos = documentos;
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
    }

    // Convierte los DetalleMovimiento (solo guardan IdExistencia) en algo legible para la
    // auditoría: código de producto, descripción y kilos — nada de ids sueltos.
    private Task<List<object>> ResolverDetalles(IEnumerable<DetalleMovimiento> detalles) =>
        Empresa.Intranet.API.Servicios.AuditoriaDetalles.LineasAsync(_context, detalles);

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
        e.IdDireccionOrigen,
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

    private static string Normalizar(string? t) =>
        new string((t ?? "").Trim().ToLowerInvariant().Normalize(System.Text.NormalizationForm.FormD)
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark).ToArray());

    // Origen predeterminado de un embarque: la dirección de Ensenada de la empresa interna (el que la Requisición trae
    // preseleccionado). Si un embarque no tiene origen guardado, ese es el que vale.
    private async Task<Direccion?> OrigenPredeterminadoAsync()
    {
        var internas = await _context.Direcciones.AsNoTracking().Include(d => d.Empresa)
            .Where(d => d.Activo && d.Empresa != null
                && ((d.Empresa.Tipo != null && d.Empresa.Tipo.ToLower() == "interna") || d.Empresa.Nombre.ToLower().Contains("granjamar")))
            .OrderBy(d => d.Id).ToListAsync();
        return internas.FirstOrDefault(d => Normalizar(d.Municipio).Contains("ensenada"))
            ?? internas.FirstOrDefault(d => Normalizar(d.DireccionTexto).Contains("ensenada"));
    }

    private static string? Texto(string? t) => string.IsNullOrWhiteSpace(t) ? null : t.Trim();

    // GET api/embarques/5/requisicion — todo lo que lleva la hoja de Requisición de ese embarque (destino) ya armado:
    // una "página" por lugar de origen (con su destino, tipo de salida y productos), el transporte y la lista de datos
    // que faltan. La hoja se puede generar aunque falte algo: la pantalla avisa antes de descargar.
    [RequierePermiso("embarques", "ver")]
    [HttpGet("{id}/requisicion")]
    public async Task<IActionResult> GetRequisicion(uint id)
    {
        var e = await _context.Embarques.AsNoTracking()
            .Include(x => x.HistorialMovimiento).ThenInclude(h => h.DetallesMovimiento).ThenInclude(d => d.Existencia)
            .Include(x => x.Direccion).ThenInclude(d => d!.Empresa)
            .Include(x => x.Cliente)
            .Include(x => x.DireccionOrigen).ThenInclude(d => d!.Empresa)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Chofer)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Tractocamion).ThenInclude(t => t!.Marca)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Tractocamion).ThenInclude(t => t!.Empresa)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Caja)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == id && x.Activo);
        if (e == null) return NotFound();

        var faltantes = new List<string>();
        void Falta(string texto) { if (!faltantes.Contains(texto)) faltantes.Add(texto); }
        if (Texto(e.Numero) == null) Falta("Número de embarque");

        // Destino: una dirección (con su empresa) o un cliente.
        string? destEmpresa, destRfc, destDireccion, destMunicipio, destEstado, destSegmento = null;
        if (e.Cliente != null)
        {
            var c = e.Cliente;
            destEmpresa = Texto(c.Nombre);
            destRfc = Texto(c.Rfc);
            destDireccion = Texto(string.Join(", ", new[] { c.Calle, c.Colonia, string.IsNullOrWhiteSpace(c.CodigoPostal) ? null : $"C.P. {c.CodigoPostal}" }
                .Where(x => !string.IsNullOrWhiteSpace(x))));
            destMunicipio = Texto(c.Municipio);
            destEstado = Texto(c.Estado);
        }
        else
        {
            var d = e.Direccion;
            destEmpresa = Texto(d?.Empresa?.Nombre);
            destRfc = Texto(d?.Empresa?.Rfc);
            destDireccion = Texto(d?.DireccionTexto);
            destMunicipio = Texto(d?.Municipio);
            destEstado = Texto(d?.Estado);
            destSegmento = Texto(d?.Segmento);
        }
        if (destEmpresa == null) Falta("Nombre del destinatario");
        if (destRfc == null) Falta("RFC del destinatario");
        if (destDireccion == null) Falta("Dirección del destino");
        if (destMunicipio == null || destEstado == null) Falta("Ciudad y estado del destino");

        // Remitente / origen: el que se elige arriba en la Requisición, junto al No. de embarque (NO el lugar de donde
        // sale cada producto). Sin él, esos campos van en blanco y se avisa.
        var o = e.DireccionOrigen ?? await OrigenPredeterminadoAsync();
        var oEmpresa = Texto(o?.Empresa?.Nombre);
        var oRfc = Texto(o?.Empresa?.Rfc);
        var oDireccion = Texto(o?.DireccionTexto);
        var oMunicipio = Texto(o?.Municipio);
        var oEstado = Texto(o?.Estado);
        var oSegmento = Texto(o?.Segmento);
        if (o == null) Falta("Origen del embarque (se elige arriba en la Requisición, junto al No. de embarque)");
        else
        {
            if (oEmpresa == null) Falta("Nombre del remitente");
            if (oRfc == null) Falta("RFC del remitente");
            if (oDireccion == null) Falta("Dirección del origen");
            if (oMunicipio == null || oEstado == null) Falta("Ciudad y estado del origen");
        }

        // Un renglón por producto (la hoja no distingue de qué ubicación sale cada uno).
        var detalles = e.HistorialMovimiento.DetallesMovimiento.OrderBy(d => d.Id).ToList();
        if (detalles.Count == 0) Falta("Productos (el embarque no tiene)");
        var codigos = detalles.Select(d => d.CodigoProducto ?? d.Existencia?.CodigoProducto).Where(c => c != null).Distinct().ToList();
        var productos = await _context.Productos.AsNoTracking()
            .Include(p => p.Especie).Include(p => p.Marca).Include(p => p.Talla).Include(p => p.PesoCaja)
            .Include(p => p.Descripciones).ThenInclude(d => d.Presentacion)
            .Where(p => codigos.Contains(p.Codigo)).ToDictionaryAsync(p => p.Codigo);
        var renglones = new List<object>();
        foreach (var g in detalles.GroupBy(d => d.CodigoProducto ?? d.Existencia?.CodigoProducto))
        {
            if (g.Key == null || !productos.TryGetValue(g.Key, out var p)) continue;
            var kilos = g.Sum(d => d.Kilos);
            var peso = p.PesoCaja?.Peso ?? 0;
            if (peso <= 0) Falta($"Peso por caja de {p.Codigo} (no se puede calcular su número de cajas)");
            var presentaciones = p.Descripciones.Select(d => d.Presentacion.Nombre).Where(n => !string.IsNullOrWhiteSpace(n));
            renglones.Add(new
            {
                Codigo = p.Codigo,
                Descripcion = string.Join(" ", new[] { p.Especie.Nombre }.Concat(presentaciones)),
                Marca = p.Marca?.Nombre,
                Medida = p.Talla?.Descripcion,
                PesoCaja = peso > 0 ? peso : (decimal?)null,
                Cajas = peso > 0 ? Math.Round(kilos / peso, 2) : (decimal?)null,
                Kilos = kilos
            });
        }

        // Local = misma ciudad; Al interior = otra ciudad del mismo estado; Nacional = otro estado.
        string? ambito = null;
        if (oMunicipio != null && oEstado != null && destMunicipio != null && destEstado != null)
            ambito = Normalizar(oEstado) != Normalizar(destEstado) ? "Nacional"
                : Normalizar(oMunicipio) == Normalizar(destMunicipio) ? "Local" : "Al interior";

        var paginas = new List<object>
        {
            new
            {
                Origen = new { Empresa = oEmpresa, Rfc = oRfc, Segmento = oSegmento, Direccion = oDireccion, Municipio = oMunicipio, Estado = oEstado },
                Ambito = ambito,
                Productos = renglones
            }
        };

        // Datos fijos de la hoja (título, quienes firman…): se editan en Admin → Documentos.
        var config = await _documentos.ObtenerAsync(ConfiguracionDocumentosService.Requisicion);
        foreach (var (clave, rotulo) in new[] { ("Despacho", "despacha"), ("Reviso", "revisa"), ("Autorizo", "autoriza") })
            if (string.IsNullOrWhiteSpace(config[clave])) Falta($"Nombre de quien {rotulo} (Admin → Documentos)");

        // Transporte.
        var dt = e.DetalleTransporte;
        var chofer = dt?.Chofer;
        var tracto = dt?.Tractocamion;
        var caja = dt?.Caja;
        if (chofer == null) Falta("Operador (nombre y teléfono)");
        else
        {
            if (Texto(chofer.NumeroTelefono) == null) Falta("Teléfono del operador");
            if (Texto(chofer.TipoTelefono) == null) Falta("Tipo de teléfono del operador");
        }
        if (tracto == null) Falta("Tractocamión (compañía, placas, modelo, marca y color)");
        else
        {
            if (Texto(tracto.Empresa?.Nombre) == null) Falta("Compañía de transporte");
            if (Texto(tracto.Placa) == null) Falta("Placas del tractor");
        }
        if (caja == null) Falta("Caja (placas, tamaño y capacidad)");
        else
        {
            if (Texto(caja.CajaPlaca) == null) Falta("Placas de la caja");
            if (Texto(caja.CajaTamano) == null) Falta("Tamaño de la caja");
            if (caja.CajaCapacidad == null) Falta("Capacidad de la caja");
        }

        return Ok(new
        {
            e.Id,
            e.Numero,
            Fecha = e.HistorialMovimiento.FechaRegistro,
            Destino = new { Empresa = destEmpresa, Rfc = destRfc, Segmento = destSegmento, Direccion = destDireccion, Municipio = destMunicipio, Estado = destEstado },
            // Traspaso entre almacenes (a una bodega/empresa) o venta directa (a un cliente).
            TipoSalida = e.Cliente != null ? "Venta directa" : "Traspaso entre almacenes",
            Paginas = paginas,
            Configuracion = config,
            Transporte = new
            {
                Nombre = Texto(chofer?.Nombre),
                Compania = Texto(tracto?.Empresa?.Nombre),
                Telefono = Texto(chofer?.NumeroTelefono),
                TipoTelefono = Texto(chofer?.TipoTelefono),
                Modelo = tracto?.Modelo,
                Marca = Texto(tracto?.Marca?.Nombre),
                Color = Texto(tracto?.Color),
                PlacasTractor = Texto(tracto?.Placa),
                PlacasCaja = Texto(caja?.CajaPlaca),
                TamanoCaja = Texto(caja?.CajaTamano),
                CapacidadKg = caja?.CajaCapacidad
            },
            Faltantes = faltantes
        });
    }

    // GET api/embarques/5/solicitud-documento — todo lo que lleva la hoja de Solicitud del embarque (de TODOS sus destinos:
    // un número de embarque compartido es un solo documento con un bloque por destino) ya armado, más la lista de datos
    // que faltan. La hoja se puede generar aunque falte algo: la pantalla avisa antes de descargar.
    [RequierePermiso("embarques", "ver")]
    [HttpGet("{id}/solicitud-documento")]
    public async Task<IActionResult> GetSolicitudDocumento(uint id)
    {
        var actual = await _context.Embarques.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.Activo);
        if (actual == null) return NotFound();

        var hermanos = await _context.Embarques.AsNoTracking()
            .Include(x => x.HistorialMovimiento).ThenInclude(h => h.DetallesMovimiento).ThenInclude(d => d.Existencia)
            .Include(x => x.SolicitudDetalles).ThenInclude(d => d.Existencia)
            .Include(x => x.SolicitudTarimas)
            .Include(x => x.Direccion).ThenInclude(d => d!.Empresa)
            .Include(x => x.Cliente)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Chofer)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Tractocamion).ThenInclude(t => t!.Marca)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Tractocamion).ThenInclude(t => t!.Empresa)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Caja)
            .Where(x => x.Activo && (actual.Numero == null ? x.Id == id : x.Numero == actual.Numero))
            .OrderBy(x => x.Id)
            .AsSplitQuery()
            .ToListAsync();

        var faltantes = new List<string>();
        void Falta(string texto) { if (!faltantes.Contains(texto)) faltantes.Add(texto); }
        if (Texto(actual.Numero) == null) Falta("Número de embarque");

        var codigos = hermanos.SelectMany(h => h.HistorialMovimiento.DetallesMovimiento.Select(d => d.CodigoProducto ?? d.Existencia?.CodigoProducto)
                .Concat(h.SolicitudDetalles.Select(d => d.Existencia.CodigoProducto))
                .Concat(h.SolicitudTarimas.Select(t => (string?)t.CodigoProducto)))
            .Where(c => c != null).Distinct().ToList();
        var productos = await _context.Productos.AsNoTracking()
            .Include(p => p.Especie).Include(p => p.Marca).Include(p => p.Talla)
            .Include(p => p.Descripciones).ThenInclude(d => d.Presentacion)
            .Where(p => codigos.Contains(p.Codigo)).ToDictionaryAsync(p => p.Codigo);

        static string Num(decimal n) => n.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
        // Como se escriben en la hoja: "ESPECIE TALLA MARCA PRESENTACIÓN" (ej. "TILAPIA 350/550 GMR 100%"), sin el peso de la caja.
        string Descripcion(string codigo)
        {
            return productos.TryGetValue(codigo, out var p) ? DescripcionHoja(p) : codigo;
        }

        var destinos = new List<object>();
        decimal totalKilos = 0;
        int totalTarimas = 0;
        foreach (var (h, indice) in hermanos.Select((h, i) => (h, i)))
        {
            // Destino: a quién va (recuadro oscuro) y a dónde (encabezado de la columna de kilos).
            string? empresa, etiqueta;
            if (h.Cliente != null) { empresa = Texto(h.Cliente.Nombre); etiqueta = Texto(h.Cliente.Municipio) ?? Texto(h.Cliente.Nombre); }
            else { empresa = Texto(h.Direccion?.Empresa?.Nombre); etiqueta = Texto(h.Direccion?.DireccionTexto) ?? Texto(h.Direccion?.Municipio); }
            var nombreDestino = hermanos.Count > 1 ? $" del destino {indice + 1}" : "";
            if (empresa == null) Falta($"Nombre del destinatario{nombreDestino}");
            if (etiqueta == null) Falta($"Nombre o ciudad del destino{(hermanos.Count > 1 ? $" {indice + 1}" : "")}");

            var planeados = h.HistorialMovimiento.DetallesMovimiento.OrderBy(d => d.Id).ToList();
            var capturada = h.SolicitudDetalles.Count > 0;
            if (planeados.Count == 0 && !capturada) Falta($"Productos{nombreDestino} (el embarque no tiene)");
            else if (!capturada) Falta($"Solicitud{nombreDestino} sin capturar (lotes y tarimas)");

            // Un renglón por producto y ubicación de origen, en el orden de la Requisición.
            var claves = new List<(string Codigo, uint? Direccion)>();
            foreach (var d in planeados)
            {
                var c = d.CodigoProducto ?? d.Existencia?.CodigoProducto;
                if (c != null && !claves.Contains((c, d.IdDireccion))) claves.Add((c, d.IdDireccion));
            }
            foreach (var d in h.SolicitudDetalles.OrderBy(d => d.Id))
                if (!claves.Contains((d.Existencia.CodigoProducto, d.IdDireccion))) claves.Add((d.Existencia.CodigoProducto, d.IdDireccion));

            var renglones = new List<object>();
            foreach (var (codigo, dir) in claves)
            {
                var detalles = h.SolicitudDetalles.Where(d => d.Existencia.CodigoProducto == codigo && d.IdDireccion == dir).ToList();
                var kilos = detalles.Count > 0 ? detalles.Sum(d => d.Kilos)
                    : planeados.Where(d => (d.CodigoProducto ?? d.Existencia?.CodigoProducto) == codigo && d.IdDireccion == dir).Sum(d => d.Kilos);
                var tarimas = h.SolicitudTarimas.Where(t => t.CodigoProducto == codigo && t.IdDireccion == dir).OrderBy(t => t.Id).ToList();
                var numTarimas = tarimas.Sum(t => t.NumTarimas);
                if (capturada && tarimas.Count == 0) Falta($"Tarimas de {codigo}{nombreDestino}");
                var especificaciones = string.Join(" / ", detalles.Select(d => Texto(d.LoteEspecificaciones)).Where(x => x != null).Distinct());
                totalKilos += kilos;
                totalTarimas += numTarimas;
                renglones.Add(new
                {
                    Codigo = codigo,
                    Descripcion = Descripcion(codigo),
                    Kilos = kilos,
                    // "9X90" = 9 tarimas de 90 cajas; varias desiguales van unidas con guion ("4X198-1X179").
                    Tarimas = string.Join("-", tarimas.Select(t => $"{t.NumTarimas}X{Num(t.CajasPorTarima)}")),
                    NumTarimas = numTarimas,
                    Lotes = especificaciones
                });
            }
            destinos.Add(new { h.Id, Empresa = empresa, Etiqueta = etiqueta, Productos = renglones });
        }

        // Transporte (el mismo para todos los destinos del embarque).
        var dt = hermanos.Select(h => h.DetalleTransporte).FirstOrDefault(x => x != null);
        var chofer = dt?.Chofer;
        var tracto = dt?.Tractocamion;
        var caja = dt?.Caja;
        if (chofer == null) Falta("Operador (nombre y celular)");
        else if (Texto(chofer.NumeroTelefono) == null) Falta("Celular del operador");
        if (tracto == null) Falta("Tractocamión (compañía, marca, color, modelo y placas)");
        else
        {
            if (Texto(tracto.Empresa?.Nombre) == null) Falta("Compañía de transporte");
            if (Texto(tracto.Placa) == null) Falta("Placas del tractor");
        }
        if (caja == null || Texto(caja.CajaPlaca) == null) Falta("Placas de la caja");

        return Ok(new
        {
            actual.Numero,
            Fecha = hermanos.Select(h => h.HistorialMovimiento.FechaRegistro).DefaultIfEmpty(DateTime.UtcNow).Min(),
            Transportes = Texto(tracto?.Empresa?.Nombre),
            Configuracion = await _documentos.ObtenerAsync(ConfiguracionDocumentosService.Solicitud),
            Destinos = destinos,
            TotalKilos = totalKilos,
            TotalTarimas = totalTarimas,
            Transporte = new
            {
                Operador = Texto(chofer?.Nombre),
                Celular = Texto(chofer?.NumeroTelefono),
                // "VOLVO ROJO 2019"
                Tracto = Texto(string.Join(" ", new[] { tracto?.Marca?.Nombre, tracto?.Color, tracto?.Modelo.ToString() }.Where(x => !string.IsNullOrWhiteSpace(x)))),
                PlacasTractor = Texto(tracto?.Placa),
                PlacasCaja = Texto(caja?.CajaPlaca),
                // Los que se capturan al generar la Carta responsiva ("0045871 / 0045872"); en blanco si aún no se capturan.
                Sellos = Texto(string.Join(" / ", hermanos.SelectMany(h => new[] { Texto(h.SelloSeguridad1), Texto(h.SelloSeguridad2) }).Where(s => s != null).Distinct()))
            },
            Faltantes = faltantes
        });
    }

    // GET api/embarques/5/ciego-documento — lo que lleva la hoja de Ciego de carga: una fila por TARIMA física (las que se
    // capturaron en la Solicitud) con su producto, sus cajas, sus kilos y a qué sucursal va; de todos los destinos del
    // mismo número de embarque. DESTINO (arriba) es la empresa a la que se manda y SUCURSAL la ciudad donde está ubicada.
    [RequierePermiso("embarques", "ver")]
    [HttpGet("{id}/ciego-documento")]
    public async Task<IActionResult> GetCiegoDocumento(uint id)
    {
        var actual = await _context.Embarques.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.Activo);
        if (actual == null) return NotFound();

        var hermanos = await _context.Embarques.AsNoTracking()
            .Include(x => x.HistorialMovimiento)
            .Include(x => x.SolicitudDetalles).ThenInclude(d => d.Existencia)
            .Include(x => x.SolicitudTarimas)
            .Include(x => x.Direccion).ThenInclude(d => d!.Empresa)
            .Include(x => x.Cliente)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Chofer)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Tractocamion).ThenInclude(t => t!.Empresa)
            .Where(x => x.Activo && (actual.Numero == null ? x.Id == id : x.Numero == actual.Numero))
            .OrderBy(x => x.Id)
            .AsSplitQuery()
            .ToListAsync();

        var faltantes = new List<string>();
        void Falta(string texto) { if (!faltantes.Contains(texto)) faltantes.Add(texto); }
        if (Texto(actual.Numero) == null) Falta("Número de embarque");

        var codigos = hermanos.SelectMany(h => h.SolicitudTarimas.Select(t => t.CodigoProducto)).Distinct().ToList();
        var productos = await _context.Productos.AsNoTracking()
            .Include(p => p.Especie).Include(p => p.Marca).Include(p => p.Talla).Include(p => p.PesoCaja)
            .Include(p => p.Descripciones).ThenInclude(d => d.Presentacion)
            .Where(p => codigos.Contains(p.Codigo)).ToDictionaryAsync(p => p.Codigo);

        var filas = new List<object>();
        var empresas = new List<string>();
        var sucursales = new List<string>();
        decimal totalKilos = 0;
        var numero = 0;
        foreach (var (h, indice) in hermanos.Select((h, i) => (h, i)))
        {
            // DESTINO = la empresa; SUCURSAL = dónde está ubicada (su ciudad).
            string? empresa, sucursal;
            if (h.Cliente != null) { empresa = Texto(h.Cliente.Nombre); sucursal = Texto(h.Cliente.Municipio); }
            else { empresa = Texto(h.Direccion?.Empresa?.Nombre); sucursal = Texto(h.Direccion?.Municipio) ?? Texto(h.Direccion?.DireccionTexto); }
            var nombreDestino = hermanos.Count > 1 ? $" del destino {indice + 1}" : "";
            if (empresa == null) Falta($"Nombre del destinatario{nombreDestino}");
            else if (!empresas.Contains(empresa)) empresas.Add(empresa);
            if (sucursal == null) Falta($"Sucursal (ciudad) del destino{(hermanos.Count > 1 ? $" {indice + 1}" : "")}");
            else if (!sucursales.Contains(sucursal)) sucursales.Add(sucursal);
            if (h.SolicitudTarimas.Count == 0) { Falta($"Tarimas{nombreDestino} (la Solicitud no se ha capturado)"); continue; }

            // Las tarimas de un mismo producto y ubicación van juntas, en el orden en que se capturaron.
            var grupos = h.SolicitudTarimas.OrderBy(t => t.Id).GroupBy(t => (t.CodigoProducto, t.IdDireccion)).ToList();
            foreach (var g in grupos)
            {
                var codigo = g.Key.CodigoProducto;
                productos.TryGetValue(codigo, out var p);
                var peso = p?.PesoCaja?.Peso ?? 0;
                // Sin peso por caja se reparten los kilos de la Solicitud entre las cajas del producto.
                var cajasGrupo = g.Sum(t => t.NumTarimas * t.CajasPorTarima);
                var kilosSolicitud = h.SolicitudDetalles.Where(d => d.Existencia.CodigoProducto == codigo && d.IdDireccion == g.Key.IdDireccion).Sum(d => d.Kilos);
                if (peso <= 0 && cajasGrupo > 0 && kilosSolicitud > 0) peso = kilosSolicitud / cajasGrupo;
                if (peso <= 0) Falta($"Peso por caja de {codigo} (no se pueden calcular los kilos de sus tarimas)");
                var descripcion = p != null ? DescripcionHoja(p) : codigo;
                foreach (var t in g)
                    for (var i = 0; i < t.NumTarimas; i++)
                    {
                        var kilos = Math.Round(t.CajasPorTarima * peso, 2);
                        totalKilos += kilos;
                        filas.Add(new { Tarima = ++numero, Producto = descripcion, Cajas = t.CajasPorTarima, Kilos = kilos, Destino = sucursal, Grupo = indice });
                    }
            }
        }

        var dt = hermanos.Select(h => h.DetalleTransporte).FirstOrDefault(x => x != null);
        var chofer = dt?.Chofer;
        var tracto = dt?.Tractocamion;
        if (chofer == null || Texto(chofer.Nombre) == null) Falta("Operador");
        if (Texto(tracto?.Empresa?.Nombre) == null) Falta("Compañía de transporte");

        return Ok(new
        {
            actual.Numero,
            Fecha = hermanos.Select(h => h.HistorialMovimiento.FechaRegistro).DefaultIfEmpty(DateTime.UtcNow).Min(),
            Configuracion = await _documentos.ObtenerAsync(ConfiguracionDocumentosService.Ciego),
            Destino = string.Join(" / ", empresas),
            Sucursal = string.Join(" / ", sucursales),
            Transportes = Texto(tracto?.Empresa?.Nombre),
            Operador = Texto(chofer?.Nombre),
            Tarimas = filas,
            TotalKilos = totalKilos,
            Faltantes = faltantes
        });
    }

    // GET api/embarques/5/carta-documento — lo que lleva la Carta responsiva de los sellos de seguridad: la fecha, el destino
    // final (la ciudad de cada destino del mismo número de embarque), los números de sello y la compañía de transporte
    // que firma. La carta es de la unidad de carga, así que es una sola por número de embarque.
    [RequierePermiso("embarques", "ver")]
    [HttpGet("{id}/carta-documento")]
    public async Task<IActionResult> GetCartaDocumento(uint id)
    {
        var actual = await _context.Embarques.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.Activo);
        if (actual == null) return NotFound();

        var hermanos = await _context.Embarques.AsNoTracking()
            .Include(x => x.HistorialMovimiento)
            .Include(x => x.Direccion)
            .Include(x => x.Cliente)
            .Include(x => x.DetalleTransporte).ThenInclude(dt => dt!.Tractocamion).ThenInclude(t => t!.Empresa)
            .Where(x => x.Activo && (actual.Numero == null ? x.Id == id : x.Numero == actual.Numero))
            .OrderBy(x => x.Id)
            .AsSplitQuery()
            .ToListAsync();

        var faltantes = new List<string>();
        void Falta(string texto) { if (!faltantes.Contains(texto)) faltantes.Add(texto); }

        var sello1 = hermanos.Select(h => Texto(h.SelloSeguridad1)).FirstOrDefault(s => s != null);
        var sello2 = hermanos.Select(h => Texto(h.SelloSeguridad2)).FirstOrDefault(s => s != null);
        if (sello1 == null) Falta("Número de sello de seguridad (al menos uno)");

        var destinos = new List<string>();
        foreach (var h in hermanos)
        {
            var lugar = h.Cliente != null
                ? string.Join(", ", new[] { Texto(h.Cliente.Municipio), Texto(h.Cliente.Estado) }.Where(x => x != null))
                : string.Join(", ", new[] { Texto(h.Direccion?.Municipio), Texto(h.Direccion?.Estado) }.Where(x => x != null));
            if (lugar.Length > 0 && !destinos.Contains(lugar)) destinos.Add(lugar);
        }
        if (destinos.Count == 0) Falta("Destino final (ciudad y estado)");

        var transportista = hermanos.Select(h => Texto(h.DetalleTransporte?.Tractocamion?.Empresa?.Nombre)).FirstOrDefault(n => n != null);
        if (transportista == null) Falta("Compañía de transporte (quien firma la carta)");

        return Ok(new
        {
            actual.Id,
            actual.Numero,
            Fecha = hermanos.Select(h => h.HistorialMovimiento.FechaRegistro).DefaultIfEmpty(DateTime.UtcNow).Min(),
            Sello1 = sello1,
            Sello2 = sello2,
            DestinoFinal = string.Join(" / ", destinos),
            Transportista = transportista,
            Faltantes = faltantes
        });
    }

    // PUT api/embarques/5/sellos — guarda los números de sello de seguridad de la unidad de carga. Se necesita al menos
    // uno; se guardan en todos los destinos del mismo número de embarque, porque es el mismo camión.
    [HttpPut("{id}/sellos")]
    public async Task<IActionResult> GuardarSellos(uint id, [FromBody] GuardarSellosDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "embarques", "editar"))
            return this.SinPermiso();

        var sello1 = Texto(dto.Sello1);
        var sello2 = Texto(dto.Sello2);
        if (sello1 == null) return BadRequest(new { mensaje = "Escribe al menos un número de sello de seguridad" });

        var actual = await _context.Embarques.FirstOrDefaultAsync(x => x.Id == id && x.Activo);
        if (actual == null) return NotFound();
        var hermanos = await _context.Embarques
            .Where(x => x.Activo && (actual.Numero == null ? x.Id == id : x.Numero == actual.Numero))
            .ToListAsync();

        var antes = new { actual.SelloSeguridad1, actual.SelloSeguridad2 };
        foreach (var h in hermanos)
        {
            h.SelloSeguridad1 = sello1;
            h.SelloSeguridad2 = sello2;
            h.CartaCompleta = true;
        }
        await _context.SaveChangesAsync();
        await _auditoria.RegistrarAsync("embarque", id.ToString(), "MODIFICAR", antes, new { SelloSeguridad1 = sello1, SelloSeguridad2 = sello2 }, dto.IdUsuario);
        return NoContent();
    }

    // GET api/embarques/5/rt-documento — los datos variables de la Remisión-Traslado (RT) de UN destino (el embarque `id`):
    // a quién se remite, los productos (kilos, precio, importe y pedimentos/facturas), el desglose por clave SAT y los
    // totales, más los documentos que se anexan al PDF (los pedimentos/facturas seleccionados en la pantalla del RT) y la
    // lista de lo que falta. La hoja ya viene impresa y enumerada: aquí solo va lo que se escribe encima.
    [RequierePermiso("embarques", "ver")]
    [HttpGet("{id}/rt-documento")]
    public async Task<IActionResult> GetRtDocumento(uint id)
    {
        var e = await _context.Embarques.AsNoTracking()
            .Include(x => x.HistorialMovimiento)
            .Include(x => x.SolicitudDetalles).ThenInclude(d => d.Existencia).ThenInclude(ex => ex.DocumentoOrigen).ThenInclude(d => d!.DocumentoTipo)
            .Include(x => x.RtDetalles).ThenInclude(d => d.Documentos).ThenInclude(d => d.Documento).ThenInclude(d => d.DocumentoTipo)
            .Include(x => x.Direccion).ThenInclude(d => d!.Empresa)
            .Include(x => x.Cliente)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == id && x.Activo);
        if (e == null) return NotFound();

        var faltantes = new List<string>();
        void Falta(string texto) { if (!faltantes.Contains(texto)) faltantes.Add(texto); }
        if (Texto(e.Numero) == null) Falta("Número de embarque");

        // ── A quién se remite ───────────────────────────────────────────────────────────────────────────────────────────
        string? nombre, rfc, calle, municipio, estado, cp;
        if (e.Cliente != null)
        {
            nombre = Texto(e.Cliente.Nombre); rfc = Texto(e.Cliente.Rfc);
            calle = Texto(string.Join(", ", new[] { e.Cliente.Calle, e.Cliente.Colonia }.Where(x => !string.IsNullOrWhiteSpace(x))));
            municipio = Texto(e.Cliente.Municipio); estado = Texto(e.Cliente.Estado); cp = Texto(e.Cliente.CodigoPostal);
        }
        else
        {
            nombre = Texto(e.Direccion?.Empresa?.Nombre); rfc = Texto(e.Direccion?.Empresa?.Rfc);
            calle = Texto(e.Direccion?.DireccionTexto); municipio = Texto(e.Direccion?.Municipio);
            estado = Texto(e.Direccion?.Estado); cp = Texto(e.Direccion?.CodigoPostal);
        }
        if (nombre == null) Falta("Nombre del cliente (destinatario)");
        if (rfc == null) Falta("RFC del cliente");
        if (calle == null) Falta("Dirección del cliente");
        if (municipio == null && estado == null) Falta("Ciudad y estado del cliente");
        if (cp == null) Falta("Código postal del cliente (se captura en la dirección del destino)");

        // ── Productos ───────────────────────────────────────────────────────────────────────────────────────────────────
        var codigos = e.SolicitudDetalles.Select(d => d.Existencia.CodigoProducto).Distinct().ToList();
        var productos = await _context.Productos.AsNoTracking()
            .Include(p => p.Especie).ThenInclude(s => s.ClaveSat)
            .Where(p => codigos.Contains(p.Codigo)).ToDictionaryAsync(p => p.Codigo);
        // (una RT vieja pudo guardar un producto dos veces: se toma el último)
        var guardadas = e.RtDetalles.GroupBy(d => d.CodigoProducto).ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First());
        if (e.SolicitudDetalles.Count == 0) Falta("Productos (la Solicitud no se ha capturado)");
        else if (e.RtDetalles.Count == 0) Falta("La RT todavía no se envió: los precios y los pedimentos son los sugeridos");

        // "PED.261132596002385" · "F-18127": como se escribe cada documento debajo del producto.
        static string Referencia(string? tipo, string numero)
        {
            var n = numero.Trim();
            var t = (tipo ?? "").Trim().ToLowerInvariant();
            // Factura: siempre "F-" y su número.
            if (t.Contains("factura"))
            {
                if (n.StartsWith("F-", StringComparison.OrdinalIgnoreCase)) n = n[2..].TrimStart();
                return $"F-{n}".ToUpperInvariant();
            }
            // Cualquier otro (pedimento A1, C1, etc.): siempre "PED." y el nombre del pedimento, sin espacios.
            var nombre = string.Concat(n.Where(c => !char.IsWhiteSpace(c))).ToUpperInvariant();
            if (nombre.StartsWith("PED.", StringComparison.Ordinal)) nombre = nombre[4..];
            return $"PED.{nombre}";
        }
        static decimal Redondear(decimal n) => Math.Round(n, 2, MidpointRounding.AwayFromZero);

        var anexos = new List<object>();
        var anexados = new HashSet<uint>();
        void Anexar(Documento d)
        {
            if (!anexados.Add(d.Id)) return;
            var etiqueta = $"{d.DocumentoTipo.Nombre} {d.Numero}";
            var xml = d.ArchivoTipo?.Contains("xml", StringComparison.OrdinalIgnoreCase) == true;
            if (d.ArchivoRuta == null) Falta($"{etiqueta} no tiene archivo cargado (no se anexa al PDF)");
            else if (xml) Falta($"{etiqueta} es un XML (no se puede anexar al PDF)");
            anexos.Add(new { IdDocumento = d.Id, Etiqueta = etiqueta, TieneArchivo = d.ArchivoRuta != null && !xml, d.ArchivoTipo, d.ArchivoNombre });
        }

        var renglones = new List<(string Codigo, string Descripcion, decimal Kilos, decimal Precio, decimal Importe, string? ClaveSat, string? DescSat, List<string> Documentos)>();
        foreach (var g in e.SolicitudDetalles.OrderBy(d => d.Id).GroupBy(d => d.Existencia.CodigoProducto))
        {
            productos.TryGetValue(g.Key, out var p);
            guardadas.TryGetValue(g.Key, out var rt);
            var kilos = g.Sum(d => d.Kilos);
            var precio = rt?.PrecioUnitario ?? p?.PrecioKilo ?? 0;
            if (precio <= 0) Falta($"Precio unitario de {g.Key}");
            var clave = Texto(rt?.ClaveSat) ?? Texto(p?.Especie.CodigoClaveSat);
            var descSat = Texto(rt?.DescripcionSat) ?? Texto(p?.Especie.ClaveSat?.Nombre);
            if (clave == null) Falta($"Clave SAT de {g.Key}");

            // Los documentos de este producto: los que se marcaron en la RT; si no se ha enviado, los de sus lotes.
            var docs = rt != null
                ? rt.Documentos.OrderBy(x => x.Id).Select(x => x.Documento).ToList()
                : g.Select(d => d.Existencia.DocumentoOrigen).Where(d => d != null).Select(d => d!).DistinctBy(d => d.Id).ToList();
            if (docs.Count == 0) Falta($"Pedimento o factura de {g.Key}");
            foreach (var d in docs) Anexar(d);

            renglones.Add((g.Key, (p?.Especie.Nombre ?? g.Key).ToUpperInvariant(), kilos, precio, Redondear(kilos * precio), clave, descSat,
                docs.Select(d => Referencia(d.DocumentoTipo.Nombre, d.Numero)).ToList()));
        }

        // Desglose por clave SAT: kilos e importe de cada una (en el orden en que se acostumbra en la hoja).
        string[] orden = { "50121537", "50121706", "50121612" };
        var claves = renglones.GroupBy(r => (Clave: r.ClaveSat ?? "", Nombre: r.DescSat ?? ""))
            .Select(g => new { Codigo = g.Key.Clave, Nombre = g.Key.Nombre, Kilos = g.Sum(r => r.Kilos), Importe = g.Sum(r => r.Importe) })
            .OrderBy(c => Array.IndexOf(orden, c.Codigo) is var i and >= 0 ? i : orden.Length).ThenBy(c => c.Codigo)
            .ToList();

        var origen = await _documentos.ObtenerAsync(ConfiguracionDocumentosService.Rt);
        return Ok(new
        {
            e.Numero,
            Fecha = e.HistorialMovimiento.FechaRegistro,
            Configuracion = origen,
            Cliente = new
            {
                Nombre = nombre, Rfc = rfc, Direccion = calle,
                Ciudad = Texto(string.Join(", ", new[] { municipio, estado }.Where(x => !string.IsNullOrWhiteSpace(x)))),
                CodigoPostal = cp
            },
            Productos = renglones.Select(r => new
            {
                r.Codigo, r.Descripcion, r.Kilos, r.Precio, r.Importe, ClaveSat = r.ClaveSat, DescripcionSat = r.DescSat,
                Documentos = r.Documentos
            }),
            Claves = claves,
            TotalKilos = renglones.Sum(r => r.Kilos),
            Total = renglones.Sum(r => r.Importe),
            Anexos = anexos,
            Faltantes = faltantes
        });
    }

    // "ESPECIE TALLA MARCA PRESENTACIÓN" como se escribe el producto en las hojas (ej. "TILAPIA 350/550 GMR 100%"). La
    // presentación "Caja" es el empaque, no parte del nombre, y no se escribe; tampoco el peso de la caja.
    private static string DescripcionHoja(Producto p)
    {
        var partes = new List<string?> { p.Especie.Nombre, p.Talla?.Descripcion, p.Marca?.Nombre };
        partes.AddRange(p.Descripciones.Select(d => d.Presentacion.Nombre)
            .Where(n => !string.Equals(n?.Trim(), "Caja", StringComparison.OrdinalIgnoreCase) && !string.Equals(n?.Trim(), "Cajas", StringComparison.OrdinalIgnoreCase)));
        return string.Join(" ", partes.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()));
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
            IdDireccionOrigen = dto.IdDireccionOrigen ?? (await OrigenPredeterminadoAsync())?.Id,
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
        embarque.IdDireccionOrigen = dto.IdDireccionOrigen ?? (await OrigenPredeterminadoAsync())?.Id;
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