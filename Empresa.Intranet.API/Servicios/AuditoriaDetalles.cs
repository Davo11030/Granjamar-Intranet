using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Servicios;

// Cómo se guardan en la auditoría las líneas de PRODUCTO de un movimiento (entrada, embarque, venta…): legibles, con el
// producto, su lote y su bodega, para que el historial del admin muestre bien qué se movió. Solo se incluyen los datos
// que existen. Las claves usan los nombres que entiende la pantalla de Movimientos.
public static class AuditoriaDetalles
{
    // "Empresa — dirección" de una bodega.
    public static async Task<string?> BodegaAsync(AppDbContext context, uint? idDireccion)
    {
        if (idDireccion == null) return null;
        var d = await context.Direcciones.AsNoTracking().Include(x => x.Empresa).FirstOrDefaultAsync(x => x.Id == idDireccion);
        if (d == null) return null;
        return d.Empresa != null ? $"{d.Empresa.Nombre} — {d.DireccionTexto}" : d.DireccionTexto;
    }

    public static async Task<Dictionary<string, object?>> LineaAsync(AppDbContext context, DetalleMovimiento d, bool completa = false)
    {
        var existencia = d.IdExistencia != null ? await context.Existencias.AsNoTracking().FirstOrDefaultAsync(e => e.Id == d.IdExistencia) : null;
        var codigo = existencia?.CodigoProducto ?? d.CodigoProducto;
        var producto = codigo != null ? await context.Productos.AsNoTracking().Include(p => p.Especie).FirstOrDefaultAsync(p => p.Codigo == codigo) : null;

        var linea = new Dictionary<string, object?>
        {
            ["Producto"] = codigo,
            ["Descripcion"] = producto?.Especie?.Nombre ?? codigo,
        };
        if (existencia?.Lote != null) linea["Lote"] = existencia.Lote;
        var bodega = await BodegaAsync(context, d.IdDireccion);
        if (bodega != null) linea["Bodega"] = bodega;
        if (completa && existencia != null)
        {
            if (existencia.IdDocumentoOrigen != null)
            {
                var doc = await context.Documentos.AsNoTracking().Include(x => x.DocumentoTipo).FirstOrDefaultAsync(x => x.Id == existencia.IdDocumentoOrigen);
                if (doc != null) linea["Documento"] = $"{doc.DocumentoTipo?.Nombre} {doc.Numero}".Trim();
            }
            if (existencia.Costo != null) linea["Costo"] = existencia.Costo;
            if (existencia.Caducidad != null) linea["Caducidad"] = existencia.Caducidad.Value.ToString("yyyy-MM-dd");
        }
        linea["Kilos"] = d.Kilos;
        return linea;
    }

    public static async Task<List<object>> LineasAsync(AppDbContext context, IEnumerable<DetalleMovimiento> detalles, bool completa = false)
    {
        var lista = new List<object>();
        foreach (var d in detalles) lista.Add(await LineaAsync(context, d, completa));
        return lista;
    }
}
