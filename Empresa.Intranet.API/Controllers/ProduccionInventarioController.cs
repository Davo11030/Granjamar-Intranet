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

// TABLA GENERAL de producción: siempre disponible, un día a la vez. Cada renglón es un producto con
//   Inicial    (bloqueado, lo que cerró el día anterior; no se edita)
//   Entradas   (producto que ingresa a producción, bloqueado: sale de Conpaq o se pide a consignación)
//   Salida     (kilos que se DESBLOQUEAN para usarlos en el reporte del día)
//   Existencia (Inicial + Entradas − Salida; es el Inicial del día siguiente. Con 0 el producto ya no aparece.)
// Lo que entra de CONSIGNACIÓN no descuenta su inventario todavía: queda como solicitud (SolicitudProduccion) para
// agruparla en pedidos; la aprobación del pedido es contable y no frena el trabajo.
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProduccionInventarioController : ControllerBase
{
    private const decimal Eps = ProduccionService.Eps;

    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;
    private readonly ProduccionService _prod;
    private readonly PedidosConsignacionService _pedidos;

    public ProduccionInventarioController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService, ProduccionService prod,
        PedidosConsignacionService pedidos)
    {
        _pedidos = pedidos;
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
        _prod = prod;
    }

    // GET api/produccioninventario?fecha=2026-10-23 — la tabla del día (hoy si no se indica fecha).
    [RequierePermiso("produccion", "ver")]
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? fecha)
    {
        DateTime dia;
        if (string.IsNullOrWhiteSpace(fecha)) dia = DateTime.UtcNow.Date;
        else if (!ProduccionService.TryDia(fecha, out dia)) return BadRequest(new { mensaje = "Fecha inválida" });

        var grupos = await _prod.InicialesPorOrigenAsync(dia);
        var lineas = await _context.ProduccionInventario.AsNoTracking()
            .Include(l => l.Producto).ThenInclude(p => p.Especie)
            .Where(l => l.Activo && l.Fecha.Date == dia).OrderBy(l => l.Orden).ThenBy(l => l.Id).ToListAsync();
        var ids = lineas.Select(l => l.Id).ToList();
        var solicitudes = await _context.SolicitudesProduccion.AsNoTracking().Include(s => s.Pedido)
            .Where(s => s.Activo && s.IdLinea != null && ids.Contains(s.IdLinea!.Value)).ToListAsync();
        var idsEx = lineas.Where(l => l.IdExistencia.HasValue).Select(l => l.IdExistencia!.Value)
            .Concat(grupos.Where(g => g.IdExistencia.HasValue).Select(g => g.IdExistencia!.Value)).Distinct().ToList();
        var lotes = await _context.Existencias.AsNoTracking().Where(e => idsEx.Contains(e.Id)).ToDictionaryAsync(e => e.Id, e => e.Lote);
        var idsDir = grupos.Where(g => g.IdDireccion.HasValue).Select(g => g.IdDireccion!.Value).Distinct().ToList();
        var consignacionPorDireccion = await _context.Direcciones.AsNoTracking()
            .Where(d => idsDir.Contains(d.Id) && d.Empresa != null && d.Empresa.Tipo != null && d.Empresa.Tipo.ToLower() == "consignacion")
            .Select(d => d.Id).ToListAsync();

        // El Inicial de cada producto y origen va en el primer renglón de ese origen.
        var inicialPorGrupo = grupos.ToDictionary(g => (g.Codigo, g.IdExistencia, g.IdDireccion), g => g.Kilos);
        var yaMostrado = new HashSet<(string, uint?, uint?)>();
        var filas = new List<object>();
        foreach (var l in lineas)
        {
            var clave = (l.CodigoProducto, l.IdExistencia, l.IdDireccion);
            var inicial = inicialPorGrupo.TryGetValue(clave, out var k) && yaMostrado.Add(clave) ? k : 0m;
            var s = solicitudes.FirstOrDefault(x => x.IdLinea == l.Id);
            filas.Add(new
            {
                Id = (uint?)l.Id,
                Codigo = l.CodigoProducto,
                Articulo = l.Producto.Especie.Nombre,
                l.IdExistencia,
                l.IdDireccion,
                Lote = l.IdExistencia.HasValue ? lotes.GetValueOrDefault(l.IdExistencia.Value) : null,
                l.EsConsignacion,
                Inicial = inicial,
                l.Entrada,
                l.Salida,
                IdPedido = s?.IdPedido,
                NumeroPedido = s?.Pedido?.Numero,
                // Solo un pedido ya liberado o facturado (comprado) bloquea el origen: los kilos siempre se pueden modificar.
                Bloqueada = s?.Pedido != null && (s.Pedido.Estado == PedidosConsignacionService.Liberado || s.Pedido.IdDocumentoFactura != null)
            });
        }

        // Lo que viene de días anteriores aparece aunque hoy no tenga movimiento, con su origen ya fijo.
        var codigosArrastre = grupos.Select(g => g.Codigo).Distinct().ToList();
        var articulos = await _context.Productos.AsNoTracking().Where(p => codigosArrastre.Contains(p.Codigo))
            .Select(p => new { p.Codigo, Nombre = p.Especie.Nombre }).ToDictionaryAsync(p => p.Codigo, p => p.Nombre);
        var arrastre = grupos
            .Where(g => !lineas.Any(l => l.CodigoProducto == g.Codigo && l.IdExistencia == g.IdExistencia && l.IdDireccion == g.IdDireccion))
            .Select(g => (object)new
            {
                Id = (uint?)null,
                Codigo = g.Codigo,
                Articulo = articulos.GetValueOrDefault(g.Codigo, ""),
                g.IdExistencia,
                g.IdDireccion,
                Lote = g.IdExistencia.HasValue ? lotes.GetValueOrDefault(g.IdExistencia.Value) : null,
                EsConsignacion = g.IdDireccion.HasValue && consignacionPorDireccion.Contains(g.IdDireccion.Value),
                Inicial = g.Kilos,
                Entrada = 0m,
                Salida = 0m,
                IdPedido = (uint?)null,
                NumeroPedido = (string?)null,
                Bloqueada = false
            });

        var desbloqueado = await _prod.DesbloqueadoAsync(dia);
        return Ok(new
        {
            Fecha = dia.ToString("yyyy-MM-dd"),
            Desbloqueado = desbloqueado,
            Filas = arrastre.Concat(filas)
        });
    }

    // PUT api/produccioninventario/2026-10-23 — guarda la tabla del día por completo.
    [HttpPut("{fecha}")]
    public async Task<IActionResult> Guardar(string fecha, [FromBody] GuardarInventarioDto dto)
    {
        var usuario = this.IdUsuarioActual();
        if (!await _permisoService.TienePermisoAsync(usuario, "produccion", "editar")
            && !await _permisoService.TienePermisoAsync(usuario, "produccion", "crear"))
            return this.SinPermiso();
        if (!ProduccionService.TryDia(fecha, out var dia)) return BadRequest(new { mensaje = "Fecha inválida" });

        await ProduccionService.Candado.WaitAsync();
        try
        {
            await using var tx = await _context.Database.BeginTransactionAsync();
            var error = await AplicarAsync(dia, dto, usuario);
            if (error != null) return BadRequest(new { mensaje = error });   // sin commit: la transacción se descarta
            error = await _prod.ValidarLineaDeTiempoAsync();
            if (error != null) return BadRequest(new { mensaje = error });
            await tx.CommitAsync();
            return Ok(new { fecha = dia.ToString("yyyy-MM-dd") });
        }
        finally { ProduccionService.Candado.Release(); }
    }

    private async Task<string?> AplicarAsync(DateTime dia, GuardarInventarioDto dto, uint usuario)
    {
        var nuevas = dto.Lineas.Where(l => l.Entrada > 0 || l.Salida > 0).ToList();
        if (dto.Lineas.Any(l => l.Entrada < 0 || l.Salida < 0)) return "Los kilos no pueden ser negativos";

        // ── Lo que ya había ese día.
        var viejas = await _context.ProduccionInventario.Where(l => l.Activo && l.Fecha.Date == dia).ToListAsync();
        var idsViejas = viejas.Select(l => l.Id).ToList();
        var solicitudesViejas = await _context.SolicitudesProduccion.Include(s => s.Pedido)
            .Where(s => s.Activo && s.IdLinea != null && idsViejas.Contains(s.IdLinea!.Value)).ToListAsync();

        // Las entradas de consignación que ya están en un pedido: el pedido es contable y no frena el trabajo, así que
        // sus kilos se pueden modificar. Pedido pendiente sin factura → se actualiza con los kilos nuevos (o desaparece si
        // se quita su única entrada). Pedido liberado o con factura (ya comprado) → no se toca: la entrada puede cambiar
        // de kilos pero no quitarse ni cambiar de origen.
        var enSitio = new List<(ProduccionInventarioLinea Linea, SolicitudProduccion Sol, LineaInventarioDto Cliente, bool Cerrado)>();
        var pedidosARefrescar = new HashSet<uint>();
        foreach (var v in viejas)
        {
            var sol = solicitudesViejas.FirstOrDefault(s => s.IdLinea == v.Id && s.IdPedido != null);
            if (sol == null) continue;
            var cerrado = sol.Pedido!.Estado == PedidosConsignacionService.Liberado || sol.Pedido.IdDocumentoFactura != null;
            var cliente = nuevas.FirstOrDefault(l => l.Id == v.Id);
            var mismo = cliente != null && cliente.Codigo == v.CodigoProducto && cliente.IdExistencia == v.IdExistencia
                && cliente.IdDireccion == v.IdDireccion && cliente.Entrada > 0;
            if (mismo) enSitio.Add((v, sol, cliente!, cerrado));
            else if (cerrado)
                return $"La entrada de {v.CodigoProducto} ya está en el pedido {sol.Pedido.Numero}, liberado o facturado: puedes cambiar sus kilos pero no quitarla ni cambiar su origen.";
            else pedidosARefrescar.Add(sol.IdPedido!.Value);   // se reemplaza como cualquier otra entrada
        }
        var idsEnSitio = enSitio.Select(e => e.Linea.Id).ToHashSet();

        // ── Validar los renglones nuevos.
        var origenes = new Dictionary<uint, ProduccionService.Origen>();
        var ubicaciones = new Dictionary<(uint, uint), UbicacionProducto>();
        var pedido = new Dictionary<(uint, uint), decimal>();
        foreach (var l in nuevas.Where(x => !(x.Id.HasValue && idsEnSitio.Contains(x.Id.Value))))
        {
            if (string.IsNullOrWhiteSpace(l.Codigo) || !await _context.Productos.AnyAsync(p => p.Codigo == l.Codigo))
                return "Selecciona el producto de cada renglón";
            if (!l.IdExistencia.HasValue || !l.IdDireccion.HasValue)
                return $"Selecciona el origen de {l.Codigo}";
            var ex = await _context.Existencias.FindAsync(l.IdExistencia.Value);
            if (ex == null || ex.CodigoProducto != l.Codigo) return $"El origen seleccionado no es de {l.Codigo}";
            var origen = await _prod.OrigenDeDireccionAsync(l.IdDireccion.Value);
            if (origen == null) return "El origen seleccionado no pertenece a ninguna empresa";
            if (!origen.EsPropia && !origen.EsConsignacion) return "Producción solo puede tomar producto de Granjamar o de consignación";
            origenes[l.IdDireccion.Value] = origen;
            if (l.Entrada <= 0) continue;
            var ub = await _context.UbicacionesProducto.FirstOrDefaultAsync(u => u.IdExistencia == l.IdExistencia.Value && u.IdDireccion == l.IdDireccion.Value);
            if (ub == null) return $"No hay stock de {l.Codigo} en el origen seleccionado";
            ubicaciones[(l.IdExistencia.Value, l.IdDireccion.Value)] = ub;
            if (origen.EsPropia)
                pedido[(l.IdExistencia.Value, l.IdDireccion.Value)] = pedido.GetValueOrDefault((l.IdExistencia.Value, l.IdDireccion.Value)) + l.Entrada;
        }
        // Stock de Conpaq para lo que entra (contando lo que este mismo día devuelve al borrarse lo anterior).
        var devuelto = new Dictionary<(uint, uint), decimal>();
        foreach (var v in viejas.Where(v => !idsEnSitio.Contains(v.Id) && !v.EsConsignacion && v.Entrada > 0 && v.IdExistencia.HasValue && v.IdDireccion.HasValue))
            devuelto[(v.IdExistencia!.Value, v.IdDireccion!.Value)] = devuelto.GetValueOrDefault((v.IdExistencia.Value, v.IdDireccion.Value)) + v.Entrada;
        foreach (var (k, kilos) in pedido)
        {
            var disponible = ubicaciones[k].CantidadKilos + devuelto.GetValueOrDefault(k);
            if (disponible + Eps < kilos) return $"Stock insuficiente en el origen seleccionado. Disponible: {disponible:0.###} kg";
        }

        // ── Se aplica: primero se deshace lo anterior que no está bloqueado.
        foreach (var v in viejas.Where(v => !idsEnSitio.Contains(v.Id)))
        {
            if (!v.EsConsignacion && v.Entrada > 0 && v.IdExistencia.HasValue && v.IdDireccion.HasValue)
            {
                var ub = await _context.UbicacionesProducto.FirstOrDefaultAsync(u => u.IdExistencia == v.IdExistencia && u.IdDireccion == v.IdDireccion);
                if (ub != null) ub.CantidadKilos += v.Entrada;
                if (v.IdDetalleMovimiento.HasValue)
                {
                    var det = await _context.DetallesMovimiento.FindAsync(v.IdDetalleMovimiento.Value);
                    if (det != null) _context.DetallesMovimiento.Remove(det);
                }
            }
        }
        foreach (var s in solicitudesViejas.Where(s => !idsEnSitio.Contains(s.IdLinea!.Value)))
        {
            s.Activo = false;
            s.IdLinea = null;
            if (s.IdPedido != null) pedidosARefrescar.Add(s.IdPedido.Value);
        }
        await _context.SaveChangesAsync();
        _context.ProduccionInventario.RemoveRange(viejas.Where(v => !idsEnSitio.Contains(v.Id)));
        await _context.SaveChangesAsync();

        // Las entradas que se quedan en su pedido cambian de kilos y de desbloqueo.
        foreach (var e in enSitio)
        {
            e.Linea.Salida = e.Cliente.Salida;
            if (Math.Abs(e.Linea.Entrada - e.Cliente.Entrada) > Eps)
            {
                e.Linea.Entrada = e.Cliente.Entrada;
                if (!e.Cerrado)
                {
                    e.Sol.Kilos = e.Cliente.Entrada;
                    pedidosARefrescar.Add(e.Sol.IdPedido!.Value);
                }
            }
        }

        var idTipoProd = await _prod.TipoMovimientoAsync("Produccion", crear: false);
        if (idTipoProd == 0)
            idTipoProd = (await _context.TiposMovimiento.FirstOrDefaultAsync(t => t.Nombre.ToLower().Contains("producci")))?.Id ?? 0;
        HistorialMovimiento? historial = null;

        var orden = 0;
        foreach (var l in nuevas)
        {
            orden++;
            if (l.Id.HasValue && idsEnSitio.Contains(l.Id.Value))
            {
                enSitio.First(e => e.Linea.Id == l.Id.Value).Linea.Orden = orden;
                continue;
            }
            var linea = new ProduccionInventarioLinea
            {
                Fecha = dia, Orden = orden, CodigoProducto = l.Codigo, Entrada = l.Entrada, Salida = l.Salida, IdUsuario = usuario
            };
            // El origen se guarda siempre: así el producto sigue en su renglón (con su origen fijo) los días siguientes.
            var origenLinea = origenes[l.IdDireccion!.Value];
            linea.IdExistencia = l.IdExistencia;
            linea.IdDireccion = l.IdDireccion;
            linea.IdEmpresa = origenLinea.IdEmpresa;
            linea.EsConsignacion = origenLinea.EsConsignacion;
            if (l.Entrada > 0)
            {
                var origen = origenLinea;
                _context.ProduccionInventario.Add(linea);

                if (origen.EsConsignacion)
                {
                    // La empresa todavía no lo entrega: se pide (solicitud); el producto ya está en producción.
                    _context.SolicitudesProduccion.Add(new SolicitudProduccion
                    {
                        IdEmpresa = origen.IdEmpresa, CodigoProducto = l.Codigo, Kilos = l.Entrada, IdExistencia = l.IdExistencia,
                        IdDireccion = l.IdDireccion, Fecha = dia, IdUsuario = usuario, Linea = linea
                    });
                }
                else
                {
                    if (idTipoProd == 0)
                        return "No existe tipo de movimiento 'Produccion'. Créalo en /api/CatalogosVenta/tipos-movimiento";
                    historial ??= _context.HistorialesMovimiento.Add(new HistorialMovimiento { FechaRegistro = dia, IdUsuario = usuario }).Entity;
                    var ub = ubicaciones[(l.IdExistencia!.Value, l.IdDireccion!.Value)];
                    ub.CantidadKilos -= l.Entrada;
                    var detalle = new DetalleMovimiento
                    {
                        HistorialMovimiento = historial, IdExistencia = l.IdExistencia, Kilos = l.Entrada,
                        IdTipoMovimiento = idTipoProd, IdDireccion = l.IdDireccion
                    };
                    _context.DetallesMovimiento.Add(detalle);
                    await _context.SaveChangesAsync();
                    linea.IdDetalleMovimiento = detalle.Id;
                }
            }
            else
                _context.ProduccionInventario.Add(linea);
        }
        await _context.SaveChangesAsync();
        foreach (var idPedido in pedidosARefrescar) await _pedidos.RefrescarPedidoDeSolicitudesAsync(idPedido);

        await _auditoria.RegistrarAsync("produccion_inventario", dia.ToString("yyyy-MM-dd"), "MODIFICAR", null, new
        {
            fecha = dia,
            renglones = nuevas.Count,
            entradas = nuevas.Sum(l => l.Entrada),
            desbloqueado = nuevas.Sum(l => l.Salida)
        }, usuario);
        return null;
    }
}

public class GuardarInventarioDto
{
    public List<LineaInventarioDto> Lineas { get; set; } = new();
}

// Un renglón de la tabla general. "Id" solo en los que ya estaban guardados ese día.
public class LineaInventarioDto
{
    public uint? Id { get; set; }
    public string Codigo { get; set; } = "";
    public uint? IdExistencia { get; set; }
    public uint? IdDireccion { get; set; }
    public decimal Entrada { get; set; }
    public decimal Salida { get; set; }
}
