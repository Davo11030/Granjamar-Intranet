using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SembrarPermisoProduccionEditar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Los reportes de producción ahora se pueden editar por completo: permiso produccion/editar.
            // Lo reciben quienes ya podían registrar producción (produccion/crear) y los administradores.
            migrationBuilder.Sql(@"
                INSERT INTO permiso (Modulo, Accion, Descripcion)
                SELECT 'produccion', 'editar', 'Editar reportes de producción'
                WHERE NOT EXISTS (SELECT 1 FROM permiso WHERE Modulo = 'produccion' AND Accion = 'editar');

                INSERT INTO usuario_permiso (IdUsuario, IdPermiso)
                SELECT DISTINCT up.IdUsuario, nuevo.Id
                FROM usuario_permiso up
                JOIN permiso viejo ON viejo.Id = up.IdPermiso AND viejo.Modulo = 'produccion' AND viejo.Accion = 'crear'
                JOIN permiso nuevo ON nuevo.Modulo = 'produccion' AND nuevo.Accion = 'editar'
                WHERE NOT EXISTS (SELECT 1 FROM usuario_permiso x WHERE x.IdUsuario = up.IdUsuario AND x.IdPermiso = nuevo.Id);

                INSERT INTO usuario_permiso (IdUsuario, IdPermiso)
                SELECT u.Id, p.Id
                FROM usuario u CROSS JOIN permiso p
                WHERE p.Modulo = 'produccion' AND p.Accion = 'editar'
                  AND LOWER(LTRIM(RTRIM(u.Puesto))) IN ('admin', 'administrador')
                  AND NOT EXISTS (SELECT 1 FROM usuario_permiso x WHERE x.IdUsuario = u.Id AND x.IdPermiso = p.Id);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE up FROM usuario_permiso up JOIN permiso p ON p.Id = up.IdPermiso WHERE p.Modulo = 'produccion' AND p.Accion = 'editar';
                DELETE FROM permiso WHERE Modulo = 'produccion' AND Accion = 'editar';
            ");
        }
    }
}
