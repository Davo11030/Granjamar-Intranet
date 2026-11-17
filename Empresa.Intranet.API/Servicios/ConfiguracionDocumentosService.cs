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
    public const string Carta = "Carta";

    public static readonly DefinicionDocumento[] Definiciones =
    {
        new(Requisicion, "Requisición de embarque", "Hoja de Requisición (PDF y Excel) del detalle del embarque. El origen y el destino salen del embarque, no se cambian aquí.", new[]
        {
            new CampoDocumento("Titulo", "Título del encabezado", "Nombre de la empresa en la parte de arriba de la hoja.", "GRANJAMAR S. de R.L. de C.V."),
            new CampoDocumento("Subtitulo", "Subtítulo", "Va debajo del título.", "EMBARQUES"),
            new CampoDocumento("Despacho", "Despacho (nombre)", "Quien despacha: aparece en su recuadro de Autorizaciones."),
            new CampoDocumento("Reviso", "Revisó (nombre)", "Quien revisa: aparece en su recuadro de Autorizaciones."),
            new CampoDocumento("Autorizo", "Autorizó (nombre)", "Quien autoriza: aparece en su recuadro de Autorizaciones."),
            new CampoDocumento("Observaciones", "Observaciones fijas", "Texto que se imprime en el renglón de OBSERVACIONES de todas las requisiciones (cabe en hasta 4 renglones). Vacío = en blanco para escribir a mano."),
        }),
        new(Solicitud, "Solicitud de embarque", "Hoja de Solicitud (PDF y Excel) con el producto, las tarimas y los lotes de cada destino.", new[]
        {
            new CampoDocumento("Titulo", "Título", "Va debajo del logo.", "SOLICITUD DE EMBARQUE"),
            new CampoDocumento("Nota", "Nota al pie", "Texto pequeño que se imprime abajo de la hoja (por ejemplo, una indicación para el almacén). Vacío = sin nota."),
        }),
        new(Ciego, "Ciego de carga", "Hoja de Ciego de carga (PDF y Excel) con las tarimas que se cargan al camión.", new[]
        {
            new CampoDocumento("Titulo", "Título", "Va en el recuadro verde de arriba; la fecha del embarque se agrega al final.", "CIEGO DE CARGA GRANJAMAR SUCURSAL ENSENADA"),
            new CampoDocumento("Nota", "Nota al pie", "Texto pequeño que se imprime abajo de la hoja. Vacío = sin nota."),
        }),
        new(Rt, "Remisión-Traslado (RT)", "Hoja de RT (PDF y Excel): solo los datos variables, para imprimir sobre la hoja ya impresa y enumerada. El domicilio de origen es el origen que se eligió al crear el embarque.", new[]
        {
            new CampoDocumento("AjusteX", "Ajuste horizontal del PDF (pt)", "Mueve todo lo impreso a la derecha (positivo) o a la izquierda (negativo) si la hoja ya impresa queda desfasada. 1 pt = 0.35 mm.", "0"),
            new CampoDocumento("AjusteY", "Ajuste vertical del PDF (pt)", "Mueve todo lo impreso hacia abajo (positivo) o hacia arriba (negativo).", "0"),
        }),
        new(Carta, "Carta responsiva (sellos de seguridad)", "Carta que acompaña la unidad de carga. El texto de la primera hoja (qué es un sello y por qué se registra su ruptura) es fijo; estos son los textos que sí se pueden cambiar.", new[]
        {
            new CampoDocumento("Saludo", "Saludo", "Primer renglón de la carta.", "A quien corresponda:"),
            new CampoDocumento("Monitoreo", "Párrafo de monitoreo", "Va después de los números de sello.", "Cabe mencionar que dicha unidad de carga se encuentra monitoreada las 24 horas del día por medio de sistema gps, el cual lleva un seguimiento continuo por medio de una empresa externa."),
            new CampoDocumento("Objetivo", "Párrafo del objetivo", "Explica para qué se hace el escrito.", "Dicho escrito se realiza con el objetivo de poder transitar de forma segura en las carreteras y espacio públicos, en condiciones de equidad, igualdad y accesibilidad para todos."),
            new CampoDocumento("Cierre", "Despedida", "Renglón de cierre, antes de la firma.", "Agradeciendo las atenciones de antemano quedo de Ud."),
            new CampoDocumento("Firma", "Quien firma", "Nombre que va al final. Vacío = la compañía de transporte del embarque."),
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
