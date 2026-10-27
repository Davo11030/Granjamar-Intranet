namespace Empresa.Intranet.Application.DTOs;

public class PermisoDto
{
    public uint Id { get; set; }
    public string Modulo { get; set; } = null!;
    public string Accion { get; set; } = null!;
    public string Descripcion { get; set; } = null!;
}

public class AsignarPermisoDto
{
    public uint IdUsuario { get; set; }
    public uint IdPermiso { get; set; }
}