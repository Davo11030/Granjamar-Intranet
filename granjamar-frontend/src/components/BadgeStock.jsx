const n3 = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })

// Pequeña pestaña que muestra cuánto stock hay disponible; se pone en rojo si ya no alcanza.
export default function BadgeStock({ kilos, insuficiente = false, texto = 'Disponible' }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        insuficiente ? 'bg-red-100 text-red-600' : 'text-gray-700'
      }`}
      style={insuficiente ? undefined : { backgroundColor: 'var(--color-pill)' }}
    >
      {texto}: {n3(kilos)} kg
    </span>
  )
}
