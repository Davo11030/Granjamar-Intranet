namespace Empresa.Intranet.Application.DTOs;

public class ExistenciaDto
{
    public int Id { get; set; }
    public string Lote { get; set; } = null!;
    public string CodigoProducto { get; set; } = null!;
    public string Producto { get; set; } = null!;
    public decimal? Costo { get; set; }
    public DateTime? Caducidad { get; set; }
    public int? IdDocumentoOrigen { get; set; }
}

public class CrearExistenciaDto
{
    public uint IdUsuario { get; set; }
    public string Lote { get; set; } = null!;
    public string CodigoProducto { get; set; } = null!;
    public decimal? Costo { get; set; }
    public DateTime? Caducidad { get; set; }
    public int? IdDocumentoOrigen { get; set; }
}