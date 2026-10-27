namespace Empresa.Intranet.Domain.Entities;
public class Cliente
{
    public uint Id { get; set; }
    public string? Nombre { get; set; }
    public string? Telefono { get; set; }
    public string? Rfc { get; set; }
    // Dirección completa del cliente.
    public string? Calle { get; set; }      // calle y número (exterior/interior)
    public string? Colonia { get; set; }
    public string? Municipio { get; set; }  // municipio o ciudad
    public string? Estado { get; set; }
    public string? CodigoPostal { get; set; }
    public bool Activo { get; set; } = true;
    public ICollection<Venta> Ventas { get; set; } = new List<Venta>();
}
