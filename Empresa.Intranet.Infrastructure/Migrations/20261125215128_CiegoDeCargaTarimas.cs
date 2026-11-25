using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CiegoDeCargaTarimas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ciego_tarima",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdEmbarque = table.Column<long>(type: "bigint", nullable: false),
                    Posicion = table.Column<int>(type: "int", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Cajas = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ciego_tarima", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ciego_tarima_embarque_IdEmbarque",
                        column: x => x.IdEmbarque,
                        principalTable: "embarque",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ciego_tarima_producto_CodigoProducto",
                        column: x => x.CodigoProducto,
                        principalTable: "producto",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ciego_tarima_CodigoProducto",
                table: "ciego_tarima",
                column: "CodigoProducto");

            migrationBuilder.CreateIndex(
                name: "IX_ciego_tarima_IdEmbarque",
                table: "ciego_tarima",
                column: "IdEmbarque");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ciego_tarima");
        }
    }
}
