namespace Empresa.Intranet.Domain.Entities;

// Un renglón de la TABLA GENERAL de producción (siempre disponible, un día a la vez):
//   Inicial   = lo que había en producción (bloqueado) al empezar el día = la Existencia con la que cerró el día anterior.
//   Entrada   = producto que ingresa a producción (bloqueado): sale de Conpaq o se pide a consignación.
//   Salida    = kilos que se DESBLOQUEAN para poder usarlos en los reportes.
//   Existencia = Inicial + Entradas − Salidas.
// Solo se guardan los renglones con movimiento; el Inicial de cada día se calcula.
public class ProduccionInventarioLinea
{
    public uint Id { get; set; }
    public DateTime Fecha { get; set; }
    public int Orden { get; set; }
    public string CodigoProducto { get; set; } = null!;
    // De dónde entra (lote y bodega de Conpaq o de la empresa en consignación). Solo si hay Entrada.
    public uint? IdExistencia { get; set; }
    public uint? IdDireccion { get; set; }
    public uint? IdEmpresa { get; set; }
    public bool EsConsignacion { get; set; }
    public decimal Entrada { get; set; }
    public decimal Salida { get; set; }
    // Lo que descontó de Conpaq (no aplica a consignación, que solo genera una solicitud).
    public uint? IdDetalleMovimiento { get; set; }
    public uint IdUsuario { get; set; }
    public bool Activo { get; set; } = true;
    public Producto Producto { get; set; } = null!;
}

// Un renglón del REPORTE diario. La etapa la da la columna en la que se capturan los kilos:
//   Entrada → kilos que se toman de lo desbloqueado.
//   MP      → "M.P. en procesos": resultó Kilos del producto del renglón; se usó TODO lo del renglón anterior.
//   Salida  → sale de producción hacia Conpaq; se usó TODO lo del renglón anterior. Una salida justo después de otra
//             es de la misma entrada y es el rendimiento.
public class ProduccionReporteFila
{
    public const string Entrada = "Entrada";
    public const string MP = "MP";
    public const string Salida = "Salida";
    public const string UsoDesbloqueado = "Desbloqueado";   // lo usado salió de lo desbloqueado
    public const string UsoProceso = "Proceso";             // lo usado salió de M.P. en procesos
    public const string UsoNinguno = "Ninguno";

    public uint Id { get; set; }
    public DateTime Fecha { get; set; }
    public int Orden { get; set; }
    public string CodigoProducto { get; set; } = null!;
    public string Etapa { get; set; } = null!;
    public decimal Kilos { get; set; }
    public string Uso { get; set; } = UsoNinguno;
    public string? CodigoUsado { get; set; }
    public decimal KilosUsados { get; set; }
    // MP que no viene de una entrada: solo referencia producto que ya estaba en proceso de días anteriores.
    public bool EsReferencia { get; set; }
    // Solo en salidas.
    public decimal? Rendimiento { get; set; }
    public decimal? Porcentaje { get; set; }
    public string? Lote { get; set; }
    public bool LoteOriginal { get; set; }
    // El lote/bodega del que provenía el producto la primera vez (se arrastra por toda la cadena).
    public uint? IdExistenciaOrigen { get; set; }
    public uint? IdDireccionOrigen { get; set; }
    // Inventario que creó la salida (para poder deshacerla al editar).
    public uint? IdDetalleMovimiento { get; set; }
    public uint? IdExistenciaSalida { get; set; }
    public uint? IdDetalleMovimientoExtra { get; set; }
    public uint? IdExistenciaExtra { get; set; }
    public uint IdUsuario { get; set; }
    public bool Activo { get; set; } = true;
    public Producto Producto { get; set; } = null!;
    public Usuario Usuario { get; set; } = null!;
}
