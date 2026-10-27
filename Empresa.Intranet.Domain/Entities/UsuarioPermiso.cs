namespace Empresa.Intranet.Domain.Entities;
public class UsuarioPermiso
{
    public uint Id { get; set; }
    public uint IdUsuario { get; set; }
    public uint IdPermiso { get; set; }
    public Usuario Usuario { get; set; } = null!;
    public Permiso Permiso { get; set; } = null!;
}