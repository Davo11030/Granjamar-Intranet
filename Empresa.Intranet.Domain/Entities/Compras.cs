namespace Empresa.Intranet.Domain.Entities;
public class Compras
{
    public uint Id { get; set; }
    public uint? IdEmpresa { get; set; }
    public uint? IdHistorialMovimiento { get; set; }
    public string? UrlRemision { get; set; }
    public string? NumeroEmbarque { get; set; }
    public string? NumeroContenedor { get; set; }
    // Folio con el que la empresa (ej. Genitech, en consignación) registra esta entrada de su lado.
    public string? FolioEmpresa { get; set; }
    public string? UrlFactura { get; set; }
    public string Estado { get; set; } = "Solicitado"; // Solicitado | Pendiente por recibir | Pendiente por pagar | Completado
    public bool Activo { get; set; } = true;
    public Empresa? Empresa { get; set; }
    public HistorialMovimiento? HistorialMovimiento { get; set; }
} 