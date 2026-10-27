namespace Empresa.Intranet.Domain.Entities;

// Las tarimas físicas que se capturaron en la Solicitud para un producto de un destino:
// "NumTarimas tarimas de CajasPorTarima cajas" (ej. 13 de 198 y otra de 33 son dos renglones).
// CajasPorTarima puede ser fraccionario: una tarima puede llevar una caja incompleta (ej. 2.8 cajas).
// Aparte de SolicitudDetalle, que se parte por LOTE (una tarima física puede tomar cajas de varios
// lotes, o varios lotes alimentar una misma tarima) y por eso no conserva cuántas tarimas son. El
// Ciego de carga se arma con esto: exactamente estas tarimas, cada una con las cajas que lleva.
public class SolicitudTarima
{
    public uint Id { get; set; }
    public uint IdEmbarque { get; set; }
    public string CodigoProducto { get; set; } = null!;
    public uint IdDireccion { get; set; }
    public int NumTarimas { get; set; }
    public decimal CajasPorTarima { get; set; }
    public Embarque Embarque { get; set; } = null!;
    public Producto Producto { get; set; } = null!;
}
