// Selecciona las ubicaciones óptimas para cubrir los kilos requeridos
// Primero lo que caduca antes (FEFO); los lotes sin caducidad al final. Con la misma caducidad, el de más kilos primero
// para tocar menos lotes.
const fechaCaducidad = (u) => (u.caducidad ? new Date(u.caducidad).getTime() : Infinity)

export function seleccionarUbicaciones(ubicaciones, kilosRequeridos) {
  const disponibles = ubicaciones
    .filter(u => u.cantidadKilos > 0)
    .sort((a, b) => fechaCaducidad(a) - fechaCaducidad(b) || b.cantidadKilos - a.cantidadKilos)

  const resultado = []
  let restante = kilosRequeridos

  for (const ub of disponibles) {
    if (restante <= 0) break
    const tomar = Math.min(ub.cantidadKilos, restante)
    resultado.push({
      idExistencia: ub.idExistencia,
      kilos: tomar,
      idDireccion: ub.idDireccion,
      idDepartamento: ub.idDepartamento || null
    })
    restante -= tomar
  }

  if (restante > 0) return null // Stock insuficiente
  return resultado
}

export function stockTotal(ubicaciones) {
  return ubicaciones.reduce((s, u) => s + u.cantidadKilos, 0)
}