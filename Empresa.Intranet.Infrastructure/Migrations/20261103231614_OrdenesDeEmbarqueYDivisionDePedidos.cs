using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrdenesDeEmbarqueYDivisionDePedidos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pedido_consignacion_orden",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdPedido = table.Column<long>(type: "bigint", nullable: false),
                    Numero = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IdDocumentoOrden = table.Column<long>(type: "bigint", nullable: true),
                    IdDocumentoFactura = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pedido_consignacion_orden", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pedido_consignacion_orden_documento_IdDocumentoFactura",
                        column: x => x.IdDocumentoFactura,
                        principalTable: "documento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pedido_consignacion_orden_documento_IdDocumentoOrden",
                        column: x => x.IdDocumentoOrden,
                        principalTable: "documento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pedido_consignacion_orden_pedido_consignacion_IdPedido",
                        column: x => x.IdPedido,
                        principalTable: "pedido_consignacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pedido_consignacion_orden_detalle",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdOrden = table.Column<long>(type: "bigint", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Kilos = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pedido_consignacion_orden_detalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pedido_consignacion_orden_detalle_pedido_consignacion_orden_IdOrden",
                        column: x => x.IdOrden,
                        principalTable: "pedido_consignacion_orden",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pedido_consignacion_orden_detalle_producto_CodigoProducto",
                        column: x => x.CodigoProducto,
                        principalTable: "producto",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_orden_IdDocumentoFactura",
                table: "pedido_consignacion_orden",
                column: "IdDocumentoFactura");

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_orden_IdDocumentoOrden",
                table: "pedido_consignacion_orden",
                column: "IdDocumentoOrden");

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_orden_IdPedido",
                table: "pedido_consignacion_orden",
                column: "IdPedido");

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_orden_detalle_CodigoProducto",
                table: "pedido_consignacion_orden_detalle",
                column: "CodigoProducto");

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_orden_detalle_IdOrden",
                table: "pedido_consignacion_orden_detalle",
                column: "IdOrden");

            // Los pedidos que ya estaban liberados o con factura pasan a tener UNA orden de embarque con todo su producto
            // (la orden y la factura que ya tenían), para que no se pierda nada al mover esos datos a la tabla de órdenes.
            migrationBuilder.Sql(@"
INSERT INTO pedido_consignacion_orden (IdPedido, Numero, Fecha, IdDocumentoOrden, IdDocumentoFactura)
SELECT Id, COALESCE(NULLIF(LTRIM(RTRIM(OrdenEmbarque)), ''), '(sin orden)'), COALESCE(FechaLiberacion, Fecha), IdDocumentoOrden, IdDocumentoFactura
FROM pedido_consignacion
WHERE Estado = 'Liberado' OR IdDocumentoFactura IS NOT NULL;");
            migrationBuilder.Sql(@"
INSERT INTO pedido_consignacion_orden_detalle (IdOrden, CodigoProducto, Kilos)
SELECT o.Id, d.CodigoProducto, d.Kilos
FROM pedido_consignacion_orden o
JOIN pedido_consignacion_detalle d ON d.IdPedido = o.IdPedido;");
            migrationBuilder.Sql(@"
UPDATE pedido_consignacion SET Estado = 'Liberado'
WHERE Id IN (SELECT IdPedido FROM pedido_consignacion_orden);");

            migrationBuilder.DropForeignKey(
                name: "FK_pedido_consignacion_documento_IdDocumentoFactura",
                table: "pedido_consignacion");

            migrationBuilder.DropForeignKey(
                name: "FK_pedido_consignacion_documento_IdDocumentoOrden",
                table: "pedido_consignacion");

            migrationBuilder.DropIndex(
                name: "IX_pedido_consignacion_IdDocumentoFactura",
                table: "pedido_consignacion");

            migrationBuilder.DropIndex(
                name: "IX_pedido_consignacion_IdDocumentoOrden",
                table: "pedido_consignacion");

            migrationBuilder.DropColumn(name: "FechaLiberacion", table: "pedido_consignacion");
            migrationBuilder.DropColumn(name: "IdDocumentoFactura", table: "pedido_consignacion");
            migrationBuilder.DropColumn(name: "IdDocumentoOrden", table: "pedido_consignacion");
            migrationBuilder.DropColumn(name: "OrdenEmbarque", table: "pedido_consignacion");

            migrationBuilder.AddColumn<long>(
                name: "IdPedidoDividido",
                table: "pedido_consignacion",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_pedido_consignacion_IdPedidoDividido",
                table: "pedido_consignacion",
                column: "IdPedidoDividido");

            migrationBuilder.AddForeignKey(
                name: "FK_pedido_consignacion_pedido_consignacion_IdPedidoDividido",
                table: "pedido_consignacion",
                column: "IdPedidoDividido",
                principalTable: "pedido_consignacion",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_pedido_consignacion_pedido_consignacion_IdPedidoDividido",
                table: "pedido_consignacion");

            migrationBuilder.DropIndex(
                name: "IX_pedido_consignacion_IdPedidoDividido",
                table: "pedido_consignacion");

            migrationBuilder.DropColumn(name: "IdPedidoDividido", table: "pedido_consignacion");

            migrationBuilder.AddColumn<DateTime>(name: "FechaLiberacion", table: "pedido_consignacion", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<long>(name: "IdDocumentoFactura", table: "pedido_consignacion", type: "bigint", nullable: true);
            migrationBuilder.AddColumn<long>(name: "IdDocumentoOrden", table: "pedido_consignacion", type: "bigint", nullable: true);
            migrationBuilder.AddColumn<string>(name: "OrdenEmbarque", table: "pedido_consignacion", type: "nvarchar(max)", nullable: true);

            // De vuelta a una sola orden por pedido: la primera.
            migrationBuilder.Sql(@"
UPDATE p SET p.OrdenEmbarque = o.Numero, p.FechaLiberacion = o.Fecha, p.IdDocumentoOrden = o.IdDocumentoOrden, p.IdDocumentoFactura = o.IdDocumentoFactura
FROM pedido_consignacion p
JOIN pedido_consignacion_orden o ON o.Id = (SELECT MIN(x.Id) FROM pedido_consignacion_orden x WHERE x.IdPedido = p.Id);");
            migrationBuilder.Sql("UPDATE pedido_consignacion SET Estado = 'Pendiente' WHERE Estado = 'Cancelado';");

            migrationBuilder.DropTable(name: "pedido_consignacion_orden_detalle");
            migrationBuilder.DropTable(name: "pedido_consignacion_orden");

            migrationBuilder.CreateIndex(name: "IX_pedido_consignacion_IdDocumentoFactura", table: "pedido_consignacion", column: "IdDocumentoFactura");
            migrationBuilder.CreateIndex(name: "IX_pedido_consignacion_IdDocumentoOrden", table: "pedido_consignacion", column: "IdDocumentoOrden");

            migrationBuilder.AddForeignKey(
                name: "FK_pedido_consignacion_documento_IdDocumentoFactura",
                table: "pedido_consignacion",
                column: "IdDocumentoFactura",
                principalTable: "documento",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pedido_consignacion_documento_IdDocumentoOrden",
                table: "pedido_consignacion",
                column: "IdDocumentoOrden",
                principalTable: "documento",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
