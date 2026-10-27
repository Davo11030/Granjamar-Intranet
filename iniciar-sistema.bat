@echo off
rem Levanta el sistema Granjamar: API (puerto 5145) y web (puerto 5173).
rem Se abren dos ventanas; cierra cada una para apagar su servicio.
cd /d "%~dp0"

start "Granjamar API" cmd /k "cd /d %~dp0Empresa.Intranet.API && dotnet run --no-launch-profile --urls http://localhost:5145"
start "Granjamar Web" cmd /k "cd /d %~dp0granjamar-frontend && npm run dev"

echo.
echo Espera unos segundos y abre http://localhost:5173
timeout /t 8 >nul
start http://localhost:5173
