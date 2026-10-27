namespace Empresa.Intranet.Domain.Entities;
public class Produccion
{
    public uint Id { get; set; }
    public uint? IdDetalleMovimiento { get; set; }
    public decimal KilosRendimiento { get; set; }
    public decimal PorcentajeRendimiento { get; set; }
    public DetalleMovimiento? DetalleMovimiento { get; set; }
}