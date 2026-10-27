using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarTrabajosDeProduccion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "produccion_trabajo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdUsuario = table.Column<long>(type: "bigint", nullable: false),
                    FechaInicio = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IdExistencia = table.Column<long>(type: "bigint", nullable: false),
                    IdDireccion = table.Column<long>(type: "bigint", nullable: false),
                    Cerrado = table.Column<bool>(type: "bit", nullable: false),
                    Activo = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_produccion_trabajo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_produccion_trabajo_direccion_IdDireccion",
                        column: x => x.IdDireccion,
                        principalTable: "direccion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_produccion_trabajo_existencia_IdExistencia",
                        column: x => x.IdExistencia,
                        principalTable: "existencia",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_produccion_trabajo_producto_CodigoProducto",
                        column: x => x.CodigoProducto,
                        principalTable: "producto",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_produccion_trabajo_usuario_IdUsuario",
                        column: x => x.IdUsuario,
                        principalTable: "usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "produccion_evento",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdTrabajo = table.Column<long>(type: "bigint", nullable: false),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Tipo = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IdUsuario = table.Column<long>(type: "bigint", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    KilosUsados = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Kilos = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    KilosRendimiento = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: true),
                    Porcentaje = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    SinTrabajo = table.Column<bool>(type: "bit", nullable: false),
                    MantenerLote = table.Column<bool>(type: "bit", nullable: false),
                    IdDetalleMovimiento = table.Column<long>(type: "bigint", nullable: true),
                    IdExistenciaSalida = table.Column<long>(type: "bigint", nullable: true),
                    IdDetalleMovimientoExtra = table.Column<long>(type: "bigint", nullable: true),
                    IdExistenciaExtra = table.Column<long>(type: "bigint", nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_produccion_evento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_produccion_evento_produccion_trabajo_IdTrabajo",
                        column: x => x.IdTrabajo,
                        principalTable: "produccion_trabajo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_produccion_evento_Fecha",
                table: "produccion_evento",
                column: "Fecha");

            migrationBuilder.CreateIndex(
                name: "IX_produccion_evento_IdTrabajo",
                table: "produccion_evento",
                column: "IdTrabajo");

            migrationBuilder.CreateIndex(
                name: "IX_produccion_trabajo_CodigoProducto",
                table: "produccion_trabajo",
                column: "CodigoProducto");

            migrationBuilder.CreateIndex(
                name: "IX_produccion_trabajo_IdDireccion",
                table: "produccion_trabajo",
                column: "IdDireccion");

            migrationBuilder.CreateIndex(
                name: "IX_produccion_trabajo_IdExistencia",
                table: "produccion_trabajo",
                column: "IdExistencia");

            migrationBuilder.CreateIndex(
                name: "IX_produccion_trabajo_IdUsuario",
                table: "produccion_trabajo",
                column: "IdUsuario");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "produccion_evento");

            migrationBuilder.DropTable(
                name: "produccion_trabajo");
        }
    }
}
