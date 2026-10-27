using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SembrarPermisosVer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Ahora TODAS las lecturas y los módulos sin permiso propio exigen uno: "ver" por módulo,
            // más producción/crear, documentos/crear|editar y ventas/corte. Hasta hoy cualquiera con
            // sesión podía leer todo, así que para no quitarle nada a nadie por sorpresa los permisos
            // nuevos de lectura se asignan a todos los usuarios existentes; el administrador los
            // retira desde Usuarios → Permisos. Los de escritura nuevos heredan de lo que ya tenían.
            migrationBuilder.Sql(@"
                INSERT INTO permiso (Modulo, Accion, Descripcion)
                SELECT v.Modulo, v.Accion, v.Descripcion
                FROM (VALUES
                    ('clientes',    'ver',   'Ver clientes'),
                    ('productos',   'ver',   'Ver el kardex de productos'),
                    ('existencias', 'ver',   'Ver existencias y lotes'),
                    ('ventas',      'ver',   'Ver ventas'),
                    ('ventas',      'corte', 'Ver su corte de caja'),
                    ('compras',     'ver',   'Ver entradas'),
                    ('embarques',   'ver',   'Ver embarques'),
                    ('empresas',    'ver',   'Ver empresas'),
                    ('direcciones', 'ver',   'Ver destinos y direcciones'),
                    ('catalogos',   'ver',   'Ver catálogos (operadores, claves SAT)'),
                    ('produccion',  'ver',   'Ver producción'),
                    ('produccion',  'crear', 'Registrar producción'),
                    ('documentos',  'ver',   'Ver y descargar pedimentos y facturas'),
                    ('documentos',  'crear', 'Registrar documentos'),
                    ('documentos',  'editar','Subir o reemplazar archivos de documentos')
                ) AS v(Modulo, Accion, Descripcion)
                WHERE NOT EXISTS (SELECT 1 FROM permiso p WHERE p.Modulo = v.Modulo AND p.Accion = v.Accion);

                -- lecturas: a todos los usuarios existentes
                INSERT INTO usuario_permiso (IdUsuario, IdPermiso)
                SELECT u.Id, p.Id
                FROM usuario u CROSS JOIN permiso p
                WHERE (p.Accion = 'ver' OR (p.Modulo = 'ventas' AND p.Accion = 'corte'))
                  AND NOT EXISTS (SELECT 1 FROM usuario_permiso up WHERE up.IdUsuario = u.Id AND up.IdPermiso = p.Id);

                -- producción/crear: quien antes producía con inventario/editar
                INSERT INTO usuario_permiso (IdUsuario, IdPermiso)
                SELECT DISTINCT up.IdUsuario, nuevo.Id
                FROM usuario_permiso up
                JOIN permiso viejo ON viejo.Id = up.IdPermiso AND viejo.Modulo = 'inventario' AND viejo.Accion = 'editar'
                JOIN permiso nuevo ON nuevo.Modulo = 'produccion' AND nuevo.Accion = 'crear'
                WHERE NOT EXISTS (SELECT 1 FROM usuario_permiso x WHERE x.IdUsuario = up.IdUsuario AND x.IdPermiso = nuevo.Id);

                -- documentos/crear venía de catalogos/crear; documentos/editar, de compras/editar
                INSERT INTO usuario_permiso (IdUsuario, IdPermiso)
                SELECT DISTINCT up.IdUsuario, nuevo.Id
                FROM usuario_permiso up
                JOIN permiso viejo ON viejo.Id = up.IdPermiso
                JOIN permiso nuevo ON nuevo.Modulo = 'documentos'
                    AND ((viejo.Modulo = 'catalogos' AND viejo.Accion = 'crear' AND nuevo.Accion = 'crear')
                      OR (viejo.Modulo = 'compras'   AND viejo.Accion = 'editar' AND nuevo.Accion = 'editar'))
                WHERE NOT EXISTS (SELECT 1 FROM usuario_permiso x WHERE x.IdUsuario = up.IdUsuario AND x.IdPermiso = nuevo.Id);

                -- administradores: todo, para que la matriz de Usuarios los muestre completos
                INSERT INTO usuario_permiso (IdUsuario, IdPermiso)
                SELECT u.Id, p.Id
                FROM usuario u CROSS JOIN permiso p
                WHERE LOWER(LTRIM(RTRIM(u.Puesto))) IN ('admin', 'administrador')
                  AND NOT EXISTS (SELECT 1 FROM usuario_permiso up WHERE up.IdUsuario = u.Id AND up.IdPermiso = p.Id);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE up FROM usuario_permiso up JOIN permiso p ON p.Id = up.IdPermiso
                WHERE (p.Accion = 'ver' AND p.Modulo <> 'inventario')
                   OR (p.Modulo = 'ventas' AND p.Accion = 'corte')
                   OR (p.Modulo = 'produccion' AND p.Accion = 'crear')
                   OR (p.Modulo = 'documentos' AND p.Accion IN ('crear', 'editar'));
                DELETE FROM permiso
                WHERE (Accion = 'ver' AND Modulo <> 'inventario')
                   OR (Modulo = 'ventas' AND Accion = 'corte')
                   OR (Modulo = 'produccion' AND Accion = 'crear')
                   OR (Modulo = 'documentos' AND Accion IN ('crear', 'editar'));
            ");
        }
    }
}
