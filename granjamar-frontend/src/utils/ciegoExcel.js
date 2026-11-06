import logoUrl from '../assets/logo-granjamar.png'
import { CAPACIDAD, ALTO_FILA, mayus, miles, nombreArchivoCiego, repartirTarimas, tinteDe, tituloCiego } from './ciegoPdf'

// La misma hoja de Ciego de carga que el PDF, en Excel: recuadro verde con el título y la fecha, el logo, el embarque con
// su destino, sucursal, transporte y operador, y la tabla con una fila por tarima y el total. Cada hoja de cálculo es una
// página (las filas se reparten igual que en el PDF). ExcelJS pesa bastante: solo se carga cuando se pide un Excel.
const ANCHOS = [11.5, 36, 10, 13, 14] // A tarima (y el logo) · B producto · C cajas · D kg tarima · E destino
const CARS_PRODUCTO = 33 // caracteres que caben en una línea del producto (Arial 9)
const AMARILLO = 'FFFFFF00'
const VERDE_CLARO = 'FFE2EFDA'

const logoBase64 = async () => {
  const blob = await (await fetch(logoUrl)).blob()
  return await new Promise((resolve) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result)
    lector.readAsDataURL(blob)
  })
}

// datos = respuesta de GET /Embarques/{id}/ciego-documento. Devuelve el nombre del archivo descargado.
export async function descargarCiegoExcel(datos) {
  const { default: ExcelJS } = await import('exceljs')
  const libro = new ExcelJS.Workbook()
  const logo = libro.addImage({ base64: await logoBase64(), extension: 'png' })

  // Cuántas líneas ocupa el producto al partirse por palabras; cada línea de más agrega alto a la fila.
  const lineasDe = (texto) => {
    let lineas = 1
    let actual = ''
    mayus(texto).split(' ').forEach((palabra) => {
      const prueba = actual ? `${actual} ${palabra}` : palabra
      if (prueba.length > CARS_PRODUCTO && actual) {
        lineas += 1
        actual = palabra
      } else actual = prueba
    })
    return lineas
  }
  const altoDe = (r) => {
    const n = lineasDe(r.producto)
    return n <= 1 ? ALTO_FILA : 11.5 * n + 4
  }
  const paginas = repartirTarimas(datos.tarimas || [], altoDe, CAPACIDAD)
  const tinteDeFila = tinteDe(datos.tarimas)
  const argb = ([r, g, b]) => 'FF' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()

  const fino = { style: 'thin', color: { argb: 'FF000000' } }
  const grueso = { style: 'medium', color: { argb: 'FF000000' } }
  const fuente = (tam, negrita = false) => ({ name: 'Arial', size: tam, bold: negrita })

  // El destino y la sucursal en una línea; si no caben, en dos.
  const destino = mayus(datos.destino)
  const sucursal = mayus(datos.sucursal)
  const partido = `DESTINO: ${destino}      SUCURSAL: ${sucursal}`.length > 62

  paginas.forEach((pagina, indice) => {
    const ws = libro.addWorksheet(paginas.length > 1 ? `Hoja ${indice + 1}` : 'Ciego de carga', {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      },
      views: [{ showGridLines: false }],
    })
    ANCHOS.forEach((w, i) => (ws.getColumn(i + 1).width = w))
    const alto = (fila, puntos) => (ws.getRow(fila).height = puntos)

    // Una línea del encabezado (celdas B:E combinadas, centrada): partes normales y en negrita.
    const lineaMixta = (fila, partes) => {
      ws.mergeCells(`B${fila}:E${fila}`)
      const celda = ws.getCell(`B${fila}`)
      celda.value = { richText: partes.map((p) => ({ text: p.t, font: fuente(10, !!p.b) })) }
      celda.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true }
    }

    // ── Encabezado ─────────────────────────────────────────────────────────────────────────────────────────────────
    alto(1, 31)
    ws.mergeCells('A1:E1')
    ;['A', 'B', 'C', 'D', 'E'].forEach((c, i) => {
      const celda = ws.getCell(`${c}1`)
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } }
      celda.border = { top: grueso, bottom: grueso, left: i === 0 ? grueso : undefined, right: i === 4 ? grueso : undefined }
    })
    const titulo = ws.getCell('A1')
    titulo.value = tituloCiego(datos)
    titulo.font = fuente(13, true)
    titulo.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true }
    alto(2, 8)
    ;[3, 4, 5, 6, 7].forEach((f) => alto(f, 15.7))
    ws.addImage(logo, { tl: { col: 0.05, row: 2.1 }, ext: { width: 82, height: 74 } })
    lineaMixta(3, [{ t: `EMBARQUE # ${datos.numero ?? ''}`, b: true }])
    if (partido) {
      lineaMixta(4, [{ t: 'DESTINO: ' }, { t: destino, b: true }])
      lineaMixta(5, [{ t: 'SUCURSAL: ' }, { t: sucursal, b: true }])
    } else {
      lineaMixta(4, [{ t: 'DESTINO: ' }, { t: destino, b: true }, { t: '      SUCURSAL: ' }, { t: sucursal, b: true }])
      alto(5, 2)
    }
    lineaMixta(6, [{ t: 'TRANSPORTES: ' }, { t: mayus(datos.transportes), b: true }])
    lineaMixta(7, [{ t: 'OPERADOR: ' }, { t: mayus(datos.operador), b: true }])
    alto(8, 14)

    // ── Tabla: una fila por tarima ──────────────────────────────────────────────────────────────────────────────────
    let f = 9
    alto(f, 18)
    ;['TARIMA', 'PRODUCTO', 'CAJAS', 'KG TARIMA', 'DESTINO'].forEach((t, c) => {
      const celda = ws.getCell(f, c + 1)
      celda.value = t
      celda.font = fuente(9, true)
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } }
      celda.border = { top: fino, bottom: fino, left: fino, right: fino }
      celda.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true }
    })
    f += 1
    pagina.forEach(({ r, h }) => {
      alto(f, h)
      const tinte = tinteDeFila(r)
      ;[r.tarima, mayus(r.producto), Number(r.cajas), Number(r.kilos), mayus(r.destino)].forEach((v, c) => {
        const celda = ws.getCell(f, c + 1)
        celda.value = v
        celda.font = fuente(9)
        celda.border = { top: fino, bottom: fino, left: fino, right: fino }
        if (tinte) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(tinte) } }
        celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: c === 1, shrinkToFit: c === 4 }
        if (c === 2) celda.numFmt = Number.isInteger(Number(r.cajas)) ? '0' : '0.0#'
        if (c === 3) celda.numFmt = Number.isInteger(Number(r.kilos)) ? '0' : '0.0#'
      })
      f += 1
    })

    // ── Total (en la última hoja) ───────────────────────────────────────────────────────────────────────────────────
    alto(f, 6)
    f += 1
    alto(f, 27)
    if (indice === paginas.length - 1) {
      const etiqueta = ws.getCell(f, 3)
      etiqueta.value = 'TOTAL'
      etiqueta.font = fuente(12, true)
      const total = ws.getCell(f, 4)
      total.value = Number(datos.totalKilos || 0)
      total.numFmt = '#,##0.00'
      total.font = fuente(12, true)
      ;[etiqueta, total].forEach((celda, i) => {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } }
        celda.border = { top: grueso, bottom: grueso, left: grueso, right: i === 1 ? grueso : undefined }
        celda.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true }
      })
    }
    if (paginas.length > 1) {
      f += 1
      const c = ws.getCell(`E${f}`)
      c.value = `Hoja ${indice + 1} de ${paginas.length}`
      c.font = { name: 'Arial', size: 8, color: { argb: 'FF5A5A5A' } }
      c.alignment = { horizontal: 'right' }
    }
    ws.pageSetup.printArea = `A1:E${f}`
  })

  const nombre = `${nombreArchivoCiego(datos.numero)}.xlsx`
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
