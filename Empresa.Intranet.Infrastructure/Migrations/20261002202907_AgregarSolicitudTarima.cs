using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarSolicitudTarima : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "solicitud_tarima",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdEmbarque = table.Column<long>(type: "bigint", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IdDireccion = table.Column<long>(type: "bigint", nullable: false),
                    NumTarimas = table.Column<int>(type: "int", nullable: false),
                    CajasPorTarima = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_solicitud_tarima", x => x.Id);
                    table.ForeignKey(
                        name: "FK_solicitud_tarima_embarque_IdEmbarque",
                        column: x => x.IdEmbarque,
                        principalTable: "embarque",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_solicitud_tarima_producto_CodigoProducto",
                        column: x => x.CodigoProducto,
                        principalTable: "producto",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_solicitud_tarima_CodigoProducto",
                table: "solicitud_tarima",
                column: "CodigoProducto");

            migrationBuilder.CreateIndex(
                name: "IX_solicitud_tarima_IdEmbarque",
                table: "solicitud_tarima",
                column: "IdEmbarque");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "solicitud_tarima");
        }
    }
}
