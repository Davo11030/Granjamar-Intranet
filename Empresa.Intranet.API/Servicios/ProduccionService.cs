using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Servicios;

// Lo que comparten la tabla general de producción (ProduccionInventarioController) y los reportes diarios
// (ProduccionesController): saldos a una fecha, la revisión de que nada quede en negativo y utilidades de inventario.
//
//   Bloqueado    = Σ (Entradas − Salidas) de la tabla general.            · Salidas = lo que se DESBLOQUEA.
//   Desbloqueado = Σ Salidas de la tabla general − Σ lo usado en reportes (Uso = Desbloqueado).
//   En proceso   = Σ M.P. en procesos nuevas − Σ lo usado en reportes (Uso = Proceso).
public class ProduccionService
{
    // Todo lo de producción se guarda en serie: la verificación de saldos y el guardado no se pisan.
    public static readonly SemaphoreSlim Candado = new(1, 1);
    public const decimal Eps = 0.001m;

    private readonly AppDbContext _context;
    public ProduccionService(AppDbContext context) => _context = context;

    public static bool TryDia(string fecha, out DateTime dia) =>
        DateTime.TryParseExact(fecha, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal, out dia);

    // ── Saldos a una fecha ─────────────────────────────────────────────

    // Lo que había bloqueado en producción al EMPEZAR el día (la Existencia con que cerró el anterior), por producto
    // Y ORIGEN: cada origen (lote y bodega) es su propio renglón y su origen queda fijo desde su primera entrada.
    public record InicialGrupo(string Codigo, uint? IdExistencia, uint? IdDireccion, decimal Kilos);

    public async Task<List<InicialGrupo>> InicialesPorOrigenAsync(DateTime dia)
    {
        var lineas = await _context.ProduccionInventario.AsNoTracking()
            .Where(l => l.Activo && l.Fecha < dia).ToListAsync();
        return lineas.GroupBy(l => (l.CodigoProducto, l.IdExistencia, l.IdDireccion))
            .Select(g => new InicialGrupo(g.Key.CodigoProducto, g.Key.IdExistencia, g.Key.IdDireccion, g.Sum(l => l.Entrada - l.Salida)))
            .Where(g => g.Kilos > Eps)
            .OrderBy(g => g.Codigo).ToList();
    }

    // Lo desbloqueado y todavía sin usar al EMPEZAR el reporte del día: salidas de la tabla general hasta el día
    // (inclusive) menos lo usado en reportes de días anteriores.
    public async Task<Dictionary<string, decimal>> DesbloqueadoAsync(DateTime dia)
    {
        var salidas = await _context.ProduccionInventario.AsNoTracking()
            .Where(l => l.Activo && l.Fecha <= dia && l.Salida > 0).ToListAsync();
        var usos = await _context.ProduccionReporte.AsNoTracking()
            .Where(f => f.Activo && f.Fecha < dia && f.Uso == ProduccionReporteFila.UsoDesbloqueado).ToListAsync();
        var pool = salidas.GroupBy(l => l.CodigoProducto).ToDictionary(g => g.Key, g => g.Sum(l => l.Salida));
        foreach (var g in usos.GroupBy(f => f.CodigoUsado!))
            pool[g.Key] = pool.GetValueOrDefault(g.Key) - g.Sum(f => f.KilosUsados);
        return pool.Where(kv => kv.Value > Eps).ToDictionary(kv => kv.Key, kv => kv.Value);
    }

    // M.P. en procesos pendiente (sin darle salida) al EMPEZAR el día.
    public async Task<Dictionary<string, decimal>> EnProcesoAsync(DateTime dia)
    {
        var filas = await _context.ProduccionReporte.AsNoTracking().Where(f => f.Activo && f.Fecha < dia).ToListAsync();
        var saldo = new Dictionary<string, decimal>();
        foreach (var f in filas)
        {
            if (f.Etapa == ProduccionReporteFila.MP && !f.EsReferencia)
                saldo[f.CodigoProducto] = saldo.GetValueOrDefault(f.CodigoProducto) + f.Kilos;
            if (f.Uso == ProduccionReporteFila.UsoProceso && f.CodigoUsado != null)
                saldo[f.CodigoUsado] = saldo.GetValueOrDefault(f.CodigoUsado) - f.KilosUsados;
        }
        return saldo.Where(kv => kv.Value > Eps).ToDictionary(kv => kv.Key, kv => kv.Value);
    }

