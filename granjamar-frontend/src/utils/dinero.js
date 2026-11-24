// Denominaciones de billetes y monedas en circulación en México.
const DENOMINACIONES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5]

// Montos de efectivo con los que es razonable que pague el cliente, según lo que se cobra: el total redondeado hacia arriba
// a decenas y a los billetes comunes, p. ej. para 372.50 → [380, 400, 500, 1000] y para 45 → [50, 100, 200, 500]. Nunca
// incluye el total exacto (para eso va su propio botón) ni montos menores a lo que se cobra.
export function sugerenciasEfectivo(total, maximo = 4) {
  const t = Math.round(Number(total || 0) * 100) / 100
  if (t <= 0) return []
  const candidatos = [...new Set([10, 50, 100, 200, 500, 1000, 2000, 5000].map((paso) => Math.ceil(t / paso - 1e-9) * paso))]
    .filter((m) => m > t + 0.001)
    .sort((x, y) => x - y)
  // Se descartan los montos casi iguales entre sí (p. ej. 5,250 y 5,300): se queda el primero de cada grupo.
  const elegidos = []
  for (const m of candidatos) {
    const previo = elegidos[elegidos.length - 1]
    if (previo === undefined || m - previo >= Math.max(10, previo * 0.02)) elegidos.push(m)
  }
  return elegidos.slice(0, maximo)
}

// Desglosa un monto de cambio en la menor cantidad de billetes/monedas posible,
// p. ej. desgloseCambio(370) -> [{ valor: 200, cantidad: 1 }, { valor: 100, cantidad: 1 },
// { valor: 50, cantidad: 1 }, { valor: 20, cantidad: 1 }].
export function desgloseCambio(monto) {
  let restante = Math.round(Number(monto || 0) * 100) / 100
  const piezas = []
  for (const valor of DENOMINACIONES) {
    const cantidad = Math.floor(restante / valor + 1e-9)
    if (cantidad > 0) {
      piezas.push({ valor, cantidad })
      restante = Math.round((restante - cantidad * valor) * 100) / 100
    }
  }
  return piezas
}
