import { importeConLetra } from './numeroALetras'
import { nombreArchivoRt, repartirProductos } from './rtPdf'

// La misma RT que el PDF, en Excel (solo la hoja con los datos: los documentos anexos van en el PDF). Igual que el archivo
// de ejemplo: solo lleva lo variable, para imprimir sobre la hoja ya impresa y enumerada (carta, vertical, al 86 %, con los
// mismos márgenes). Las columnas y la letra son las del ejemplo; las filas se calculan para que cada dato caiga a la misma
// altura que en el PDF, donde está cada campo de la hoja impresa. ExcelJS pesa bastante: solo se carga cuando se pide un Excel.
const ESCALA = 0.86
const MARGEN_SUPERIOR = 0.78740157480314965 * 72 // pt (0.787")
const DESCENSO = 2.3 // pt: de la línea base del texto al borde inferior de su fila (letra de 10 pt)
const PASO_PIXEL = 0.75 // Excel guarda las alturas en múltiplos de un píxel (0.75 pt)
// A cantidad · B kilos · C descripción · D–G · H precio · I (separador) · J importe
const ANCHOS = [4.18, 10.73, 12.27, 9.73, 11.18, 15.73, 18.27, 14.13, 0.5, 16.85]
const COLUMNAS = 'ABCDEFGHIJ'
const FUENTE = 'Aptos Narrow'
const CONTABLE = '_-"$"* #,##0.00_-;-"$"* #,##0.00_-;_-"$"* "-"??_-;_-@_-'
const mayus = (t) => (t == null ? '' : String(t).toUpperCase())

