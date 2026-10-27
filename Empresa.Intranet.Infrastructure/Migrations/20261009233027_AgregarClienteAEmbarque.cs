using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarClienteAEmbarque : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "IdCliente",
                table: "embarque",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_embarque_IdCliente",
                table: "embarque",
                column: "IdCliente");

            migrationBuilder.AddForeignKey(
                name: "FK_embarque_cliente_IdCliente",
                table: "embarque",
                column: "IdCliente",
                principalTable: "cliente",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_embarque_cliente_IdCliente",
                table: "embarque");

            migrationBuilder.DropIndex(
                name: "IX_embarque_IdCliente",
                table: "embarque");

            migrationBuilder.DropColumn(
                name: "IdCliente",
                table: "embarque");
        }
    }
}
