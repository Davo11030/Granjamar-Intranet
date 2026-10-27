using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarEstadoAVentaYEmbarque : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Estado",
                table: "venta",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "Pendiente entrega");

            migrationBuilder.AddColumn<string>(
                name: "Estado",
                table: "embarque",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "En proceso");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Estado",
                table: "venta");

            migrationBuilder.DropColumn(
                name: "Estado",
                table: "embarque");
        }
    }
}
