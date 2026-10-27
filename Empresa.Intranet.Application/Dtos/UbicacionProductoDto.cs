namespace Empresa.Intranet.Application.DTOs;

public class UbicacionProductoDto
{
    public uint Id { get; set; }
    public uint IdExistencia { get; set; }
    public string Lote { get; set; } = null!;
    public string CodigoProducto { get; set; } = null!;
    public uint IdDireccion { get; set; }
    public string Direccion { get; set; } = null!;
    public decimal CantidadKilos { get; set; }
    public uint? IdDepartamento { get; set; }
}

public class CrearUbicacionProductoDto
{
    public uint IdExistencia { get; set; }
    public uint IdDireccion { get; set; }
    public decimal CantidadKilos { get; set; }
    public uint? IdDepartamento { get; set; }
}