namespace Empresa.Intranet.Domain.Entities;
public class DetalleTransporte
{
    public uint Id { get; set; }
    public uint? IdChofer { get; set; }
    public uint? IdTractocamion { get; set; }
    public uint? IdCaja { get; set; }
    public Chofer? Chofer { get; set; }
    public Tractocamion? Tractocamion { get; set; }
    public CajaTractocamion? Caja { get; set; }
    public ICollection<Embarque> Embarques { get; set; } = new List<Embarque>();
    public ICollection<DetalleMovimiento> DetallesMovimiento { get; set; } = new List<DetalleMovimiento>();
}
