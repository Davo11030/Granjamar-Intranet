// Un importe en pesos con letra, como se escribe en la Remisión-Traslado:
//   1,503,980.00 → "(SON UN MILLON QUINIENTOS TRES MIL NOVECIENTOS OCHENTA PESOS 00/100 M.N)"
const UNIDADES = [
  'CERO', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE',
  'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES',
  'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
]
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

// 1–999 ("UN" antes de MIL/MILLONES: VEINTIUN MIL, TREINTA Y UN MIL).
function menorDeMil(n) {
  if (n === 100) return 'CIEN'
  const partes = []
  const c = Math.floor(n / 100)
  const r = n % 100
  if (c) partes.push(CENTENAS[c])
  if (r) {
    if (r < 30) partes.push(UNIDADES[r])
    else {
      const d = Math.floor(r / 10)
      const u = r % 10
      partes.push(u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d])
    }
  }
  return partes.join(' ')
}

function enteroALetras(n) {
  if (n === 0) return 'CERO'
  const partes = []
  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  if (millones) partes.push(millones === 1 ? 'UN MILLON' : `${enteroALetras(millones)} MILLONES`)
  if (miles) partes.push(miles === 1 ? 'MIL' : `${menorDeMil(miles)} MIL`)
  if (resto) partes.push(menorDeMil(resto))
  return partes.join(' ')
}

export function importeConLetra(importe) {
  const total = Math.round(Math.abs(Number(importe) || 0) * 100)
  const pesos = Math.floor(total / 100)
  const centavos = String(total % 100).padStart(2, '0')
  // Millones exactos llevan "DE": "UN MILLON DE PESOS".
  const de = pesos >= 1_000_000 && pesos % 1_000_000 === 0 ? ' DE' : ''
  return `(SON ${enteroALetras(pesos)}${de} ${pesos === 1 ? 'PESO' : 'PESOS'} ${centavos}/100 M.N)`
}