    // ── Revisión de que nada quede en negativo (se llama ya aplicados los cambios, dentro de la transacción) ──
    public async Task<string?> ValidarLineaDeTiempoAsync()
    {
        var lineas = await _context.ProduccionInventario.AsNoTracking().Where(l => l.Activo).ToListAsync();
        var filas = (await _context.ProduccionReporte.AsNoTracking().Where(f => f.Activo).ToListAsync())
            .OrderBy(f => f.Fecha).ThenBy(f => f.Orden).ThenBy(f => f.Id).ToList();

        var codigos = lineas.Select(l => l.CodigoProducto)
            .Concat(filas.Select(f => f.CodigoProducto))
            .Concat(filas.Where(f => f.CodigoUsado != null).Select(f => f.CodigoUsado!))
            .Distinct().ToList();

        foreach (var c in codigos)
        {
            // Bloqueado: la existencia de la tabla general al cierre de cada día.
            foreach (var origen in lineas.Where(l => l.CodigoProducto == c).GroupBy(l => (l.IdExistencia, l.IdDireccion)))
            {
                var acumulado = 0m;
                foreach (var g in origen.GroupBy(l => l.Fecha.Date).OrderBy(g => g.Key))
                {
                    acumulado += g.Sum(l => l.Entrada - l.Salida);
                    if (acumulado < -Eps)
                        return $"La existencia de producción de {c} quedaría negativa el {g.Key:dd/MM/yyyy}: no se puede desbloquear más de lo que hay.";
                }
            }

            // Desbloqueado: lo usado en reportes nunca puede pasar de lo desbloqueado.
            var fechas = lineas.Where(l => l.CodigoProducto == c && l.Salida > 0).Select(l => l.Fecha.Date)
                .Concat(filas.Where(f => f.Uso == ProduccionReporteFila.UsoDesbloqueado && f.CodigoUsado == c).Select(f => f.Fecha.Date))
                .Distinct().OrderBy(d => d);
            var pool = 0m;
            foreach (var d in fechas)
            {
                pool += lineas.Where(l => l.CodigoProducto == c && l.Fecha.Date == d).Sum(l => l.Salida);
                pool -= filas.Where(f => f.Fecha.Date == d && f.Uso == ProduccionReporteFila.UsoDesbloqueado && f.CodigoUsado == c).Sum(f => f.KilosUsados);
                if (pool < -Eps)
                    return $"En los reportes se usa más {c} del que está desbloqueado al {d:dd/MM/yyyy}: solicita el desbloqueo de más producto en Producción.";
            }

            // En proceso: se recorre en el orden de los renglones.
            var enProceso = 0m;
            foreach (var f in filas)
            {
                if (f.Etapa == ProduccionReporteFila.MP && f.EsReferencia && f.CodigoProducto == c && enProceso + Eps < f.Kilos)
                    return $"No hay {f.Kilos:0.###} kg de {c} en proceso (M.P.) para el reporte del {f.Fecha:dd/MM/yyyy}.";
                if (f.Etapa == ProduccionReporteFila.MP && !f.EsReferencia && f.CodigoProducto == c) enProceso += f.Kilos;
                if (f.Uso == ProduccionReporteFila.UsoProceso && f.CodigoUsado == c) enProceso -= f.KilosUsados;
                if (enProceso < -Eps)
                    return $"En el reporte del {f.Fecha:dd/MM/yyyy} se usa más {c} en proceso del que hay (M.P.).";
            }
        }
        return null;
    }

    // ── Inventario ─────────────────────────────────────────────────────

    public async Task<uint> TipoMovimientoAsync(string nombre, bool crear)
    {
        var tipo = await _context.TiposMovimiento.FirstOrDefaultAsync(t => t.Nombre == nombre);
        if (tipo != null) return tipo.Id;
        if (!crear) return 0;
        tipo = new TipoMovimiento { Nombre = nombre };
        _context.TiposMovimiento.Add(tipo);
        await _context.SaveChangesAsync();
        return tipo.Id;
    }

