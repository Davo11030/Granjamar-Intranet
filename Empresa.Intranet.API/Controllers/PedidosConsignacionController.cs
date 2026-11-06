using System.Text.Json;
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
// PedidosConsignacionService); aquí se consultan, se dividen, se liberan (con una o varias órdenes de embarque + su
// documento) y se le sube la factura a cada orden.
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PedidosConsignacionController : ControllerBase
{
    private const decimal Tolerancia = 0.0005m;

    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly ArchivosDocumentoService _archivos;
    private readonly PedidosConsignacionService _pedidos;
    private readonly ConfiguracionDocumentosService _documentos;

    public PedidosConsignacionController(AppDbContext context, AuditoriaService auditoria, ArchivosDocumentoService archivos,
        PedidosConsignacionService pedidos, ConfiguracionDocumentosService documentos)
    {
        _documentos = documentos;
        _context = context;
        _auditoria = auditoria;
        _archivos = archivos;
        _pedidos = pedidos;
    }

    // GET api/pedidosconsignacion?idEmpresa=3 — del más nuevo al más viejo.
    [RequierePermiso("inventario", "ver")]
    [HttpGet]
    public async Task<IActionResult> GetTodos([FromQuery] uint? idEmpresa)
    {
        var pedidos = await _context.PedidosConsignacion.AsNoTracking()
            .Include(p => p.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.Especie)
            .Include(p => p.Ordenes).ThenInclude(o => o.DocumentoOrden)
            .Include(p => p.Ordenes).ThenInclude(o => o.DocumentoFactura)
            .Include(p => p.Ordenes).ThenInclude(o => o.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.Especie)
            .Include(p => p.PedidoDividido)
            .Where(p => p.Activo && (idEmpresa == null || p.IdEmpresa == idEmpresa))
            .OrderByDescending(p => p.Fecha).ThenByDescending(p => p.Id)
            .ToListAsync();

        // Los pedidos en que se dividió cada pedido cancelado.
        var cancelados = pedidos.Where(p => p.Estado == PedidosConsignacionService.Cancelado).Select(p => p.Id).ToList();
        var hijos = cancelados.Count == 0 ? new List<PedidoConsignacion>()
            : await _context.PedidosConsignacion.AsNoTracking()
                .Where(p => p.Activo && p.IdPedidoDividido != null && cancelados.Contains(p.IdPedidoDividido!.Value))
                .OrderBy(p => p.Id).ToListAsync();

        return Ok(pedidos.Select(p => new
        {
            p.Id, p.Numero, p.Fecha, p.TipoDestino, p.Destino, p.Estado,
            Productos = p.Detalles.Count,
            Kilos = p.Detalles.Sum(d => d.Kilos),
            // "Dividido de Ens-10" / "Se dividió en Ens-15, Ens-16"
            DivididoDe = p.PedidoDividido?.Numero,
            DivididoEn = hijos.Where(h => h.IdPedidoDividido == p.Id).Select(h => h.Numero).ToList(),
            // Se puede dividir mientras no se haya liberado nada.
            PuedeDividir = p.Estado == PedidosConsignacionService.Pendiente && p.Ordenes.Count == 0 && p.Detalles.Count > 0,
            Ordenes = p.Ordenes.OrderBy(o => o.Id).Select(o => new
            {
                o.Id, o.Numero, o.Fecha,
                IdDocumentoOrden = o.IdDocumentoOrden,
                TieneOrden = o.DocumentoOrden != null && o.DocumentoOrden.ArchivoRuta != null,
                IdDocumentoFactura = o.IdDocumentoFactura,
                NumeroFactura = o.DocumentoFactura != null ? o.DocumentoFactura.Numero : null,
                TieneFactura = o.DocumentoFactura != null && o.DocumentoFactura.ArchivoRuta != null,
                Productos = string.Join(", ", o.Detalles.Select(d => $"{d.Producto.Especie.Nombre} ({d.Kilos:0.###} kg)"))
            })
        }));
    }

    // GET api/pedidosconsignacion/5 — el detalle de lo que se pide, lo ya liberado y sus órdenes de embarque.
    [RequierePermiso("inventario", "ver")]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(uint id)
    {
        var p = await CargarPedidoAsync(id);
        if (p == null) return NotFound();

        var liberado = p.Ordenes.SelectMany(o => o.Detalles).GroupBy(d => d.CodigoProducto)
            .ToDictionary(g => g.Key, g => g.Sum(d => d.Kilos));
        return Ok(new
        {
            p.Id, p.Numero, p.Fecha, Empresa = p.Empresa.Nombre, p.TipoDestino, p.Destino, p.Estado,
            DivididoDe = p.PedidoDividido?.Numero,
            // Datos fijos de la hoja del pedido (Admin → Documentos).
            Configuracion = await _documentos.ObtenerAsync(ConfiguracionDocumentosService.PedidoMercancia),
            Detalles = p.Detalles.Select(d => new
            {
                d.Id,
                Codigo = d.CodigoProducto,
                Descripcion = d.Producto.Especie.Nombre,
                Marca = d.Producto.Marca?.Nombre,
                Talla = d.Producto.Talla?.Descripcion,
                d.Kilos,
                Liberado = liberado.GetValueOrDefault(d.CodigoProducto),
                Pendiente = Math.Max(0, d.Kilos - liberado.GetValueOrDefault(d.CodigoProducto)),
                Cajas = d.Producto.PesoCaja != null && d.Producto.PesoCaja.Peso > 0
                    ? Math.Round(d.Kilos / d.Producto.PesoCaja.Peso, 2) : (decimal?)null
            }),
            Ordenes = p.Ordenes.OrderBy(o => o.Id).Select(o => new
            {
                o.Id, o.Numero, o.Fecha,
                NumeroFactura = o.DocumentoFactura?.Numero,
                Detalles = o.Detalles.Select(d => new { Codigo = d.CodigoProducto, Descripcion = d.Producto.Especie.Nombre, d.Kilos })
            })
        });
    }

    // PUT api/pedidosconsignacion/5/liberar — crea una orden de embarque del pedido. Pide el número de la orden Y su
    // documento (como las facturas de las entradas: el documento queda registrado con su número y se puede consultar
    // después desde Pedimentos). "productos" (JSON [{codigo, kilos}]) dice qué producto y cuántos kilos libera esta
    // orden; si no se manda, libera todo lo que falta. El pedido sigue Pendiente hasta que todo el producto tenga orden.
    [RequierePermiso("inventario", "editar")]
    [RequestSizeLimit(20_000_000)]
    [HttpPut("{id}/liberar")]
    public async Task<IActionResult> Liberar(uint id, [FromForm] string? ordenEmbarque, [FromForm] IFormFile? archivo, [FromForm] string? productos)
    {
        var pedido = await CargarPedidoAsync(id);
        if (pedido == null) return NotFound();
        if (pedido.Estado == PedidosConsignacionService.Cancelado)
            return BadRequest(new { mensaje = "Este pedido se canceló al dividirlo: libera los pedidos en que se dividió" });
        if (pedido.Estado == PedidosConsignacionService.Liberado)
            return BadRequest(new { mensaje = "Este pedido ya está liberado por completo" });
        if (string.IsNullOrWhiteSpace(ordenEmbarque))
            return BadRequest(new { mensaje = "Indica el número de la orden de embarque" });
        if (archivo == null)
            return BadRequest(new { mensaje = "Sube el documento de la orden de embarque" });

        var liberado = pedido.Ordenes.SelectMany(o => o.Detalles).GroupBy(d => d.CodigoProducto)
            .ToDictionary(g => g.Key, g => g.Sum(d => d.Kilos));
        var falta = pedido.Detalles.GroupBy(d => d.CodigoProducto)
            .ToDictionary(g => g.Key, g => g.Sum(d => d.Kilos) - liberado.GetValueOrDefault(g.Key));

        List<LineaDivision> lineas;
        if (string.IsNullOrWhiteSpace(productos))
            lineas = falta.Where(f => f.Value > Tolerancia).Select(f => new LineaDivision { Codigo = f.Key, Kilos = f.Value }).ToList();
        else
        {
            try { lineas = JsonSerializer.Deserialize<List<LineaDivision>>(productos, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new(); }
            catch (JsonException) { return BadRequest(new { mensaje = "Los productos de la orden no tienen un formato válido" }); }
        }
        lineas = lineas.Where(l => l.Kilos > 0).ToList();
        if (lineas.Count == 0) return BadRequest(new { mensaje = "Indica al menos un producto con sus kilos" });
        foreach (var g in lineas.GroupBy(l => l.Codigo))
        {
            if (!falta.TryGetValue(g.Key, out var resta))
                return BadRequest(new { mensaje = $"{g.Key} no está en este pedido" });
            if (g.Sum(l => l.Kilos) > resta + Tolerancia)
                return BadRequest(new { mensaje = $"De {g.Key} solo faltan {resta:0.###} kg por liberar en este pedido" });
        }

        var numero = ordenEmbarque.Trim();
        if (pedido.Ordenes.Any(o => string.Equals(o.Numero, numero, StringComparison.OrdinalIgnoreCase)))
            return BadRequest(new { mensaje = $"Este pedido ya tiene una orden de embarque {numero}" });

        var resultado = await GuardarDocumentoAsync("Orden de embarque", numero, archivo);
        if (resultado.Error != null) return BadRequest(new { mensaje = resultado.Error });

        var orden = new PedidoConsignacionOrden { IdPedido = pedido.Id, Numero = numero, Fecha = DateTime.UtcNow, IdDocumentoOrden = resultado.IdDocumento };
        foreach (var g in lineas.GroupBy(l => l.Codigo))
            orden.Detalles.Add(new PedidoConsignacionOrdenDetalle { CodigoProducto = g.Key, Kilos = g.Sum(l => l.Kilos) });
        _context.PedidosConsignacionOrdenes.Add(orden);

        var estadoAnterior = pedido.Estado;
        var sigueFaltando = falta.Any(f => f.Value - lineas.Where(l => l.Codigo == f.Key).Sum(l => l.Kilos) > Tolerancia);
        pedido.Estado = sigueFaltando ? PedidosConsignacionService.Pendiente : PedidosConsignacionService.Liberado;
        await _context.SaveChangesAsync();

        var detalles = lineas.GroupBy(l => l.Codigo).Select(g => new
        {
            Producto = g.Key,
            Descripcion = pedido.Detalles.First(d => d.CodigoProducto == g.Key).Producto.Especie.Nombre,
            Kilos = g.Sum(l => l.Kilos)
        }).ToList();
        await _auditoria.RegistrarAsync("pedidos_consignacion", id.ToString(), "MODIFICAR",
            new { pedido.Numero, Estado = estadoAnterior },
            new { pedido.Numero, pedido.Estado, OrdenEmbarque = numero, Detalles = detalles }, this.IdUsuarioActual());
        return Ok(new { pedido.Id, pedido.Estado, OrdenEmbarque = numero, IdOrden = orden.Id });
    }

    // PUT api/pedidosconsignacion/ordenes/5/factura — sube (o reemplaza, por si se subió una por error) la factura de
    // una orden de embarque: cada orden tiene la suya.
    [RequierePermiso("inventario", "editar")]
    [RequestSizeLimit(20_000_000)]
    [HttpPut("ordenes/{idOrden}/factura")]
    public async Task<IActionResult> SubirFactura(uint idOrden, [FromForm] string? numeroFactura, [FromForm] IFormFile? archivo)
    {
        var orden = await _context.PedidosConsignacionOrdenes.Include(o => o.Pedido).Include(o => o.DocumentoFactura)
            .FirstOrDefaultAsync(o => o.Id == idOrden && o.Pedido.Activo);
        if (orden == null) return NotFound();
        if (string.IsNullOrWhiteSpace(numeroFactura))
            return BadRequest(new { mensaje = "Indica el número de la factura" });
        if (archivo == null)
            return BadRequest(new { mensaje = "Sube el archivo de la factura" });

        var anterior = orden.DocumentoFactura?.Numero;
        var resultado = await GuardarDocumentoAsync("Factura", numeroFactura.Trim(), archivo);
        if (resultado.Error != null) return BadRequest(new { mensaje = resultado.Error });

        orden.IdDocumentoFactura = resultado.IdDocumento;
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("pedidos_consignacion", orden.IdPedido.ToString(), "MODIFICAR",
            new { orden.Pedido.Numero, OrdenEmbarque = orden.Numero, Factura = anterior },
            new { orden.Pedido.Numero, OrdenEmbarque = orden.Numero, Factura = numeroFactura.Trim() },
            this.IdUsuarioActual());
        return Ok(new { orden.Id, NumeroFactura = numeroFactura.Trim() });
    }

    // POST api/pedidosconsignacion/5/dividir — parte un pedido (sin órdenes de embarque) en 2 o más. El pedido original
    // queda Cancelado y se crean los nuevos con el siguiente folio de la empresa. "partes" dice qué producto y cuántos
    // kilos lleva cada pedido nuevo; entre todos suman exactamente lo del pedido original.
    [RequierePermiso("inventario", "editar")]
    [HttpPost("{id}/dividir")]
    public async Task<IActionResult> Dividir(uint id, [FromBody] DividirPedidoDto dto)
    {
        var pedido = await CargarPedidoAsync(id);
        if (pedido == null) return NotFound();
        if (pedido.Estado != PedidosConsignacionService.Pendiente || pedido.Ordenes.Count > 0)
            return BadRequest(new { mensaje = "Solo se puede dividir un pedido pendiente al que aún no se le libera nada" });

        var partes = (dto?.Partes ?? new()).Select(p => (p ?? new()).Where(l => l.Kilos > 0).ToList()).ToList();
        if (partes.Count < 2) return BadRequest(new { mensaje = "Para dividir el pedido se necesitan al menos 2 partes" });
        if (partes.Count > 10) return BadRequest(new { mensaje = "Máximo 10 partes" });
        if (partes.Any(p => p.Count == 0)) return BadRequest(new { mensaje = "Todas las partes deben llevar producto" });

        var total = pedido.Detalles.GroupBy(d => d.CodigoProducto).ToDictionary(g => g.Key, g => g.Sum(d => d.Kilos));
        var repartido = partes.SelectMany(p => p).GroupBy(l => l.Codigo).ToDictionary(g => g.Key, g => g.Sum(l => l.Kilos));
        foreach (var codigo in repartido.Keys.Where(c => !total.ContainsKey(c)))
            return BadRequest(new { mensaje = $"{codigo} no está en este pedido" });
        foreach (var (codigo, kilos) in total)
        {
            var asignado = repartido.GetValueOrDefault(codigo);
            if (Math.Abs(asignado - kilos) > Tolerancia)
                return BadRequest(new { mensaje = $"De {codigo} el pedido tiene {kilos:0.###} kg y en las partes sumaron {asignado:0.###}" });
        }

        await using var tx = await _context.Database.BeginTransactionAsync();
        var nuevos = new List<PedidoConsignacion>();
        foreach (var parte in partes)
        {
            var nuevo = new PedidoConsignacion
            {
                Numero = await _pedidos.SiguienteNumeroAsync(pedido.IdEmpresa),
                IdEmpresa = pedido.IdEmpresa,
                Fecha = DateTime.UtcNow,
                TipoOrigen = pedido.TipoOrigen,
                IdOrigen = pedido.IdOrigen,
                TipoDestino = pedido.TipoDestino,
                Destino = pedido.Destino,
                Estado = PedidosConsignacionService.Pendiente,
                IdPedidoDividido = pedido.Id
            };
            foreach (var g in parte.GroupBy(l => l.Codigo))
                nuevo.Detalles.Add(new PedidoConsignacionDetalle { CodigoProducto = g.Key, Kilos = g.Sum(l => l.Kilos) });
            _context.PedidosConsignacion.Add(nuevo);
            await _context.SaveChangesAsync();   // el siguiente folio se calcula con este ya guardado
            nuevos.Add(nuevo);
        }
        pedido.Estado = PedidosConsignacionService.Cancelado;
        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        var usuario = this.IdUsuarioActual();
        var numeros = string.Join(", ", nuevos.Select(n => n.Numero));
        await _auditoria.RegistrarAsync("pedidos_consignacion", pedido.Id.ToString(), "MODIFICAR",
            new { pedido.Numero, Estado = PedidosConsignacionService.Pendiente },
            new { pedido.Numero, Estado = PedidosConsignacionService.Cancelado, SeDividioEn = numeros }, usuario);
        foreach (var n in nuevos)
            await _auditoria.RegistrarAsync("pedidos_consignacion", n.Id.ToString(), "CREAR", null,
                new
                {
                    n.Numero,
                    DivididoDe = pedido.Numero,
                    Detalles = n.Detalles.Select(d => new
                    {
                        Producto = d.CodigoProducto,
                        Descripcion = pedido.Detalles.First(x => x.CodigoProducto == d.CodigoProducto).Producto.Especie.Nombre,
                        d.Kilos
                    })
                }, usuario);

        return Ok(new { pedidos = nuevos.Select(n => new { n.Id, n.Numero }) });
    }

    // PUT api/pedidosconsignacion/ordenes/5 — corrige una orden de embarque: su número, su documento (si se manda otro
    // archivo) y/o el producto y los kilos que libera. El estado del pedido se recalcula.
    [RequierePermiso("inventario", "editar")]
    [RequestSizeLimit(20_000_000)]
    [HttpPut("ordenes/{idOrden}")]
    public async Task<IActionResult> EditarOrden(uint idOrden, [FromForm] string? ordenEmbarque, [FromForm] IFormFile? archivo, [FromForm] string? productos)
    {
        var idPedido = await _context.PedidosConsignacionOrdenes.Where(o => o.Id == idOrden).Select(o => (uint?)o.IdPedido).FirstOrDefaultAsync();
        var pedido = idPedido == null ? null : await CargarPedidoAsync(idPedido.Value);
        var orden = pedido?.Ordenes.FirstOrDefault(o => o.Id == idOrden);
        if (pedido == null || orden == null) return NotFound();

        var numero = (string.IsNullOrWhiteSpace(ordenEmbarque) ? orden.Numero : ordenEmbarque).Trim();
        var cambioNumero = !string.Equals(numero, orden.Numero, StringComparison.OrdinalIgnoreCase);
        if (pedido.Ordenes.Any(o => o.Id != orden.Id && string.Equals(o.Numero, numero, StringComparison.OrdinalIgnoreCase)))
            return BadRequest(new { mensaje = $"Este pedido ya tiene una orden de embarque {numero}" });

        // Producto y kilos: lo que no libera ninguna otra orden más lo que esta ya liberaba.
        var antes = DetallesDeOrden(orden);
        var lineas = antes.Select(a => new LineaDivision { Codigo = a.Producto, Kilos = a.Kilos }).ToList();
        if (!string.IsNullOrWhiteSpace(productos))
        {
            var leidas = LeerProductos(productos);
            if (leidas == null) return BadRequest(new { mensaje = "Los productos de la orden no tienen un formato válido" });
            lineas = leidas.Where(l => l.Kilos > 0).ToList();
        }
        if (lineas.Count == 0) return BadRequest(new { mensaje = "Indica al menos un producto con sus kilos" });
        var deOtras = pedido.Ordenes.Where(o => o.Id != orden.Id).SelectMany(o => o.Detalles).GroupBy(d => d.CodigoProducto)
            .ToDictionary(g => g.Key, g => g.Sum(d => d.Kilos));
        var total = pedido.Detalles.GroupBy(d => d.CodigoProducto).ToDictionary(g => g.Key, g => g.Sum(d => d.Kilos));
        foreach (var g in lineas.GroupBy(l => l.Codigo))
        {
            if (!total.TryGetValue(g.Key, out var delPedido))
                return BadRequest(new { mensaje = $"{g.Key} no está en este pedido" });
            var disponible = delPedido - deOtras.GetValueOrDefault(g.Key);
            if (g.Sum(l => l.Kilos) > disponible + Tolerancia)
                return BadRequest(new { mensaje = $"De {g.Key} esta orden puede llevar como máximo {disponible:0.###} kg" });
        }

        // Documento de la orden.
        var idDocumento = orden.IdDocumentoOrden;
        if (archivo != null)
        {
            var guardado = await GuardarDocumentoAsync("Orden de embarque", numero, archivo);
            if (guardado.Error != null) return BadRequest(new { mensaje = guardado.Error });
            idDocumento = guardado.IdDocumento;
        }
        else if (cambioNumero)
        {
            var tipo = await _context.DocumentosTipo.FirstOrDefaultAsync(t => t.Nombre.ToLower() == "orden de embarque");
            var existente = tipo == null ? null : await _context.Documentos.FirstOrDefaultAsync(d => d.Numero == numero && d.IdDocumentoTipo == tipo.Id);
            if (existente != null) idDocumento = existente.Id;
            else if (orden.IdDocumentoOrden != null
                && !await _context.PedidosConsignacionOrdenes.AnyAsync(o => o.IdDocumentoOrden == orden.IdDocumentoOrden && o.Id != orden.Id))
            {
                // El documento solo lo usa esta orden: basta corregir su número.
                var doc = await _context.Documentos.FirstAsync(d => d.Id == orden.IdDocumentoOrden);
                doc.Numero = numero;
            }
            else return BadRequest(new { mensaje = "Sube el documento de la nueva orden de embarque" });
        }

        var numeroAnterior = orden.Numero;
        orden.Numero = numero;
        orden.IdDocumentoOrden = idDocumento;
        _context.PedidosConsignacionOrdenesDetalle.RemoveRange(orden.Detalles);
        orden.Detalles = lineas.GroupBy(l => l.Codigo)
            .Select(g => new PedidoConsignacionOrdenDetalle { CodigoProducto = g.Key, Kilos = g.Sum(l => l.Kilos) }).ToList();

        var estadoAnterior = pedido.Estado;
        var liberado = deOtras.ToDictionary(x => x.Key, x => x.Value);
        foreach (var l in orden.Detalles) liberado[l.CodigoProducto] = liberado.GetValueOrDefault(l.CodigoProducto) + l.Kilos;
        pedido.Estado = EstadoSegun(pedido, liberado, hayOrdenes: true);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("pedidos_consignacion", pedido.Id.ToString(), "MODIFICAR",
            new { pedido.Numero, Estado = estadoAnterior, OrdenEmbarque = numeroAnterior, Detalles = antes },
            new { pedido.Numero, pedido.Estado, OrdenEmbarque = numero, Detalles = DetallesDeOrden(orden, pedido) }, this.IdUsuarioActual());
        return Ok(new { pedido.Id, pedido.Estado, OrdenEmbarque = numero });
    }

    // DELETE api/pedidosconsignacion/ordenes/5 — quita una orden de embarque (y con ella su factura): el producto que
    // liberaba vuelve a faltar y el pedido regresa a Pendiente.
    [RequierePermiso("inventario", "editar")]
    [HttpDelete("ordenes/{idOrden}")]
    public async Task<IActionResult> EliminarOrden(uint idOrden)
    {
        var idPedido = await _context.PedidosConsignacionOrdenes.Where(o => o.Id == idOrden).Select(o => (uint?)o.IdPedido).FirstOrDefaultAsync();
        var pedido = idPedido == null ? null : await CargarPedidoAsync(idPedido.Value);
        var orden = pedido?.Ordenes.FirstOrDefault(o => o.Id == idOrden);
        if (pedido == null || orden == null) return NotFound();

        var antes = DetallesDeOrden(orden);
        var factura = orden.DocumentoFactura?.Numero;
        var estadoAnterior = pedido.Estado;
        var restantes = pedido.Ordenes.Where(o => o.Id != orden.Id).ToList();
        var liberado = restantes.SelectMany(o => o.Detalles).GroupBy(d => d.CodigoProducto).ToDictionary(g => g.Key, g => g.Sum(d => d.Kilos));
        _context.PedidosConsignacionOrdenes.Remove(orden);
        pedido.Estado = EstadoSegun(pedido, liberado, hayOrdenes: restantes.Count > 0);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("pedidos_consignacion", pedido.Id.ToString(), "MODIFICAR",
            new { pedido.Numero, Estado = estadoAnterior, OrdenEmbarque = orden.Numero, Factura = factura, Detalles = antes },
            new { pedido.Numero, pedido.Estado, OrdenEmbarque = (string?)null, Nota = $"Se quitó la orden de embarque {orden.Numero}" }, this.IdUsuarioActual());
        return Ok(new { pedido.Id, pedido.Estado });
    }

    // DELETE api/pedidosconsignacion/ordenes/5/factura — quita la factura de una orden (el documento queda registrado).
    [RequierePermiso("inventario", "editar")]
    [HttpDelete("ordenes/{idOrden}/factura")]
    public async Task<IActionResult> QuitarFactura(uint idOrden)
    {
        var orden = await _context.PedidosConsignacionOrdenes.Include(o => o.Pedido).Include(o => o.DocumentoFactura)
            .FirstOrDefaultAsync(o => o.Id == idOrden && o.Pedido.Activo);
        if (orden == null) return NotFound();
        if (orden.IdDocumentoFactura == null) return BadRequest(new { mensaje = "Esta orden no tiene factura" });

        var anterior = orden.DocumentoFactura?.Numero;
        orden.IdDocumentoFactura = null;
        await _context.SaveChangesAsync();
        await _auditoria.RegistrarAsync("pedidos_consignacion", orden.IdPedido.ToString(), "MODIFICAR",
            new { orden.Pedido.Numero, OrdenEmbarque = orden.Numero, Factura = anterior },
            new { orden.Pedido.Numero, OrdenEmbarque = orden.Numero, Factura = (string?)null }, this.IdUsuarioActual());
        return NoContent();
    }

    // POST api/pedidosconsignacion/5/deshacer-division — anula la cancelación de un pedido que se dividió: los pedidos en
    // que se dividió desaparecen y el original vuelve a Pendiente. Solo si esos pedidos siguen sin órdenes de embarque y
    // sin haberse dividido a su vez (se deshacen primero).
    [RequierePermiso("inventario", "editar")]
    [HttpPost("{id}/deshacer-division")]
    public async Task<IActionResult> DeshacerDivision(uint id)
    {
        var pedido = await CargarPedidoAsync(id);
        if (pedido == null) return NotFound();
        if (pedido.Estado != PedidosConsignacionService.Cancelado)
            return BadRequest(new { mensaje = "Este pedido no está cancelado por una división" });

        var hijos = await _context.PedidosConsignacion.Include(p => p.Ordenes)
            .Where(p => p.Activo && p.IdPedidoDividido == id).OrderBy(p => p.Id).ToListAsync();
        var divididos = hijos.Where(h => h.Estado == PedidosConsignacionService.Cancelado).Select(h => h.Numero).ToList();
        if (divididos.Count > 0)
            return BadRequest(new { mensaje = $"Primero deshaz la división de {string.Join(", ", divididos)}" });
        var conOrdenes = hijos.Where(h => h.Ordenes.Count > 0).Select(h => h.Numero).ToList();
        if (conOrdenes.Count > 0)
            return BadRequest(new { mensaje = $"{string.Join(", ", conOrdenes)} ya tiene órdenes de embarque: quítalas primero" });

        foreach (var h in hijos) h.Activo = false;
        pedido.Estado = PedidosConsignacionService.Pendiente;
        await _context.SaveChangesAsync();

        var usuario = this.IdUsuarioActual();
        await _auditoria.RegistrarAsync("pedidos_consignacion", pedido.Id.ToString(), "MODIFICAR",
            new { pedido.Numero, Estado = PedidosConsignacionService.Cancelado, SeDividioEn = string.Join(", ", hijos.Select(h => h.Numero)) },
            new { pedido.Numero, Estado = PedidosConsignacionService.Pendiente, Nota = "Se deshizo la división" }, usuario);
        foreach (var h in hijos)
            await _auditoria.RegistrarAsync("pedidos_consignacion", h.Id.ToString(), "ELIMINAR",
                new { h.Numero, DivididoDe = pedido.Numero }, null, usuario);
        return Ok(new { pedido.Id, pedido.Estado });
    }

    // Pendiente hasta que todo el producto del pedido tenga orden; Liberado cuando ya está completo.
    private static string EstadoSegun(PedidoConsignacion pedido, Dictionary<string, decimal> liberado, bool hayOrdenes)
    {
        var completo = pedido.Detalles.GroupBy(d => d.CodigoProducto)
            .All(g => g.Sum(d => d.Kilos) - liberado.GetValueOrDefault(g.Key) <= Tolerancia);
        return hayOrdenes && completo ? PedidosConsignacionService.Liberado : PedidosConsignacionService.Pendiente;
    }

    private static List<LineaDivision>? LeerProductos(string json)
    {
        try { return JsonSerializer.Deserialize<List<LineaDivision>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new(); }
        catch (JsonException) { return null; }
    }

    // Producto y kilos de una orden como se guardan en la auditoría.
    private static List<DetalleOrdenAuditoria> DetallesDeOrden(PedidoConsignacionOrden orden, PedidoConsignacion? pedido = null) =>
        orden.Detalles.Select(d => new DetalleOrdenAuditoria(
            d.CodigoProducto,
            d.Producto?.Especie?.Nombre ?? pedido?.Detalles.FirstOrDefault(x => x.CodigoProducto == d.CodigoProducto)?.Producto.Especie.Nombre ?? d.CodigoProducto,
            d.Kilos)).ToList();

    private Task<PedidoConsignacion?> CargarPedidoAsync(uint id) =>
        _context.PedidosConsignacion
            .Include(x => x.Empresa)
            .Include(x => x.PedidoDividido)
            .Include(x => x.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.Especie)
            .Include(x => x.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.Marca)
            .Include(x => x.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.Talla)
            .Include(x => x.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.PesoCaja)
            .Include(x => x.Ordenes).ThenInclude(o => o.DocumentoOrden)
            .Include(x => x.Ordenes).ThenInclude(o => o.DocumentoFactura)
            .Include(x => x.Ordenes).ThenInclude(o => o.Detalles).ThenInclude(d => d.Producto).ThenInclude(pr => pr.Especie)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == id && x.Activo);

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

// Las claves (Producto, Descripcion, Kilos) las entiende la pantalla de Movimientos del admin.
public record DetalleOrdenAuditoria(string Producto, string Descripcion, decimal Kilos);

public class LineaDivision
{
    public string Codigo { get; set; } = null!;
    public decimal Kilos { get; set; }
}

public class DividirPedidoDto
{
    public List<List<LineaDivision>> Partes { get; set; } = new();
}
