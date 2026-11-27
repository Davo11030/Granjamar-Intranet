using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ColumnaTipoEmpresa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // empresa.Tipo ya estaba en el modelo pero ninguna migración la creaba: en una base nueva todo lo que toca
            // empresas daba 500. La base de producción ya la tiene (se agregó a mano), por eso solo se crea si falta.
            migrationBuilder.Sql("IF COL_LENGTH('empresa', 'Tipo') IS NULL ALTER TABLE [empresa] ADD [Tipo] nvarchar(max) NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No se quita: en producción la columna existía antes de esta migración.
        }
    }
}
