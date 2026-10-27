export default function Paginacion({ total, porPagina, paginaActual, onCambiar }) {
  const totalPaginas = Math.ceil(total / porPagina)
  if (totalPaginas <= 1) return null

  const paginas = []
  const rango = 2

  for (let i = 1; i <= totalPaginas; i++) {
    if (
      i === 1 ||
      i === totalPaginas ||
      (i >= paginaActual - rango && i <= paginaActual + rango)
    ) {
      paginas.push(i)
    } else if (
      i === paginaActual - rango - 1 ||
      i === paginaActual + rango + 1
    ) {
      paginas.push('...')
    }
  }

  // Eliminar duplicados de '...'
  const paginasFiltradas = paginas.filter((p, i) => p !== '...' || paginas[i - 1] !== '...')

  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <p className="text-sm text-gray-500">
        Mostrando {Math.min((paginaActual - 1) * porPagina + 1, total)} - {Math.min(paginaActual * porPagina, total)} de {total}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onCambiar(paginaActual - 1)}
          disabled={paginaActual === 1}
          className="px-3 py-1 rounded-lg text-sm border border-borde transition-all duration-150 disabled:opacity-40 hover:bg-gray-50 hover:-translate-y-0.5 disabled:hover:translate-y-0">
          ←
        </button>
        {paginasFiltradas.map((p, i) => (
          p === '...'
            ? <span key={`puntos-${i}`} className="px-3 py-1 text-sm text-gray-400">...</span>
            : <button key={`pagina-${p}`} onClick={() => onCambiar(p)}
                className={`px-3 py-1 rounded-lg text-sm border transition-all duration-150 ${p === paginaActual
                  ? 'bg-teal text-white border-teal shadow-sm'
                  : 'border-borde hover:bg-gray-50 hover:-translate-y-0.5'}`}>
                {p}
              </button>
        ))}
        <button
          onClick={() => onCambiar(paginaActual + 1)}
          disabled={paginaActual === totalPaginas}
          className="px-3 py-1 rounded-lg text-sm border border-borde transition-all duration-150 disabled:opacity-40 hover:bg-gray-50 hover:-translate-y-0.5 disabled:hover:translate-y-0">
          →
        </button>
      </div>
    </div>
  )
}