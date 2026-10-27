namespace Empresa.Intranet.Domain.Entities;
public class Direccion
{
    public uint Id { get; set; }
    public string DireccionTexto { get; set; } = null!;
    public string Estado { get; set; } = null!;
    public string Municipio { get; set; } = null!;
    public uint? IdEmpresa { get; set; }
    public bool Activo { get; set; } = true;
    public Empresa? Empresa { get; set; }
    public ICollection<Embarque> Embarques { get; set; } = new List<Embarque>();
    public ICollection<UbicacionProducto> UbicacionesProducto { get; set; } = new List<UbicacionProducto>();
    public ICollection<DetalleMovimiento> DetallesMovimiento { get; set; } = new List<DetalleMovimiento>();
}