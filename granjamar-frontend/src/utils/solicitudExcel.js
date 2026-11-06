import logoUrl from '../assets/logo-granjamar.png'
import { nombreArchivoSolicitud } from './solicitudPdf'

// La misma hoja de Solicitud que el PDF, en Excel: arriba el embarque, el logo, la fecha y el transporte; un bloque por
// destino (recuadro oscuro, encabezado y productos con kilos, descripción, tarimas y lotes); los totales y los datos del
// operador. Cada hoja de cálculo es una página (la tabla tiene el mismo alto en todas; un bloque que no cabe sigue en la
// hoja siguiente). ExcelJS pesa bastante: solo se carga cuando se pide un Excel.
const ALTO_FILA = 19.5 // pt
const ALTO_DOBLE = 30
const ALTO_ETIQUETA = 23
const ALTO_ENCABEZADO = 22
const ALTO_TABLA = 497 // lo que mide la tabla en cada hoja (bloques + renglones)
const OSCURO = 'FF252525'
const AZUL = 'FF5FD3FF'
const VERDE = 'FF008000'
const ANCHOS = [14, 17.9, 40, 17, 15.9, 20.6] // A código · B kilos · C descripción · D tarimas · E:F lotes y/o especificaciones
const CARS_DESCRIPCION = 36 // caracteres que caben en una línea de la descripción (negrita 9.5)
const CARS_LOTES = 32

const mayus = (t) => (t == null ? '' : String(t).toUpperCase())
const fechaCorta = (f) => {
  const d = new Date(f)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
const letra = (n) => String.fromCharCode(64 + n)

const logoBase64 = async () => {
  const blob = await (await fetch(logoUrl)).blob()
  return await new Promise((resolve) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result)
    lector.readAsDataURL(blob)
  })
}

