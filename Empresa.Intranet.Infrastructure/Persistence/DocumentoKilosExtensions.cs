using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.Infrastructure.Persistence;

// Conteo LEGAL de kilos por documento (pedimento/factura) y por código de producto — aparte del
// stock físico: un documento entra con ciertos kilos (la compra que creó sus lotes) y cada RT
// enviada descuenta de él los kilos que declara usar.
public static class DocumentoKilosExtensions
{
    // Kilos que respalda la FACTURA de los pedidos de consignación para ese código: lo que el pedido
    // pidió de ese producto. Una vez cargada, la factura es de Granjamar y se queda aunque el embarque,
    // venta o producción de origen cambie o se elimine. Una misma factura puede cubrir varios pedidos y varios productos; el
    // conteo es por (documento, producto), igual que el de los pedimentos.
    public static async Task<Dictionary<uint, decimal>> KilosPedidoPorDocumento(this AppDbContext ctx, string codigoProducto)
    {
        return await (
            from d in ctx.PedidosConsignacionDetalle
            where d.CodigoProducto == codigoProducto
                && d.Pedido.IdDocumentoFactura != null
            group d by d.Pedido.IdDocumentoFactura!.Value into g
            select new { Documento = g.Key, Kilos = g.Sum(x => x.Kilos) })
            .ToDictionaryAsync(x => x.Documento, x => x.Kilos);
    }

    // Kilos con los que entró cada documento para ese código: la suma de las compras de todos sus
    // lotes (pedimentos y facturas de entradas) más lo que respalda la factura de un pedido de consignación.
    public static async Task<Dictionary<uint, decimal>> KilosOriginalesPorDocumento(this AppDbContext ctx, string codigoProducto)
    {
        var resultado = await KilosDeEntradasPorDocumento(ctx, codigoProducto);
        foreach (var (doc, kilos) in await KilosPedidoPorDocumento(ctx, codigoProducto))
            resultado[doc] = resultado.GetValueOrDefault(doc) + kilos;
        return resultado;
    }

    private static async Task<Dictionary<uint, decimal>> KilosDeEntradasPorDocumento(AppDbContext ctx, string codigoProducto)
    {
        var tipoCompra = await ctx.TiposMovimiento.FirstOrDefaultAsync(t => t.Nombre.ToLower().Contains("compra"));
        if (tipoCompra == null) return new Dictionary<uint, decimal>();

        return await (
            from d in ctx.DetallesMovimiento
            join e in ctx.Existencias on d.IdExistencia equals (uint?)e.Id
            where d.IdTipoMovimiento == tipoCompra.Id
                && e.CodigoProducto == codigoProducto
                && e.Activo
                && e.IdDocumentoOrigen != null
            group d by e.IdDocumentoOrigen!.Value into g
            select new { Documento = g.Key, Kilos = g.Sum(x => x.Kilos) })
            .ToDictionaryAsync(x => x.Documento, x => x.Kilos);
    }

    // Kilos ya descontados de cada documento por RTs de embarques activos. "excluirEmbarque" deja
    // fuera el uso del propio embarque (al reguardar una RT se reemplaza su uso anterior).
    public static async Task<Dictionary<uint, decimal>> KilosUsadosPorDocumento(
        this AppDbContext ctx, string codigoProducto, uint? excluirEmbarque = null)
    {
        return await (
            from x in ctx.RtDetalleDocumentos
            where x.RtDetalle.CodigoProducto == codigoProducto
                && x.RtDetalle.Embarque.Activo
                && (excluirEmbarque == null || x.RtDetalle.IdEmbarque != excluirEmbarque)
            group x by x.IdDocumento into g
            select new { Documento = g.Key, Kilos = g.Sum(x => x.Kilos) })
            .ToDictionaryAsync(x => x.Documento, x => x.Kilos);
    }
}
