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
public class ExistenciasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;

    public ExistenciasController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService)
    {
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
    }

    [RequierePermiso("existencias","ver","inventario/ver","ventas/crear","ventas/editar","embarques/crear","embarques/editar","produccion/crear","compras/crear")]
    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Existencias
            .Include(e => e.Producto)
            .Where(e => e.Activo)
            .Select(e => new ExistenciaDto
            {
                Id = (int)e.Id,
                Lote = e.Lote,
                CodigoProducto = e.CodigoProducto,
                Producto = e.Producto.Codigo,
                Costo = e.Costo,
                Caducidad = e.Caducidad,
                IdDocumentoOrigen = (int?)e.IdDocumentoOrigen
            })
            .ToListAsync());

    [RequierePermiso("existencias","ver","inventario/ver","ventas/crear","ventas/editar","embarques/crear","embarques/editar","produccion/crear","compras/crear")]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var e = await _context.Existencias
            .Include(e => e.Producto)
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (e == null) return NotFound();
        return Ok(new ExistenciaDto
        {
            Id = (int)e.Id,
            Lote = e.Lote,
            CodigoProducto = e.CodigoProducto,
            Producto = e.Producto.Codigo,
            Costo = e.Costo,
            Caducidad = e.Caducidad,
            IdDocumentoOrigen = (int?)e.IdDocumentoOrigen
        });
    }

    // GET api/existencias/pedimentos/CAM-U15-001 — todos los pedimentos/facturas de un código de
    // producto, uno por DOCUMENTO (se use o no en esta Solicitud), con los kilos ORIGINALES de
    // cuando entró con ese documento (la compra que lo creó, sumando todos sus lotes) — no el
    // stock actual, que puede haber bajado desde entonces. Lo usa el RT tanto para los kilos
    // totales de los pedimentos automáticos de un renglón como para la lista de "agregar otro".
    [RequierePermiso("existencias","ver","inventario/ver","ventas/crear","ventas/editar","embarques/crear","embarques/editar","produccion/crear","compras/crear","compras/ver")]
    [HttpGet("pedimentos/{codigoProducto}")]
    public async Task<IActionResult> GetPedimentosPorProducto(string codigoProducto)
    {
        var existencias = await _context.Existencias
            .Include(e => e.DocumentoOrigen).ThenInclude(doc => doc!.DocumentoTipo)
            .Where(e => e.CodigoProducto == codigoProducto && e.Activo && e.IdDocumentoOrigen != null)
            .ToListAsync();

        var kilosPorLote = await _context.DetallesMovimiento
            .Where(d => d.IdExistencia != null
                && existencias.Select(e => e.Id).Contains(d.IdExistencia!.Value)
                && d.TipoMovimiento.Nombre.ToLower().Contains("compra"))
            .GroupBy(d => d.IdExistencia!.Value)
            .Select(g => new { IdExistencia = g.Key, Kilos = g.Sum(d => d.Kilos) })
            .ToDictionaryAsync(x => x.IdExistencia, x => x.Kilos);
        var kilosUsados = await _context.KilosUsadosPorDocumento(codigoProducto);
        // Conteo legal: cuánto le queda al documento = lo que entró − lo que las RT ya le descontaron.

        // Un renglón por DOCUMENTO (no por lote): el conteo de kilos es por documento, porque un
        // mismo nombre de lote puede ingresar varias veces con documentos distintos (cada uno con
        // sus propios kilos), y un mismo documento puede cubrir varios lotes del mismo código.
        // Facturas de pedidos de consignación de este código: también respaldan kilos de este producto
        // (aunque sus lotes no traigan documento) y se cuentan por (documento, producto) como los demás.
        var kilosPedido = await _context.KilosPedidoPorDocumento(codigoProducto);

        var documentos = existencias
            .GroupBy(e => e.IdDocumentoOrigen!.Value)
            .Select(g =>
            {
                var primero = g.First();
                return new DocumentoPedimentoDto(
                    g.Key,
                    primero.DocumentoOrigen!.DocumentoTipo.Nombre,
                    primero.DocumentoOrigen.Numero,
                    primero.DocumentoOrigen.ArchivoRuta != null,
                    primero.DocumentoOrigen.Fecha,
                    g.Sum(e => kilosPorLote.GetValueOrDefault(e.Id)) + kilosPedido.GetValueOrDefault(g.Key),
                    kilosUsados.GetValueOrDefault(g.Key),
                    g.Select(e => new LoteDocumentoDto(e.Id, e.Lote, kilosPorLote.GetValueOrDefault(e.Id))).ToList());
            })
            .ToList();

        // TODOS los demás pedimentos y facturas del sistema también se ofrecen (por ejemplo la factura de
        // un pedido de consignación, o un documento que cubre otros productos). Los que no traen kilos de
        // ESTE producto salen con 0: se pueden marcar en la RT pero no descuentan nada. Las órdenes de
        // embarque no cuentan: no son pedimento ni factura.
        var yaListados = documentos.Select(d => d.IdDocumento).ToHashSet();
        var otros = await _context.Documentos.Include(d => d.DocumentoTipo)
            .Where(d => !yaListados.Contains(d.Id) && d.DocumentoTipo.Nombre.ToLower() != "orden de embarque")
            .OrderBy(d => d.Id).ToListAsync();
        foreach (var d in otros)
            documentos.Add(new DocumentoPedimentoDto(d.Id, d.DocumentoTipo.Nombre, d.Numero, d.ArchivoRuta != null,
                d.Fecha, kilosPedido.GetValueOrDefault(d.Id), kilosUsados.GetValueOrDefault(d.Id), new List<LoteDocumentoDto>()));
        return Ok(documentos);
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearExistenciaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "existencias", "crear"))
            return this.SinPermiso();

        var producto = await _context.Productos.FindAsync(dto.CodigoProducto);
        if (producto == null) return BadRequest(new { mensaje = "No existe ese producto" });

        var existencia = new Existencia
        {
            Lote = dto.Lote,
            CodigoProducto = dto.CodigoProducto,
            Costo = dto.Costo,
            Caducidad = dto.Caducidad,
            IdDocumentoOrigen = (uint?)dto.IdDocumentoOrigen
        };

        _context.Existencias.Add(existencia);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("existencias", existencia.Id.ToString(), "CREAR", null, new
        {
            existencia.Id,
            existencia.Lote,
            existencia.CodigoProducto,
            existencia.Costo,
            existencia.Caducidad
        }, dto.IdUsuario);

        return CreatedAtAction(nameof(GetPorId), new { id = existencia.Id },
            new { existencia.Id, existencia.Lote, existencia.CodigoProducto });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Actualizar(uint id, [FromBody] CrearExistenciaDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(dto.IdUsuario, "existencias", "editar"))
            return this.SinPermiso();

        var existencia = await _context.Existencias
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (existencia == null) return NotFound();

        var datosAnteriores = new
        {
            existencia.Lote,
            existencia.CodigoProducto,
            existencia.Costo,
            existencia.Caducidad
        };

        existencia.Lote = dto.Lote;
        existencia.CodigoProducto = dto.CodigoProducto;
        existencia.Costo = dto.Costo;
        existencia.Caducidad = dto.Caducidad;
        existencia.IdDocumentoOrigen = (uint?)dto.IdDocumentoOrigen;

        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("existencias", id.ToString(), "MODIFICAR", datosAnteriores, new
        {
            existencia.Lote,
            existencia.CodigoProducto,
            existencia.Costo,
            existencia.Caducidad
        }, dto.IdUsuario);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(uint id, [FromQuery] uint idUsuario)
    {
        if (!await _permisoService.TienePermisoAsync(idUsuario, "existencias", "eliminar"))
            return this.SinPermiso();

        var existencia = await _context.Existencias
            .FirstOrDefaultAsync(e => e.Id == id && e.Activo);
        if (existencia == null) return NotFound();

        var datosAnteriores = new
        {
            existencia.Id,
            existencia.Lote,
            existencia.CodigoProducto,
            existencia.Costo
        };

        existencia.Activo = false;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("existencias", id.ToString(), "ELIMINAR",
            datosAnteriores, null, idUsuario);

        return NoContent();
    }
}
public record LoteDocumentoDto(uint IdExistencia, string Lote, decimal Kilos);

public record DocumentoPedimentoDto(uint IdDocumento, string TipoDocumento, string NumeroDocumento, bool TieneArchivo,
    DateTime FechaDocumento, decimal KilosOriginales, decimal KilosUsados, List<LoteDocumentoDto> Lotes);
