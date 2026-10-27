namespace Empresa.Intranet.Application.DTOs;

public class ProductoDto
{
    public string Codigo { get; set; } = null!;
    public string Especie { get; set; } = null!;
    public string? Talla { get; set; }
    public string? Marca { get; set; }
    public decimal? PesoCaja { get; set; }
    public decimal PrecioKilo { get; set; }
    public string? ClaveSat { get; set; }
    public string? DescripcionSat { get; set; }
    public List<string> Presentaciones { get; set; } = new();
    // Ids de catálogo, para precargar el formulario de edición.
    public int IdEspecie { get; set; }
    public int? IdTalla { get; set; }
    public int? IdMarca { get; set; }
    public int? IdPesoCaja { get; set; }
    public List<int> IdsPresentacion { get; set; } = new();
}

public class CrearProductoDto
{
    public string Codigo { get; set; } = null!;
    public int IdEspecie { get; set; }
    public int? IdTalla { get; set; }
    public int? IdMarca { get; set; }
    public int? IdPesoCaja { get; set; }
    public decimal PrecioKilo { get; set; }
    public List<int> IdsPresentacion { get; set; } = new();
}