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

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DocumentosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ArchivosDocumentoService _archivos;
    private readonly AuditoriaService _auditoria;

    public DocumentosController(AppDbContext context, ArchivosDocumentoService archivos, AuditoriaService auditoria)
    {
        _context = context;
        _archivos = archivos;
        _auditoria = auditoria;
    }

    // Todos los documentos con su archivo (si ya se subió) y los lotes/productos que cubren — es lo
    // que se busca para sacar un documento rápido por su número.
    [RequierePermiso("documentos","ver","compras/ver","compras/crear","embarques/editar","inventario/ver")]
    [HttpGet]
    public async Task<IActionResult> GetTodos()
    {
        var docs = await _context.Documentos.Include(d => d.DocumentoTipo).OrderByDescending(d => d.Fecha).ToListAsync();
        var existencias = await _context.Existencias
            .Where(e => e.IdDocumentoOrigen != null && e.Activo)
            .Select(e => new { Doc = e.IdDocumentoOrigen!.Value, e.Lote, e.CodigoProducto })
            .ToListAsync();
        var porDoc = existencias.GroupBy(e => e.Doc).ToDictionary(g => g.Key);

        return Ok(docs.Select(d => new
        {
            d.Id,
            d.Numero,
            d.Fecha,
            d.Ruta,
            Tipo = d.DocumentoTipo.Nombre,
            TieneArchivo = d.ArchivoRuta != null,
            d.ArchivoNombre,
            d.ArchivoTipo,
            d.FechaArchivo,
            Lotes = porDoc.TryGetValue(d.Id, out var g1) ? string.Join(", ", g1.Select(x => x.Lote).Distinct()) : null,
            Producto = porDoc.TryGetValue(d.Id, out var g2) ? string.Join(", ", g2.Select(x => x.CodigoProducto).Distinct()) : null
        }));
    }

    // POST api/documentos/archivo-temporal — sube el archivo de un documento ANTES de guardar la
    // entrada; devuelve un token que la entrada manda para ligarlo a su documento.
    [RequierePermiso("compras", "crear", "compras/editar", "documentos/crear")]
    [RequestSizeLimit(20_000_000)]
    [HttpPost("archivo-temporal")]
    public async Task<IActionResult> SubirTemporal([FromForm] IFormFile archivo)
    {
        var (error, token, nombre) = await _archivos.GuardarTemporalAsync(archivo);
        if (error != null) return BadRequest(new { mensaje = error });
        return Ok(new { token, nombre });
    }

    // PUT api/documentos/5/archivo — adjunta (o reemplaza) el archivo de un documento ya registrado.
    [RequierePermiso("documentos", "editar")]
    [RequestSizeLimit(20_000_000)]
    [HttpPut("{id}/archivo")]
    public async Task<IActionResult> AdjuntarArchivo(uint id, [FromForm] IFormFile archivo)
    {
        var doc = await _context.Documentos.FindAsync(id);
        if (doc == null) return NotFound();

        var (error, ruta, tipo, nombre) = await _archivos.GuardarParaDocumentoAsync(id, archivo);
        if (error != null) return BadRequest(new { mensaje = error });

        var anterior = doc.ArchivoRuta;
        var antes = new { doc.ArchivoNombre };
        doc.ArchivoRuta = ruta;
        doc.ArchivoNombre = nombre;
        doc.ArchivoTipo = tipo;
        doc.FechaArchivo = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        _archivos.Eliminar(anterior);

        await _auditoria.RegistrarAsync("documentos", id.ToString(), anterior == null ? "CREAR" : "MODIFICAR",
            antes, new { doc.ArchivoNombre }, this.IdUsuarioActual());
        return Ok(new { doc.Id, doc.ArchivoNombre });
    }

    // GET api/documentos/5/archivo — descarga/visualiza el archivo (solo con sesión iniciada).
    [RequierePermiso("documentos","ver","compras/ver","compras/crear","embarques/editar","inventario/ver")]
    [HttpGet("{id}/archivo")]
    public async Task<IActionResult> Descargar(uint id)
    {
        var doc = await _context.Documentos.Include(d => d.DocumentoTipo).FirstOrDefaultAsync(d => d.Id == id);
        if (doc?.ArchivoRuta == null) return NotFound(new { mensaje = "Este documento todavía no tiene archivo" });
        var stream = _archivos.Abrir(doc.ArchivoRuta);
        if (stream == null) return NotFound(new { mensaje = "No se encontró el archivo en el servidor" });

        Response.Headers["X-Content-Type-Options"] = "nosniff";
        var nombre = doc.ArchivoNombre ?? $"{doc.DocumentoTipo.Nombre}-{doc.Numero}";
        // PDF e imágenes se abren en el navegador; el XML se descarga.
        var inline = doc.ArchivoTipo is "application/pdf" or "image/jpeg" or "image/png";
        Response.Headers["Content-Disposition"] =
            $"{(inline ? "inline" : "attachment")}; filename*=UTF-8''{Uri.EscapeDataString(nombre)}";
        return File(stream, doc.ArchivoTipo ?? "application/octet-stream");
    }

    // Catálogo de tipos de documento/pedimento (A1, C1, etc.) — se va llenando sobre la marcha
    // desde donde se capturan (alta rápida, igual que las marcas de tractocamión).
    [HttpGet("tipos")]
    public async Task<IActionResult> GetTipos() =>
        Ok(await _context.DocumentosTipo.OrderBy(t => t.Nombre).Select(t => new { t.Id, t.Nombre }).ToListAsync());

    [RequierePermiso("catalogos", "crear")]
    [HttpPost("tipos")]
    public async Task<IActionResult> CrearTipo([FromBody] CrearDocumentoTipoDto dto)
    {
        var nombre = (dto.Nombre ?? "").Trim();
        if (string.IsNullOrEmpty(nombre)) return BadRequest(new { mensaje = "Escribe el nombre del tipo" });

        var existente = await _context.DocumentosTipo.FirstOrDefaultAsync(t => t.Nombre.ToLower() == nombre.ToLower());
        if (existente != null) return Ok(new { existente.Id, existente.Nombre });

        var tipo = new DocumentoTipo { Nombre = nombre };
        _context.DocumentosTipo.Add(tipo);
        await _context.SaveChangesAsync();
        return Ok(new { tipo.Id, tipo.Nombre });
    }

    [RequierePermiso("documentos", "crear")]
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearDocumentoDto dto)
    {
        var tipo = await _context.DocumentosTipo.FindAsync(dto.IdDocumentoTipo);
        if (tipo == null) return BadRequest(new { mensaje = "Tipo de documento no existe" });

        var doc = new Documento
        {
            Numero = dto.Numero,
            Fecha = dto.Fecha,
            IdDocumentoTipo = dto.IdDocumentoTipo,
            Ruta = dto.Ruta
        };
        _context.Documentos.Add(doc);
        await _context.SaveChangesAsync();
        return Ok(new { doc.Id, doc.Numero });
    }
}

public class CrearDocumentoDto
{
    public string Numero { get; set; } = null!;
    public DateTime Fecha { get; set; }
    public int IdDocumentoTipo { get; set; }
    public string? Ruta { get; set; }
}

public class CrearDocumentoTipoDto
{
    public string Nombre { get; set; } = null!;
}