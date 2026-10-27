using Empresa.Intranet.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<ClavesSat> ClavesSat { get; set; }
    public DbSet<Especie> Especies { get; set; }
    public DbSet<Marca> Marcas { get; set; }
    public DbSet<Talla> Tallas { get; set; }
    public DbSet<PesoCaja> PesosCaja { get; set; }
    public DbSet<Presentacion> Presentaciones { get; set; }
    public DbSet<Producto> Productos { get; set; }
    public DbSet<Descripcion> Descripciones { get; set; }
    public DbSet<DocumentoTipo> DocumentosTipo { get; set; }
    public DbSet<Documento> Documentos { get; set; }
    public DbSet<Domain.Entities.Empresa> Empresas { get; set; }
    public DbSet<Direccion> Direcciones { get; set; }
    public DbSet<Existencia> Existencias { get; set; }
    public DbSet<Usuario> Usuarios { get; set; }
    public DbSet<HistorialMovimiento> HistorialesMovimiento { get; set; }
    public DbSet<TipoMovimiento> TiposMovimiento { get; set; }
    public DbSet<DetalleMovimiento> DetallesMovimiento { get; set; }
    public DbSet<MarcaTractocamion> MarcasTractocamion { get; set; }
    public DbSet<Tractocamion> Tractocamiones { get; set; }
    public DbSet<Chofer> Choferes { get; set; }
    public DbSet<CajaTractocamion> CajasTractocamion { get; set; }
    public DbSet<DetalleTransporte> DetallesTransporte { get; set; }
    public DbSet<Embarque> Embarques { get; set; }
    public DbSet<SolicitudDetalle> SolicitudesDetalle { get; set; }
    public DbSet<SolicitudTarima> SolicitudTarimas { get; set; }
    public DbSet<RtDetalle> RtDetalles { get; set; }
    public DbSet<RtDetalleDocumento> RtDetalleDocumentos { get; set; }
    public DbSet<PedidoConsignacion> PedidosConsignacion { get; set; }
    public DbSet<PedidoConsignacionDetalle> PedidosConsignacionDetalle { get; set; }
    public DbSet<SolicitudProduccion> SolicitudesProduccion { get; set; }
    public DbSet<ProduccionInventarioLinea> ProduccionInventario { get; set; }
    public DbSet<ProduccionReporteFila> ProduccionReporte { get; set; }
    public DbSet<Cliente> Clientes { get; set; }
    public DbSet<FormaPago> FormasPago { get; set; }
    public DbSet<EstadoRecoleccion> EstadosRecoleccion { get; set; }
    public DbSet<LugarEntrega> LugaresEntrega { get; set; }
    public DbSet<Venta> Ventas { get; set; }
    public DbSet<Departamento> Departamentos { get; set; }
    public DbSet<UbicacionProducto> UbicacionesProducto { get; set; }
    public DbSet<Produccion> Producciones { get; set; }
    public DbSet<Compras> Compras { get; set; }
    public DbSet<Visitante> Visitante { get; set; }
    public DbSet<Auditoria> Auditorias { get; set; }
    public DbSet<Permiso> Permisos { get; set; }
