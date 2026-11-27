namespace Empresa.Intranet.API.Servicios;

// La empresa trabaja con la hora de Ensenada (la misma de Tijuana), pero la base guarda las fechas en UTC. Aquí se
// convierte un día de calendario ("el 27 de noviembre") al rango UTC que le corresponde, para que el corte de caja y los
// filtros por fecha tomen el día completo de Ensenada y no el día UTC (que empieza a las 4 o 5 p.m. de Ensenada).
public static class ZonaHoraria
{
    public static readonly TimeZoneInfo Zona = Buscar();

    private static TimeZoneInfo Buscar()
    {
        // "America/Tijuana" funciona en Linux y en Windows con .NET 8; el nombre de Windows queda de respaldo.
        foreach (var id in new[] { "America/Tijuana", "Pacific Standard Time (Mexico)" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }

    // Instante UTC en que empieza ese día en Ensenada.
    public static DateTime InicioDelDiaUtc(DateTime dia) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(dia.Date, DateTimeKind.Unspecified), Zona);

    // La fecha de hoy en Ensenada.
    public static DateTime HoyLocal() => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zona).Date;
}
