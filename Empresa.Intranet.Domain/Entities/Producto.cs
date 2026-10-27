namespace Empresa.Intranet.Domain.Entities;
public class Producto
{
    public string Codigo { get; set; } = null!;
    public int IdEspecie { get; set; }
    public int? IdTalla { get; set; }
    public int? IdMarca { get; set; }
    public int? IdPesoCaja { get; set; }
    public decimal PrecioKilo { get; set; }
    public bool Activo { get; set; } = true;
    public Especie Especie { get; set; } = null!;
    public Talla? Talla { get; set; }
    public Marca? Marca { get; set; }
    public PesoCaja? PesoCaja { get; set; }
    public ICollection<Descripcion> Descripciones { get; set; } = new List<Descripcion>();
    public ICollection<Existencia> Existencias { get; set; } = new List<Existencia>();
}