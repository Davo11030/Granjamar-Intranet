using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InventarioYReportesDeProduccion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_solicitud_produccion_produccion_trabajo_IdTrabajo",
                table: "solicitud_produccion");

            migrationBuilder.CreateTable(
                name: "produccion_inventario",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Orden = table.Column<int>(type: "int", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IdExistencia = table.Column<long>(type: "bigint", nullable: true),
                    IdDireccion = table.Column<long>(type: "bigint", nullable: true),
                    IdEmpresa = table.Column<long>(type: "bigint", nullable: true),
                    EsConsignacion = table.Column<bool>(type: "bit", nullable: false),
                    Entrada = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Salida = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    IdDetalleMovimiento = table.Column<long>(type: "bigint", nullable: true),
                    IdUsuario = table.Column<long>(type: "bigint", nullable: false),
                    Activo = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_produccion_inventario", x => x.Id);
                    table.ForeignKey(
                        name: "FK_produccion_inventario_producto_CodigoProducto",
                        column: x => x.CodigoProducto,
                        principalTable: "producto",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "produccion_reporte",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Orden = table.Column<int>(type: "int", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Etapa = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Kilos = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Uso = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CodigoUsado = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    KilosUsados = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    EsReferencia = table.Column<bool>(type: "bit", nullable: false),
                    Rendimiento = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: true),
                    Porcentaje = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Lote = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LoteOriginal = table.Column<bool>(type: "bit", nullable: false),
                    IdExistenciaOrigen = table.Column<long>(type: "bigint", nullable: true),
                    IdDireccionOrigen = table.Column<long>(type: "bigint", nullable: true),
                    IdDetalleMovimiento = table.Column<long>(type: "bigint", nullable: true),
                    IdExistenciaSalida = table.Column<long>(type: "bigint", nullable: true),
                    IdDetalleMovimientoExtra = table.Column<long>(type: "bigint", nullable: true),
                    IdExistenciaExtra = table.Column<long>(type: "bigint", nullable: true),
                    IdUsuario = table.Column<long>(type: "bigint", nullable: false),
                    Activo = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_produccion_reporte", x => x.Id);
                    table.ForeignKey(
                        name: "FK_produccion_reporte_producto_CodigoProducto",
                        column: x => x.CodigoProducto,
                        principalTable: "producto",
                        principalColumn: "Codigo",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_produccion_reporte_usuario_IdUsuario",
                        column: x => x.IdUsuario,
                        principalTable: "usuario",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_produccion_inventario_CodigoProducto",
                table: "produccion_inventario",
                column: "CodigoProducto");

            migrationBuilder.CreateIndex(
                name: "IX_produccion_inventario_Fecha",
                table: "produccion_inventario",
                column: "Fecha");

            migrationBuilder.CreateIndex(
                name: "IX_produccion_reporte_CodigoProducto",
                table: "produccion_reporte",
                column: "CodigoProducto");

            migrationBuilder.CreateIndex(
                name: "IX_produccion_reporte_Fecha",
                table: "produccion_reporte",
                column: "Fecha");

            migrationBuilder.CreateIndex(
                name: "IX_produccion_reporte_IdUsuario",
                table: "produccion_reporte",
                column: "IdUsuario");

            // Las entradas de consignación que ya eran "trabajos" pasan a la tabla general como producto bloqueado en
            // producción (sin desbloquear). Si hubiera trabajos de Conpaq con movimientos se detiene todo: no se pierde nada.
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM produccion_evento e
           WHERE e.Activo = 1 AND e.IdTrabajo NOT IN (SELECT IdTrabajo FROM solicitud_produccion WHERE IdTrabajo IS NOT NULL AND Activo = 1))
    THROW 50000, 'Hay trabajos de produccion que no vienen de consignacion: conviertelos antes de aplicar esta migracion.', 1;

DECLARE @s INT, @l INT;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT Id FROM solicitud_produccion WHERE Activo = 1 AND IdTrabajo IS NOT NULL;
OPEN c;
FETCH NEXT FROM c INTO @s;
WHILE @@FETCH_STATUS = 0
BEGIN
    INSERT INTO produccion_inventario (Fecha, Orden, CodigoProducto, IdExistencia, IdDireccion, IdEmpresa, EsConsignacion, Entrada, Salida, IdUsuario, Activo)
    SELECT Fecha, 1, CodigoProducto, IdExistencia, IdDireccion, IdEmpresa, 1, Kilos, 0, IdUsuario, 1 FROM solicitud_produccion WHERE Id = @s;
    SET @l = SCOPE_IDENTITY();
    UPDATE solicitud_produccion SET IdTrabajo = @l WHERE Id = @s;
    FETCH NEXT FROM c INTO @s;
END
CLOSE c;
DEALLOCATE c;
UPDATE solicitud_produccion SET IdTrabajo = NULL WHERE Activo = 0;");

            migrationBuilder.DropTable(
                name: "produccion_evento");

            migrationBuilder.DropTable(
                name: "produccion_trabajo");

            migrationBuilder.RenameColumn(
                name: "IdTrabajo",
                table: "solicitud_produccion",
                newName: "IdLinea");

            migrationBuilder.RenameIndex(
                name: "IX_solicitud_produccion_IdTrabajo",
                table: "solicitud_produccion",
                newName: "IX_solicitud_produccion_IdLinea");

            migrationBuilder.AddForeignKey(
                name: "FK_solicitud_produccion_produccion_inventario_IdLinea",
                table: "solicitud_produccion",
                column: "IdLinea",
                principalTable: "produccion_inventario",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_solicitud_produccion_produccion_inventario_IdLinea",
                table: "solicitud_produccion");

            migrationBuilder.DropTable(
                name: "produccion_inventario");

            migrationBuilder.DropTable(
                name: "produccion_reporte");

            migrationBuilder.RenameColumn(
                name: "IdLinea",
                table: "solicitud_produccion",
                newName: "IdTrabajo");

            migrationBuilder.RenameIndex(
                name: "IX_solicitud_produccion_IdLinea",
                table: "solicitud_produccion",
                newName: "IX_solicitud_produccion_IdTrabajo");

            migrationBuilder.CreateTable(
                name: "produccion_trabajo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CodigoProducto = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IdDireccion = table.Column<long>(type: "bigint", nullable: false),
                    IdExistencia = table.Column<long>(type: "bigint", nullable: false),
                    IdUsuario = table.Column<long>(type: "bigint", nullable: false),
                    Activo = table.Column<bool>(type: "bit", nullable: false),
                    Cerrado = table.Column<bool>(type: "bit", nullable: false),
                    FechaInicio = table.Column<DateTime>(type: "datetime2", nullable: false)
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
                    Activo = table.Column<bool>(type: "bit", nullable: false),
                    CodigoProducto = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IdDetalleMovimiento = table.Column<long>(type: "bigint", nullable: true),
                    IdDetalleMovimientoExtra = table.Column<long>(type: "bigint", nullable: true),
                    IdExistenciaExtra = table.Column<long>(type: "bigint", nullable: true),
                    IdExistenciaSalida = table.Column<long>(type: "bigint", nullable: true),
                    IdUsuario = table.Column<long>(type: "bigint", nullable: false),
                    Kilos = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    KilosRendimiento = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: true),
                    KilosUsados = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    MantenerLote = table.Column<bool>(type: "bit", nullable: false),
                    Porcentaje = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    SinTrabajo = table.Column<bool>(type: "bit", nullable: false),
                    Tipo = table.Column<string>(type: "nvarchar(max)", nullable: false)
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

            migrationBuilder.AddForeignKey(
                name: "FK_solicitud_produccion_produccion_trabajo_IdTrabajo",
                table: "solicitud_produccion",
                column: "IdTrabajo",
                principalTable: "produccion_trabajo",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
