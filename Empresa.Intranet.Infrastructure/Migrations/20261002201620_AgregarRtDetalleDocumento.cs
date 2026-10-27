using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarRtDetalleDocumento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "rt_detalle_documento",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdRtDetalle = table.Column<long>(type: "bigint", nullable: false),
                    IdDocumento = table.Column<long>(type: "bigint", nullable: false),
                    Kilos = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rt_detalle_documento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_rt_detalle_documento_documento_IdDocumento",
                        column: x => x.IdDocumento,
                        principalTable: "documento",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_rt_detalle_documento_rt_detalle_IdRtDetalle",
                        column: x => x.IdRtDetalle,
                        principalTable: "rt_detalle",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_rt_detalle_documento_IdDocumento",
                table: "rt_detalle_documento",
                column: "IdDocumento");

            migrationBuilder.CreateIndex(
                name: "IX_rt_detalle_documento_IdRtDetalle",
                table: "rt_detalle_documento",
                column: "IdRtDetalle");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "rt_detalle_documento");
        }
    }
}
