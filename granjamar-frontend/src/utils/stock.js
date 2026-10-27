// Selecciona las ubicaciones óptimas para cubrir los kilos requeridos
export function seleccionarUbicaciones(ubicaciones, kilosRequeridos) {
  const disponibles = ubicaciones
    .filter(u => u.cantidadKilos > 0)
    .sort((a, b) => b.cantidadKilos - a.cantidadKilos)

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