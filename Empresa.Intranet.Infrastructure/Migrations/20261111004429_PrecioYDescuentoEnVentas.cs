using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PrecioYDescuentoEnVentas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Descuento",
                table: "venta",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrecioKilo",
                table: "detalle_movimiento",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Descuento",
                table: "venta");

            migrationBuilder.DropColumn(
                name: "PrecioKilo",
                table: "detalle_movimiento");
        }
    }
}
