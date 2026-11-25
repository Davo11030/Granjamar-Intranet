import Modal from './Modal'

// Confirmación antes de dar de baja (usuarios, empresas, direcciones). La baja no borra el historial:
// el registro deja de aparecer en listas y menús, y queda en los movimientos del administrador.
export default function ConfirmarBaja({ abierto, titulo, texto, procesando, onCancelar, onConfirmar }) {
  return (
    <Modal abierto={abierto} onCerrar={procesando ? undefined : onCancelar} ancho="max-w-md" titulo={titulo}>
      <p className="text-sm text-gray-600">{texto}</p>
      <p className="mt-2 text-xs text-gray-400">
        Su historial se conserva y la baja queda registrada en los movimientos del administrador.
      </p>
      <div className="mt-8 flex justify-between">
        <button className="gm-btn-cancelar" onClick={onCancelar} disabled={procesando}>
          Cancelar
        </button>
        <button className="gm-btn-guardar" onClick={onConfirmar} disabled={procesando}>
          {procesando ? 'Dando de baja…' : 'Dar de baja'}
        </button>
      </div>
    </Modal>
  )
}
