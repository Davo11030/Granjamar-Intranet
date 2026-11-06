namespace Empresa.Intranet.Domain.Entities;
public class Embarque
{
    public uint Id { get; set; }
    public string? Numero { get; set; }
    public uint IdHistorial { get; set; }
    public string? RutaCiego { get; set; }
    public string? RutaRequisision { get; set; }
    public string? RutaRt { get; set; }
    public string? RutaSolicitud { get; set; }
    // Destino: una dirección (empresa/bodega) O un cliente — nunca los dos.
    public uint? IdDireccion { get; set; }
    public uint? IdCliente { get; set; }
    // Origen / remitente del embarque: el lugar que se elige arriba en la Requisición, junto al No. de embarque (no es
    // el lugar de donde sale cada producto, que va en sus renglones).
    public uint? IdDireccionOrigen { get; set; }
    public uint? IdDetalleTransporte { get; set; }
    public string Estado { get; set; } = "En proceso"; // En proceso | Completado
    public bool Activo { get; set; } = true;

    // Avance de cada documento del embarque — controla el color de su pestaña en pantalla.
    public bool RequisicionCompleta { get; set; } = true; // ya existe el embarque = ya existe la requisición
    public bool SolicitudCompleta { get; set; }
    public bool RtCompleta { get; set; }
    public bool CiegoCompleto { get; set; }
    public bool CartaCompleta { get; set; }
    // Números de los sellos de seguridad de la unidad de carga (Carta responsiva). Se guardan en todos los destinos del mismo número de embarque.
    public string? SelloSeguridad1 { get; set; }
    public string? SelloSeguridad2 { get; set; }
    public HistorialMovimiento HistorialMovimiento { get; set; } = null!;
    public Direccion? Direccion { get; set; }
    public Direccion? DireccionOrigen { get; set; }
    public Cliente? Cliente { get; set; }
    public DetalleTransporte? DetalleTransporte { get; set; }
    public ICollection<SolicitudDetalle> SolicitudDetalles { get; set; } = new List<SolicitudDetalle>();
    public ICollection<RtDetalle> RtDetalles { get; set; } = new List<RtDetalle>();
    public ICollection<SolicitudTarima> SolicitudTarimas { get; set; } = new List<SolicitudTarima>();
}