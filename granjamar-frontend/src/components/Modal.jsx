// Modal. variante:
//  - 'blanco'  (por defecto): tarjeta blanca redondeada con título azul
//  - 'cyan'    : panel cian con borde punteado (estilo pago de Ventas en los mockups)
export default function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 'max-w-md',
  variante = 'blanco',
}) {
  if (!abierto) return null

  const panel =
    variante === 'cyan'
      ? 'border-2 border-dashed border-black rounded-3xl p-6'
      : 'bg-white rounded-2xl p-8'

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 overflow-y-auto py-8 animate-fondo-in"
      onClick={onCerrar}
    >
      <div
        className={`w-full ${ancho} mx-4 animate-escala-in ${panel}`}
        style={{
          ...(variante === 'cyan' ? { backgroundColor: 'var(--color-panel-cyan)' } : {}),
          boxShadow: '0 24px 48px -12px rgb(15 23 42 / 0.18), 0 4px 12px -2px rgb(15 23 42 / 0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(titulo || onCerrar) && (
          <div className="flex justify-between items-start mb-6 gap-4">
            {titulo && (
              <h2 className={variante === 'cyan' ? 'text-2xl font-bold text-teal' : 'text-2xl font-bold text-marca'}>
                {titulo}
              </h2>
            )}
            <button
              onClick={onCerrar}
              aria-label="Cerrar"
              className="text-gray-400 hover:text-gray-600 hover:rotate-90 text-2xl leading-none ml-auto transition-all duration-200"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
