using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrigenDelEmbarque : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "IdDireccionOrigen",
                table: "embarque",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_embarque_IdDireccionOrigen",
                table: "embarque",
                column: "IdDireccionOrigen");

            migrationBuilder.AddForeignKey(
                name: "FK_embarque_direccion_IdDireccionOrigen",
                table: "embarque",
                column: "IdDireccionOrigen",
                principalTable: "direccion",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_embarque_direccion_IdDireccionOrigen",
                table: "embarque");

            migrationBuilder.DropIndex(
                name: "IX_embarque_IdDireccionOrigen",
                table: "embarque");

            migrationBuilder.DropColumn(
                name: "IdDireccionOrigen",
                table: "embarque");
        }
    }
}