public DbSet<UsuarioPermiso> UsuariosPermiso { get; set; }
    public DbSet<SolicitudContrasena> SolicitudesContrasena { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Nombres de tablas ──────────────────────────────────────────
        modelBuilder.Entity<ClavesSat>().ToTable("claves_sat");
        modelBuilder.Entity<Especie>().ToTable("especie");
        modelBuilder.Entity<Marca>().ToTable("marca");
        modelBuilder.Entity<Talla>().ToTable("talla");
        modelBuilder.Entity<PesoCaja>().ToTable("peso_caja");
        modelBuilder.Entity<Presentacion>().ToTable("presentacion");
        modelBuilder.Entity<Producto>().ToTable("producto").HasKey(p => p.Codigo);
        modelBuilder.Entity<Descripcion>().ToTable("descripcion");
        modelBuilder.Entity<DocumentoTipo>().ToTable("documento_tipo");
        modelBuilder.Entity<Documento>().ToTable("documento");
        modelBuilder.Entity<Domain.Entities.Empresa>().ToTable("empresa");
        modelBuilder.Entity<Direccion>().ToTable("direccion")
            .Property(d => d.DireccionTexto).HasColumnName("direccion");
        modelBuilder.Entity<Existencia>().ToTable("existencia");
        modelBuilder.Entity<Usuario>().ToTable("usuario")
            .Property(u => u.Contrasena).HasColumnName("contraseña");
        modelBuilder.Entity<HistorialMovimiento>().ToTable("historial_movimiento");
        modelBuilder.Entity<TipoMovimiento>().ToTable("tipo_movimiento");
        modelBuilder.Entity<DetalleMovimiento>().ToTable("detalle_movimiento");
        modelBuilder.Entity<MarcaTractocamion>().ToTable("marca_tractocamion");
        modelBuilder.Entity<Tractocamion>().ToTable("tractocamion");
        modelBuilder.Entity<Chofer>().ToTable("chofer");
        modelBuilder.Entity<CajaTractocamion>().ToTable("caja_tractocamion");
        modelBuilder.Entity<DetalleTransporte>().ToTable("detalle_transporte");
        modelBuilder.Entity<Embarque>().ToTable("embarque");
        modelBuilder.Entity<SolicitudDetalle>().ToTable("solicitud_detalle");
        modelBuilder.Entity<SolicitudTarima>().ToTable("solicitud_tarima");
        modelBuilder.Entity<RtDetalle>().ToTable("rt_detalle");
        modelBuilder.Entity<RtDetalleDocumento>().ToTable("rt_detalle_documento");
        modelBuilder.Entity<PedidoConsignacion>().ToTable("pedido_consignacion");
        modelBuilder.Entity<PedidoConsignacionDetalle>().ToTable("pedido_consignacion_detalle");
        modelBuilder.Entity<SolicitudProduccion>().ToTable("solicitud_produccion");
        modelBuilder.Entity<ProduccionInventarioLinea>().ToTable("produccion_inventario");
        modelBuilder.Entity<ProduccionReporteFila>().ToTable("produccion_reporte");
        modelBuilder.Entity<Cliente>().ToTable("cliente");
        modelBuilder.Entity<FormaPago>().ToTable("forma_pago");
        modelBuilder.Entity<EstadoRecoleccion>().ToTable("estado_recoleccion");
        modelBuilder.Entity<LugarEntrega>().ToTable("lugar_entrega");
        modelBuilder.Entity<Venta>().ToTable("venta");
        modelBuilder.Entity<Departamento>().ToTable("departamento");
        modelBuilder.Entity<UbicacionProducto>().ToTable("ubicacion_producto");
        modelBuilder.Entity<Produccion>().ToTable("produccion");
        modelBuilder.Entity<Compras>().ToTable("compras");
        modelBuilder.Entity<Visitante>().ToTable("visitante");
        modelBuilder.Entity<Auditoria>().ToTable("auditoria");
        modelBuilder.Entity<Auditoria>()
            .HasOne(a => a.Usuario)
            .WithMany()
            .HasForeignKey(a => a.IdUsuario);
        // ── Precisión de decimales ─────────────────────────────────────
        modelBuilder.Entity<DetalleMovimiento>()
            .Property(d => d.Kilos).HasPrecision(18, 3);
        modelBuilder.Entity<DetalleMovimiento>()
            .Property(d => d.Saldo).HasPrecision(18, 3);
        modelBuilder.Entity<Existencia>()
            .Property(e => e.Costo).HasPrecision(18, 2);
        modelBuilder.Entity<PesoCaja>()
            .Property(p => p.Peso).HasPrecision(10, 3);
        modelBuilder.Entity<Produccion>()
            .Property(p => p.KilosRendimiento).HasPrecision(18, 3);
        modelBuilder.Entity<Produccion>()
            .Property(p => p.PorcentajeRendimiento).HasPrecision(18, 4);
        modelBuilder.Entity<Producto>()
            .Property(p => p.PrecioKilo).HasPrecision(10, 2);
        modelBuilder.Entity<UbicacionProducto>()
            .Property(u => u.CantidadKilos).HasPrecision(18, 3);
        modelBuilder.Entity<SolicitudDetalle>()
            .Property(d => d.Kilos).HasPrecision(18, 3);
        modelBuilder.Entity<UbicacionProducto>()
            .Property(u => u.RowVersion).IsRowVersion();
        modelBuilder.Entity<Venta>()
            .Property(v => v.Total).HasPrecision(18, 2);
        modelBuilder.Entity<Venta>()
            .Property(v => v.EfectivoRecibido).HasPrecision(18, 2);

        // ── Relaciones explícitas ──────────────────────────────────────

        modelBuilder.Entity<Especie>()
            .HasOne(e => e.ClaveSat)
            .WithMany(c => c.Especies)
            .HasForeignKey(e => e.CodigoClaveSat)
            .HasPrincipalKey(c => c.Codigo);

        modelBuilder.Entity<Producto>()
            .HasOne(p => p.Especie)
            .WithMany(e => e.Productos)
            .HasForeignKey(p => p.IdEspecie);
        modelBuilder.Entity<Producto>()
            .HasOne(p => p.Talla)
            .WithMany(t => t.Productos)
            .HasForeignKey(p => p.IdTalla);
        modelBuilder.Entity<Producto>()
            .HasOne(p => p.Marca)
            .WithMany(m => m.Productos)
            .HasForeignKey(p => p.IdMarca);
        modelBuilder.Entity<Producto>()
            .HasOne(p => p.PesoCaja)
            .WithMany(pc => pc.Productos)
            .HasForeignKey(p => p.IdPesoCaja);

        modelBuilder.Entity<Descripcion>()
            .HasOne(d => d.Presentacion)
            .WithMany(p => p.Descripciones)
            .HasForeignKey(d => d.IdPresentacion);
        modelBuilder.Entity<Descripcion>()
            .HasOne(d => d.Producto)
            .WithMany(p => p.Descripciones)
            .HasForeignKey(d => d.CodigoProducto);

        modelBuilder.Entity<Documento>()
            .HasOne(d => d.DocumentoTipo)
            .WithMany(dt => dt.Documentos)
            .HasForeignKey(d => d.IdDocumentoTipo);

        modelBuilder.Entity<Existencia>()
            .HasOne(e => e.Producto)
            .WithMany(p => p.Existencias)
            .HasForeignKey(e => e.CodigoProducto);
        modelBuilder.Entity<Existencia>()
            .HasOne(e => e.DocumentoOrigen)
            .WithMany(d => d.Existencias)
            .HasForeignKey(e => e.IdDocumentoOrigen);

        modelBuilder.Entity<Direccion>()
            .HasOne(d => d.Empresa)
            .WithMany(e => e.Direcciones)
            .HasForeignKey(d => d.IdEmpresa);

        modelBuilder.Entity<HistorialMovimiento>()
            .HasOne(h => h.Usuario)
            .WithMany(u => u.HistorialesMovimiento)
            .HasForeignKey(h => h.IdUsuario);

        modelBuilder.Entity<DetalleMovimiento>()
            .HasOne(d => d.Existencia)
            .WithMany(e => e.DetallesMovimiento)
            .HasForeignKey(d => d.IdExistencia);
        modelBuilder.Entity<DetalleMovimiento>()
            .HasOne(d => d.HistorialMovimiento)
            .WithMany(h => h.DetallesMovimiento)
            .HasForeignKey(d => d.IdHistorial);
        modelBuilder.Entity<DetalleMovimiento>()
            .HasOne(d => d.TipoMovimiento)
            .WithMany(t => t.DetallesMovimiento)
            .HasForeignKey(d => d.IdTipoMovimiento);
        modelBuilder.Entity<DetalleMovimiento>()
            .HasOne(d => d.Direccion)
            .WithMany(dir => dir.DetallesMovimiento)
            .HasForeignKey(d => d.IdDireccion);
        
        modelBuilder.Entity<DetalleMovimiento>()
            .HasOne(d => d.Departamento)
            .WithMany()
            .HasForeignKey(d => d.IdDepartamento);
        modelBuilder.Entity<DetalleMovimiento>()
            .HasOne(d => d.DetalleTransporte)
            .WithMany(dt => dt.DetallesMovimiento)
            .HasForeignKey(d => d.IdDetalleTransporte);

        modelBuilder.Entity<SolicitudDetalle>()
            .HasOne(d => d.Embarque)
            .WithMany(e => e.SolicitudDetalles)
            .HasForeignKey(d => d.IdEmbarque);
        modelBuilder.Entity<SolicitudDetalle>()
            .HasOne(d => d.Existencia)
            .WithMany()
            .HasForeignKey(d => d.IdExistencia);

        modelBuilder.Entity<SolicitudTarima>()
            .HasOne(t => t.Embarque)
            .WithMany(e => e.SolicitudTarimas)
            .HasForeignKey(t => t.IdEmbarque);
        modelBuilder.Entity<SolicitudTarima>()
            .Property(t => t.CajasPorTarima).HasPrecision(18, 3);
        modelBuilder.Entity<SolicitudTarima>()
            .HasOne(t => t.Producto)
            .WithMany()
            .HasForeignKey(t => t.CodigoProducto)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RtDetalle>()
            .HasOne(d => d.Embarque)
            .WithMany(e => e.RtDetalles)
            .HasForeignKey(d => d.IdEmbarque);
        modelBuilder.Entity<RtDetalle>()
            .HasOne(d => d.Producto)
            .WithMany()
            .HasForeignKey(d => d.CodigoProducto);
        modelBuilder.Entity<RtDetalle>()
            .Property(d => d.PrecioUnitario).HasPrecision(18, 2);
        modelBuilder.Entity<RtDetalleDocumento>()
            .HasOne(x => x.RtDetalle)
            .WithMany(d => d.Documentos)
            .HasForeignKey(x => x.IdRtDetalle);
        // Un documento con uso registrado no se puede borrar por accidente (es registro legal).
        modelBuilder.Entity<RtDetalleDocumento>()
            .HasOne(x => x.Documento)
            .WithMany()
            .HasForeignKey(x => x.IdDocumento)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<RtDetalleDocumento>()
            .Property(x => x.Kilos).HasPrecision(18, 3);

        modelBuilder.Entity<PedidoConsignacion>()
            .HasOne(p => p.Empresa).WithMany().HasForeignKey(p => p.IdEmpresa).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PedidoConsignacion>()
            .HasOne(p => p.DocumentoOrden).WithMany().HasForeignKey(p => p.IdDocumentoOrden).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PedidoConsignacion>()
            .HasOne(p => p.DocumentoFactura).WithMany().HasForeignKey(p => p.IdDocumentoFactura).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PedidoConsignacion>()
            .HasIndex(p => new { p.IdEmpresa, p.Numero }).IsUnique();
        modelBuilder.Entity<PedidoConsignacion>()
            .HasIndex(p => new { p.TipoOrigen, p.IdOrigen });
        modelBuilder.Entity<PedidoConsignacionDetalle>()
            .HasOne(d => d.Pedido).WithMany(p => p.Detalles).HasForeignKey(d => d.IdPedido).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PedidoConsignacionDetalle>()
            .HasOne(d => d.Producto).WithMany().HasForeignKey(d => d.CodigoProducto).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PedidoConsignacionDetalle>()
            .Property(d => d.Kilos).HasPrecision(18, 3);
        modelBuilder.Entity<SolicitudProduccion>().Property(x => x.Kilos).HasPrecision(18, 3);
        modelBuilder.Entity<SolicitudProduccion>()
            .HasOne(x => x.Empresa).WithMany().HasForeignKey(x => x.IdEmpresa).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<SolicitudProduccion>()
            .HasOne(x => x.Producto).WithMany().HasForeignKey(x => x.CodigoProducto).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<SolicitudProduccion>()
            .HasOne(x => x.Usuario).WithMany().HasForeignKey(x => x.IdUsuario).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<SolicitudProduccion>()
            .HasOne(x => x.Pedido).WithMany().HasForeignKey(x => x.IdPedido).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<SolicitudProduccion>().HasIndex(x => new { x.IdEmpresa, x.IdPedido });
        modelBuilder.Entity<SolicitudProduccion>()
            .HasOne(x => x.Linea).WithMany().HasForeignKey(x => x.IdLinea).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ProduccionInventarioLinea>()
            .HasOne(x => x.Producto).WithMany().HasForeignKey(x => x.CodigoProducto).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProduccionInventarioLinea>().Property(x => x.Entrada).HasPrecision(18, 3);
        modelBuilder.Entity<ProduccionInventarioLinea>().Property(x => x.Salida).HasPrecision(18, 3);
        modelBuilder.Entity<ProduccionInventarioLinea>().HasIndex(x => x.Fecha);
        modelBuilder.Entity<ProduccionReporteFila>()
            .HasOne(x => x.Producto).WithMany().HasForeignKey(x => x.CodigoProducto).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProduccionReporteFila>()
            .HasOne(x => x.Usuario).WithMany().HasForeignKey(x => x.IdUsuario).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProduccionReporteFila>().Property(x => x.Kilos).HasPrecision(18, 3);
        modelBuilder.Entity<ProduccionReporteFila>().Property(x => x.KilosUsados).HasPrecision(18, 3);
        modelBuilder.Entity<ProduccionReporteFila>().Property(x => x.Rendimiento).HasPrecision(18, 3);
        modelBuilder.Entity<ProduccionReporteFila>().Property(x => x.Porcentaje).HasPrecision(18, 2);
        modelBuilder.Entity<ProduccionReporteFila>().HasIndex(x => x.Fecha);

        modelBuilder.Entity<Tractocamion>()
            .HasOne(t => t.Marca)
            .WithMany(m => m.Tractocamiones)
            .HasForeignKey(t => t.IdMarca);
        modelBuilder.Entity<Tractocamion>()
            .HasOne(t => t.Empresa)
            .WithMany(e => e.Tractocamiones)
            .HasForeignKey(t => t.IdEmpresa);

        modelBuilder.Entity<CajaTractocamion>()
            .HasOne(c => c.Empresa)
            .WithMany()
            .HasForeignKey(c => c.IdEmpresa);

        modelBuilder.Entity<DetalleTransporte>()
            .HasOne(dt => dt.Chofer)
            .WithMany(c => c.DetallesTransporte)
            .HasForeignKey(dt => dt.IdChofer);
        modelBuilder.Entity<DetalleTransporte>()
            .HasOne(dt => dt.Tractocamion)
            .WithMany(t => t.DetallesTransporte)
            .HasForeignKey(dt => dt.IdTractocamion);
        modelBuilder.Entity<DetalleTransporte>()
            .HasOne(dt => dt.Caja)
            .WithMany(c => c.DetallesTransporte)
            .HasForeignKey(dt => dt.IdCaja);

        modelBuilder.Entity<Embarque>()
            .HasOne(e => e.HistorialMovimiento)
            .WithMany(h => h.Embarques)
            .HasForeignKey(e => e.IdHistorial);
        modelBuilder.Entity<Embarque>()
            .HasOne(e => e.Cliente)
            .WithMany()
            .HasForeignKey(e => e.IdCliente)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Embarque>()
            .HasOne(e => e.Direccion)
            .WithMany(d => d.Embarques)
            .HasForeignKey(e => e.IdDireccion);
        modelBuilder.Entity<Embarque>()
            .HasOne(e => e.DetalleTransporte)
            .WithMany(dt => dt.Embarques)
            .HasForeignKey(e => e.IdDetalleTransporte);

        modelBuilder.Entity<Venta>()
            .HasOne(v => v.HistorialMovimiento)
            .WithMany(h => h.Ventas)
            .HasForeignKey(v => v.IdHistorial);
        modelBuilder.Entity<Venta>()
            .HasOne(v => v.EstadoRecoleccion)
            .WithMany(e => e.Ventas)
            .HasForeignKey(v => v.IdEstadoRecoleccion);
        modelBuilder.Entity<Venta>()
            .HasOne(v => v.LugarEntrega)
            .WithMany(l => l.Ventas)
            .HasForeignKey(v => v.IdLugarEntrega);
        modelBuilder.Entity<Venta>()
            .HasOne(v => v.Cliente)
            .WithMany(c => c.Ventas)
            .HasForeignKey(v => v.IdCliente);
        modelBuilder.Entity<Venta>()
            .HasOne(v => v.FormaPago)
            .WithMany(f => f.Ventas)
            .HasForeignKey(v => v.IdFormaPago);

        modelBuilder.Entity<UbicacionProducto>()
            .HasOne(u => u.Existencia)
            .WithMany(e => e.UbicacionesProducto)
            .HasForeignKey(u => u.IdExistencia);
        modelBuilder.Entity<UbicacionProducto>()
            .HasOne(u => u.Direccion)
            .WithMany(d => d.UbicacionesProducto)
            .HasForeignKey(u => u.IdDireccion);
        modelBuilder.Entity<UbicacionProducto>()
            .HasOne(u => u.Departamento)
            .WithMany()
            .HasForeignKey(u => u.IdDepartamento);

        modelBuilder.Entity<Produccion>()
            .HasOne(p => p.DetalleMovimiento)
            .WithMany(d => d.Producciones)
            .HasForeignKey(p => p.IdDetalleMovimiento);

        modelBuilder.Entity<Compras>()
            .HasOne(c => c.Empresa)
            .WithMany(e => e.Compras)
            .HasForeignKey(c => c.IdEmpresa);
        modelBuilder.Entity<Compras>()
            .HasOne(c => c.HistorialMovimiento)
            .WithMany(h => h.Compras)
            .HasForeignKey(c => c.IdHistorialMovimiento);
        
        modelBuilder.Entity<Permiso>().ToTable("permiso");
modelBuilder.Entity<UsuarioPermiso>().ToTable("usuario_permiso");

modelBuilder.Entity<UsuarioPermiso>()
    .HasOne(up => up.Usuario)
    .WithMany(u => u.Permisos)
    .HasForeignKey(up => up.IdUsuario);

modelBuilder.Entity<UsuarioPermiso>()
    .HasOne(up => up.Permiso)
    .WithMany(p => p.UsuariosPermiso)
    .HasForeignKey(up => up.IdPermiso);

        modelBuilder.Entity<SolicitudContrasena>().ToTable("solicitud_contrasena");
        modelBuilder.Entity<SolicitudContrasena>()
            .HasOne(s => s.Usuario)
            .WithMany()
            .HasForeignKey(s => s.IdUsuario);
    }
}