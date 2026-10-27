using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Servicios;

// Un renglón de lo que un embarque / venta / producción saca de una ubicación. Basta el código del
// producto, o la existencia de la que se puede deducir.
public record LineaPedido(string? CodigoProducto, uint? IdExistencia, decimal Kilos, uint? IdDireccion);

// Genera las solicitudes de compra a las empresas en consignación: cuando algo usa producto que está
// en el inventario de una de ellas, esa empresa recibe un pedido (uno por empresa y por origen).
public class PedidosConsignacionService
{
    public const string Pendiente = "Pendiente";
    public const string Liberado = "Liberado";

    private readonly AppDbContext _context;

    public PedidosConsignacionService(AppDbContext context) => _context = context;

    // Un pedido con factura (o ya liberado) está cerrado: se compró, la factura es de Granjamar y
    // ningún cambio del embarque/venta/producción de origen lo modifica ni lo anula.
    // Deja los pedidos de este origen al día con sus renglones actuales: un pedido Pendiente conserva
    // su folio y se actualiza (o se anula si ya no usa esa empresa); si una empresa ya tiene un pedido
    // Liberado de este origen, ese no se toca (ya se compró).
    public async Task SincronizarAsync(string tipoOrigen, uint idOrigen, string tipoDestino, string destino,
        IEnumerable<LineaPedido> lineas)
    {
        var pendientes = await _context.PedidosConsignacion.Include(p => p.Detalles)
            .Where(p => p.Activo && p.TipoOrigen == tipoOrigen && p.IdOrigen == idOrigen
                        && p.Estado == Pendiente && p.IdDocumentoFactura == null)
            .ToListAsync();

        var lista = lineas.Where(l => l.IdDireccion != null && l.Kilos > 0).ToList();

        var idsExistencia = lista.Where(l => l.CodigoProducto == null && l.IdExistencia != null)
            .Select(l => l.IdExistencia!.Value).Distinct().ToList();
        var codigoPorExistencia = idsExistencia.Count == 0
            ? new Dictionary<uint, string>()
            : await _context.Existencias.Where(e => idsExistencia.Contains(e.Id))
                .ToDictionaryAsync(e => e.Id, e => e.CodigoProducto);

        var idsDireccion = lista.Select(l => l.IdDireccion!.Value).Distinct().ToList();
        var empresaPorDireccion = await _context.Direcciones
            .Where(d => idsDireccion.Contains(d.Id) && d.IdEmpresa != null)
            .Select(d => new { d.Id, d.IdEmpresa, d.Empresa!.Tipo })
            .ToDictionaryAsync(d => d.Id, d => (IdEmpresa: d.IdEmpresa!.Value, d.Tipo));

        var yaLiberadas = await _context.PedidosConsignacion
            .Where(p => p.Activo && p.TipoOrigen == tipoOrigen && p.IdOrigen == idOrigen
                        && (p.Estado == Liberado || p.IdDocumentoFactura != null))
            .Select(p => p.IdEmpresa).ToListAsync();

        var porEmpresa = lista
            .Select(l => (Linea: l, Codigo: l.CodigoProducto ?? (l.IdExistencia != null && codigoPorExistencia.TryGetValue(l.IdExistencia.Value, out var c) ? c : null)))
            .Where(x => x.Codigo != null && empresaPorDireccion.TryGetValue(x.Linea.IdDireccion!.Value, out var e)
                        && string.Equals(e.Tipo, "consignacion", StringComparison.OrdinalIgnoreCase))
            .GroupBy(x => empresaPorDireccion[x.Linea.IdDireccion!.Value].IdEmpresa);

        var vigentes = new HashSet<uint>();
        foreach (var grupo in porEmpresa)
        {
            if (yaLiberadas.Contains(grupo.Key)) continue;
            vigentes.Add(grupo.Key);

            var existente = pendientes.FirstOrDefault(p => p.IdEmpresa == grupo.Key);
            if (existente != null)
            {
                existente.TipoDestino = tipoDestino;
                existente.Destino = destino;
                _context.PedidosConsignacionDetalle.RemoveRange(existente.Detalles);
                existente.Detalles = grupo.GroupBy(x => x.Codigo!)
                    .Select(g => new PedidoConsignacionDetalle { CodigoProducto = g.Key, Kilos = g.Sum(x => x.Linea.Kilos) })
                    .ToList();
                continue;
            }

            var pedido = new PedidoConsignacion
            {
                Numero = await SiguienteNumeroAsync(grupo.Key),
                IdEmpresa = grupo.Key,
                Fecha = DateTime.UtcNow,
                TipoOrigen = tipoOrigen,
                IdOrigen = idOrigen,
                TipoDestino = tipoDestino,
                Destino = destino,
                Estado = Pendiente
            };
            foreach (var porProducto in grupo.GroupBy(x => x.Codigo!))
                pedido.Detalles.Add(new PedidoConsignacionDetalle
                {
                    CodigoProducto = porProducto.Key,
                    Kilos = porProducto.Sum(x => x.Linea.Kilos)
                });
            _context.PedidosConsignacion.Add(pedido);
        }

        // Pendientes de empresas que el origen ya no usa.
        foreach (var p in pendientes.Where(p => !vigentes.Contains(p.IdEmpresa))) p.Activo = false;
        await _context.SaveChangesAsync();
    }

