namespace Empresa.Intranet.Domain.Entities;
public class DocumentoTipo
{
    public int Id { get; set; }
    public string Nombre { get; set; } = null!;
    public ICollection<Documento> Documentos { get; set; } = new List<Documento>();
}