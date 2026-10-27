using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarPedidosConsignacion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pedido_consignacion",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Numero = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IdEmpresa = table.Column<long>(type: "bigint", nullable: false),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TipoOrigen = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IdOrigen = table.Column<long>(type: "bigint", nullable: false),
                    TipoDestino = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Destino = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OrdenEmbarque = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FechaLiberacion = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IdDocumentoOrden = table.Column<long>(type: "bigint", nullable: true),
                    IdDocumentoFactura = table.Column<long>(type: "bigint", nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pedido_consignacion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pedido_consignacion_documento_IdDocumentoFactura",
                        column: x => x.IdDocumentoFactura,
                        principalTable: "documento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pedido_consignacion_documento_IdDocumentoOrden",
                        column: x => x.IdDocumentoOrden,
                        principalTable: "documento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pedido_consignacion_empresa_IdEmpresa",
                        column: x => x.IdEmpresa,
                        principalTable: "empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "pedido_consignacion_detalle",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdPedido = table.Column<long>(type: "bigint", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Kilos = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pedido_consignacion_detalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pedido_consignacion_detalle_pedido_consignacion_IdPedido",
                        column: x => x.IdPedido,
                        principalTable: "pedido_consignacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pedido_consignacion_detalle_producto_CodigoProducto",
                        column: x => x.CodigoProducto,
                        principalTable: "producto",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_IdDocumentoFactura",
                table: "pedido_consignacion",
                column: "IdDocumentoFactura");

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_IdDocumentoOrden",
                table: "pedido_consignacion",
                column: "IdDocumentoOrden");

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_IdEmpresa_Numero",
                table: "pedido_consignacion",
                columns: new[] { "IdEmpresa", "Numero" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_TipoOrigen_IdOrigen",
                table: "pedido_consignacion",
                columns: new[] { "TipoOrigen", "IdOrigen" });

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_detalle_CodigoProducto",
                table: "pedido_consignacion_detalle",
                column: "CodigoProducto");

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_detalle_IdPedido",
                table: "pedido_consignacion_detalle",
                column: "IdPedido");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pedido_consignacion_detalle");

            migrationBuilder.DropTable(
                name: "pedido_consignacion");
        }
    }
}
