import logoUrl from '../assets/logo-granjamar.png'
import { nombreArchivoRequisicion } from './requisicionPdf'

// La misma hoja de Requisición que el PDF, en Excel (una hoja de cálculo por cada 22 productos; los primeros 22 en la
// primera). La hoja se arma sobre una rejilla de 9 columnas iguales (A–I), como las del formato original: todo (recuadros
// de segmento, origen y destino, tipo de salida, la tabla y el transporte) se alinea sobre esas mismas columnas.
// ExcelJS pesa bastante: solo se carga cuando se pide un Excel.
const FILAS = 22
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const AZUL = 'FF2F5597'
const AZUL_CLARO = 'FF1F6BB0'
const GRIS = 'FFD9D9D9'
const GRIS_CLARO = 'FFF2F2F2'

const fechaCorta = (f) => {
  const d = new Date(f)
  return `${String(d.getDate()).padStart(2, '0')}-${MESES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`
}
const mayus = (t) => (t == null ? '' : String(t).toUpperCase())
const tipoTelefono = (t) => {
  const v = String(t || '').toLowerCase()
  if (!v) return null
  if (v.includes('ofic')) return 'oficina'
  if (v.includes('casa')) return 'casa'
  return 'movil'
}
const letra = (n) => String.fromCharCode(64 + n) // 1 → A

const logoBase64 = async () => {
  const blob = await (await fetch(logoUrl)).blob()
  return await new Promise((resolve) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result)
    lector.readAsDataURL(blob)
  })
}

