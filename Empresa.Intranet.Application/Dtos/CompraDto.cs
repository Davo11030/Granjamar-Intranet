namespace Empresa.Intranet.Application.DTOs;

public class ComprasDto
{
    public uint Id { get; set; }
    public string? Empresa { get; set; }
    public DateTime FechaRegistro { get; set; }
    public string? Usuario { get; set; }
    public string? UrlRemision { get; set; }
    public string? NumeroEmbarque { get; set; }
    public string? NumeroContenedor { get; set; }
    public string? UrlFactura { get; set; }
    public string? Estado { get; set; }
    // Las entradas de una empresa en consignación se editan desde su propio menú.
    public string? FolioEmpresa { get; set; }
}

// Cambiar únicamente el estado de una compra ya registrada, sin tocar sus detalles/existencias.
public class CambiarEstadoCompraDto
{
    public string Estado { get; set; } = null!;
    public uint IdUsuario { get; set; }
}

public class CrearCompraDto
{
    public uint IdUsuario { get; set; }
    public uint? IdEmpresa { get; set; }
    public string? UrlRemision { get; set; }
    public string? NumeroEmbarque { get; set; }
    // Número de contenedor de la entrada internacional (no la placa del tractocamión) — un solo
    // valor por toda la entrada, no por renglón de producto.
    public string? NumeroContenedor { get; set; }
    // Folio de la empresa para esta entrada (consignación).
    public string? FolioEmpresa { get; set; }
    public string? UrlFactura { get; set; }
    public CrearDetalleTransporteDto? Transporte { get; set; }
    public List<CrearDetalleCompraDto> Detalles { get; set; } = new();
    // Archivo de cada documento distinto de la entrada (token devuelto por api/documentos/archivo-temporal).
    // Un documento que todavía no tiene archivo en el sistema DEBE traerlo aquí; si ya lo tiene, no hace falta.
    public List<ArchivoDocumentoDto> Archivos { get; set; } = new();
}

public class CrearDetalleCompraDto
{
    // Al editar una entrada: el renglón (DetalleMovimiento) que ya existía; sin él se crea uno nuevo.
    public uint? IdDetalle { get; set; }
    public string CodigoProducto { get; set; } = null!;
    public string Lote { get; set; } = null!;
    public decimal Kilos { get; set; }
    public decimal? Costo { get; set; }
    public DateTime? Caducidad { get; set; }
    public uint IdDireccion { get; set; }
    public uint? IdDepartamento { get; set; }
    // Pedimento/documento de origen de este lote — ej. TipoDocumento "A1", NumeroDocumento
    // "858483". Si se manda, se crea (o reutiliza) el Documento real y queda ligado a la
    // Existencia que se crea para este renglón.
    public string? TipoDocumento { get; set; }
    public string? NumeroDocumento { get; set; }
}

public class ArchivoDocumentoDto
{
    public string? TipoDocumento { get; set; }
    public string NumeroDocumento { get; set; } = null!;
    public string Token { get; set; } = null!;
}
