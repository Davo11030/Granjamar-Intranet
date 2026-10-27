// Campo de búsqueda con lupa, como en los mockups ("Ingresa código producto o descripción").
export default function Buscador({ valor, onChange, placeholder = 'Buscar…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-teal" width="18" height="18"
        viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border pl-10 pr-4 py-2 text-sm outline-none transition-all duration-200 border-borde focus:border-teal focus:ring-4 focus:ring-teal/10"
      />
    </div>
  )
}
