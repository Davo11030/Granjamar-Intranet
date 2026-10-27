using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CambiarRtDetalleAProducto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_rt_detalle_existencia_IdExistencia",
                table: "rt_detalle");

            migrationBuilder.DropIndex(
                name: "IX_rt_detalle_IdExistencia",
                table: "rt_detalle");

            // CodigoProducto se agrega ANTES de tirar IdExistencia, y se rellena desde la
            // existencia de cada renglón ya guardado — si no, se pierde para qué producto era
            // cada renglón (solo quedaría "" para todo lo que ya existía).
            migrationBuilder.AddColumn<string>(
                name: "CodigoProducto",
                table: "rt_detalle",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE rt
                SET rt.CodigoProducto = ex.CodigoProducto
                FROM rt_detalle rt
                JOIN existencia ex ON ex.Id = rt.IdExistencia;
            ");

            migrationBuilder.DropColumn(
                name: "IdExistencia",
                table: "rt_detalle");

            migrationBuilder.AlterColumn<string>(
                name: "CodigoProducto",
                table: "rt_detalle",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_rt_detalle_CodigoProducto",
                table: "rt_detalle",
                column: "CodigoProducto");

            migrationBuilder.AddForeignKey(
                name: "FK_rt_detalle_producto_CodigoProducto",
                table: "rt_detalle",
                column: "CodigoProducto",
                principalTable: "producto",
                principalColumn: "Codigo",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_rt_detalle_producto_CodigoProducto",
                table: "rt_detalle");

            migrationBuilder.DropIndex(
                name: "IX_rt_detalle_CodigoProducto",
                table: "rt_detalle");

            migrationBuilder.DropColumn(
                name: "CodigoProducto",
                table: "rt_detalle");

            migrationBuilder.AddColumn<long>(
                name: "IdExistencia",
                table: "rt_detalle",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_rt_detalle_IdExistencia",
                table: "rt_detalle",
                column: "IdExistencia");

            migrationBuilder.AddForeignKey(
                name: "FK_rt_detalle_existencia_IdExistencia",
                table: "rt_detalle",
                column: "IdExistencia",
                principalTable: "existencia",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
