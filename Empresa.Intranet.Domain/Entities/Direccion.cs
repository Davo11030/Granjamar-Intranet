namespace Empresa.Intranet.Domain.Entities;
public class Direccion
{
    public uint Id { get; set; }
    public string DireccionTexto { get; set; } = null!;
    public string Estado { get; set; } = null!;
    public string Municipio { get; set; } = null!;
    // Código postal: la Remisión-Traslado (RT) lo imprime en la ciudad del destino.
    public string? CodigoPostal { get; set; }
    // "# Segmento o Cliente" de esta dirección: se escribe en el recuadro de origen/destino de la Requisición.
    public string? Segmento { get; set; }
    public uint? IdEmpresa { get; set; }
    public bool Activo { get; set; } = true;
    public Empresa? Empresa { get; set; }
    public ICollection<Embarque> Embarques { get; set; } = new List<Embarque>();
    public ICollection<UbicacionProducto> UbicacionesProducto { get; set; } = new List<UbicacionProducto>();
    public ICollection<DetalleMovimiento> DetallesMovimiento { get; set; } = new List<DetalleMovimiento>();
}