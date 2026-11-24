using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NombreClienteEnVentas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NombreCliente",
                table: "venta",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NombreCliente",
                table: "venta");
        }
    }
}
