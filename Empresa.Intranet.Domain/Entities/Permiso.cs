namespace Empresa.Intranet.Domain.Entities;
public class Permiso
{
    public uint Id { get; set; }
    public string Modulo { get; set; } = null!;
    public string Accion { get; set; } = null!;
    public string Descripcion { get; set; } = null!;
    public ICollection<UsuarioPermiso> UsuariosPermiso { get; set; } = new List<UsuarioPermiso>();
}