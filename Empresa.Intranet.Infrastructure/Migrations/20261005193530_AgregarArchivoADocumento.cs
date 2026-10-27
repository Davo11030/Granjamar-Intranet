using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarArchivoADocumento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ArchivoNombre",
                table: "documento",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ArchivoRuta",
                table: "documento",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ArchivoTipo",
                table: "documento",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaArchivo",
                table: "documento",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ArchivoNombre",
                table: "documento");

            migrationBuilder.DropColumn(
                name: "ArchivoRuta",
                table: "documento");

            migrationBuilder.DropColumn(
                name: "ArchivoTipo",
                table: "documento");

            migrationBuilder.DropColumn(
                name: "FechaArchivo",
                table: "documento");
        }
    }
}
