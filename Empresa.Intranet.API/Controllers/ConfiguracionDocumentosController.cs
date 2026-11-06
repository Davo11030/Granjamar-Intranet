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

// Admin → Documentos: los datos fijos de los documentos que genera el sistema (títulos, nombres de quienes firman…).
[ApiController]
[Route("api/[controller]")]
[Authorize]
[AdminOnly]
public class ConfiguracionDocumentosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly ConfiguracionDocumentosService _config;

    public ConfiguracionDocumentosController(AppDbContext context, AuditoriaService auditoria, ConfiguracionDocumentosService config)
    {
        _context = context;
        _auditoria = auditoria;
        _config = config;
    }

    // GET api/configuraciondocumentos — cada documento con sus campos y su valor actual.
    [HttpGet]
    public async Task<IActionResult> GetTodos()
    {
        var resultado = new List<object>();
        foreach (var d in ConfiguracionDocumentosService.Definiciones)
        {
            var valores = await _config.ObtenerAsync(d.Clave);
            resultado.Add(new
            {
                d.Clave, d.Nombre, d.Descripcion,
                Campos = d.Campos.Select(c => new { c.Clave, c.Etiqueta, c.Ayuda, c.Predeterminado, Valor = valores[c.Clave] })
            });
        }
        return Ok(resultado);
    }

    // PUT api/configuraciondocumentos/Requisicion — { valores: { Despacho: "…", … } }. Un valor vacío vuelve al de fábrica.
    [HttpPut("{documento}")]
    public async Task<IActionResult> Guardar(string documento, [FromBody] GuardarConfiguracionDocumentoDto dto)
    {
        var definicion = ConfiguracionDocumentosService.Definiciones.FirstOrDefault(d => d.Clave == documento);
        if (definicion == null) return NotFound();
        var invalidas = dto.Valores.Keys.Where(k => definicion.Campos.All(c => c.Clave != k)).ToList();
        if (invalidas.Count > 0) return BadRequest(new { mensaje = $"Campo desconocido: {string.Join(", ", invalidas)}" });

        var antes = await _config.ObtenerAsync(documento);
        var guardados = await _context.ConfiguracionDocumentos.Where(c => c.Documento == documento).ToListAsync();
        foreach (var (clave, valor) in dto.Valores)
        {
            var nuevo = (valor ?? "").Trim();
            var fila = guardados.FirstOrDefault(c => c.Clave == clave);
            var predeterminado = definicion.Campos.First(c => c.Clave == clave).Predeterminado;
            if (nuevo == predeterminado || nuevo.Length == 0)
            {
                if (fila != null) _context.ConfiguracionDocumentos.Remove(fila);
            }
            else if (fila != null) fila.Valor = nuevo;
            else _context.ConfiguracionDocumentos.Add(new ConfiguracionDocumento { Documento = documento, Clave = clave, Valor = nuevo });
        }
        await _context.SaveChangesAsync();

        var despues = await _config.ObtenerAsync(documento);
        var etiqueta = definicion.Campos.ToDictionary(c => c.Clave, c => c.Etiqueta);
        var cambios = despues.Keys.Where(k => antes[k] != despues[k]).ToList();
        if (cambios.Count > 0)
            await _auditoria.RegistrarAsync("configuracion_documento", documento, "MODIFICAR",
                cambios.ToDictionary(k => etiqueta[k], k => antes[k]),
                cambios.ToDictionary(k => etiqueta[k], k => despues[k]), this.IdUsuarioActual());
        return Ok(despues);
    }
}

public class GuardarConfiguracionDocumentoDto
{
    public Dictionary<string, string?> Valores { get; set; } = new();
}
