// Denominaciones de billetes y monedas en circulación en México.
const DENOMINACIONES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5]

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
