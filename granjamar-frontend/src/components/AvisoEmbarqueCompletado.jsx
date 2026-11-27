// Aviso en las pantallas de un embarque (Requisición, Solicitud, RT y Ciego) cuando ya está Completado: se puede ver
// pero no modificar hasta reabrirlo desde el detalle del embarque.
export default function AvisoEmbarqueCompletado() {
  return (
    <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
      Este embarque está <strong>completado</strong>: solo se puede consultar. Para modificarlo, ábrelo y usa
      &ldquo;Reabrir para modificar&rdquo;.
    </div>
  )
}
