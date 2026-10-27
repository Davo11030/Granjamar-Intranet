namespace Empresa.Intranet.Domain.Entities;
public class Documento
{
    public uint Id { get; set; }
    public string Numero { get; set; } = null!;
    public DateTime Fecha { get; set; }
    public int IdDocumentoTipo { get; set; }
    public string? Ruta { get; set; }
    // Archivo real del documento (PDF/imagen/XML) guardado por el servidor. "Ruta" es heredado: antes
    // solo guardaba el NOMBRE escrito del archivo, nunca el archivo.
    public string? ArchivoRuta { get; set; }   // nombre en disco, generado por el servidor
    public string? ArchivoNombre { get; set; } // nombre original, para mostrar/descargar
    public string? ArchivoTipo { get; set; }   // content-type
    public DateTime? FechaArchivo { get; set; }
    public DocumentoTipo DocumentoTipo { get; set; } = null!;
    public ICollection<Existencia> Existencias { get; set; } = new List<Existencia>();
}