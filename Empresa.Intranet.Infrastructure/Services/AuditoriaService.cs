using System.Text.Json;
using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;

namespace Empresa.Intranet.Infrastructure.Services;

public class AuditoriaService
{
    private readonly AppDbContext _context;
    private readonly IUsuarioActual _actual;

    public AuditoriaService(AppDbContext context, IUsuarioActual actual)
    {
        _context = context;
        _actual = actual;
    }

    public async Task RegistrarAsync(string tabla, string idRegistro, string accion,
        object? datosAnteriores, object? datosNuevos, uint idUsuario)
    {
        var auditoria = new Auditoria
        {
            Tabla = tabla,
            IdRegistro = idRegistro,
            Accion = accion,
            DatosAnteriores = datosAnteriores != null
                ? JsonSerializer.Serialize(datosAnteriores) : null,
            DatosNuevos = datosNuevos != null
                ? JsonSerializer.Serialize(datosNuevos) : null,
            // El usuario del token manda sobre el que escribió el cliente (no se puede atribuir una acción a otro).
            IdUsuario = _actual.Id ?? idUsuario,
            Fecha = DateTime.UtcNow
        };
        _context.Auditorias.Add(auditoria);
        await _context.SaveChangesAsync();
    }
}