    // Nombre automático del lote nuevo: PROD-20261022-1, -2…
    public async Task<string> LoteAutomaticoAsync(DateTime dia)
    {
        var prefijo = $"PROD-{dia:yyyyMMdd}-";
        var usados = await _context.Existencias.Where(e => e.Lote.StartsWith(prefijo)).Select(e => e.Lote).ToListAsync();
        var siguiente = usados.Select(l => int.TryParse(l[prefijo.Length..], out var n) ? n : 0).DefaultIfEmpty(0).Max() + 1;
        return prefijo + siguiente;
    }

    // Lo que sale de producción regresa a NUESTRO inventario (Granjamar): a la bodega del lote de origen si es
    // nuestra; si el producto vino de una empresa en consignación (o no se sabe), a la bodega principal de Granjamar.
    public async Task<uint> DireccionIngresoAsync(uint? idDireccionOrigen)
    {
        var propias = await _context.Direcciones.Include(d => d.Empresa)
            .Where(d => d.Activo && d.Empresa != null
                && (d.Empresa.Tipo != null && d.Empresa.Tipo.ToLower() == "interna" || d.Empresa.Nombre.ToLower().Contains("granjamar")))
            .ToListAsync();
        if (idDireccionOrigen.HasValue && propias.Any(d => d.Id == idDireccionOrigen.Value)) return idDireccionOrigen.Value;
        var principal = propias
            .OrderByDescending(d => d.Municipio.Contains("Ensenada", StringComparison.OrdinalIgnoreCase)).ThenBy(d => d.Id)
            .FirstOrDefault();
        return principal?.Id ?? idDireccionOrigen ?? 0;
    }

    // El origen de un lote para producción: solo Granjamar o consignación (nunca resguardo ni otras empresas).
    public record Origen(uint IdEmpresa, string Nombre, string? Tipo)
    {
        public bool EsConsignacion => string.Equals(Tipo, "consignacion", StringComparison.OrdinalIgnoreCase);
        public bool EsPropia => string.Equals(Tipo, "interna", StringComparison.OrdinalIgnoreCase)
            || Nombre.Contains("granjamar", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<Origen?> OrigenDeDireccionAsync(uint idDireccion) =>
        await _context.Direcciones.Where(d => d.Id == idDireccion && d.IdEmpresa != null)
            .Select(d => new Origen(d.IdEmpresa!.Value, d.Empresa!.Nombre, d.Empresa.Tipo)).FirstOrDefaultAsync();

    // ── Deshacer lo que creó una salida (su lote no debe haberse movido) ──
    public async Task<string?> RevisarDeshacerSalidaAsync(ProduccionReporteFila f)
    {
        foreach (var (idEx, idDet) in new[] { (f.IdExistenciaSalida, f.IdDetalleMovimiento), (f.IdExistenciaExtra, f.IdDetalleMovimientoExtra) })
        {
            if (idEx == null) continue;
            var det = idDet.HasValue ? await _context.DetallesMovimiento.FindAsync(idDet.Value) : null;
            var hoy = await _context.UbicacionesProducto.Where(u => u.IdExistencia == idEx.Value).SumAsync(u => (decimal?)u.CantidadKilos) ?? 0;
            var otros = await _context.DetallesMovimiento.AnyAsync(d => d.IdExistencia == idEx.Value && d.Id != idDet);
            if (otros || det == null || Math.Abs(hoy - det.Kilos) > Eps)
            {
                var lote = (await _context.Existencias.FindAsync(idEx.Value))?.Lote;
                return $"El lote {lote} que creó esta salida ya se movió en Conpaq: no se puede deshacer.";
            }
        }
        return null;
    }

    public async Task DeshacerSalidaAsync(ProduccionReporteFila f)
    {
        foreach (var (idEx, idDet) in new[] { (f.IdExistenciaSalida, f.IdDetalleMovimiento), (f.IdExistenciaExtra, f.IdDetalleMovimientoExtra) })
        {
            if (idEx == null) continue;
            _context.UbicacionesProducto.RemoveRange(_context.UbicacionesProducto.Where(u => u.IdExistencia == idEx.Value));
            if (idDet.HasValue)
            {
                var det = await _context.DetallesMovimiento.FindAsync(idDet.Value);
                if (det != null) _context.DetallesMovimiento.Remove(det);
            }
            var ex = await _context.Existencias.FindAsync(idEx.Value);
            if (ex != null) _context.Existencias.Remove(ex);
        }
    }
}
