import IconoMas from './IconoMas'

// Pastilla de acción de los mockups: etiqueta + círculo verde con "+"
export default function AgregarBoton({ children = 'Agregar', onClick, disabled, className = '' }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`gm-agregar ${className}`}>
      <span>{children}</span>
      <IconoMas />
    </button>
  )
}
