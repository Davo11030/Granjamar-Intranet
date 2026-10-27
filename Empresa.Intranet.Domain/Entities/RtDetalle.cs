namespace Empresa.Intranet.Domain.Entities;

// Un renglón de la RT: precio/clave SAT/pedimentos de un PRODUCTO ya presente en la Solicitud de
// ese mismo embarque (no se puede facturar algo que no se solicitó) — un solo renglón por
// producto, nunca repetido por lote; "Pedimentos" trae, como texto combinado, las referencias de
// TODOS los lotes de ese producto usados en la Solicitud (más las que el usuario haya agregado a
// mano de otros lotes del mismo código).
public class RtDetalle
{
    public uint Id { get; set; }
    public uint IdEmbarque { get; set; }
    public string CodigoProducto { get; set; } = null!;
    public decimal PrecioUnitario { get; set; }
    public string? ClaveSat { get; set; }
    public string? DescripcionSat { get; set; }
    public string? Pedimentos { get; set; }
    public Embarque Embarque { get; set; } = null!;
    public Producto Producto { get; set; } = null!;
    // Documentos usados por este renglón y los kilos que se descuentan de cada uno (conteo legal).
    public ICollection<RtDetalleDocumento> Documentos { get; set; } = new List<RtDetalleDocumento>();
}