// datos = respuesta de GET /Embarques/{id}/solicitud-documento. Devuelve el nombre del archivo descargado.
export async function descargarSolicitudExcel(datos) {
  const { default: ExcelJS } = await import('exceljs')
  const libro = new ExcelJS.Workbook()
  const logo = libro.addImage({ base64: await logoBase64(), extension: 'png' })
  const cfg = datos.configuracion || {}
  const t = datos.transporte || {}

  // Renglón con texto largo → dos líneas → más alto.
  const lineasDe = (valor, cars) => Math.max(1, Math.ceil(String(valor || '').length / cars))
  const altoDe = (r) => (lineasDe(mayus(r.descripcion), CARS_DESCRIPCION) > 1 || lineasDe(mayus(r.lotes), CARS_LOTES) > 1 ? ALTO_DOBLE : ALTO_FILA)

  // ── Reparto de los destinos en hojas (igual que en el PDF) ─────────────────────────────────────────────────────────
  const paginas = []
  let pagina = null
  let usado = 0
  const nuevaPagina = () => {
    pagina = { grupos: [], usado: 0 }
    paginas.push(pagina)
    usado = 0
  }
  nuevaPagina()
  const destinos = datos.destinos?.length ? datos.destinos : [{ empresa: '', etiqueta: '', productos: [] }]
  let grupo = null
  const abrirGrupo = (destino) => {
    grupo = { destino, filas: [] }
    pagina.grupos.push(grupo)
    usado += ALTO_ETIQUETA + ALTO_ENCABEZADO
    pagina.usado = usado
  }
  destinos.forEach((d) => {
    const primero = d.productos.length ? altoDe(d.productos[0]) : ALTO_FILA
    if (pagina.grupos.length && usado + ALTO_ETIQUETA + ALTO_ENCABEZADO + primero > ALTO_TABLA) nuevaPagina()
    abrirGrupo(d)
    d.productos.forEach((r) => {
      const h = altoDe(r)
      if (usado + h > ALTO_TABLA + 0.01) {
        nuevaPagina()
        abrirGrupo(d)
      }
      grupo.filas.push({ r, h })
      usado += h
      pagina.usado = usado
    })
  })

  const fino = { style: 'thin', color: { argb: 'FF000000' } }
  const medio = { style: 'medium', color: { argb: 'FF000000' } }

  paginas.forEach((pag, indice) => {
    const ws = libro.addWorksheet(paginas.length > 1 ? `Hoja ${indice + 1}` : 'Solicitud', {
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

    // Escribe un valor en el rango (c1,r1)–(c2,r2), combinándolo si abarca más de una celda, con su formato y borde. Los
    // bordes se ponen DESPUÉS de combinar, en todas las celdas del rango.
    const poner = (c1, r1, c2, r2, valor, { negrita = false, tam = 10, alinear = 'center', vertical = 'middle', color, relleno, borde, grosor = fino, ajustar = false, reducir = false } = {}) => {
      if (c1 !== c2 || r1 !== r2) ws.mergeCells(`${letra(c1)}${r1}:${letra(c2)}${r2}`)
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++) {
          const celda = ws.getCell(`${letra(c)}${r}`)
          if (relleno) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: relleno } }
          if (borde === 'caja') {
            const b = {}
            if (r === r1) b.top = grosor
            if (r === r2) b.bottom = grosor
            if (c === c1) b.left = grosor
            if (c === c2) b.right = grosor
            celda.border = b
          } else if (borde === 'linea' && r === r2) celda.border = { bottom: grosor }
        }
      const principal = ws.getCell(`${letra(c1)}${r1}`)
      principal.value = valor ?? ''
      principal.font = { name: 'Arial', size: tam, bold: negrita, color: color ? { argb: color } : undefined }
      principal.alignment = { horizontal: alinear, vertical, wrapText: ajustar, shrinkToFit: reducir && !ajustar }
    }
    const alto = (fila, puntos) => (ws.getRow(fila).height = puntos)

    // ── Encabezado ─────────────────────────────────────────────────────────────────────────────────────────────────
    alto(1, 8)
    alto(2, 26)
    alto(3, 30)
    alto(4, 16)
    alto(5, 16)
    alto(6, 31)
    alto(7, 8)
    poner(2, 2, 2, 2, 'EMBARQUE', { negrita: true, tam: 11, borde: 'caja', grosor: medio })
    poner(2, 3, 2, 5, datos.numero, { tam: 28, borde: 'caja', grosor: medio })
    ws.addImage(logo, { tl: { col: 2.62, row: 1.1 }, ext: { width: 123, height: 111 } })
    poner(3, 6, 4, 6, cfg.Titulo, { negrita: true, tam: 11 })
    poner(6, 2, 6, 2, 'FECHA', { negrita: true, tam: 11, borde: 'caja', grosor: medio })
    poner(6, 3, 6, 3, datos.fecha ? fechaCorta(datos.fecha) : '', { tam: 13, borde: 'caja', grosor: medio })
    poner(6, 5, 6, 5, 'TRANSPORTES', { tam: 9, borde: 'caja', grosor: medio })
    poner(6, 6, 6, 6, mayus(datos.transportes), { negrita: true, tam: mayus(datos.transportes).length <= 14 ? 10 : mayus(datos.transportes).length <= 28 ? 8 : 7, borde: 'caja', grosor: medio, ajustar: true })

    // ── Un bloque por destino ──────────────────────────────────────────────────────────────────────────────────────
    let f = 8
    const libre = ALTO_TABLA - pag.usado
    const vacios = Math.floor(libre / ALTO_FILA)
    pag.grupos.forEach((g, gi) => {
      alto(f, ALTO_ETIQUETA)
      poner(2, f, 2, f, mayus(g.destino.empresa), { tam: 10, color: 'FFFFFFFF', relleno: OSCURO, reducir: true })
      f += 1
      alto(f, ALTO_ENCABEZADO)
      poner(1, f, 1, f, 'CODIGO', { negrita: true, tam: 8, borde: 'caja' })
      poner(2, f, 2, f, mayus(g.destino.etiqueta), { negrita: true, tam: 10, borde: 'caja', reducir: true })
      poner(3, f, 3, f, '', { borde: 'caja' })
      poner(4, f, 4, f, 'TARIMAS', { negrita: true, tam: 9, borde: 'caja' })
      poner(5, f, 6, f, 'LOTES Y/O ESPECIFICACIONES', { negrita: true, tam: 8, borde: 'caja' })
      f += 1
      g.filas.forEach(({ r, h }) => {
        alto(f, h)
        poner(1, f, 1, f, r.codigo, { tam: 10, borde: 'caja' })
        poner(2, f, 2, f, Number(r.kilos), { negrita: true, tam: 10, borde: 'caja' })
        ws.getCell(`B${f}`).numFmt = Number.isInteger(Number(r.kilos)) ? '#,##0' : '#,##0.0#'
        poner(3, f, 3, f, mayus(r.descripcion), { negrita: true, tam: 9.5, borde: 'caja', ajustar: true })
        poner(4, f, 4, f, r.tarimas, { negrita: true, tam: 10, borde: 'caja' })
        poner(5, f, 6, f, mayus(r.lotes), { negrita: true, tam: 9.5, borde: 'caja', ajustar: true })
        f += 1
      })
      const enEste = gi === pag.grupos.length - 1 ? vacios - Math.floor(vacios / pag.grupos.length) * (pag.grupos.length - 1) : Math.floor(vacios / pag.grupos.length)
      for (let i = 0; i < enEste; i++) {
        alto(f, vacios > 0 ? libre / vacios : ALTO_FILA)
        ;[1, 2, 3, 4].forEach((c) => poner(c, f, c, f, '', { borde: 'caja' }))
        poner(5, f, 6, f, '', { borde: 'caja' })
        f += 1
      }
    })

    // ── Totales (en la última hoja) ────────────────────────────────────────────────────────────────────────────────
    alto(f, 24)
    if (indice === paginas.length - 1) {
      poner(2, f, 2, f, Number(datos.totalKilos || 0), { negrita: true, tam: 14, borde: 'caja', grosor: medio })
      ws.getCell(`B${f}`).numFmt = '#,##0.00'
      poner(4, f, 4, f, Number(datos.totalTarimas || 0), { negrita: true, tam: 18, borde: 'caja', grosor: medio })
      poner(5, f, 5, f, 'TARIMAS', { negrita: true, tam: 10, borde: 'caja', grosor: medio })
    }
    f += 1
    alto(f, 22)
    f += 1

    // ── Operador y tractocamión ────────────────────────────────────────────────────────────────────────────────────
    ;[
      `OP. ${mayus(t.operador)}`,
      `TRACTO: ${mayus(t.tracto)}`,
      `PLACAS: ${mayus(t.placasTractor)}`,
      `CAJA: ${mayus(t.placasCaja)}`,
      `CELULAR: ${t.celular ?? ''}`,
      `SELLO SEGURIDAD: ${mayus(t.sellos)}`,
    ].forEach((l, i, todas) => {
      alto(f, 15.5)
      ;[3, 4].forEach((c) => {
        const celda = ws.getCell(`${letra(c)}${f}`)
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
        celda.border = {
          left: c === 3 ? medio : undefined,
          right: c === 4 ? medio : undefined,
          top: i === 0 ? medio : undefined,
          bottom: i === todas.length - 1 ? medio : undefined,
        }
      })
      const celda = ws.getCell(`C${f}`)
      celda.value = l
      celda.font = { name: 'Arial', size: 9, color: { argb: VERDE } }
      celda.alignment = { horizontal: 'left', vertical: 'middle' }
      f += 1
    })
    alto(f, 30)
    f += 1
    ws.getCell(`B${f}`).border = { bottom: fino }
    if (paginas.length > 1) {
      const c = ws.getCell(`F${f}`)
      c.value = `Hoja ${indice + 1} de ${paginas.length}`
      c.font = { name: 'Arial', size: 8, color: { argb: 'FF5A5A5A' } }
      c.alignment = { horizontal: 'right' }
    }
    ws.pageSetup.printArea = `A1:F${f}`
  })

  const nombre = `${nombreArchivoSolicitud(datos.numero)}.xlsx`
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
