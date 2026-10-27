# Granjamar — Intranet

Sistema de distribución de producto del mar: API en .NET 8 (`Empresa.Intranet.*`, EF Core code-first sobre SQL Server) y web en React + Vite (`granjamar-frontend`).

Este repositorio guarda el **código y la estructura de la base de datos** (las migraciones). No incluye datos, archivos subidos ni secretos.

## Primer arranque

1. Copia `Empresa.Intranet.API/appsettings.Example.json` como `Empresa.Intranet.API/appsettings.json` y cambia la clave `Jwt:Key` (y la conexión si hace falta).
2. Crea la base de datos con las migraciones:
   ```bash
   cd Empresa.Intranet.API
   dotnet ef database update --project ../Empresa.Intranet.Infrastructure --startup-project .
   ```
3. Instala y levanta la web:
   ```bash
   cd granjamar-frontend
   npm install
   ```
4. En Windows, `iniciar-sistema.bat` levanta la API (puerto 5145) y la web (puerto 5173).

La base de datos nueva queda vacía (sin usuarios, catálogos ni datos).
