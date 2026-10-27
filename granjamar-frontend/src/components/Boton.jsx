export default function Boton({
  onClick,
  children,
  variante = 'primario',
  disabled,
  tipo = 'button',
  className = '',
}) {
  const estilos = {
    primario: 'bg-teal hover:brightness-95 text-white',
    guardar: 'bg-teal hover:brightness-95 text-white',
    secundario: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300',
    peligro: 'text-white hover:brightness-95',
    verde: 'text-gray-800 hover:brightness-95',
    morado: 'bg-purple-300 hover:bg-purple-400 text-gray-800',
  }
  const inline =
    variante === 'peligro'
      ? { backgroundColor: 'var(--color-cancelar)' }
      : variante === 'verde'
      ? { backgroundColor: 'var(--color-entrar)' }
      : undefined

  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      style={inline}
      className={`px-6 py-2 rounded-full font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${estilos[variante]} ${className}`}
    >
      {children}
    </button>
  )
}
