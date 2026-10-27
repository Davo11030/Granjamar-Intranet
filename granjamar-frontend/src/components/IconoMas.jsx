// Icono "+" dentro de círculo verde (usado en los mockups para "Agregar")
export default function IconoMas({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="var(--color-agregar)" strokeWidth="2" fill="white" />
      <path d="M12 7.5v9M7.5 12h9" stroke="var(--color-agregar)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
