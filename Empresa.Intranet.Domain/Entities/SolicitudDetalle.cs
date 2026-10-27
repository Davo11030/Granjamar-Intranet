namespace Empresa.Intranet.Domain.Entities;

// Un renglón de la Solicitud de embarque: cuántas tarimas (y cajas por tarima) de una
// existencia ya pedida en la Requisición se van a mandar. El Ciego de carga deriva de aquí
// cuántos espacios de tarima debe tener (NumTarimas por renglón), sin poder agregar de más.
public class SolicitudDetalle
{
    public uint Id { get; set; }
    public uint IdEmbarque { get; set; }
    public uint IdExistencia { get; set; }
    // Junto con IdExistencia identifica exactamente qué renglón de UbicacionProducto se
    // descuenta — un mismo lote puede tener stock en más de una dirección.
    public uint IdDireccion { get; set; }
    public int NumTarimas { get; set; }
    public int CajasPorTarima { get; set; }
    // Kilos REALES de este renglón — normalmente NumTarimas×CajasPorTarima×PesoCaja, pero puede
    // ser menor cuando CajaIncompleta es true (el lote no alcanzaba para una caja completa y se
    // usó todo lo que quedaba como una sola caja, más ligera de lo normal).
    public decimal Kilos { get; set; }
    public bool CajaIncompleta { get; set; }
    public string? LoteEspecificaciones { get; set; }
    public Embarque Embarque { get; set; } = null!;
    public Existencia Existencia { get; set; } = null!;
}
