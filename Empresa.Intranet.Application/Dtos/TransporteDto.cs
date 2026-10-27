namespace Empresa.Intranet.Application.DTOs;

public class CrearChoferDto
{
    public string Nombre { get; set; } = null!;
    public string NumeroTelefono { get; set; } = null!;
    public string? TipoTelefono { get; set; }
}

public class CrearMarcaTractocamionDto
{
    public string Nombre { get; set; } = null!;
}

public class CrearCajaTractocamionDto
{
    public string? CajaPlaca { get; set; }
    public string? CajaTamano { get; set; }
    public int? CajaCapacidad { get; set; }
    public uint? IdEmpresa { get; set; }
}

public class CrearTractocamionDto
{
    public int Modelo { get; set; }
    public string Color { get; set; } = null!;
    public uint IdMarca { get; set; }
    public uint? IdEmpresa { get; set; }
    public string? Placa { get; set; }
}

public class CrearDetalleTransporteDto
{
    public uint? IdChofer { get; set; }
    public uint? IdTractocamion { get; set; }
    public uint? IdCaja { get; set; }
}

public class CrearEmbarqueDto
{
    public uint IdUsuario { get; set; }
    public string? Numero { get; set; }
    public uint? IdDireccion { get; set; }
    // Destino directo a un cliente (en lugar de una dirección).
    public uint? IdCliente { get; set; }
    public string? RutaCiego { get; set; }
    public string? RutaRequisision { get; set; }
    public string? RutaRt { get; set; }
    public string? RutaSolicitud { get; set; }
    public CrearDetalleTransporteDto? Transporte { get; set; }
    public List<CrearDetalleEmbarqueDto> Detalles { get; set; } = new();
}

// La Requisición ya no liga a un lote específico — solo dice qué producto, cuántos kilos y de
// qué ubicación (empresa/dirección) van a salir. El lote real se elige hasta la Solicitud.
public class CrearDetalleEmbarqueDto
{
    public string CodigoProducto { get; set; } = null!;
    public decimal Kilos { get; set; }
    public uint IdDireccion { get; set; }
    public uint? IdDepartamento { get; set; }
}

// Cambiar únicamente el estado de un embarque (marcar completado, etc.).
public class CambiarEstadoEmbarqueDto
{
    public string Estado { get; set; } = null!;
    public uint IdUsuario { get; set; }
}

// Marca (o desmarca) uno de los 5 documentos del embarque como completo — controla el color
// de su pestaña en EmbarqueDetalle. Documento: requisicion | solicitud | rt | ciego | carta.
public class MarcarDocumentoDto
{
    public string Documento { get; set; } = null!;
    public bool Completo { get; set; } = true;
    public uint IdUsuario { get; set; }
}

// Guarda (reemplaza) el detalle de tarimas de la Solicitud de embarque. Cada renglón debe
// corresponder a una existencia ya pedida en la Requisición de ese mismo embarque, y no puede
// exceder los kilos ahí solicitados.
public class GuardarSolicitudDto
{
    public uint IdUsuario { get; set; }
    public List<SolicitudDetalleDto> Detalles { get; set; } = new();
    // Las tarimas físicas capturadas (por producto y ubicación de origen) — el Ciego de carga se
    // arma con ellas: exactamente estas tarimas, cada una con las cajas que lleva.
    public List<SolicitudTarimaDto> Tarimas { get; set; } = new();
}

public class SolicitudTarimaDto
{
    public string CodigoProducto { get; set; } = null!;
    public uint IdDireccion { get; set; }
    public int NumTarimas { get; set; }
    public decimal CajasPorTarima { get; set; }
}

public class SolicitudDetalleDto
{
    public uint IdExistencia { get; set; }
    // Junto con IdExistencia identifica el renglón exacto de UbicacionProducto a descontar.
    public uint IdDireccion { get; set; }
    public int NumTarimas { get; set; }
    public int CajasPorTarima { get; set; }
    // Si es true, este renglón cierra un lote que no alcanzaba para una caja completa: debe ser
    // exactamente NumTarimas=1, CajasPorTarima=1, y Kilos es obligatorio (los kilos reales que
    // quedaban en el lote, menores al peso nominal de una caja) — el backend valida que no exceda
    // el stock real disponible. Para un renglón normal, Kilos se ignora y se recalcula siempre
    // como NumTarimas×CajasPorTarima×PesoCaja.
    public bool CajaIncompleta { get; set; }
    public decimal? Kilos { get; set; }
    public string? LoteEspecificaciones { get; set; }
}

// Guarda (reemplaza) el detalle de la RT. Cada renglón debe corresponder a una existencia ya
// presente en la Solicitud de ese mismo embarque.
public class GuardarRtDto
{
    public uint IdUsuario { get; set; }
    public List<RtDetalleDto> Detalles { get; set; } = new();
}

public class RtDetalleDto
{
    public string CodigoProducto { get; set; } = null!;
    public decimal PrecioUnitario { get; set; }
    public string? ClaveSat { get; set; }
    public string? DescripcionSat { get; set; }
    // Texto legible de los documentos del renglón (para mostrar/imprimir) — la fuente de verdad
    // del conteo por documento es "Documentos".
    public string? Pedimentos { get; set; }
    // Documentos que cubren este producto y los kilos que se descuentan de cada uno. Obligatorio
    // al menos uno: no se puede enviar un producto sin documento.
    public List<RtDocumentoDto> Documentos { get; set; } = new();
}

public class RtDocumentoDto
{
    public uint IdDocumento { get; set; }
    public decimal Kilos { get; set; }
}