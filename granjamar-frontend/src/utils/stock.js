// Primero lo que caduca antes (FEFO); los lotes sin caducidad al final. Con la misma caducidad, el de más kilos primero
// para tocar menos lotes.
const fechaCaducidad = (u) => (u.caducidad ? new Date(u.caducidad).getTime() : Infinity)
const TOLERANCIA = 0.0005
const redondear3 = (n) => Math.round(n * 1000) / 1000

// Kilos que no completan una caja: si un lote tiene 55 kg y la caja es de 10 kg, hay una caja abierta con 5 kg sueltos.
// Sin peso por caja (peso variado) no aplica.
export function kilosSueltos(kilos, pesoCaja) {
  const peso = Number(pesoCaja) || 0
  const k = Number(kilos) || 0
  if (peso <= 0 || k <= 0) return 0
  const resto = redondear3(k - Math.floor(k / peso + TOLERANCIA) * peso)
  return resto > TOLERANCIA && peso - resto > TOLERANCIA ? resto : 0
}

// Ubicaciones (lote + bodega) de un producto que tienen una caja abierta, con sus kilos sueltos.
export function cajasAbiertas(ubicaciones, pesoCaja) {
  return ubicaciones
    .map((u) => ({ ...u, sueltos: kilosSueltos(u.cantidadKilos, pesoCaja) }))
    .filter((u) => u.sueltos > 0)
}

// Selecciona de qué ubicaciones salen los kilos de un renglón de venta.
// Con peso por caja, la parte que no completa una caja se toma primero de las cajas que ya están abiertas (para no abrir
// otra); el resto, por caducidad (FEFO).
export function seleccionarUbicaciones(ubicaciones, kilosRequeridos, pesoCaja = 0) {
  const disponibles = ubicaciones
    .filter((u) => u.cantidadKilos > 0)
    .sort((a, b) => fechaCaducidad(a) - fechaCaducidad(b) || b.cantidadKilos - a.cantidadKilos)
    .map((u) => ({ u, libre: Number(u.cantidadKilos), kilos: 0 }))

  let restante = Number(kilosRequeridos) || 0
  const tomar = (d, k) => {
    d.libre -= k
    d.kilos += k
    restante -= k
  }

  let fraccion = kilosSueltos(restante, pesoCaja)
  for (const d of disponibles) {
    if (fraccion <= TOLERANCIA) break
    const sueltos = kilosSueltos(d.libre, pesoCaja)
    if (sueltos <= 0) continue
    const k = Math.min(sueltos, fraccion)
    tomar(d, k)
    fraccion -= k
  }

  for (const d of disponibles) {
    if (restante <= TOLERANCIA) break
    const k = Math.min(d.libre, restante)
    if (k > 0) tomar(d, k)
  }

  if (restante > TOLERANCIA) return null // Stock insuficiente
  return disponibles
    .filter((d) => d.kilos > TOLERANCIA)
    .map((d) => ({
      idExistencia: d.u.idExistencia,
      kilos: redondear3(d.kilos),
      idDireccion: d.u.idDireccion,
      idDepartamento: d.u.idDepartamento || null,
    }))
}

export function stockTotal(ubicaciones) {
  return ubicaciones.reduce((s, u) => s + u.cantidadKilos, 0)
}
