namespace Empresa.Intranet.Application.DTOs;

public class VentaDto
{
    public uint Id { get; set; }
    public string? Cliente { get; set; }
    public string? FormaPago { get; set; }
    public string? LugarEntrega { get; set; }
    public string? EstadoRecoleccion { get; set; }
    public DateTime FechaRegistro { get; set; }
    public string? Usuario { get; set; }
    public decimal Total { get; set; }
    public decimal? EfectivoRecibido { get; set; }
    public string? Estado { get; set; }
}

public class CrearVentaDto
{
    public uint? IdCliente { get; set; }
    public uint? IdFormaPago { get; set; }
    public uint? IdLugarEntrega { get; set; }
    public uint? IdEstadoRecoleccion { get; set; }
    public uint IdUsuario { get; set; }
    public decimal Total { get; set; }
    public decimal? EfectivoRecibido { get; set; }
    public string? Estado { get; set; }
    public List<CrearDetalleVentaDto> Detalles { get; set; } = new();
}

// Cambiar únicamente el estado de una venta ya registrada (marcar entregada, etc.),
// sin tocar sus detalles/existencias.
public class CambiarEstadoVentaDto
{
    public string Estado { get; set; } = null!;
    public uint IdUsuario { get; set; }
}

public class CrearDetalleVentaDto
{
    public uint IdExistencia { get; set; }
    public decimal Kilos { get; set; }
    public uint IdDireccion { get; set; }
    public uint? IdDepartamento { get; set; }
}