# Granjamar — Intranet

Sistema interno para una empresa de **distribución de producto del mar**: lleva el inventario por lote, las entradas y salidas de mercancía, los embarques con su documentación (requisición, solicitud, RT y ciego de carga), las ventas, el inventario en consignación y en resguardo, y la producción diaria.

Está hecho con una **API en .NET 8** (EF Core, SQL Server) y una **web en React** (Vite + Tailwind).

> Este repositorio guarda el **código** y la **estructura de la base de datos** (las migraciones de EF Core). No incluye datos, archivos subidos por los usuarios ni secretos.

---

## Contenido

- [Qué hace](#qué-hace)
- [Tecnologías](#tecnologías)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Puesta en marcha](#puesta-en-marcha)
- [Configuración](#configuración)
- [Seguridad y permisos](#seguridad-y-permisos)
- [Reglas de negocio importantes](#reglas-de-negocio-importantes)
- [Trabajar con la base de datos](#trabajar-con-la-base-de-datos)
- [Calidad del código](#calidad-del-código)

---

## Qué hace

| Módulo | Para qué sirve |
|---|---|
| **Entradas** | Ingreso de mercancía al inventario (importación con pedimento, nacional con factura y traspasos). Cada documento lleva su archivo (PDF, imagen o XML) y las entradas ya cargadas se pueden modificar sin romper embarques ni producción. |
| **Inventario** | Tres inventarios separados: **Conpaq** (propio), **Consignación** (producto de otras empresas) y **Resguardo**. Cada uno con su historial de movimientos por producto. |
| **Salidas / Embarques** | Un embarque nace en la **Requisición**, se detalla en la **Solicitud** (lotes y tarimas), genera el **RT** (con los documentos que respaldan cada kilo) y el **Ciego de carga**. Un embarque puede ir a varios destinos con el mismo número, a una bodega o directo a un cliente. |
| **Ventas** | Venta de mostrador y de mayoreo, con corte de caja por usuario. |
| **Pedidos de consignación** | Se generan solos cuando un embarque o la producción toma producto de una empresa en consignación. Llevan folio por empresa (`Ens-01`…), orden de embarque, documento y factura. |
| **Producción** | Una **tabla general** (siempre disponible) con lo que hay en producción por producto y origen —Inicial, Entradas, Salida (desbloqueo) y Existencia— y **reportes diarios** que registran entrada, M.P. en procesos y salida, con rendimiento y porcentaje. |
| **Pedimentos y documentos** | Consulta de pedimentos y facturas, con su archivo y los kilos que cubre cada uno. |
| **Catálogos** | Clientes (con dirección completa), productos (Kardex), claves SAT, destinos, operadores (choferes, tractocamiones, cajas), visitantes. |
| **Administración** | Usuarios, permisos por módulo, empresas y **movimientos** (auditoría de quién hizo qué y cuándo). |

## Tecnologías

**Backend** — `.NET 8`, ASP.NET Core Web API, Entity Framework Core 8 (*code first*), SQL Server, autenticación JWT, contraseñas con BCrypt, Swagger en desarrollo.

**Frontend** — React 19, Vite, React Router 7, Tailwind CSS 4, Axios, oxlint.

## Estructura del repositorio

```
Empresa.Intranet.sln
├── Empresa.Intranet.API              API: controladores, filtros de permisos, servicios (archivos, pedidos, producción)
├── Empresa.Intranet.Application      DTOs
├── Empresa.Intranet.Domain           Entidades del negocio
├── Empresa.Intranet.Infrastructure   AppDbContext, migraciones y servicios de datos (permisos, auditoría)
├── granjamar-frontend                Aplicación web (React)
│   └── src
│       ├── api/                      Llamadas HTTP agrupadas por módulo
│       ├── components/               Componentes compartidos (Layout, Modal, Tabla, formularios…)
│       ├── context/                  Sesión y permisos (AuthContext)
│       ├── pages/                    Una carpeta por módulo (entradas, inventario, salidas, produccion, admin…)
│       └── utils/                    Reglas de orígenes, fechas, dinero
└── iniciar-sistema.bat               Atajo para levantar API y web en Windows
```

## Puesta en marcha

### Requisitos

- [.NET SDK 8](https://dotnet.microsoft.com/download)
- SQL Server (LocalDB, Express o completo)
- [Node.js](https://nodejs.org) 20.19 o superior (o 22)
- La herramienta de EF Core: `dotnet tool install --global dotnet-ef`

### 1. Configurar la API

Copia el archivo de ejemplo y cambia la clave secreta:

```bash
cp Empresa.Intranet.API/appsettings.Example.json Empresa.Intranet.API/appsettings.json
```

Edita `Empresa.Intranet.API/appsettings.json`:

- `ConnectionStrings:DefaultConnection` — por defecto usa `Server=localhost;Database=EmpresaIntranet` con autenticación de Windows.
- `Jwt:Key` — una clave larga y secreta (32 caracteres o más). **No la subas al repositorio**: `appsettings.json` está ignorado por git.

### 2. Crear la base de datos

```bash
cd Empresa.Intranet.API
dotnet ef database update --project ../Empresa.Intranet.Infrastructure --startup-project .
```

La base queda **vacía** (sin usuarios, catálogos ni datos). Como crear usuarios es una acción de administrador, el primer administrador se da de alta directamente en la tabla `usuario`, con `Puesto = 'admin'` y la contraseña ya con hash BCrypt; después se crean los demás desde la propia aplicación.

### 3. Levantar la API

```bash
cd Empresa.Intranet.API
dotnet run --no-launch-profile --urls http://localhost:5145
```

En desarrollo, la documentación de la API (Swagger) queda en `http://localhost:5145/swagger`.

### 4. Levantar la web

```bash
cd granjamar-frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. En Windows, `iniciar-sistema.bat` hace los pasos 3 y 4 de una vez.

> La API solo acepta peticiones desde `http://localhost:5173` (CORS) y la web llama a `http://localhost:5145/api`. Si cambias los puertos, ajusta `Empresa.Intranet.API/Program.cs` y `granjamar-frontend/src/api/config.js`.

## Configuración

| Dato | Dónde | Notas |
|---|---|---|
| Cadena de conexión | `appsettings.json` → `ConnectionStrings:DefaultConnection` | SQL Server |
| Clave de firma del token | `appsettings.json` → `Jwt:Key` | Secreta; el token dura `Jwt:ExpirationHours` horas |
| Archivos de documentos | Carpeta `Empresa.Intranet.API/Archivos/` (configurable en `Almacenamiento:RutaDocumentos`) | Fuera de `wwwroot`, no se sirven como estáticos y no se versionan |

## Seguridad y permisos

- **Autenticación** con JWT. Las contraseñas se guardan con BCrypt.
- **Permisos por módulo y acción** (`ver`, `crear`, `editar`, `eliminar`, más algunos especiales como el corte de caja). Se asignan por usuario desde Administración → Usuarios.
- **Administrador**: los usuarios con puesto `admin` o `administrador` pasan todas las validaciones y son los únicos que administran usuarios, permisos y auditoría.
- En la API cada acción se protege con `[RequierePermiso(modulo, accion)]` o `[AdminOnly]`; el frontend oculta rutas, menús y botones según los mismos permisos (`ProtectedRoute`, `useAuth().puede(...)`).
- **Auditoría**: las altas, cambios y bajas importantes quedan registradas con usuario y fecha, y se consultan en Administración → Movimientos.
- **Archivos subidos**: se validan por tipo y firma real del archivo, con límite de tamaño, y se guardan con nombre generado por el servidor.
- **Concurrencia**: dos peticiones que modifican el mismo stock a la vez no se pisan; la segunda recibe un error claro y se vuelve a intentar.

## Reglas de negocio importantes

- **Inventario por lote y ubicación.** Todo el stock vive en lotes (existencias) repartidos en bodegas; nunca queda en negativo.
- **Un embarque, varios destinos.** Un mismo número de embarque puede repartirse en varios destinos. Un embarque no puede ir a la misma bodega de la que sale ni a una bodega de consignación (a esas solo se ingresa desde su propio menú).
- **RT con respaldo legal.** Cada kilo del RT se respalda con un documento (pedimento o factura); el sistema lleva el conteo de cuántos kilos ha usado cada documento por producto.
- **Consignación.** Lo que sale del inventario de una empresa en consignación genera un pedido con folio propio. El pedido es un control contable: pendiente se actualiza solo si cambia el origen; liberado o facturado ya no se toca.
- **Producción.** El producto que entra a producción queda *bloqueado* hasta que se **desbloquea** en la tabla general; los reportes diarios solo pueden usar lo desbloqueado. En un reporte, lo que se usa es siempre todo lo del renglón anterior; la M.P. en procesos se queda en producción y solo la **salida** ingresa a Conpaq como lote nuevo. Un reporte por día.
- **Editar sin romper.** Las entradas y los reportes se pueden modificar; el sistema revierte y reaplica el inventario y rechaza cambios que dejarían algo en negativo o que afectan lotes que ya se usaron.

## Trabajar con la base de datos

La estructura vive en las migraciones (`Empresa.Intranet.Infrastructure/Migrations`). Para cambiar el modelo:

```bash
cd Empresa.Intranet.API
dotnet ef migrations add NombreDelCambio --project ../Empresa.Intranet.Infrastructure --startup-project .
dotnet ef database update --project ../Empresa.Intranet.Infrastructure --startup-project .
```

Revisa siempre el archivo de migración generado antes de aplicarlo: si el cambio transforma datos existentes, hay que escribir esa conversión a mano dentro de la migración.

## Calidad del código

```bash
# Frontend
cd granjamar-frontend
npm run lint      # oxlint
npm run build     # compilación de producción

# Backend
dotnet build
```
