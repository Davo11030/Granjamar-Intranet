using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarProgresoDocumentosEmbarque : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CartaCompleta",
                table: "embarque",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CiegoCompleto",
                table: "embarque",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequisicionCompleta",
                table: "embarque",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "RtCompleta",
                table: "embarque",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "SolicitudCompleta",
                table: "embarque",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CartaCompleta",
                table: "embarque");

            migrationBuilder.DropColumn(
                name: "CiegoCompleto",
                table: "embarque");

            migrationBuilder.DropColumn(
                name: "RequisicionCompleta",
                table: "embarque");

            migrationBuilder.DropColumn(
                name: "RtCompleta",
                table: "embarque");

            migrationBuilder.DropColumn(
                name: "SolicitudCompleta",
                table: "embarque");
        }
    }
}
