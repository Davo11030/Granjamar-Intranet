@echo off
rem Levanta el sistema Granjamar: API (puerto 5145) y web (puerto 5173), visibles en toda la red.
rem Se abren dos ventanas; cierra cada una para apagar su servicio.
cd /d "%~dp0"

start "Granjamar API" cmd /k "cd /d %~dp0Empresa.Intranet.API && dotnet run --no-launch-profile --urls http://0.0.0.0:5145"
start "Granjamar Web" cmd /k "cd /d %~dp0granjamar-frontend && npm run dev"

echo.
echo En esta PC abre:            http://localhost:5173
echo Desde otras PCs de la red:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%b in ("%%a") do echo    http://%%b:5173
echo Si otra PC no puede entrar, permite los puertos 5145 y 5173 en el Firewall de Windows.
timeout /t 8 >nul
start http://localhost:5173
