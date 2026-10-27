namespace Empresa.Intranet.Domain.Entities;
public class Descripcion
{
    public int Id { get; set; }
    public int IdPresentacion { get; set; }
    public string CodigoProducto { get; set; } = null!;
    public Presentacion Presentacion { get; set; } = null!;
    public Producto Producto { get; set; } = null!;
}