// datos = respuesta de GET /Embarques/{id}/requisicion. Devuelve el nombre del archivo descargado.
export async function descargarRequisicionExcel(datos, destino) {
  const { default: ExcelJS } = await import('exceljs')
  const libro = new ExcelJS.Workbook()
  const logo = libro.addImage({ base64: await logoBase64(), extension: 'png' })

  const cfg = datos.configuracion || {}
  const t = datos.transporte || {}
  const dest = datos.destino || {}
  const paginasOrigen = datos.paginas?.length ? datos.paginas : [{ origen: {}, productos: [], ambito: null }]
  const totalKilos = paginasOrigen.reduce((s, p) => s + p.productos.reduce((k, r) => k + Number(r.kilos || 0), 0), 0)
  const hojas = paginasOrigen.flatMap((p) => {
    const trozos = []
    for (let i = 0; i < Math.max(1, p.productos.length); i += FILAS) trozos.push({ ...p, productos: p.productos.slice(i, i + FILAS) })
    return trozos
  })

  const fino = { style: 'thin', color: { argb: 'FF000000' } }
  const grueso = { style: 'medium', color: { argb: 'FF000000' } }

  hojas.forEach((hoja, indice) => {
    const ws = libro.addWorksheet(hojas.length > 1 ? `Hoja ${indice + 1}` : 'Requisición', {
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
    for (let c = 1; c <= 9; c++) ws.getColumn(c).width = 15.5

    // Escribe un valor en el rango (c1,r1)–(c2,r2) —lo combina si abarca más de una celda— con su formato y su borde:
    //  'caja'  = recuadro por fuera · 'linea' = solo raya abajo · sin borde. sinUnir deja las celdas sueltas (solo relleno
    //  y borde) para escribir en ellas por separado.
    const poner = (c1, r1, c2, r2, valor, { negrita = false, tam = 9, alinear = 'left', vertical = 'middle', color, relleno, borde, ajustar = false, formato, sinUnir = false } = {}) => {
      // Un recuadro NO se combina cuando es de un renglón o está vacío: en una celda combinada Excel solo respeta los bordes
      // de su última celda y el recuadro quedaba abierto por la izquierda. En su lugar cada celda lleva su borde y el texto
      // centrado se reparte con "centrar en la selección".
      const combinar = !sinUnir && (c1 !== c2 || r1 !== r2) && !(borde === 'caja' && (r1 === r2 || valor === '' || valor == null))
      if (combinar) ws.mergeCells(`${letra(c1)}${r1}:${letra(c2)}${r2}`)
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++) {
          const celda = ws.getCell(`${letra(c)}${r}`)
          if (relleno) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: relleno } }
          if (borde === 'caja') {
            const b = {}
            if (r === r1) b.top = fino
            if (r === r2) b.bottom = fino
            if (c === c1) b.left = fino
            if (c === c2) b.right = fino
            celda.border = b
          } else if (borde === 'linea' && r === r2) celda.border = { bottom: fino }
        }
      const principal = ws.getCell(`${letra(c1)}${r1}`)
      principal.value = valor ?? ''
      principal.font = { name: 'Calibri', size: tam, bold: negrita, color: color ? { argb: color } : undefined }
      principal.alignment = { horizontal: alinear, vertical, wrapText: ajustar, indent: alinear === 'left' && borde === 'caja' ? 1 : 0 }
      if (formato) principal.numFmt = formato
      if (!combinar && !sinUnir && c1 !== c2 && alinear === 'center') {
        for (let c = c1; c <= c2; c++) {
          const celda = ws.getCell(`${letra(c)}${r1}`)
          celda.alignment = { ...(celda.alignment || {}), horizontal: 'centerContinuous', vertical }
        }
      }
    }
    const alto = (fila, puntos) => (ws.getRow(fila).height = puntos)
    const marca = (c, r, activo) => poner(c, r, c, r, activo ? 'X' : '', { negrita: true, alinear: 'center', borde: 'caja' })

    // ── Encabezado ─────────────────────────────────────────────────────────────────────────────────────────────────
    alto(1, 24)
    alto(2, 16)
    alto(4, 26)
    ws.addImage(logo, { tl: { col: 0.15, row: 0.15 }, ext: { width: 92, height: 82 } })
    poner(3, 1, 7, 1, cfg.Titulo, { negrita: true, tam: 17, alinear: 'center', color: AZUL })
    poner(3, 2, 7, 2, cfg.Subtitulo, { negrita: true, tam: 10, alinear: 'center', color: AZUL_CLARO })
    poner(7, 3, 7, 3, 'FECHA:', { negrita: true, alinear: 'right' })
    poner(8, 3, 9, 3, datos.fecha ? fechaCorta(datos.fecha) : '', { alinear: 'center', borde: 'linea' })
    poner(6, 4, 8, 4, 'NUMERO DE EMBARQUE:', { negrita: true, alinear: 'right' })
    poner(9, 4, 9, 4, datos.numero, { tam: 18, alinear: 'center', borde: 'caja' })
    alto(5, 6)

    // ── Origen y destino: recuadro de segmento arriba y recuadro gris con los datos ────────────────────────────────
    const origen = hoja.origen || {}
    const ciudad = (l) => [l.municipio, l.estado].filter(Boolean).map(mayus).join(', ')
    const bloque = (cEtiqueta, cIni, cFin, titulo, rol, lugar) => {
      poner(cEtiqueta, 6, cEtiqueta, 6, '# Segmento o Cliente', { negrita: true, tam: 8, alinear: 'left' })
      poner(cIni, 6, cIni, 6, lugar.segmento ?? '', { borde: 'caja', alinear: 'center' })   // el número de segmento o cliente (Admin → Empresas)
      poner(cEtiqueta, 7, cEtiqueta, 7, `${titulo}:`, { negrita: true })
      poner(cEtiqueta, 8, cEtiqueta, 8, `${rol}:`, { negrita: true })
      poner(cEtiqueta, 9, cEtiqueta, 9, 'RFC:', { negrita: true })
      poner(cEtiqueta, 10, cEtiqueta, 10, 'Direccion:', { negrita: true, vertical: 'top' })
      // Un solo recuadro gris con todo adentro (las celdas no se combinan, para que no haya rayas por dentro): el texto de
      // un renglón corre hacia la derecha dentro del mismo recuadro, y la dirección ocupa sus dos renglones combinados.
      ws.mergeCells(`${letra(cIni)}10:${letra(cFin)}11`)
      poner(cIni, 7, cFin, 11, '', { relleno: GRIS, borde: 'caja', sinUnir: true }) // relleno y borde al final, ya combinada la dirección
      ;[[7, ciudad(lugar)], [8, lugar.empresa], [9, lugar.rfc]].forEach(([fila, valor]) => {
        const c = ws.getCell(`${letra(cIni)}${fila}`)
        c.value = valor ?? ''
        c.font = { name: 'Calibri', size: 9 }
        c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      })
      const dir = ws.getCell(`${letra(cIni)}10`)
      dir.value = lugar.direccion ?? ''
      dir.font = { name: 'Calibri', size: 9 }
      dir.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 }
    }
    bloque(1, 2, 4, 'Origen', 'Remitente', origen)
    bloque(6, 7, 9, 'Destino', 'Destinatario', dest)

    // ── Tipo de salida ─────────────────────────────────────────────────────────────────────────────────────────────
    poner(1, 13, 3, 13, 'TIPO DE SALIDA:', { negrita: true })
    alto(14, 18)
    alto(15, 6)
    alto(16, 18)
    poner(1, 14, 3, 14, 'TRASPASO ENTRE ALMACENES', { negrita: true, alinear: 'center' })
    marca(4, 14, datos.tipoSalida === 'Traspaso entre almacenes')
    poner(7, 14, 8, 14, 'VENTA DIRECTA', { negrita: true, alinear: 'center' })
    marca(9, 14, datos.tipoSalida === 'Venta directa')
    poner(1, 16, 1, 16, 'LOCAL', { negrita: true, alinear: 'center' })
    marca(2, 16, hoja.ambito === 'Local')
    poner(3, 16, 3, 16, 'AL INTERIOR', { negrita: true, alinear: 'center' })
    marca(4, 16, hoja.ambito === 'Al interior')
    poner(6, 16, 6, 16, 'NACIONAL', { negrita: true, alinear: 'center' })
    marca(7, 16, hoja.ambito === 'Nacional')
    poner(8, 16, 8, 16, 'EXPORTACION', { negrita: true, alinear: 'center' })
    marca(9, 16, false)

    // ── Mercancía ──────────────────────────────────────────────────────────────────────────────────────────────────
    poner(1, 18, 4, 18, 'DATOS DE LA MERCANCIA:', { negrita: true })
    alto(19, 30)
    const encabezado = { negrita: true, alinear: 'center', ajustar: true }
    poner(1, 19, 1, 19, 'CODIGO', encabezado)
    poner(2, 19, 4, 19, 'DESCRIPCION', encabezado)
    poner(5, 19, 5, 19, 'MARCA', encabezado)
    poner(6, 19, 6, 19, 'MEDIDA', encabezado)
    poner(7, 19, 7, 19, 'PESO POR CAJA KG', encabezado)
    poner(8, 19, 8, 19, 'NUMERO DE CAJAS', encabezado)
    poner(9, 19, 9, 19, 'TOTAL DE KILOS', encabezado)
    for (let c = 1; c <= 9; c++) ws.getCell(`${letra(c)}19`).border = { top: grueso, bottom: grueso, left: c === 1 || c === 2 ? grueso : fino, right: c === 9 ? grueso : fino }
    for (let i = 0; i < FILAS; i++) {
      const f = 20 + i
      const r = hoja.productos[i]
      const vacio = !r
      const rellenoVacio = vacio ? GRIS_CLARO : undefined
      poner(1, f, 1, f, r?.codigo, { alinear: 'center', borde: 'caja' })
      poner(2, f, 4, f, mayus(r?.descripcion), { borde: 'caja', relleno: rellenoVacio })
      poner(5, f, 5, f, mayus(r?.marca), { alinear: 'center', borde: 'caja', relleno: rellenoVacio, ajustar: true, tam: 8 })
      poner(6, f, 6, f, r?.medida, { alinear: 'center', borde: 'caja', relleno: rellenoVacio })
      poner(7, f, 7, f, r?.pesoCaja ?? null, { alinear: 'center', borde: 'caja', relleno: rellenoVacio })
      poner(8, f, 8, f, r?.cajas ?? null, { alinear: 'center', borde: 'caja', relleno: rellenoVacio })
      poner(9, f, 9, f, r ? Number(r.kilos) : null, { negrita: true, alinear: 'center', borde: 'caja', formato: '#,##0.00' })
    }
    const subtotal = hoja.productos.reduce((s, r) => s + Number(r.kilos || 0), 0)
    const filaSub = 20 + FILAS // 42
    poner(9, filaSub, 9, filaSub, 'SUB TOTAL', { negrita: true, alinear: 'center', tam: 8 })
    poner(6, filaSub + 1, 8, filaSub + 1, 'TOTAL DE KILOS ENVIADOS', { negrita: true, alinear: 'right' })
    poner(9, filaSub + 1, 9, filaSub + 1, hoja.productos.length ? totalKilos : 0, { negrita: true, alinear: 'center', borde: 'linea', formato: '#,##0.00' })
    if (hojas.length > 1)
      poner(1, filaSub + 1, 5, filaSub + 1, `Sub total de esta hoja: ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} · Hoja ${indice + 1} de ${hojas.length}`, { tam: 8, color: 'FF5A5A5A' })

    // ── Transporte ─────────────────────────────────────────────────────────────────────────────────────────────────
    let f = filaSub + 3 // 45
    poner(1, f, 1, f, 'NOMBRE:', { negrita: true })
    poner(2, f, 4, f, mayus(t.nombre), { alinear: 'center', borde: 'linea' })
    poner(5, f, 5, f, 'COMPAÑÍA:', { negrita: true, alinear: 'right' })
    poner(6, f, 8, f, mayus(t.compania), { alinear: 'center', borde: 'linea' })
    f += 1
    poner(1, f, 1, f, 'TELEFONO:', { negrita: true })
    poner(2, f, 4, f, t.telefono, { alinear: 'center', borde: 'linea' })
    poner(5, f, 5, f, 'TIPO:', { negrita: true, alinear: 'right' })
    const tt = tipoTelefono(t.tipoTelefono)
    ;[['oficina', 'OFICINA', 6], ['casa', 'CASA', 7], ['movil', 'MOVIL', 8]].forEach(([clave, etiqueta, c]) => {
      marca(c, f, tt === clave)
      poner(c, f + 1, c, f + 1, etiqueta, { negrita: true, alinear: 'center', tam: 8 })
    })
    f += 3
    poner(1, f, 3, f, 'DATOS DEL TRANSPORTE:', { negrita: true })
    f += 1
    poner(1, f, 1, f, 'MODELO:', { negrita: true })
    poner(2, f, 2, f, t.modelo, { alinear: 'center', borde: 'linea' })
    poner(4, f, 4, f, 'MARCA:', { negrita: true, alinear: 'right' })
    poner(5, f, 5, f, mayus(t.marca), { alinear: 'center', borde: 'linea' })
    poner(7, f, 7, f, 'COLOR:', { negrita: true, alinear: 'right' })
    poner(8, f, 8, f, mayus(t.color), { alinear: 'center', borde: 'linea' })
    f += 1
    poner(1, f, 1, f, 'PLACAS DE LA CAJA:', { negrita: true })
    poner(2, f, 3, f, mayus(t.placasCaja), { alinear: 'center', borde: 'linea' })
    poner(5, f, 6, f, 'PLACAS DEL TRACTOR:', { negrita: true, alinear: 'right' })
    poner(7, f, 8, f, mayus(t.placasTractor), { alinear: 'center', borde: 'linea' })
    f += 1
    poner(1, f, 1, f, 'TAMAÑO DE LA CAJA:', { negrita: true })
    poner(2, f, 3, f, t.tamanoCaja, { alinear: 'center', borde: 'linea' })
    poner(5, f, 6, f, 'CAPACIDAD DE LA CAJA (KG):', { negrita: true, alinear: 'right' })
    poner(7, f, 8, f, t.capacidadKg != null ? `${Number(t.capacidadKg).toLocaleString('en-US')} KG` : '', { alinear: 'center', borde: 'linea' })

    // ── Autorizaciones (el nombre sale de Admin → Documentos; la firma se hace a mano) ──────────────────────────────
    f += 2
    poner(1, f, 3, f, 'AUTORIZACIONES:', { negrita: true })
    f += 1
    ;[
      [1, 2, 'DESPACHO:', cfg.Despacho],
      [4, 5, 'REVISO:', cfg.Reviso],
      [7, 8, 'AUTORIZO:', cfg.Autorizo],
    ].forEach(([c1, c2, titulo, nombre]) => {
      poner(c1, f, c1, f, titulo, { negrita: true, tam: 8 })
      poner(c1, f + 1, c2, f + 1, mayus(nombre), { alinear: 'center', borde: 'caja', tam: 8 })
      poner(c1, f + 2, c2, f + 2, 'NOMBRE', { negrita: true, alinear: 'center', borde: 'caja', tam: 8 })
      poner(c1, f + 3, c2, f + 4, '', { borde: 'caja' })
      poner(c1, f + 5, c2, f + 5, 'FIRMA', { negrita: true, alinear: 'center', borde: 'caja', tam: 8 })
    })
    f += 7
    poner(1, f, 2, f, 'OBSERVACIONES:', { negrita: true })
    for (let i = 0; i < 4; i++) poner(3, f + i, 9, f + i, '', { borde: 'linea' })
    ws.pageSetup.printArea = `A1:I${f + 3}`
  })

  const nombre = `${nombreArchivoRequisicion(datos.numero, destino)}.xlsx`
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
