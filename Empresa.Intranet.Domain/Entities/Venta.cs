namespace Empresa.Intranet.Domain.Entities;
public class Venta
{
    public uint Id { get; set; }
    public uint? IdHistorial { get; set; }
    public uint? IdEstadoRecoleccion { get; set; }
    public uint? IdLugarEntrega { get; set; }
    public uint? IdCliente { get; set; }
    // Nombre escrito en una venta de mostrador (que no es de un cliente del catálogo). Sin nombre: "Público en general".
    public string? NombreCliente { get; set; }
    public uint? IdFormaPago { get; set; }
    public decimal Total { get; set; }
    // Descuento (%) que se aplicó al final de la cuenta: Total = suma de los renglones × (1 − Descuento / 100).
    public decimal? Descuento { get; set; }
    public decimal? EfectivoRecibido { get; set; }
    public string Estado { get; set; } = "Pendiente entrega"; // Programada | Pendiente entrega | Entregada
    public bool Activo { get; set; } = true;
    public HistorialMovimiento? HistorialMovimiento { get; set; }
    public EstadoRecoleccion? EstadoRecoleccion { get; set; }
    public LugarEntrega? LugarEntrega { get; set; }
    public Cliente? Cliente { get; set; }
    public FormaPago? FormaPago { get; set; }
}