using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarEmpresaYActivoAFlota : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Activo",
                table: "tractocamion",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "Activo",
                table: "chofer",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<long>(
                name: "IdEmpresa",
                table: "chofer",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Activo",
                table: "caja_tractocamion",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<long>(
                name: "IdEmpresa",
                table: "caja_tractocamion",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_chofer_IdEmpresa",
                table: "chofer",
                column: "IdEmpresa");

            migrationBuilder.CreateIndex(
                name: "IX_caja_tractocamion_IdEmpresa",
                table: "caja_tractocamion",
                column: "IdEmpresa");

            migrationBuilder.AddForeignKey(
                name: "FK_caja_tractocamion_empresa_IdEmpresa",
                table: "caja_tractocamion",
                column: "IdEmpresa",
                principalTable: "empresa",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_chofer_empresa_IdEmpresa",
                table: "chofer",
                column: "IdEmpresa",
                principalTable: "empresa",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_caja_tractocamion_empresa_IdEmpresa",
                table: "caja_tractocamion");

            migrationBuilder.DropForeignKey(
                name: "FK_chofer_empresa_IdEmpresa",
                table: "chofer");

            migrationBuilder.DropIndex(
                name: "IX_chofer_IdEmpresa",
                table: "chofer");

            migrationBuilder.DropIndex(
                name: "IX_caja_tractocamion_IdEmpresa",
                table: "caja_tractocamion");

            migrationBuilder.DropColumn(
                name: "Activo",
                table: "tractocamion");

            migrationBuilder.DropColumn(
                name: "Activo",
                table: "chofer");

            migrationBuilder.DropColumn(
                name: "IdEmpresa",
                table: "chofer");

            migrationBuilder.DropColumn(
                name: "Activo",
                table: "caja_tractocamion");

            migrationBuilder.DropColumn(
                name: "IdEmpresa",
                table: "caja_tractocamion");
        }
    }
}
