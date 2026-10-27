// Barra inferior con "Cancelar" (rojo) y "Guardar" (teal), alineada a la derecha como en los mockups.
export default function BarraAcciones({
  onCancelar,
  onGuardar,
  textoGuardar = 'Guardar',
  textoCancelar = 'Cancelar',
  guardarDeshabilitado = false,
  guardando = false,
}) {
  return (
    <div className="flex justify-end gap-4 mt-8">
      {onCancelar && (
        <button type="button" className="gm-btn-cancelar" onClick={onCancelar}>
          {textoCancelar}
        </button>
      )}
      <button
        type="button"
        className="gm-btn-guardar"
        onClick={onGuardar}
        disabled={guardarDeshabilitado || guardando}
      >
        {guardando ? 'Guardando…' : textoGuardar}
      </button>
    </div>
  )
}
