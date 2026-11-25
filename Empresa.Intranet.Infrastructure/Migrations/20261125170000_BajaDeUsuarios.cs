using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BajaDeUsuarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Los usuarios que ya existen quedan activos.
            migrationBuilder.AddColumn<bool>(
                name: "Activo",
                table: "usuario",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Activo",
                table: "usuario");
        }
    }
}
