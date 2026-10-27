using System.Text.RegularExpressions;

namespace Empresa.Intranet.API.Servicios;

// Guarda en disco los archivos de los documentos (pedimentos/facturas) de las entradas. Los
// archivos viven FUERA de wwwroot (nunca se sirven como estáticos): solo se leen por el endpoint
// autenticado. Los nombres en disco los genera el servidor (nunca el del usuario), así que no hay
// forma de escribir fuera de la carpeta ni de pisar el archivo de otro documento.
public class ArchivosDocumentoService
{
    public const long MaxBytes = 15 * 1024 * 1024;

    private static readonly Dictionary<string, string> TiposPermitidos = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
        [".xml"] = "application/xml",
    };

    private static readonly Regex TokenValido = new("^[0-9a-f]{32}$", RegexOptions.Compiled);

    private readonly string _raiz;
    private readonly string _temporal;

    public ArchivosDocumentoService(IConfiguration config, IWebHostEnvironment env)
    {
        _raiz = config["Almacenamiento:RutaDocumentos"] is { Length: > 0 } ruta
            ? ruta
            : Path.Combine(env.ContentRootPath, "Archivos", "Documentos");
        _temporal = Path.Combine(_raiz, "_temporal");
        Directory.CreateDirectory(_temporal);
    }

    public static string TiposAceptados => string.Join(", ", TiposPermitidos.Keys);

    // Valida tamaño, extensión y que el contenido sea realmente de ese tipo (no basta el nombre).
    private static async Task<string?> ValidarAsync(IFormFile archivo)
    {
        if (archivo == null || archivo.Length == 0) return "El archivo está vacío";
        if (archivo.Length > MaxBytes) return $"El archivo pesa más de {MaxBytes / 1024 / 1024} MB";
        var ext = Path.GetExtension(archivo.FileName ?? "");
        if (!TiposPermitidos.ContainsKey(ext)) return $"Tipo de archivo no permitido (usa {TiposAceptados})";

        var cabecera = new byte[8];
        await using (var s = archivo.OpenReadStream()) await s.ReadAsync(cabecera, 0, cabecera.Length);
        var ok = ext.ToLowerInvariant() switch
        {
            ".pdf" => cabecera[0] == 0x25 && cabecera[1] == 0x50 && cabecera[2] == 0x44 && cabecera[3] == 0x46, // %PDF
            ".jpg" or ".jpeg" => cabecera[0] == 0xFF && cabecera[1] == 0xD8 && cabecera[2] == 0xFF,
            ".png" => cabecera[0] == 0x89 && cabecera[1] == 0x50 && cabecera[2] == 0x4E && cabecera[3] == 0x47,
            ".xml" => cabecera.Take(5).SequenceEqual(new byte[] { 0x3C, 0x3F, 0x78, 0x6D, 0x6C }) // <?xml
                      || (cabecera[0] == 0xEF && cabecera[1] == 0xBB && cabecera[2] == 0xBF) // BOM UTF-8
                      || cabecera[0] == 0x3C,
            _ => false,
        };
        return ok ? null : "El contenido del archivo no corresponde a su extensión";
    }

    private static string NombreSeguro(string? original)
    {
        var nombre = Path.GetFileName(original ?? "documento");
        foreach (var c in Path.GetInvalidFileNameChars()) nombre = nombre.Replace(c, '_');
        return nombre.Length > 150 ? nombre[..150] : nombre;
    }

    // Sube un archivo a la carpeta temporal; devuelve un token para ligarlo después a su documento.
    public async Task<(string? Error, string? Token, string? Nombre)> GuardarTemporalAsync(IFormFile archivo)
    {
        var error = await ValidarAsync(archivo);
        if (error != null) return (error, null, null);

        LimpiarTemporalesViejos();
        var token = Guid.NewGuid().ToString("N");
        var ext = Path.GetExtension(archivo.FileName).ToLowerInvariant();
        var nombre = NombreSeguro(archivo.FileName);
        await using (var destino = File.Create(Path.Combine(_temporal, token + ext)))
            await archivo.CopyToAsync(destino);
        await File.WriteAllTextAsync(Path.Combine(_temporal, token + ".nombre"), nombre);
        return (null, token, nombre);
    }

    private string? BuscarTemporal(string token)
    {
        if (string.IsNullOrWhiteSpace(token) || !TokenValido.IsMatch(token)) return null;
        return Directory.GetFiles(_temporal, token + ".*").FirstOrDefault(f => !f.EndsWith(".nombre"));
    }

    public bool ExisteTemporal(string? token) => token != null && BuscarTemporal(token) != null;

    // Mueve el archivo temporal a su lugar definitivo. Devuelve (ruta relativa, tipo, nombre original).
    public async Task<(string Ruta, string Tipo, string Nombre)?> AdjuntarTemporalAsync(uint idDocumento, string token)
    {
        var origen = BuscarTemporal(token);
        if (origen == null) return null;
        var ext = Path.GetExtension(origen).ToLowerInvariant();
        var nombreArchivo = Path.Combine(_raiz, $"{idDocumento}-{Guid.NewGuid():N}{ext}");
        var original = Path.Combine(_temporal, token + ".nombre");
        var nombre = File.Exists(original) ? await File.ReadAllTextAsync(original) : $"documento{ext}";
        File.Move(origen, nombreArchivo);
        if (File.Exists(original)) File.Delete(original);
        return (Path.GetFileName(nombreArchivo), TiposPermitidos[ext], nombre);
    }

    // Guarda directamente un archivo para un documento ya existente (adjuntar/reemplazar).
    public async Task<(string? Error, string? Ruta, string? Tipo, string? Nombre)> GuardarParaDocumentoAsync(uint idDocumento, IFormFile archivo)
    {
        var error = await ValidarAsync(archivo);
        if (error != null) return (error, null, null, null);
        var ext = Path.GetExtension(archivo.FileName).ToLowerInvariant();
        var nombreArchivo = $"{idDocumento}-{Guid.NewGuid():N}{ext}";
        await using (var destino = File.Create(Path.Combine(_raiz, nombreArchivo)))
            await archivo.CopyToAsync(destino);
        return (null, nombreArchivo, TiposPermitidos[ext], NombreSeguro(archivo.FileName));
    }

    public Stream? Abrir(string? ruta)
    {
        if (string.IsNullOrEmpty(ruta) || ruta != Path.GetFileName(ruta)) return null; // solo nombres simples
        var completa = Path.Combine(_raiz, ruta);
        return File.Exists(completa) ? File.OpenRead(completa) : null;
    }

    public void Eliminar(string? ruta)
    {
        if (string.IsNullOrEmpty(ruta) || ruta != Path.GetFileName(ruta)) return;
        var completa = Path.Combine(_raiz, ruta);
        if (File.Exists(completa)) File.Delete(completa);
    }

    // Los temporales que nunca se ligaron (entrada cancelada o rechazada) se borran pasado un día.
    private void LimpiarTemporalesViejos()
    {
        try
        {
            foreach (var f in Directory.GetFiles(_temporal))
                if (File.GetLastWriteTimeUtc(f) < DateTime.UtcNow.AddDays(-1)) File.Delete(f);
        }
        catch (IOException) { }
    }
}
