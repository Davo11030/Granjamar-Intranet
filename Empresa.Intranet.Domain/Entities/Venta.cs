namespace Empresa.Intranet.Domain.Entities;
public class Venta
{
    public uint Id { get; set; }
    public uint? IdHistorial { get; set; }
    public uint? IdEstadoRecoleccion { get; set; }
    public uint? IdLugarEntrega { get; set; }
    public uint? IdCliente { get; set; }
    public uint? IdFormaPago { get; set; }
    public decimal Total { get; set; }
    public decimal? EfectivoRecibido { get; set; }
    public string Estado { get; set; } = "Pendiente entrega"; // Programada | Pendiente entrega | Entregada
    public bool Activo { get; set; } = true;
    public HistorialMovimiento? HistorialMovimiento { get; set; }
    public EstadoRecoleccion? EstadoRecoleccion { get; set; }
    public LugarEntrega? LugarEntrega { get; set; }
    public Cliente? Cliente { get; set; }
    public FormaPago? FormaPago { get; set; }
}