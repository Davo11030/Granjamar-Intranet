using System.Text;
using Empresa.Intranet.Infrastructure.Persistence;
using Empresa.Intranet.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<Empresa.Intranet.API.Servicios.ArchivosDocumentoService>();
builder.Services.AddScoped<IUsuarioActual, Empresa.Intranet.API.Servicios.UsuarioActualHttp>();
builder.Services.AddScoped<PermisoService>();
// TokenService
builder.Services.AddScoped<TokenService>();
// AuditoriaService
builder.Services.AddScoped<AuditoriaService>();
builder.Services.AddScoped<Empresa.Intranet.API.Servicios.PedidosConsignacionService>();
builder.Services.AddScoped<Empresa.Intranet.API.Servicios.ConfiguracionDocumentosService>();
builder.Services.AddScoped<Empresa.Intranet.API.Servicios.ProduccionService>();
// JWT
var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Escribe: Bearer {tu token}"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});
// CORS: la web puede abrirse desde cualquier PC de la oficina. Se aceptan los orígenes de
// Cors:OrigenesPermitidos y, si Cors:PermitirRedLocal es true (por defecto), cualquier equipo de la
// red local (localhost, 10.x, 172.16–31.x, 192.168.x). El token va en la cabecera, no en cookies.
var origenesPermitidos = builder.Configuration.GetSection("Cors:OrigenesPermitidos").Get<string[]>()
    ?? new[] { "http://localhost:5173" };
var permitirRedLocal = builder.Configuration.GetValue("Cors:PermitirRedLocal", true);
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactPolicy", policy =>
    {
        policy.SetIsOriginAllowed(origen =>
                  origenesPermitidos.Contains(origen, StringComparer.OrdinalIgnoreCase)
                  || (permitirRedLocal && EsRedLocal(origen)))
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});
var app = builder.Build();

await Empresa.Intranet.API.Servicios.SemillaDatos.AplicarAsync(app.Services);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("ReactPolicy");
// Dos peticiones que modifican el mismo stock a la vez: la segunda recibe 409 con un mensaje claro
// (antes las dos pasaban y el stock quedaba descontado una sola vez — se vendía dos veces lo mismo).
app.Use(async (contexto, siguiente) =>
{
    try
    {
        await siguiente();
    }
    catch (DbUpdateConcurrencyException) when (!contexto.Response.HasStarted)
    {
        contexto.Response.StatusCode = StatusCodes.Status409Conflict;
        await contexto.Response.WriteAsJsonAsync(new
        {
            mensaje = "El inventario cambió mientras guardabas (otro usuario modificó el mismo lote). Vuelve a intentarlo."
        });
    }
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

static bool EsRedLocal(string origen)
{
    if (!Uri.TryCreate(origen, UriKind.Absolute, out var uri)) return false;
    if (uri.IsLoopback || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)) return true;
    if (!System.Net.IPAddress.TryParse(uri.Host, out var ip)
        || ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork) return false;
    var b = ip.GetAddressBytes();
    return b[0] == 10
        || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
        || (b[0] == 192 && b[1] == 168);
}
