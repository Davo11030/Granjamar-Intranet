namespace Empresa.Intranet.Domain.Entities;

// Uso LEGAL de un documento (pedimento/factura) en un renglón de RT: cuántos kilos de ese producto
// se descuentan del documento. Es un conteo aparte del stock físico (UbicacionProducto) — sirve
// para saber cuánto le queda a cada documento. Kilos = 0 significa que el documento se referencia
// en el renglón pero no se descuenta nada (por ejemplo, porque ya no tiene kilos).
public class RtDetalleDocumento
{
    public uint Id { get; set; }
    public uint IdRtDetalle { get; set; }
    public uint IdDocumento { get; set; }
    public decimal Kilos { get; set; }
    public RtDetalle RtDetalle { get; set; } = null!;
    public Documento Documento { get; set; } = null!;
}
