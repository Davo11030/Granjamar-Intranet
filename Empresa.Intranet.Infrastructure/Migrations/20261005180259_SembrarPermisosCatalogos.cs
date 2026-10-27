using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SembrarPermisosCatalogos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Los catálogos (especies, marcas, tallas, pesos de caja, presentaciones, departamentos,
            // claves SAT, transporte, catálogos de venta, documentos) ahora exigen el permiso
            // catalogos/crear|editar|eliminar. Se crean y se asignan a los administradores que ya
            // existen para que nadie legítimo pierda acceso; al resto se les asigna desde Usuarios.
            migrationBuilder.Sql(@"
                INSERT INTO permiso (Modulo, Accion, Descripcion)
                SELECT v.Modulo, v.Accion, v.Descripcion
                FROM (VALUES
                    ('catalogos', 'crear',    'Crear en catálogos'),
                    ('catalogos', 'editar',   'Editar catálogos'),
                    ('catalogos', 'eliminar', 'Eliminar de catálogos')
                ) AS v(Modulo, Accion, Descripcion)
                WHERE NOT EXISTS (SELECT 1 FROM permiso p WHERE p.Modulo = v.Modulo AND p.Accion = v.Accion);

                INSERT INTO usuario_permiso (IdUsuario, IdPermiso)
                SELECT u.Id, p.Id
                FROM usuario u
                CROSS JOIN permiso p
                WHERE p.Modulo = 'catalogos'
                  AND LOWER(LTRIM(RTRIM(u.Puesto))) IN ('admin', 'administrador')
                  AND NOT EXISTS (SELECT 1 FROM usuario_permiso up WHERE up.IdUsuario = u.Id AND up.IdPermiso = p.Id);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE up FROM usuario_permiso up JOIN permiso p ON p.Id = up.IdPermiso WHERE p.Modulo = 'catalogos';
                DELETE FROM permiso WHERE Modulo = 'catalogos';
            ");
        }
    }
}
