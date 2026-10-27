namespace Empresa.Intranet.Domain.Entities;
public class UbicacionProducto
{
    public uint Id { get; set; }
    public uint IdExistencia { get; set; }
    public uint IdDireccion { get; set; }
    public decimal CantidadKilos { get; set; }
    public uint? IdDepartamento { get; set; }
    // Control de versión: si dos peticiones modifican el mismo stock a la vez, la segunda falla
    // (DbUpdateConcurrencyException → 409) en vez de pisar el descuento de la primera.
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    public Existencia Existencia { get; set; } = null!;
    public Direccion Direccion { get; set; } = null!;
    public Departamento? Departamento { get; set; }
}