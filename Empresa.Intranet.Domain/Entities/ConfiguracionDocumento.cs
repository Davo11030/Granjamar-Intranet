namespace Empresa.Intranet.Domain.Entities;

// Un dato fijo de un documento que genera el sistema (título, nombres de quienes firman…), editable desde Admin →
// Documentos. Solo se guarda lo que se cambió: lo demás usa el valor predeterminado del documento.
public class ConfiguracionDocumento
{
    public uint Id { get; set; }
    public string Documento { get; set; } = null!;   // "Requisicion" | "PedidoMercancia"
    public string Clave { get; set; } = null!;       // "Titulo", "Despacho"…
    public string Valor { get; set; } = "";
}
