using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarTrabajoASolicitudYLoteOrigen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "IdTrabajo",
                table: "solicitud_produccion",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LoteOrigen",
                table: "existencia",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_solicitud_produccion_IdTrabajo",
                table: "solicitud_produccion",
                column: "IdTrabajo");

            migrationBuilder.AddForeignKey(
                name: "FK_solicitud_produccion_produccion_trabajo_IdTrabajo",
                table: "solicitud_produccion",
                column: "IdTrabajo",
                principalTable: "produccion_trabajo",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_solicitud_produccion_produccion_trabajo_IdTrabajo",
                table: "solicitud_produccion");

            migrationBuilder.DropIndex(
                name: "IX_solicitud_produccion_IdTrabajo",
                table: "solicitud_produccion");

            migrationBuilder.DropColumn(
                name: "IdTrabajo",
                table: "solicitud_produccion");

            migrationBuilder.DropColumn(
                name: "LoteOrigen",
                table: "existencia");
        }
    }
}
