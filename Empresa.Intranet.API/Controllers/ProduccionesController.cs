using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.API.Extensiones;
using Empresa.Intranet.API.Servicios;
using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
using Empresa.Intranet.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Controllers;

// REPORTES diarios de producción (uno por día). Los renglones se leen en orden y la etapa la da la columna donde se
// capturan los kilos; lo "usado" ya no se captura: es TODO lo del renglón anterior.
//   Entrada a producción → kilos que se toman de lo DESBLOQUEADO en la tabla general (no puede pasar de lo desbloqueado).
//   M.P. en procesos     → resultó X del producto del renglón; se usó todo lo del renglón anterior (entrada o M.P.).
//                          Sin renglón anterior de entrada es solo una REFERENCIA a producto que ya estaba en proceso
//                          de otro día (mismo producto y mismos kilos) para poder darle salida.
//   Salida de producción → sale hacia Conpaq como lote nuevo (o con el lote original); se usó todo lo del renglón anterior.
//                          Una salida justo después de otra es de la misma entrada y es su rendimiento.
// El M.P. que no se saca el mismo día se queda en proceso (no es inventario de Conpaq).
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProduccionesController : ControllerBase
{
    private const decimal Eps = ProduccionService.Eps;

    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;
    private readonly ProduccionService _prod;
    public ProduccionesController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService, ProduccionService prod)
    {
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
        _prod = prod;
    }

    // ──────────────────────────────────────────────── lecturas

    // GET api/producciones — el listado: UN reporte por día, del más reciente al más viejo.
    [RequierePermiso("produccion", "ver")]
    [HttpGet]
    public async Task<IActionResult> GetTodos()
    {
        var filas = await _context.ProduccionReporte.AsNoTracking()
            .Where(f => f.Activo)
            .Select(f => new { f.Fecha, f.Etapa, f.Kilos, Usuario = f.Usuario.Nombre })
            .ToListAsync();
        return Ok(filas.GroupBy(f => f.Fecha.Date)
            .Select(g => new
            {
                Fecha = g.Key.ToString("yyyy-MM-dd"),
                Usuario = g.First().Usuario,
                Renglones = g.Count(),
                Entrada = g.Where(x => x.Etapa == ProduccionReporteFila.Entrada).Sum(x => x.Kilos),
                EnProceso = g.Where(x => x.Etapa == ProduccionReporteFila.MP).Sum(x => x.Kilos),
                Salida = g.Where(x => x.Etapa == ProduccionReporteFila.Salida).Sum(x => x.Kilos)
            })
            .OrderByDescending(r => r.Fecha));
    }

    // GET api/producciones/reporte/2026-10-22 — el reporte completo de un día (para verlo o editarlo).
    [RequierePermiso("produccion", "ver")]
    [HttpGet("reporte/{fecha}")]
    public async Task<IActionResult> GetReporte(string fecha)
    {
        if (!ProduccionService.TryDia(fecha, out var dia)) return BadRequest(new { mensaje = "Fecha inválida" });
        var filas = await _context.ProduccionReporte.AsNoTracking()
            .Include(f => f.Usuario).Include(f => f.Producto).ThenInclude(p => p.Especie)
            .Where(f => f.Activo && f.Fecha.Date == dia).OrderBy(f => f.Orden).ThenBy(f => f.Id).ToListAsync();
        if (filas.Count == 0) return NotFound();

        var idsLotes = filas.SelectMany(f => new[] { f.IdExistenciaSalida, f.IdExistenciaExtra }).Where(i => i.HasValue).Select(i => i!.Value).ToList();
        var lotes = await _context.Existencias.AsNoTracking().Where(x => idsLotes.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Lote);
        return Ok(new
        {
            Fecha = dia.ToString("yyyy-MM-dd"),
            Usuario = filas[0].Usuario.Nombre,
            Filas = filas.Select(f => new
            {
                f.Orden,
                Codigo = f.CodigoProducto,
                Articulo = f.Producto.Especie.Nombre,
                f.Etapa,
                f.Kilos,
                f.Uso,
                f.CodigoUsado,
                f.KilosUsados,
                f.EsReferencia,
                f.Rendimiento,
                f.Porcentaje,
                f.Lote,
                f.LoteOriginal,
                LoteSalida = f.IdExistenciaSalida is { } l ? lotes.GetValueOrDefault(l) : null
            })
        });
    }

    // GET api/producciones/disponible?fecha=2026-10-23 — lo desbloqueado y lo que está en proceso (M.P.) al EMPEZAR
    // el reporte de ese día, para validarlo en pantalla.
    [RequierePermiso("produccion", "ver")]
    [HttpGet("disponible")]
    public async Task<IActionResult> Disponible([FromQuery] string fecha)
    {
        if (!ProduccionService.TryDia(fecha, out var dia)) return BadRequest(new { mensaje = "Fecha inválida" });
        var desbloqueado = await _prod.DesbloqueadoAsync(dia);
        var enProceso = await _prod.EnProcesoAsync(dia);
        var codigos = desbloqueado.Keys.Concat(enProceso.Keys).Distinct().ToList();
        var articulos = await _context.Productos.AsNoTracking().Where(p => codigos.Contains(p.Codigo))
            .Select(p => new { p.Codigo, Nombre = p.Especie.Nombre }).ToDictionaryAsync(p => p.Codigo, p => p.Nombre);
        return Ok(new
        {
            Desbloqueado = desbloqueado.Select(kv => new { Codigo = kv.Key, Articulo = articulos.GetValueOrDefault(kv.Key, ""), Kilos = kv.Value }),
            EnProceso = enProceso.Select(kv => new { Codigo = kv.Key, Articulo = articulos.GetValueOrDefault(kv.Key, ""), Kilos = kv.Value })
        });
    }

    // ──────────────────────────────────────────────── escritura

    private async Task<bool> ExisteReporteAsync(DateTime dia) =>
        await _context.ProduccionReporte.AnyAsync(f => f.Activo && f.Fecha.Date == dia);

    private static string MensajeDiaOcupado(DateTime dia) =>
        $"Ya existe un reporte de producción del {dia:dd/MM/yyyy}: solo puede haber uno por día. Ábrelo y edítalo.";

    private static string? NormalizarEtapa(string? e) => e?.Trim().ToLowerInvariant() switch
    {
        "entrada" => ProduccionReporteFila.Entrada,
        "mp" or "m.p." => ProduccionReporteFila.MP,
        "salida" => ProduccionReporteFila.Salida,
        _ => null
    };

    // Un renglón ya derivado, con lo que hace falta para crear su inventario.
    private class Derivada
    {
        public ProduccionReporteFila F = null!;
        public decimal? RendimientoManual;
        public decimal? PorcentajeManual;
    }

    // Núcleo de crear y editar. "diaEditado" = null al crear; la fecha del reporte (yyyy-MM-dd) al editar.
    private async Task<IActionResult> GuardarAsync(CrearProduccionDto dto, DateTime? diaEditado)
    {
        var editar = diaEditado.HasValue;
        var usuario = this.IdUsuarioActual();
        var dia = dto.Fecha.Date;
        if (dto.Filas.Count == 0) return BadRequest(new { mensaje = "Agrega al menos un renglón de producción" });

        if (editar)
        {
            if (dia != diaEditado!.Value && await ExisteReporteAsync(dia)) return BadRequest(new { mensaje = MensajeDiaOcupado(dia) });
        }
        else if (await ExisteReporteAsync(dia)) return BadRequest(new { mensaje = MensajeDiaOcupado(dia) });

        // ── Validación básica de los renglones.
        var items = new List<(FilaReporteDto Dto, string Etapa)>();
        foreach (var f in dto.Filas)
        {
            var etapa = NormalizarEtapa(f.Etapa);
            if (etapa == null) return BadRequest(new { mensaje = "Cada renglón debe ser de entrada, M.P. en procesos o salida" });
            if (f.Kilos <= 0) return BadRequest(new { mensaje = "Los kilos de cada renglón deben ser mayores a 0" });
            if (string.IsNullOrWhiteSpace(f.Codigo) || !await _context.Productos.AnyAsync(p => p.Codigo == f.Codigo))
                return BadRequest(new { mensaje = "Selecciona el producto de cada renglón" });
            items.Add((f, etapa));
        }

        await using var tx = await _context.Database.BeginTransactionAsync();   // sin commit: se descarta

        // ── Deshacer el reporte anterior (si se edita).
        if (editar)
        {
            var viejas = await _context.ProduccionReporte.Where(f => f.Activo && f.Fecha.Date == diaEditado!.Value).ToListAsync();
            if (viejas.Count == 0) return NotFound();
            foreach (var s in viejas.Where(v => v.Etapa == ProduccionReporteFila.Salida))
            {
                var error = await _prod.RevisarDeshacerSalidaAsync(s);
                if (error != null) return BadRequest(new { mensaje = error });
            }
            foreach (var s in viejas.Where(v => v.Etapa == ProduccionReporteFila.Salida)) await _prod.DeshacerSalidaAsync(s);
            _context.ProduccionReporte.RemoveRange(viejas);
            await _context.SaveChangesAsync();
        }

        // ── Derivar lo usado, el rendimiento y el origen de cada renglón.
        var desbloqueado = await _prod.DesbloqueadoAsync(dia);
        var usadoAntes = (await _context.ProduccionReporte.AsNoTracking()
                .Where(f => f.Activo && f.Fecha < dia && f.Uso == ProduccionReporteFila.UsoDesbloqueado).ToListAsync())
            .GroupBy(f => f.CodigoUsado!).ToDictionary(g => g.Key, g => g.Sum(f => f.KilosUsados));
        var lineasEntrada = await _context.ProduccionInventario.AsNoTracking()
            .Where(l => l.Activo && l.Entrada > 0 && l.IdExistencia != null && l.Fecha <= dia)
            .OrderBy(l => l.Fecha).ThenBy(l => l.Orden).ToListAsync();
        var ultimoMpOrigen = new Dictionary<string, (uint?, uint?)>();
        foreach (var f in await _context.ProduccionReporte.AsNoTracking()
                     .Where(f => f.Activo && f.Fecha < dia && f.Etapa == ProduccionReporteFila.MP && !f.EsReferencia)
                     .OrderBy(f => f.Fecha).ThenBy(f => f.Orden).ToListAsync())
            ultimoMpOrigen[f.CodigoProducto] = (f.IdExistenciaOrigen, f.IdDireccionOrigen);

        var usadoEnReporte = new Dictionary<string, decimal>();
        (uint?, uint?) OrigenFifo(string codigo)
        {
            var restante = usadoAntes.GetValueOrDefault(codigo) + usadoEnReporte.GetValueOrDefault(codigo);
            foreach (var l in lineasEntrada.Where(l => l.CodigoProducto == codigo))
            {
                if (l.Entrada > restante + Eps) return (l.IdExistencia, l.IdDireccion);
                restante -= l.Entrada;
            }
            var ultima = lineasEntrada.LastOrDefault(l => l.CodigoProducto == codigo);
            return (ultima?.IdExistencia, ultima?.IdDireccion);
        }

        var derivadas = new List<Derivada>();
        Derivada? prev = null;
        decimal usadoCadena = 0;
        var orden = 0;
        foreach (var (d, etapa) in items)
        {
            orden++;
            var f = new ProduccionReporteFila
            {
                Fecha = dia, Orden = orden, CodigoProducto = d.Codigo, Etapa = etapa, Kilos = d.Kilos, IdUsuario = usuario,
                Lote = string.IsNullOrWhiteSpace(d.Lote) ? null : d.Lote.Trim(), LoteOriginal = d.LoteOriginal
            };
            var der = new Derivada { F = f, RendimientoManual = d.Rendimiento, PorcentajeManual = d.Porcentaje };

            void UsaAnterior(string uso)
            {
                f.Uso = uso;
                f.CodigoUsado = prev!.F.CodigoProducto;
                f.KilosUsados = prev.F.Kilos;
                f.IdExistenciaOrigen = prev.F.IdExistenciaOrigen;
                f.IdDireccionOrigen = prev.F.IdDireccionOrigen;
                if (uso == ProduccionReporteFila.UsoDesbloqueado)
                    usadoEnReporte[f.CodigoUsado] = usadoEnReporte.GetValueOrDefault(f.CodigoUsado) + f.KilosUsados;
            }

            switch (etapa)
            {
                case ProduccionReporteFila.Entrada:
                {
                    var disponible = desbloqueado.GetValueOrDefault(d.Codigo) - usadoEnReporte.GetValueOrDefault(d.Codigo);
                    if (d.Kilos > disponible + Eps)
                        return BadRequest(new { mensaje = $"No puedes ingresar {d.Kilos:0.###} kg de {d.Codigo}: solo hay {Math.Max(disponible, 0):0.###} kg desbloqueados. Solicita el desbloqueo de más producto en Producción." });
                    var origen = OrigenFifo(d.Codigo);
                    f.IdExistenciaOrigen = origen.Item1;
                    f.IdDireccionOrigen = origen.Item2;
                    break;
                }
                case ProduccionReporteFila.MP:
                    if (prev?.F.Etapa == ProduccionReporteFila.Entrada) UsaAnterior(ProduccionReporteFila.UsoDesbloqueado);
                    else if (prev?.F.Etapa == ProduccionReporteFila.MP) UsaAnterior(ProduccionReporteFila.UsoProceso);
                    else
                    {
                        // Sin entrada antes: solo referencia producto que ya estaba en proceso.
                        f.EsReferencia = true;
                        var origen = derivadas.LastOrDefault(x => x.F.Etapa == ProduccionReporteFila.MP && !x.F.EsReferencia && x.F.CodigoProducto == d.Codigo)?.F;
                        if (origen != null) { f.IdExistenciaOrigen = origen.IdExistenciaOrigen; f.IdDireccionOrigen = origen.IdDireccionOrigen; }
                        else if (ultimoMpOrigen.TryGetValue(d.Codigo, out var o)) { f.IdExistenciaOrigen = o.Item1; f.IdDireccionOrigen = o.Item2; }
                    }
                    break;
                case ProduccionReporteFila.Salida:
                    if (prev == null)
                        return BadRequest(new { mensaje = "Una salida necesita un renglón anterior de entrada o de M.P. en procesos" });
                    if (prev.F.Etapa == ProduccionReporteFila.Salida)
                    {
                        // Otra salida de la misma entrada: es el rendimiento.
                        f.IdExistenciaOrigen = prev.F.IdExistenciaOrigen;
                        f.IdDireccionOrigen = prev.F.IdDireccionOrigen;
                        f.Rendimiento = d.Kilos;
                        f.Porcentaje = usadoCadena > 0 ? Math.Round(d.Kilos / usadoCadena * 100, 2) : 0m;
                    }
                    else
                    {
                        UsaAnterior(prev.F.Etapa == ProduccionReporteFila.Entrada ? ProduccionReporteFila.UsoDesbloqueado : ProduccionReporteFila.UsoProceso);
                        usadoCadena = f.KilosUsados;
                        f.Rendimiento = d.Kilos - f.KilosUsados;
                        f.Porcentaje = f.KilosUsados > 0 ? Math.Round((d.Kilos - f.KilosUsados) / f.KilosUsados * 100, 2) : 0m;
                    }
                    if (der.RendimientoManual.HasValue) f.Rendimiento = der.RendimientoManual;
                    if (der.PorcentajeManual.HasValue) f.Porcentaje = der.PorcentajeManual;
                    break;
            }
            derivadas.Add(der);
            prev = der;
        }

        // ── Aplicar: las salidas ingresan a Conpaq como lote nuevo.
        var idIngreso = await _prod.TipoMovimientoAsync("Traspaso de producción", crear: true);
        HistorialMovimiento? historial = null;
        foreach (var der in derivadas)
        {
            var f = der.F;
            _context.ProduccionReporte.Add(f);
            if (f.Etapa != ProduccionReporteFila.Salida) continue;

            historial ??= _context.HistorialesMovimiento.Add(new HistorialMovimiento { FechaRegistro = dia, IdUsuario = usuario }).Entity;
            var origenLote = f.IdExistenciaOrigen.HasValue ? (await _context.Existencias.FindAsync(f.IdExistenciaOrigen.Value))?.Lote : null;
            if (f.LoteOriginal && origenLote == null)
                return BadRequest(new { mensaje = $"No se conoce el lote de origen de {f.CodigoProducto}: escribe el lote de la salida." });
            var idDireccionIngreso = await _prod.DireccionIngresoAsync(f.IdDireccionOrigen);
            decimal kilosLote = f.Kilos, kilosExtra = 0;
            string nombreLote;
            if (f.LoteOriginal)
            {
                // El lote del que provenía el producto la primera vez. Si salió directo de la entrada y sobró peso,
                // el lote original conserva su peso y lo sobrante crea un lote nuevo.
                nombreLote = origenLote!;
                if (f.Uso == ProduccionReporteFila.UsoDesbloqueado && f.Kilos > f.KilosUsados)
                {
                    kilosLote = f.KilosUsados;
                    kilosExtra = f.Kilos - f.KilosUsados;
                }
            }
            else
                nombreLote = f.Lote ?? await _prod.LoteAutomaticoAsync(dia);

            var lote = new Existencia { Lote = nombreLote, CodigoProducto = f.CodigoProducto, LoteOrigen = origenLote };
            _context.Existencias.Add(lote);
            _context.UbicacionesProducto.Add(new UbicacionProducto { Existencia = lote, IdDireccion = idDireccionIngreso, CantidadKilos = kilosLote });
            var det = new DetalleMovimiento { HistorialMovimiento = historial, Existencia = lote, Kilos = kilosLote, IdTipoMovimiento = idIngreso, IdDireccion = idDireccionIngreso };
            _context.DetallesMovimiento.Add(det);
            // Los nombres automáticos dependen de lo ya guardado: se guarda cada lote antes de calcular el siguiente.
            await _context.SaveChangesAsync();
            f.IdExistenciaSalida = lote.Id;
            f.IdDetalleMovimiento = det.Id;

            if (kilosExtra > 0)
            {
                var loteExtra = new Existencia { Lote = await _prod.LoteAutomaticoAsync(dia), CodigoProducto = f.CodigoProducto, LoteOrigen = origenLote };
                _context.Existencias.Add(loteExtra);
                _context.UbicacionesProducto.Add(new UbicacionProducto { Existencia = loteExtra, IdDireccion = idDireccionIngreso, CantidadKilos = kilosExtra });
                var detExtra = new DetalleMovimiento { HistorialMovimiento = historial, Existencia = loteExtra, Kilos = kilosExtra, IdTipoMovimiento = idIngreso, IdDireccion = idDireccionIngreso };
                _context.DetallesMovimiento.Add(detExtra);
                await _context.SaveChangesAsync();
                f.IdExistenciaExtra = loteExtra.Id;
                f.IdDetalleMovimientoExtra = detExtra.Id;
            }
        }
        await _context.SaveChangesAsync();

        var errorLinea = await _prod.ValidarLineaDeTiempoAsync();
        if (errorLinea != null) return BadRequest(new { mensaje = errorLinea });
        await tx.CommitAsync();

        await _auditoria.RegistrarAsync("producciones", dia.ToString("yyyy-MM-dd"), editar ? "MODIFICAR" : "CREAR", null, new
        {
            fecha = dia,
            renglones = derivadas.Count,
            entrada = derivadas.Where(x => x.F.Etapa == ProduccionReporteFila.Entrada).Sum(x => x.F.Kilos),
            salida = derivadas.Where(x => x.F.Etapa == ProduccionReporteFila.Salida).Sum(x => x.F.Kilos)
        }, usuario);

        return Ok(new { fecha = dia.ToString("yyyy-MM-dd") });
    }

    // POST api/producciones — crea el reporte del día. Solo puede haber UNO por día.
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearProduccionDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "produccion", "crear"))
            return this.SinPermiso();
        await ProduccionService.Candado.WaitAsync();
        try { return await GuardarAsync(dto, null); }
        finally { ProduccionService.Candado.Release(); }
    }

    // PUT api/producciones/reporte/2026-10-22 — edita el reporte del día por completo.
    [HttpPut("reporte/{fecha}")]
    public async Task<IActionResult> EditarReporte(string fecha, [FromBody] CrearProduccionDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "produccion", "editar"))
            return this.SinPermiso();
        if (!ProduccionService.TryDia(fecha, out var dia)) return BadRequest(new { mensaje = "Fecha inválida" });
        await ProduccionService.Candado.WaitAsync();
        try { return await GuardarAsync(dto, dia); }
        finally { ProduccionService.Candado.Release(); }
    }
}

public class CrearProduccionDto
{
    public uint IdUsuario { get; set; }
    public DateTime Fecha { get; set; }
    public List<FilaReporteDto> Filas { get; set; } = new();
}

// Un renglón del reporte: el producto, en qué columna se capturaron los kilos (Entrada, MP o Salida) y cuántos.
public class FilaReporteDto
{
    public string Codigo { get; set; } = "";
    public string Etapa { get; set; } = "";
    public decimal Kilos { get; set; }
    // Solo en la salida: el lote que se escribe, o "original" (el lote del que provenía el producto la primera vez).
    public string? Lote { get; set; }
    public bool LoteOriginal { get; set; }
    public decimal? Rendimiento { get; set; }
    public decimal? Porcentaje { get; set; }
}
