using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarSolicitudDetalleYRtDetalle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "rt_detalle",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdEmbarque = table.Column<long>(type: "bigint", nullable: false),
                    IdExistencia = table.Column<long>(type: "bigint", nullable: false),
                    PrecioUnitario = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ClaveSat = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DescripcionSat = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Pedimentos = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rt_detalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_rt_detalle_embarque_IdEmbarque",
                        column: x => x.IdEmbarque,
                        principalTable: "embarque",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_rt_detalle_existencia_IdExistencia",
                        column: x => x.IdExistencia,
                        principalTable: "existencia",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "solicitud_detalle",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdEmbarque = table.Column<long>(type: "bigint", nullable: false),
                    IdExistencia = table.Column<long>(type: "bigint", nullable: false),
                    NumTarimas = table.Column<int>(type: "int", nullable: false),
                    CajasPorTarima = table.Column<int>(type: "int", nullable: false),
                    LoteEspecificaciones = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_solicitud_detalle", x => x.Id);
                    table.ForeignKey(
                        name: "FK_solicitud_detalle_embarque_IdEmbarque",
                        column: x => x.IdEmbarque,
                        principalTable: "embarque",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_solicitud_detalle_existencia_IdExistencia",
                        column: x => x.IdExistencia,
                        principalTable: "existencia",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_rt_detalle_IdEmbarque",
                table: "rt_detalle",
                column: "IdEmbarque");

            migrationBuilder.CreateIndex(
                name: "IX_rt_detalle_IdExistencia",
                table: "rt_detalle",
                column: "IdExistencia");

            migrationBuilder.CreateIndex(
                name: "IX_solicitud_detalle_IdEmbarque",
                table: "solicitud_detalle",
                column: "IdEmbarque");

            migrationBuilder.CreateIndex(
                name: "IX_solicitud_detalle_IdExistencia",
                table: "solicitud_detalle",
                column: "IdExistencia");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "rt_detalle");

            migrationBuilder.DropTable(
                name: "solicitud_detalle");
        }
    }
}
