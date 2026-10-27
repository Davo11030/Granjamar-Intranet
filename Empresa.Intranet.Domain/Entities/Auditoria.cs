namespace Empresa.Intranet.Domain.Entities;
public class Auditoria
{
    public uint Id { get; set; }
    public string Tabla { get; set; } = null!;
    public string IdRegistro { get; set; } = null!;
    public string Accion { get; set; } = null!;
    public string? DatosAnteriores { get; set; }
    public string? DatosNuevos { get; set; }
    public uint IdUsuario { get; set; }
    public DateTime Fecha { get; set; }
    public Usuario Usuario { get; set; } = null!;
}