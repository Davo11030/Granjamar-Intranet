using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class QuitarEmpresaDeChofer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_chofer_empresa_IdEmpresa",
                table: "chofer");

            migrationBuilder.DropIndex(
                name: "IX_chofer_IdEmpresa",
                table: "chofer");

            migrationBuilder.DropColumn(
                name: "IdEmpresa",
                table: "chofer");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "IdEmpresa",
                table: "chofer",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_chofer_IdEmpresa",
                table: "chofer",
                column: "IdEmpresa");

            migrationBuilder.AddForeignKey(
                name: "FK_chofer_empresa_IdEmpresa",
                table: "chofer",
                column: "IdEmpresa",
                principalTable: "empresa",
                principalColumn: "Id");
        }
    }
}
