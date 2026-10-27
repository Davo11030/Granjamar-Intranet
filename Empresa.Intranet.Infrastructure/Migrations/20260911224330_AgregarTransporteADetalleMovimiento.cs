using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarTransporteADetalleMovimiento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Nota: la columna "Tipo" en "empresa" ya existía en la base de datos (se agregó fuera
            // de las migraciones en una sesión anterior); no se vuelve a crear aquí para no duplicarla.

            migrationBuilder.AddColumn<long>(
                name: "IdDetalleTransporte",
                table: "detalle_movimiento",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_detalle_movimiento_IdDetalleTransporte",
                table: "detalle_movimiento",
                column: "IdDetalleTransporte");

            migrationBuilder.AddForeignKey(
                name: "FK_detalle_movimiento_detalle_transporte_IdDetalleTransporte",
                table: "detalle_movimiento",
                column: "IdDetalleTransporte",
                principalTable: "detalle_transporte",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_detalle_movimiento_detalle_transporte_IdDetalleTransporte",
                table: "detalle_movimiento");

            migrationBuilder.DropIndex(
                name: "IX_detalle_movimiento_IdDetalleTransporte",
                table: "detalle_movimiento");

            migrationBuilder.DropColumn(
                name: "IdDetalleTransporte",
                table: "detalle_movimiento");
        }
    }
}