// Parte un texto en líneas de hasta `max` caracteres sin cortar palabras (los pedimentos de un producto).
function partir(texto, max) {
  const lineas = []
  let actual = ''
  texto.split(' ').forEach((palabra) => {
    const prueba = actual ? `${actual} ${palabra}` : palabra
    if (prueba.length > max && actual) {
      lineas.push(actual)
      actual = palabra
    } else actual = prueba
  })
  if (actual) lineas.push(actual)
  return lineas
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fechaRt = (f) => {
  const d = new Date(f)
  return `${String(d.getDate()).padStart(2, '0')}-${MESES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`
}

// datos = respuesta de GET /Embarques/{id}/rt-documento. Devuelve el nombre del archivo descargado.
export async function descargarRtExcel(datos, destino) {
  const { default: ExcelJS } = await import('exceljs')
  const cfg = datos.configuracion || {}
  const c = datos.cliente || {}
  const productos = datos.productos || []
  const claves = datos.claves || []

  // ── Las líneas de la hoja: cada una con la altura (línea base, en pt sobre la hoja) a la que cae en la hoja impresa ──────
  // Cada línea: { y, celdas: [{ col, valor, ...formato }] }; las celdas con "unir" combinan hasta esa columna.
  const lineas = new Map()
  const linea = (y) => {
    const k = Math.round(y * 100)
    if (!lineas.has(k)) lineas.set(k, { y, celdas: [] })
    return lineas.get(k)
  }
  const poner = (y, col, valor, formato = {}) => linea(y).celdas.push({ col, valor, ...formato })

  poner(105.5, 'H', datos.fecha ? fechaRt(datos.fecha) : '', { unir: 'J', negrita: true, alinear: 'center' })
  poner(127.8, 'C', mayus(c.nombre), { negrita: true })
  poner(127.8, 'H', mayus(c.rfc), { unir: 'J', negrita: true, alinear: 'center' })
  poner(139.7, 'C', mayus(c.direccion), { negrita: true })
  poner(152.6, 'C', mayus(c.ciudad), { negrita: true })
  poner(152.6, 'G', c.codigoPostal || '', { negrita: true })

  // Productos: cada uno con sus pedimentos/facturas en la línea de abajo (en varias líneas si no caben).
  const trozos = productos.map((p) => partir((p.documentos || []).join(', '), 62))
  const reparto = repartirProductos(productos, (p) => trozos[productos.indexOf(p)].length)
  const primeraFila = []
  productos.forEach((p, i) => {
    const y = reparto.posiciones[i]
    primeraFila.push(y)
    poner(y, 'B', Number(p.kilos), { negrita: true, alinear: 'center', formato: '#,##0' })
    poner(y, 'C', mayus(p.descripcion), { negrita: true })
    poner(y, 'H', Number(p.precio), { formato: CONTABLE })
    poner(y, 'J', { formula: `B{fila}*H{fila}`, resultado: Number(p.importe) }, { formato: CONTABLE })
    trozos[i].forEach((t, k) => poner(y + reparto.lineasPaso * (k + 1), 'C', t, { italica: true, unir: 'G' }))
  })

  // Total en kilos y domicilio de origen.
  poner(488.5, 'B', { suma: primeraFila, resultado: Number(datos.totalKilos) }, { negrita: true, alinear: 'center', formato: '#,##0' })
  poner(488.5, 'C', 'KG', { negrita: true })
  poner(502.2, 'C', 'DOMICILIO ORIGEN: ', { negrita: true })
  poner(515.9, 'C', mayus(cfg.OrigenNombre), { italica: true, tam: 9 })
  poner(515.9, 'F', mayus(cfg.OrigenRfc), { italica: true, tam: 9, sangria: 1 })
  poner(529.5, 'C', mayus(cfg.OrigenCalle), { italica: true, tam: 9 })
  poner(541, 'C', mayus(cfg.OrigenCiudad), { italica: true, tam: 9 })
  poner(541, 'E', cfg.OrigenCp ? `CP ${cfg.OrigenCp}` : '', { italica: true, tam: 9, alinear: 'center' })

  // Clave SAT: kilos, descripción e importe de cada una, y el total.
  poner(563.8, 'C', 'CLAVE SAT: ', { negrita: true })
  const paso = Math.min(13.9, (634.5 - 578.9) / Math.max(1, claves.length))
  claves.forEach((k, i) => {
    const y = 578.9 + i * paso
    poner(y, 'B', Number(k.kilos), { alinear: 'center', formato: '#,##0' })
    poner(y, 'C', `${k.codigo ?? ''} ${mayus(k.nombre)}`.trim(), { italica: true })
    poner(y, 'G', Number(k.importe), { formato: CONTABLE })
  })
  const yTotal = 578.9 + claves.length * paso
  poner(yTotal, 'B', Number(datos.totalKilos), { negrita: true, alinear: 'center', formato: '#,##0' })
  poner(yTotal, 'G', Number(datos.total), { negrita: true, formato: CONTABLE })

  // Importe con letra (debajo del rótulo ya impreso) y total.
  poner(660.3, 'B', importeConLetra(datos.total), { unir: 'G', italica: true, tam: 9, reducir: true })
  poner(660.3, 'J', { suma: primeraFila, columna: 'J', resultado: Number(datos.total) }, { negrita: true, formato: CONTABLE })

  // ── Se arma la hoja: una fila por línea, con la altura que lleva el dato hasta el lugar que le toca ───────────────────────
  const libro = new ExcelJS.Workbook()
  const hoja = libro.addWorksheet((c.ciudad || 'RT').replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || 'RT', {
    pageSetup: {
      paperSize: 1,
      orientation: 'portrait',
      scale: Math.round(ESCALA * 100),
      fitToPage: false,
      horizontalCentered: false,
      margins: { left: 0.23622047244094491, right: 0.23622047244094491, top: 0.78740157480314965, bottom: 0.74803149606299213, header: 0.15748031496062992, footer: 0.31496062992125984 },
    },
    views: [{ showGridLines: false }],
  })
  ANCHOS.forEach((w, i) => (hoja.getColumn(i + 1).width = w))

  const ordenadas = [...lineas.values()].sort((a, b) => a.y - b.y)
  let acumulado = 0 // alto ya puesto (pt de hoja de cálculo, sin escala)
  let fila = 0
  const filaDe = new Map()
  ordenadas.forEach((l) => {
    fila += 1
    filaDe.set(l, fila)
    // Alto para que la línea base caiga en l.y (la primera cuenta desde el margen superior); se redondea a píxeles y el
    // sobrante se arrastra a la fila siguiente.
    const meta = (l.y - MARGEN_SUPERIOR) / ESCALA + DESCENSO
    const alto = Math.max(PASO_PIXEL * 4, Math.round((meta - acumulado) / PASO_PIXEL) * PASO_PIXEL)
    hoja.getRow(fila).height = alto
    acumulado += alto
  })

  const filasProducto = primeraFila.map((y) => filaDe.get(linea(y)))
  ordenadas.forEach((l) => {
    const f = filaDe.get(l)
    l.celdas.forEach((celda) => {
      const ref = `${celda.col}${f}`
      if (celda.unir) hoja.mergeCells(`${ref}:${celda.unir}${f}`)
      const x = hoja.getCell(ref)
      let v = celda.valor
      if (v && typeof v === 'object' && v.formula) v = { formula: v.formula.replaceAll('{fila}', String(f)), result: v.resultado }
      else if (v && typeof v === 'object' && v.suma) {
        // Totales: la suma de la columna (kilos o importes) de los renglones de producto.
        const col = v.columna || 'B'
        v = { formula: filasProducto.length ? filasProducto.map((r) => `${col}${r}`).join('+') : '0', result: v.resultado }
      }
      x.value = v
      x.font = { name: FUENTE, size: celda.tam || 10, bold: !!celda.negrita, italic: !!celda.italica }
      x.alignment = {
        horizontal: celda.alinear || 'left',
        vertical: 'bottom',
        indent: celda.sangria || 0,
        shrinkToFit: !!celda.reducir,
      }
      if (celda.formato) x.numFmt = celda.formato
    })
  })
  hoja.pageSetup.printArea = `A1:J${fila + 2}`

  const nombre = `${nombreArchivoRt(datos.numero, destino)}.xlsx`
  const buffer = await libro.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return nombre
}
