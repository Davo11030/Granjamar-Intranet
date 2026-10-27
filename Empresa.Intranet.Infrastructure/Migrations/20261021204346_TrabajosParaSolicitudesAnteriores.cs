using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Empresa.Intranet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TrabajosParaSolicitudesAnteriores : Migration
    {
        // Las solicitudes a consignación hechas antes de que existieran los "trabajos" de producción no tenían
        // trabajo: el producto no aparecía como inventario de producción para usarlo en otro día. Aquí cada una
        // recibe su trabajo con su entrada (no se toca ningún inventario ni la solicitud/pedido contable).
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @s INT, @t INT;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT Id FROM solicitud_produccion
    WHERE Activo = 1 AND IdTrabajo IS NULL AND IdExistencia IS NOT NULL AND IdDireccion IS NOT NULL;
OPEN c;
FETCH NEXT FROM c INTO @s;
WHILE @@FETCH_STATUS = 0
BEGIN
    INSERT INTO produccion_trabajo (IdUsuario, FechaInicio, CodigoProducto, IdExistencia, IdDireccion, Cerrado, Activo)
    SELECT IdUsuario, Fecha, CodigoProducto, IdExistencia, IdDireccion, 0, 1 FROM solicitud_produccion WHERE Id = @s;
    SET @t = SCOPE_IDENTITY();
    INSERT INTO produccion_evento (IdTrabajo, Fecha, Tipo, IdUsuario, CodigoProducto, KilosUsados, Kilos, SinTrabajo, MantenerLote, Activo)
    SELECT @t, Fecha, 'Entrada', IdUsuario, CodigoProducto, 0, Kilos, 0, 0, 1 FROM solicitud_produccion WHERE Id = @s;
    UPDATE solicitud_produccion SET IdTrabajo = @t WHERE Id = @s;
    FETCH NEXT FROM c INTO @s;
END
CLOSE c;
DEALLOCATE c;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
