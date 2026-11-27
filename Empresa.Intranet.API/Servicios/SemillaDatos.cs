using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Servicios;

// Datos mínimos para que una base nueva funcione. Se ejecuta al arrancar la API y SOLO agrega lo
// que falta: nunca borra ni modifica registros existentes, así que es seguro correrla siempre.
public static class SemillaDatos
{
    // Tipos de movimiento que el código busca por nombre. Sin "Venta", por ejemplo, no se puede vender.
    private static readonly string[] TiposMovimiento =
    {
        "Compra", "Venta", "Embarque", "Produccion", "Traspaso de producción",
        "Salida a resguardo", "Traspaso a resguardo", "Ajuste positivo", "Ajuste negativo",
        "Salida de resguardo", "Traspaso desde resguardo"
    };

    // Catálogo de permisos (módulo, acción, descripción) que usan la API y la web.
    private static readonly (string Modulo, string Accion, string Descripcion)[] Permisos =
    {
        ("ventas", "ver", "Ver ventas"),
        ("ventas", "crear", "Registrar ventas"),
        ("ventas", "editar", "Editar ventas"),
        ("ventas", "eliminar", "Cancelar ventas"),
        ("ventas", "corte", "Ver su corte de caja"),
        ("compras", "ver", "Ver entradas"),
        ("compras", "crear", "Registrar entradas"),
        ("compras", "editar", "Editar entradas"),
        ("compras", "eliminar", "Eliminar entradas"),
        ("embarques", "ver", "Ver embarques"),
        ("embarques", "crear", "Crear embarques"),
        ("embarques", "editar", "Editar embarques"),
        ("embarques", "eliminar", "Eliminar embarques"),
        ("inventario", "ver", "Ver inventario"),
        ("inventario", "editar", "Modificar inventario"),
        ("produccion", "ver", "Ver producción"),
        ("produccion", "crear", "Registrar producción"),
        ("produccion", "editar", "Editar producción"),
        ("produccion", "eliminar", "Eliminar reportes de producción"),
        ("productos", "ver", "Ver el kardex de productos"),
        ("productos", "crear", "Crear productos"),
        ("productos", "editar", "Editar productos"),
        ("productos", "eliminar", "Eliminar productos"),
        ("catalogos", "ver", "Ver catálogos (operadores, claves SAT)"),
        ("catalogos", "crear", "Crear en catálogos"),
        ("catalogos", "editar", "Editar catálogos"),
        ("catalogos", "eliminar", "Eliminar de catálogos"),
        ("clientes", "ver", "Ver clientes"),
        ("clientes", "crear", "Crear clientes"),
        ("clientes", "editar", "Editar clientes"),
        ("clientes", "eliminar", "Eliminar clientes"),
        ("direcciones", "ver", "Ver destinos y direcciones"),
        ("direcciones", "crear", "Crear destinos y direcciones"),
        ("direcciones", "editar", "Editar destinos y direcciones"),
        ("direcciones", "eliminar", "Eliminar destinos y direcciones"),
        ("empresas", "ver", "Ver empresas"),
        ("empresas", "crear", "Crear empresas"),
        ("empresas", "editar", "Editar empresas"),
        ("empresas", "eliminar", "Eliminar empresas"),
        ("existencias", "ver", "Ver existencias y lotes"),
        ("existencias", "crear", "Crear existencias"),
        ("existencias", "editar", "Editar existencias"),
        ("existencias", "eliminar", "Eliminar existencias"),
        ("documentos", "ver", "Ver y descargar pedimentos y facturas"),
        ("documentos", "crear", "Registrar documentos"),
        ("documentos", "editar", "Subir o reemplazar archivos de documentos"),
    };

    public static async Task AplicarAsync(IServiceProvider servicios)
    {
        using var scope = servicios.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var log = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("SemillaDatos");
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        try
        {
            var tiposExistentes = await db.TiposMovimiento.Select(t => t.Nombre).ToListAsync();
            foreach (var nombre in TiposMovimiento.Where(n => !tiposExistentes.Contains(n)))
                db.TiposMovimiento.Add(new TipoMovimiento { Nombre = nombre });

            var permisosExistentes = await db.Permisos.Select(p => new { p.Modulo, p.Accion }).ToListAsync();
            foreach (var p in Permisos.Where(p => !permisosExistentes.Any(e => e.Modulo == p.Modulo && e.Accion == p.Accion)))
                db.Permisos.Add(new Permiso { Modulo = p.Modulo, Accion = p.Accion, Descripcion = p.Descripcion });

            // Primer administrador: solo si no hay ningún usuario y se configuró Semilla:Admin en
            // appsettings.json (que no se sube a git). Nunca hay una contraseña fija en el código.
            if (!await db.Usuarios.AnyAsync())
            {
                var nombre = config["Semilla:Admin:Nombre"];
                var contrasena = config["Semilla:Admin:Contrasena"];
                if (string.IsNullOrWhiteSpace(nombre) || string.IsNullOrWhiteSpace(contrasena)
                    || contrasena.StartsWith("CAMBIA-", StringComparison.OrdinalIgnoreCase))
                {
                    log.LogWarning("No hay usuarios. Pon un nombre y una contraseña propia en Semilla:Admin de appsettings.json para crear el primer administrador.");
                }
                else
                {
                    db.Usuarios.Add(new Usuario
                    {
                        Nombre = nombre.Trim(),
                        Puesto = "admin",
                        Correo = string.IsNullOrWhiteSpace(config["Semilla:Admin:Correo"]) ? null : config["Semilla:Admin:Correo"]!.Trim(),
                        Contrasena = BCrypt.Net.BCrypt.HashPassword(contrasena)
                    });
                    log.LogInformation("Se creó el primer administrador '{Nombre}'. Cambia su contraseña desde el perfil y bórrala de appsettings.json.", nombre.Trim());
                }
            }

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // La API sigue arrancando aunque la base no esté lista (p. ej. faltan migraciones).
            log.LogError(ex, "No se pudieron cargar los datos iniciales. ¿Ya corriste 'dotnet ef database update'?");
        }
    }
}
