namespace Empresa.Intranet.Domain.Entities;

// Una tarima del Ciego de carga tal como se acomodó: en qué posición va (1, 2, 3…), qué producto lleva y cuántas cajas.
// Se arma con las tarimas de la Solicitud (SolicitudTarima); si la Solicitud cambia, el ciego se borra y vuelve a
// quedar pendiente.
public class CiegoTarima
{
    public uint Id { get; set; }
    public uint IdEmbarque { get; set; }
    public int Posicion { get; set; }
    public string CodigoProducto { get; set; } = null!;
    public decimal Cajas { get; set; }
    public Embarque Embarque { get; set; } = null!;
    public Producto Producto { get; set; } = null!;
}
