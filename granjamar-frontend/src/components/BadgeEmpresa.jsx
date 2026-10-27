// Etiqueta que identifica de qué empresa viene un renglón (Granjamar en verde, cualquier
// otra en ámbar) — ayuda a notar de un vistazo cuando el origen NO es nuestro inventario.
export default function BadgeEmpresa({ nombre, esPropia }) {
  if (!nombre) return null
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        esPropia ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {nombre}
    </span>
  )
}
