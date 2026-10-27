using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "caja_tractocamion",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CajaPlaca = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CajaTamano = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CajaCapacidad = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_caja_tractocamion", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "chofer",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NumeroTelefono = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TipoTelefono = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chofer", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "claves_sat",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Codigo = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_claves_sat", x => x.Id);
                    table.UniqueConstraint("AK_claves_sat_Codigo", x => x.Codigo);
                });

            migrationBuilder.CreateTable(
                name: "cliente",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Telefono = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Rfc = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cliente", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "departamento",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_departamento", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "documento_tipo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_documento_tipo", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "empresa",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Rfc = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UrlLogo = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_empresa", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "estado_recoleccion",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Descripcion = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_estado_recoleccion", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "forma_pago",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_forma_pago", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "lugar_entrega",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lugar_entrega", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "marca",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_marca", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "marca_tractocamion",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_marca_tractocamion", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "peso_caja",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Peso = table.Column<decimal>(type: "decimal(10,3)", precision: 10, scale: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_peso_caja", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "presentacion",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_presentacion", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "talla",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Descripcion = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_talla", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tipo_movimiento",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tipo_movimiento", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "usuario",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Puesto = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    contraseña = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_usuario", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "visitante",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_visitante", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "especie",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CodigoClaveSat = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_especie", x => x.Id);
                    table.ForeignKey(
                        name: "FK_especie_claves_sat_CodigoClaveSat",
                        column: x => x.CodigoClaveSat,
                        principalTable: "claves_sat",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "documento",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Numero = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IdDocumentoTipo = table.Column<int>(type: "int", nullable: false),
                    Ruta = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_documento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_documento_documento_tipo_IdDocumentoTipo",
                        column: x => x.IdDocumentoTipo,
                        principalTable: "documento_tipo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "direccion",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    direccion = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Municipio = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IdEmpresa = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_direccion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_direccion_empresa_IdEmpresa",
                        column: x => x.IdEmpresa,
                        principalTable: "empresa",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "tractocamion",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Modelo = table.Column<int>(type: "int", nullable: false),
                    Color = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IdMarca = table.Column<long>(type: "bigint", nullable: false),
                    IdEmpresa = table.Column<long>(type: "bigint", nullable: true),
                    Placa = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tractocamion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tractocamion_empresa_IdEmpresa",
                        column: x => x.IdEmpresa,
                        principalTable: "empresa",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_tractocamion_marca_tractocamion_IdMarca",
                        column: x => x.IdMarca,
                        principalTable: "marca_tractocamion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "historial_movimiento",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FechaRegistro = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IdUsuario = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_historial_movimiento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_historial_movimiento_usuario_IdUsuario",
                        column: x => x.IdUsuario,
                        principalTable: "usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "producto",
                columns: table => new
                {
                    Codigo = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IdEspecie = table.Column<int>(type: "int", nullable: false),
                    IdTalla = table.Column<int>(type: "int", nullable: true),
                    IdMarca = table.Column<int>(type: "int", nullable: true),
                    IdPesoCaja = table.Column<int>(type: "int", nullable: true),
                    PrecioKilo = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_producto", x => x.Codigo);
                    table.ForeignKey(
                        name: "FK_producto_especie_IdEspecie",
                        column: x => x.IdEspecie,
                        principalTable: "especie",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_producto_marca_IdMarca",
                        column: x => x.IdMarca,
                        principalTable: "marca",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_producto_peso_caja_IdPesoCaja",
                        column: x => x.IdPesoCaja,
                        principalTable: "peso_caja",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_producto_talla_IdTalla",
                        column: x => x.IdTalla,
                        principalTable: "talla",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "detalle_transporte",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdChofer = table.Column<long>(type: "bigint", nullable: true),
                    IdTractocamion = table.Column<long>(type: "bigint", nullable: true),
                    IdCaja = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_detalle_transporte", x => x.Id);
                    table.ForeignKey(
                        name: "FK_detalle_transporte_caja_tractocamion_IdCaja",
                        column: x => x.IdCaja,
                        principalTable: "caja_tractocamion",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_detalle_transporte_chofer_IdChofer",
                        column: x => x.IdChofer,
                        principalTable: "chofer",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_detalle_transporte_tractocamion_IdTractocamion",
                        column: x => x.IdTractocamion,
                        principalTable: "tractocamion",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "compras",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdEmpresa = table.Column<long>(type: "bigint", nullable: true),
                    IdHistorialMovimiento = table.Column<long>(type: "bigint", nullable: true),
                    UrlRemision = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NumeroEmbarque = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UrlFactura = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_compras", x => x.Id);
                    table.ForeignKey(
                        name: "FK_compras_empresa_IdEmpresa",
                        column: x => x.IdEmpresa,
                        principalTable: "empresa",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_compras_historial_movimiento_IdHistorialMovimiento",
                        column: x => x.IdHistorialMovimiento,
                        principalTable: "historial_movimiento",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "venta",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdHistorial = table.Column<long>(type: "bigint", nullable: true),
                    IdEstadoRecoleccion = table.Column<long>(type: "bigint", nullable: true),
                    IdLugarEntrega = table.Column<long>(type: "bigint", nullable: true),
                    IdCliente = table.Column<long>(type: "bigint", nullable: true),
                    IdFormaPago = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_venta", x => x.Id);
                    table.ForeignKey(
                        name: "FK_venta_cliente_IdCliente",
                        column: x => x.IdCliente,
                        principalTable: "cliente",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_venta_estado_recoleccion_IdEstadoRecoleccion",
                        column: x => x.IdEstadoRecoleccion,
                        principalTable: "estado_recoleccion",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_venta_forma_pago_IdFormaPago",
                        column: x => x.IdFormaPago,
                        principalTable: "forma_pago",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_venta_historial_movimiento_IdHistorial",
                        column: x => x.IdHistorial,
                        principalTable: "historial_movimiento",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_venta_lugar_entrega_IdLugarEntrega",
                        column: x => x.IdLugarEntrega,
                        principalTable: "lugar_entrega",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "descripcion",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdPresentacion = table.Column<int>(type: "int", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_descripcion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_descripcion_presentacion_IdPresentacion",
                        column: x => x.IdPresentacion,
                        principalTable: "presentacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_descripcion_producto_CodigoProducto",
                        column: x => x.CodigoProducto,
                        principalTable: "producto",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "existencia",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Lote = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IdDocumentoOrigen = table.Column<long>(type: "bigint", nullable: true),
                    Costo = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Caducidad = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_existencia", x => x.Id);
                    table.ForeignKey(
                        name: "FK_existencia_documento_IdDocumentoOrigen",
                        column: x => x.IdDocumentoOrigen,
                        principalTable: "documento",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_existencia_producto_CodigoProducto",
                        column: x => x.CodigoProducto,
                        principalTable: "producto",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "embarque",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdHistorial = table.Column<long>(type: "bigint", nullable: false),
                    RutaCiego = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RutaRequisision = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RutaRt = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RutaSolicitud = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IdDireccion = table.Column<long>(type: "bigint", nullable: true),
                    IdDetalleTransporte = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_embarque", x => x.Id);
                    table.ForeignKey(
                        name: "FK_embarque_detalle_transporte_IdDetalleTransporte",
                        column: x => x.IdDetalleTransporte,
                        principalTable: "detalle_transporte",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_embarque_direccion_IdDireccion",
                        column: x => x.IdDireccion,
                        principalTable: "direccion",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_embarque_historial_movimiento_IdHistorial",
                        column: x => x.IdHistorial,
                        principalTable: "historial_movimiento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "detalle_movimiento",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdExistencia = table.Column<long>(type: "bigint", nullable: true),
                    IdHistorial = table.Column<long>(type: "bigint", nullable: false),
                    Kilos = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    IdTipoMovimiento = table.Column<long>(type: "bigint", nullable: false),
                    Saldo = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: true),
                    IdDireccion = table.Column<long>(type: "bigint", nullable: true),
                    IdDepartamento = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_detalle_movimiento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_detalle_movimiento_departamento_IdDepartamento",
                        column: x => x.IdDepartamento,
                        principalTable: "departamento",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_detalle_movimiento_direccion_IdDireccion",
                        column: x => x.IdDireccion,
                        principalTable: "direccion",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_detalle_movimiento_existencia_IdExistencia",
                        column: x => x.IdExistencia,
                        principalTable: "existencia",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_detalle_movimiento_historial_movimiento_IdHistorial",
                        column: x => x.IdHistorial,
                        principalTable: "historial_movimiento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_detalle_movimiento_tipo_movimiento_IdTipoMovimiento",
                        column: x => x.IdTipoMovimiento,
                        principalTable: "tipo_movimiento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ubicacion_producto",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdExistencia = table.Column<long>(type: "bigint", nullable: false),
                    IdDireccion = table.Column<long>(type: "bigint", nullable: false),
                    CantidadKilos = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    IdDepartamento = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ubicacion_producto", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ubicacion_producto_departamento_IdDepartamento",
                        column: x => x.IdDepartamento,
                        principalTable: "departamento",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ubicacion_producto_direccion_IdDireccion",
                        column: x => x.IdDireccion,
                        principalTable: "direccion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ubicacion_producto_existencia_IdExistencia",
                        column: x => x.IdExistencia,
                        principalTable: "existencia",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "produccion",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdDetalleMovimiento = table.Column<long>(type: "bigint", nullable: true),
                    KilosRendimiento = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    PorcentajeRendimiento = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_produccion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_produccion_detalle_movimiento_IdDetalleMovimiento",
                        column: x => x.IdDetalleMovimiento,
                        principalTable: "detalle_movimiento",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_compras_IdEmpresa",
                table: "compras",
                column: "IdEmpresa");

            migrationBuilder.CreateIndex(
                name: "IX_compras_IdHistorialMovimiento",
                table: "compras",
                column: "IdHistorialMovimiento");

            migrationBuilder.CreateIndex(
                name: "IX_descripcion_CodigoProducto",
                table: "descripcion",
                column: "CodigoProducto");

            migrationBuilder.CreateIndex(
                name: "IX_descripcion_IdPresentacion",
                table: "descripcion",
                column: "IdPresentacion");

            migrationBuilder.CreateIndex(
                name: "IX_detalle_movimiento_IdDepartamento",
                table: "detalle_movimiento",
                column: "IdDepartamento");

            migrationBuilder.CreateIndex(
                name: "IX_detalle_movimiento_IdDireccion",
                table: "detalle_movimiento",
                column: "IdDireccion");

            migrationBuilder.CreateIndex(
                name: "IX_detalle_movimiento_IdExistencia",
                table: "detalle_movimiento",
                column: "IdExistencia");

            migrationBuilder.CreateIndex(
                name: "IX_detalle_movimiento_IdHistorial",
                table: "detalle_movimiento",
                column: "IdHistorial");

            migrationBuilder.CreateIndex(
                name: "IX_detalle_movimiento_IdTipoMovimiento",
                table: "detalle_movimiento",
                column: "IdTipoMovimiento");

            migrationBuilder.CreateIndex(
                name: "IX_detalle_transporte_IdCaja",
                table: "detalle_transporte",
                column: "IdCaja");

            migrationBuilder.CreateIndex(
                name: "IX_detalle_transporte_IdChofer",
                table: "detalle_transporte",
                column: "IdChofer");

            migrationBuilder.CreateIndex(
                name: "IX_detalle_transporte_IdTractocamion",
                table: "detalle_transporte",
                column: "IdTractocamion");

            migrationBuilder.CreateIndex(
                name: "IX_direccion_IdEmpresa",
                table: "direccion",
                column: "IdEmpresa");

            migrationBuilder.CreateIndex(
                name: "IX_documento_IdDocumentoTipo",
                table: "documento",
                column: "IdDocumentoTipo");

            migrationBuilder.CreateIndex(
                name: "IX_embarque_IdDetalleTransporte",
                table: "embarque",
                column: "IdDetalleTransporte");

            migrationBuilder.CreateIndex(
                name: "IX_embarque_IdDireccion",
                table: "embarque",
                column: "IdDireccion");

            migrationBuilder.CreateIndex(
                name: "IX_embarque_IdHistorial",
                table: "embarque",
                column: "IdHistorial");

            migrationBuilder.CreateIndex(
                name: "IX_especie_CodigoClaveSat",
                table: "especie",
                column: "CodigoClaveSat");

            migrationBuilder.CreateIndex(
                name: "IX_existencia_CodigoProducto",
                table: "existencia",
                column: "CodigoProducto");

            migrationBuilder.CreateIndex(
                name: "IX_existencia_IdDocumentoOrigen",
                table: "existencia",
                column: "IdDocumentoOrigen");

            migrationBuilder.CreateIndex(
                name: "IX_historial_movimiento_IdUsuario",
                table: "historial_movimiento",
                column: "IdUsuario");

            migrationBuilder.CreateIndex(
                name: "IX_produccion_IdDetalleMovimiento",
                table: "produccion",
                column: "IdDetalleMovimiento");

            migrationBuilder.CreateIndex(
                name: "IX_producto_IdEspecie",
                table: "producto",
                column: "IdEspecie");

            migrationBuilder.CreateIndex(
                name: "IX_producto_IdMarca",
                table: "producto",
                column: "IdMarca");

            migrationBuilder.CreateIndex(
                name: "IX_producto_IdPesoCaja",
                table: "producto",
                column: "IdPesoCaja");

            migrationBuilder.CreateIndex(
                name: "IX_producto_IdTalla",
                table: "producto",
                column: "IdTalla");

            migrationBuilder.CreateIndex(
                name: "IX_tractocamion_IdEmpresa",
                table: "tractocamion",
                column: "IdEmpresa");

            migrationBuilder.CreateIndex(
                name: "IX_tractocamion_IdMarca",
                table: "tractocamion",
                column: "IdMarca");

            migrationBuilder.CreateIndex(
                name: "IX_ubicacion_producto_IdDepartamento",
                table: "ubicacion_producto",
                column: "IdDepartamento");

            migrationBuilder.CreateIndex(
                name: "IX_ubicacion_producto_IdDireccion",
                table: "ubicacion_producto",
                column: "IdDireccion");

            migrationBuilder.CreateIndex(
                name: "IX_ubicacion_producto_IdExistencia",
                table: "ubicacion_producto",
                column: "IdExistencia");

            migrationBuilder.CreateIndex(
                name: "IX_venta_IdCliente",
                table: "venta",
                column: "IdCliente");

            migrationBuilder.CreateIndex(
                name: "IX_venta_IdEstadoRecoleccion",
                table: "venta",
                column: "IdEstadoRecoleccion");

            migrationBuilder.CreateIndex(
                name: "IX_venta_IdFormaPago",
                table: "venta",
                column: "IdFormaPago");

            migrationBuilder.CreateIndex(
                name: "IX_venta_IdHistorial",
                table: "venta",
                column: "IdHistorial");

            migrationBuilder.CreateIndex(
                name: "IX_venta_IdLugarEntrega",
                table: "venta",
                column: "IdLugarEntrega");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "compras");

            migrationBuilder.DropTable(
                name: "descripcion");

            migrationBuilder.DropTable(
                name: "embarque");

            migrationBuilder.DropTable(
                name: "produccion");

            migrationBuilder.DropTable(
                name: "ubicacion_producto");

            migrationBuilder.DropTable(
                name: "venta");

            migrationBuilder.DropTable(
                name: "visitante");

            migrationBuilder.DropTable(
                name: "presentacion");

            migrationBuilder.DropTable(
                name: "detalle_transporte");

            migrationBuilder.DropTable(
                name: "detalle_movimiento");

            migrationBuilder.DropTable(
                name: "cliente");

            migrationBuilder.DropTable(
                name: "estado_recoleccion");

            migrationBuilder.DropTable(
                name: "forma_pago");

            migrationBuilder.DropTable(
                name: "lugar_entrega");

            migrationBuilder.DropTable(
                name: "caja_tractocamion");

            migrationBuilder.DropTable(
                name: "chofer");

            migrationBuilder.DropTable(
                name: "tractocamion");

            migrationBuilder.DropTable(
                name: "departamento");

            migrationBuilder.DropTable(
                name: "direccion");

            migrationBuilder.DropTable(
                name: "existencia");

            migrationBuilder.DropTable(
                name: "historial_movimiento");

            migrationBuilder.DropTable(
                name: "tipo_movimiento");

            migrationBuilder.DropTable(
                name: "marca_tractocamion");

            migrationBuilder.DropTable(
                name: "empresa");

            migrationBuilder.DropTable(
                name: "documento");

            migrationBuilder.DropTable(
                name: "producto");

            migrationBuilder.DropTable(
                name: "usuario");

            migrationBuilder.DropTable(
                name: "documento_tipo");

            migrationBuilder.DropTable(
                name: "especie");

            migrationBuilder.DropTable(
                name: "marca");

            migrationBuilder.DropTable(
                name: "peso_caja");

            migrationBuilder.DropTable(
                name: "talla");

            migrationBuilder.DropTable(
                name: "claves_sat");
        }
    }
}
