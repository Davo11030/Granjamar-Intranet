using Empresa.Intranet.API.Extensiones;
using Empresa.Intranet.API.Filtros;
using Empresa.Intranet.API.Servicios;
using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
using Empresa.Intranet.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Controllers;

// Solicitudes de compra a empresas en consignación. Las crea el sistema solo (ver
// PedidosConsignacionService); aquí se consultan, se liberan (con orden de embarque + documento) y
// se les sube la factura.
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PedidosConsignacionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly ArchivosDocumentoService _archivos;

    public PedidosConsignacionController(AppDbContext context, AuditoriaService auditoria, ArchivosDocumentoService archivos)
    {
        _context = context;
        _auditoria = auditoria;
        _archivos = archivos;
    }

    // GET api/pedidosconsignacion?idEmpresa=3 — del más nuevo al más viejo.
    [RequierePermiso("inventario", "ver")]
    [HttpGet]
    public async Task<IActionResult> GetTodos([FromQuery] uint? idEmpresa)
    {
        var pedidos = await _context.PedidosConsignacion
            .Include(p => p.DocumentoOrden).Include(p => p.DocumentoFactura)
            .Where(p => p.Activo && (idEmpresa == null || p.IdEmpresa == idEmpresa))
            .OrderByDescending(p => p.Fecha).ThenByDescending(p => p.Id)
            .Select(p => new
            {
                p.Id, p.Numero, p.Fecha, p.TipoDestino, p.Destino, p.Estado, p.OrdenEmbarque,
                IdDocumentoOrden = p.IdDocumentoOrden,
                TieneOrden = p.DocumentoOrden != null && p.DocumentoOrden.ArchivoRuta != null,
                IdDocumentoFactura = p.IdDocumentoFactura,
                NumeroFactura = p.DocumentoFactura != null ? p.DocumentoFactura.Numero : null,
                TieneFactura = p.DocumentoFactura != null && p.DocumentoFactura.ArchivoRuta != null,
                Productos = p.Detalles.Count
            })
            .ToListAsync();
        return Ok(pedidos);
    }

    // GET api/pedidosconsignacion/5 — el detalle de lo que se pide.
    [RequierePermiso("inventario", "ver")]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var p = await _context.PedidosConsignacion
            .Include(x => x.Empresa)
            .Include(x => x.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.Especie)
            .Include(x => x.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.Marca)
            .Include(x => x.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.Talla)
            .Include(x => x.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.PesoCaja)
            .FirstOrDefaultAsync(x => x.Id == id && x.Activo);
        if (p == null) return NotFound();
        return Ok(new
        {
            p.Id, p.Numero, p.Fecha, Empresa = p.Empresa.Nombre, p.TipoDestino, p.Destino, p.Estado,
            p.OrdenEmbarque, p.FechaLiberacion,
            Detalles = p.Detalles.Select(d => new
            {
                d.Id,
                Codigo = d.CodigoProducto,
                Descripcion = d.Producto.Especie.Nombre,
                Marca = d.Producto.Marca?.Nombre,
                Talla = d.Producto.Talla?.Descripcion,
                d.Kilos,
                Cajas = d.Producto.PesoCaja != null && d.Producto.PesoCaja.Peso > 0
                    ? Math.Round(d.Kilos / d.Producto.PesoCaja.Peso, 2) : (decimal?)null
            })
        });
    }

    // PUT api/pedidosconsignacion/5/liberar — Pendiente → Liberado. Pide el número de la orden de
    // embarque Y su documento (como las facturas de las entradas: el documento queda registrado con
    // su número y se puede consultar después desde Pedimentos).
    [RequierePermiso("inventario", "editar")]
    [RequestSizeLimit(20_000_000)]
    [HttpPut("{id}/liberar")]
    public async Task<IActionResult> Liberar(uint id, [FromForm] string? ordenEmbarque, [FromForm] IFormFile? archivo)
    {
        var pedido = await _context.PedidosConsignacion.FirstOrDefaultAsync(p => p.Id == id && p.Activo);
        if (pedido == null) return NotFound();
        if (pedido.Estado == PedidosConsignacionService.Liberado)
            return BadRequest(new { mensaje = "Este pedido ya está liberado" });
        if (string.IsNullOrWhiteSpace(ordenEmbarque))
            return BadRequest(new { mensaje = "Indica el número de la orden de embarque" });
        if (archivo == null)
            return BadRequest(new { mensaje = "Sube el documento de la orden de embarque" });

        var resultado = await GuardarDocumentoAsync("Orden de embarque", ordenEmbarque.Trim(), archivo);
        if (resultado.Error != null) return BadRequest(new { mensaje = resultado.Error });

        pedido.Estado = PedidosConsignacionService.Liberado;
        pedido.OrdenEmbarque = ordenEmbarque.Trim();
        pedido.FechaLiberacion = DateTime.UtcNow;
        pedido.IdDocumentoOrden = resultado.IdDocumento;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("pedidos_consignacion", id.ToString(), "MODIFICAR",
            new { pedido.Numero, Estado = PedidosConsignacionService.Pendiente },
            new { pedido.Numero, pedido.Estado, pedido.OrdenEmbarque }, this.IdUsuarioActual());
        return Ok(new { pedido.Id, pedido.Estado, pedido.OrdenEmbarque });
    }

    // PUT api/pedidosconsignacion/5/factura — sube (o reemplaza, por si se subió una por error) la factura.
    [RequierePermiso("inventario", "editar")]
    [RequestSizeLimit(20_000_000)]
    [HttpPut("{id}/factura")]
    public async Task<IActionResult> SubirFactura(uint id, [FromForm] string? numeroFactura, [FromForm] IFormFile? archivo)
    {
        var pedido = await _context.PedidosConsignacion.Include(p => p.DocumentoFactura)
            .FirstOrDefaultAsync(p => p.Id == id && p.Activo);
        if (pedido == null) return NotFound();
        if (string.IsNullOrWhiteSpace(numeroFactura))
            return BadRequest(new { mensaje = "Indica el número de la factura" });
        if (archivo == null)
            return BadRequest(new { mensaje = "Sube el archivo de la factura" });

        var anterior = pedido.DocumentoFactura?.Numero;
        var resultado = await GuardarDocumentoAsync("Factura", numeroFactura.Trim(), archivo);
        if (resultado.Error != null) return BadRequest(new { mensaje = resultado.Error });

        pedido.IdDocumentoFactura = resultado.IdDocumento;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("pedidos_consignacion", id.ToString(), "MODIFICAR",
            new { pedido.Numero, Factura = anterior }, new { pedido.Numero, Factura = numeroFactura.Trim() },
            this.IdUsuarioActual());
        return Ok(new { pedido.Id, NumeroFactura = numeroFactura.Trim() });
    }

    // Registra el documento (mismo tipo+número → el mismo documento) y le pone el archivo. Valida el
    // archivo ANTES de crear nada.
    private async Task<(string? Error, uint IdDocumento)> GuardarDocumentoAsync(string tipoNombre, string numero, IFormFile archivo)
    {
        var (error, token, _) = await _archivos.GuardarTemporalAsync(archivo);
        if (error != null || token == null) return (error ?? "No se pudo leer el archivo", 0);

        var tipo = await _context.DocumentosTipo.FirstOrDefaultAsync(t => t.Nombre.ToLower() == tipoNombre.ToLower());
        if (tipo == null)
        {
            tipo = new DocumentoTipo { Nombre = tipoNombre };
            _context.DocumentosTipo.Add(tipo);
            await _context.SaveChangesAsync();
        }
        var doc = await _context.Documentos.FirstOrDefaultAsync(d => d.Numero == numero && d.IdDocumentoTipo == tipo.Id);
        if (doc == null)
        {
            doc = new Documento { Numero = numero, Fecha = DateTime.UtcNow, IdDocumentoTipo = tipo.Id };
            _context.Documentos.Add(doc);
            await _context.SaveChangesAsync();
        }

        var adjunto = await _archivos.AdjuntarTemporalAsync(doc.Id, token);
        if (adjunto == null) return ("No se pudo guardar el archivo", 0);
        var anterior = doc.ArchivoRuta;
        doc.ArchivoRuta = adjunto.Value.Ruta;
        doc.ArchivoNombre = adjunto.Value.Nombre;
        doc.ArchivoTipo = adjunto.Value.Tipo;
        doc.FechaArchivo = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        _archivos.Eliminar(anterior);
        return (null, doc.Id);
    }
}