    // Siguiente folio Ens-## de la empresa (consecutivo, incluye los pedidos ya anulados).
    private async Task<string> SiguienteNumeroAsync(uint idEmpresa)
    {
        var existentes = await _context.PedidosConsignacion
            .Where(p => p.IdEmpresa == idEmpresa)
            .Select(p => p.Numero).ToListAsync();
        return $"Ens-{existentes.Select(NumeroDe).DefaultIfEmpty(0).Max() + 1:00}";
    }

    // Agrupa solicitudes de producción (todas de una misma empresa, sin pedido) en UN pedido.
    public async Task<PedidoConsignacion> CrearPedidoDeSolicitudesAsync(uint idEmpresa, IList<SolicitudProduccion> solicitudes)
    {
        var pedido = new PedidoConsignacion
        {
            Numero = await SiguienteNumeroAsync(idEmpresa),
            IdEmpresa = idEmpresa,
            Fecha = DateTime.UtcNow,
            TipoOrigen = "SolicitudProduccion",
            IdOrigen = 0,
            TipoDestino = "Producción",
            Destino = "Producción",
            Estado = Pendiente
        };
        foreach (var porProducto in solicitudes.GroupBy(x => x.CodigoProducto))
            pedido.Detalles.Add(new PedidoConsignacionDetalle { CodigoProducto = porProducto.Key, Kilos = porProducto.Sum(x => x.Kilos) });
        _context.PedidosConsignacion.Add(pedido);
        await _context.SaveChangesAsync();
        foreach (var sol in solicitudes) sol.IdPedido = pedido.Id;
        await _context.SaveChangesAsync();
        return pedido;
    }

    // El origen se eliminó: sus pedidos aún Pendientes y sin factura dejan de existir; los Liberados o
    // con factura se conservan.
    public async Task AnularPendientesAsync(string tipoOrigen, uint idOrigen)
    {
        var pendientes = await _context.PedidosConsignacion
            .Where(p => p.Activo && p.TipoOrigen == tipoOrigen && p.IdOrigen == idOrigen
                        && p.Estado == Pendiente && p.IdDocumentoFactura == null)
            .ToListAsync();
        foreach (var p in pendientes) p.Activo = false;
        if (pendientes.Count > 0) await _context.SaveChangesAsync();
    }

    // Un pedido armado con solicitudes de producción cambió (se modificaron o quitaron entradas): se recalcula con las
    // solicitudes que le quedan; sin ninguna, el pedido deja de existir.
    public async Task RefrescarPedidoDeSolicitudesAsync(uint idPedido)
    {
        var pedido = await _context.PedidosConsignacion.Include(p => p.Detalles).FirstOrDefaultAsync(p => p.Id == idPedido);
        if (pedido == null || pedido.Estado != Pendiente || pedido.IdDocumentoFactura != null) return;
        var solicitudes = await _context.SolicitudesProduccion.Where(s => s.Activo && s.IdPedido == idPedido).ToListAsync();
        _context.PedidosConsignacionDetalle.RemoveRange(pedido.Detalles);
        if (solicitudes.Count == 0) pedido.Activo = false;
        else
            foreach (var porProducto in solicitudes.GroupBy(x => x.CodigoProducto))
                pedido.Detalles.Add(new PedidoConsignacionDetalle { CodigoProducto = porProducto.Key, Kilos = porProducto.Sum(x => x.Kilos) });
        await _context.SaveChangesAsync();
    }

    // "Ens-07" → 7
    private static int NumeroDe(string numero)
    {
        var i = numero.LastIndexOf('-');
        return i >= 0 && int.TryParse(numero[(i + 1)..], out var n) ? n : 0;
    }
}
