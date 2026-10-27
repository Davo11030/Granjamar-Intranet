using Empresa.Intranet.API.Extensiones;
using Empresa.Intranet.Application.DTOs;
using Empresa.Intranet.Domain.Entities;
using Empresa.Intranet.Infrastructure.Persistence;
using Empresa.Intranet.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Empresa.Intranet.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuditoriaService _auditoria;
    private readonly PermisoService _permisoService;
    public ProductosController(AppDbContext context, AuditoriaService auditoria, PermisoService permisoService)
    {
        _context = context;
        _auditoria = auditoria;
        _permisoService = permisoService;
    }

    private async Task<object> Instantanea(Producto p)
    {
        var especie = await _context.Especies.FindAsync(p.IdEspecie);
        var talla = p.IdTalla != null ? await _context.Tallas.FindAsync(p.IdTalla) : null;
        var marca = p.IdMarca != null ? await _context.Marcas.FindAsync(p.IdMarca) : null;
        var pesoCaja = p.IdPesoCaja != null ? await _context.PesosCaja.FindAsync(p.IdPesoCaja) : null;

        var presentaciones = new List<string?>();
        foreach (var idPresentacion in p.Descripciones.Select(d => d.IdPresentacion).OrderBy(x => x))
        {
            var presentacion = await _context.Presentaciones.FindAsync(idPresentacion);
            presentaciones.Add(presentacion?.Nombre);
        }

        return new
        {
            p.Codigo,
            Especie = especie?.Nombre,
            Talla = talla?.Descripcion,
            Marca = marca?.Nombre,
            PesoCaja = pesoCaja?.Peso,
            p.PrecioKilo,
            Presentaciones = presentaciones
        };
    }

    private async Task<string?> ValidarDatosAsync(CrearProductoDto dto)
    {
        if (dto.PrecioKilo < 0) return "El precio por kilo no puede ser negativo";
        if (!await _context.Especies.AnyAsync(e => e.Id == dto.IdEspecie)) return "No existe esa especie";
        return null;
    }

    [HttpGet]
    public async Task<IActionResult> GetTodos() =>
        Ok(await _context.Productos
            .Include(p => p.Especie).ThenInclude(e => e.ClaveSat)
            .Include(p => p.Talla)
            .Include(p => p.Marca)
            .Include(p => p.PesoCaja)
            .Include(p => p.Descripciones).ThenInclude(d => d.Presentacion)
            .Select(p => new ProductoDto
            {
                Codigo = p.Codigo,
                Especie = p.Especie.Nombre,
                Talla = p.Talla != null ? p.Talla.Descripcion : null,
                Marca = p.Marca != null ? p.Marca.Nombre : null,
                PesoCaja = p.PesoCaja != null ? p.PesoCaja.Peso : null,
                PrecioKilo = p.PrecioKilo,
                ClaveSat = p.Especie.ClaveSat.Codigo,
                DescripcionSat = p.Especie.ClaveSat.Nombre,
                Presentaciones = p.Descripciones.Select(d => d.Presentacion.Nombre).ToList(),
                IdEspecie = p.IdEspecie,
                IdTalla = p.IdTalla,
                IdMarca = p.IdMarca,
                IdPesoCaja = p.IdPesoCaja,
                IdsPresentacion = p.Descripciones.Select(d => d.IdPresentacion).ToList()
            })
            .ToListAsync());

    [HttpGet("{codigo}")]
    public async Task<IActionResult> GetPorCodigo(string codigo)
    {
        var p = await _context.Productos
            .Include(p => p.Especie).ThenInclude(e => e.ClaveSat)
            .Include(p => p.Talla)
            .Include(p => p.Marca)
            .Include(p => p.PesoCaja)
            .Include(p => p.Descripciones).ThenInclude(d => d.Presentacion)
            .FirstOrDefaultAsync(p => p.Codigo == codigo);

        if (p == null) return NotFound();

        return Ok(new ProductoDto
        {
            Codigo = p.Codigo,
            Especie = p.Especie.Nombre,
            Talla = p.Talla?.Descripcion,
            Marca = p.Marca?.Nombre,
            PesoCaja = p.PesoCaja?.Peso,
            PrecioKilo = p.PrecioKilo,
            ClaveSat = p.Especie.ClaveSat.Codigo,
            DescripcionSat = p.Especie.ClaveSat.Nombre,
            Presentaciones = p.Descripciones.Select(d => d.Presentacion.Nombre).ToList(),
            IdEspecie = p.IdEspecie,
            IdTalla = p.IdTalla,
            IdMarca = p.IdMarca,
            IdPesoCaja = p.IdPesoCaja,
            IdsPresentacion = p.Descripciones.Select(d => d.IdPresentacion).ToList()
        });
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearProductoDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "productos", "crear"))
            return this.SinPermiso();
        var errorDatos = await ValidarDatosAsync(dto);
        if (errorDatos != null) return BadRequest(new { mensaje = errorDatos });
        var existe = await _context.Productos.AnyAsync(p => p.Codigo == dto.Codigo);
        if (existe) return BadRequest(new { mensaje = "Ya existe un producto con ese código" });

        var producto = new Producto
        {
            Codigo = dto.Codigo,
            IdEspecie = dto.IdEspecie,
            IdTalla = dto.IdTalla,
            IdMarca = dto.IdMarca,
            IdPesoCaja = dto.IdPesoCaja,
            PrecioKilo = dto.PrecioKilo
        };

        foreach (var idPresentacion in dto.IdsPresentacion)
        {
            producto.Descripciones.Add(new Descripcion
            {
                IdPresentacion = idPresentacion,
                CodigoProducto = dto.Codigo
            });
        }

        _context.Productos.Add(producto);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("productos", producto.Codigo, "CREAR", null,
            await Instantanea(producto), this.IdUsuarioActual());

        return CreatedAtAction(nameof(GetPorCodigo), new { codigo = producto.Codigo }, new { producto.Codigo });
    }

    [HttpPut("{codigo}")]
    public async Task<IActionResult> Actualizar(string codigo, [FromBody] CrearProductoDto dto)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "productos", "editar"))
            return this.SinPermiso();
        var errorDatos = await ValidarDatosAsync(dto);
        if (errorDatos != null) return BadRequest(new { mensaje = errorDatos });
        var producto = await _context.Productos
            .Include(p => p.Descripciones)
            .FirstOrDefaultAsync(p => p.Codigo == codigo);

        if (producto == null) return NotFound();

        var antes = await Instantanea(producto);

        producto.IdEspecie = dto.IdEspecie;
        producto.IdTalla = dto.IdTalla;
        producto.IdMarca = dto.IdMarca;
        producto.IdPesoCaja = dto.IdPesoCaja;
        producto.PrecioKilo = dto.PrecioKilo;

        _context.Descripciones.RemoveRange(producto.Descripciones);
        foreach (var idPresentacion in dto.IdsPresentacion)
        {
            producto.Descripciones.Add(new Descripcion
            {
                IdPresentacion = idPresentacion,
                CodigoProducto = codigo
            });
        }

        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("productos", codigo, "MODIFICAR", antes,
            await Instantanea(producto), this.IdUsuarioActual());

        return NoContent();
    }

    [HttpDelete("{codigo}")]
    public async Task<IActionResult> Eliminar(string codigo)
    {
        if (!await _permisoService.TienePermisoAsync(this.IdUsuarioActual(), "productos", "eliminar"))
            return this.SinPermiso();
        var producto = await _context.Productos
            .Include(p => p.Descripciones)
            .FirstOrDefaultAsync(p => p.Codigo == codigo);
        if (producto == null) return NotFound();

        var antes = await Instantanea(producto);
        _context.Productos.Remove(producto);
        await _context.SaveChangesAsync();

        await _auditoria.RegistrarAsync("productos", codigo, "ELIMINAR", antes, null,
            this.IdUsuarioActual());

        return NoContent();
    }
}
