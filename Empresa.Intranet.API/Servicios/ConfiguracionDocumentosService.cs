using Empresa.Intranet.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Servicios;

public record CampoDocumento(string Clave, string Etiqueta, string Ayuda, string Predeterminado = "");
public record DefinicionDocumento(string Clave, string Nombre, string Descripcion, CampoDocumento[] Campos);

// Los datos fijos de cada documento que genera el sistema. Aquí solo se declara QUÉ se puede cambiar y su valor de
// fábrica; los valores que el administrador captura viven en la base (configuracion_documento).
public class ConfiguracionDocumentosService
{
    public const string Requisicion = "Requisicion";
    public const string PedidoMercancia = "PedidoMercancia";
    public const string Solicitud = "Solicitud";
    public const string Ciego = "Ciego";
    public const string Rt = "RT";

    public static readonly DefinicionDocumento[] Definiciones =
    {
        new(Requisicion, "Requisición de embarque", "Hoja de Requisición (PDF y Excel) del detalle del embarque.", new[]
        {
            new CampoDocumento("Titulo", "Título del encabezado", "Nombre de la empresa en la parte de arriba de la hoja.", "GRANJAMAR S. de R.L. de C.V."),
            new CampoDocumento("Subtitulo", "Subtítulo", "Va debajo del título.", "EMBARQUES"),
            new CampoDocumento("Despacho", "Despacho (nombre)", "Quien despacha: aparece en su recuadro de Autorizaciones."),
            new CampoDocumento("Reviso", "Revisó (nombre)", "Quien revisa: aparece en su recuadro de Autorizaciones."),
            new CampoDocumento("Autorizo", "Autorizó (nombre)", "Quien autoriza: aparece en su recuadro de Autorizaciones."),
        }),
        new(Solicitud, "Solicitud de embarque", "Hoja de Solicitud (PDF y Excel) con el producto, las tarimas y los lotes de cada destino.", new[]
        {
            new CampoDocumento("Titulo", "Título", "Va debajo del logo.", "SOLICITUD DE EMBARQUE"),
        }),
        new(Ciego, "Ciego de carga", "Hoja de Ciego de carga (PDF y Excel) con las tarimas que se cargan al camión.", new[]
        {
            new CampoDocumento("Titulo", "Título", "Va en el recuadro verde de arriba; la fecha del embarque se agrega al final.", "CIEGO DE CARGA GRANJAMAR SUCURSAL ENSENADA"),
        }),
        new(Rt, "Remisión-Traslado (RT)", "Hoja de RT (PDF y Excel): solo los datos variables, para imprimir sobre la hoja ya impresa y enumerada. El domicilio de origen es siempre el de la empresa.", new[]
        {
            new CampoDocumento("OrigenNombre", "Domicilio origen: empresa", "Nombre de quien remite, como va en \"DOMICILIO ORIGEN\".", "GRANJAMAR S DE RL DE CV"),
            new CampoDocumento("OrigenRfc", "Domicilio origen: RFC", "RFC de quien remite.", "GRA220927C78"),
            new CampoDocumento("OrigenCalle", "Domicilio origen: calle", "Calle, número y colonia del origen.", "CALLE TRES #236, PARQUE INDUSTRIAL FONDEPORT, EL SAUZAL DE RODRIGUEZ"),
            new CampoDocumento("OrigenCiudad", "Domicilio origen: ciudad y estado", "Ciudad y estado del origen.", "ENSENADA, BAJA CALIFORNIA"),
            new CampoDocumento("OrigenCp", "Domicilio origen: código postal", "Código postal del origen.", "22760"),
            new CampoDocumento("AjusteX", "Ajuste horizontal del PDF (pt)", "Mueve todo lo impreso a la derecha (positivo) o a la izquierda (negativo) si la hoja ya impresa queda desfasada. 1 pt = 0.35 mm.", "0"),
            new CampoDocumento("AjusteY", "Ajuste vertical del PDF (pt)", "Mueve todo lo impreso hacia abajo (positivo) o hacia arriba (negativo).", "0"),
        }),
        new(PedidoMercancia, "Pedido de mercancía (consignación)", "Imagen del pedido que se manda a la empresa en consignación.", new[]
        {
            new CampoDocumento("Titulo", "Título", "Sucursal o empresa que hace el pedido.", "GRANJAMAR SUC. ENSENADA"),
            new CampoDocumento("Firma", "Nombre de quien firma", "Aparece abajo a la derecha del pedido."),
        }),
    };

    private readonly AppDbContext _context;
    public ConfiguracionDocumentosService(AppDbContext context) => _context = context;

    // Los valores vigentes de un documento: lo capturado por el administrador sobre los valores de fábrica.
    public async Task<Dictionary<string, string>> ObtenerAsync(string documento)
    {
        var definicion = Definiciones.First(d => d.Clave == documento);
        var guardados = await _context.ConfiguracionDocumentos.AsNoTracking()
            .Where(c => c.Documento == documento).ToDictionaryAsync(c => c.Clave, c => c.Valor);
        return definicion.Campos.ToDictionary(c => c.Clave, c => guardados.TryGetValue(c.Clave, out var v) ? v : c.Predeterminado);
    }
}
