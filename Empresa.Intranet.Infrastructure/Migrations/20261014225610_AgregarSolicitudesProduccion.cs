using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarSolicitudesProduccion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "solicitud_produccion",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdEmpresa = table.Column<long>(type: "bigint", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Kilos = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    IdExistencia = table.Column<long>(type: "bigint", nullable: true),
                    IdDireccion = table.Column<long>(type: "bigint", nullable: true),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IdUsuario = table.Column<long>(type: "bigint", nullable: false),
                    IdPedido = table.Column<long>(type: "bigint", nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_solicitud_produccion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_solicitud_produccion_empresa_IdEmpresa",
                        column: x => x.IdEmpresa,
                        principalTable: "empresa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_solicitud_produccion_pedido_consignacion_IdPedido",
                        column: x => x.IdPedido,
                        principalTable: "pedido_consignacion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_solicitud_produccion_producto_CodigoProducto",
                        column: x => x.CodigoProducto,
                        principalTable: "producto",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_solicitud_produccion_usuario_IdUsuario",
                        column: x => x.IdUsuario,
                        principalTable: "usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_solicitud_produccion_CodigoProducto",
                table: "solicitud_produccion",
                column: "CodigoProducto");

            migrationBuilder.CreateIndex(
                name: "IX_solicitud_produccion_IdEmpresa_IdPedido",
                table: "solicitud_produccion",
                columns: new[] { "IdEmpresa", "IdPedido" });

            migrationBuilder.CreateIndex(
                name: "IX_solicitud_produccion_IdPedido",
                table: "solicitud_produccion",
                column: "IdPedido");

            migrationBuilder.CreateIndex(
                name: "IX_solicitud_produccion_IdUsuario",
                table: "solicitud_produccion",
                column: "IdUsuario");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "solicitud_produccion");
        }
    }
}
