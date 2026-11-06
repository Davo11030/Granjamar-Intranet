import { jsPDF } from 'jspdf'
import { importeConLetra } from './numeroALetras'

// Remisión-Traslado (RT) en PDF. La primera hoja NO lleva el formato: se imprime sobre la hoja ya impresa y enumerada (carta,
// 612 × 792 pt), así que aquí solo van los datos variables, colocados donde cae cada campo de ese formato (medidas tomadas
// de una RT ya impresa y escaneada). Al PDF se le anexan, a partir de la segunda hoja, los documentos (pedimentos y
// facturas) que se seleccionaron en la pantalla del RT, en el orden de los productos. Hay que imprimirlo al 100 % (tamaño
// real, sin "ajustar a la página"); si la hoja queda desfasada se corrige en Admin → Documentos (ajuste horizontal/vertical).
export const PAGINA = [612, 792]

// Posiciones (pt, línea base del texto) en la hoja impresa.
const X_TEXTO = 92.9 // donde empieza la descripción y todo lo escrito a la izquierda
const X_CANT = 64.6 // centro de la columna de cantidad
const X_PRECIO = 478.1 // borde derecho del precio unitario
const X_IMPORTE = 564.4 // borde derecho del importe
const X_SIGNO_PRECIO = 420.8
const X_SIGNO_IMPORTE = 487.8
const Y_PRIMER_PRODUCTO = 187.2
const Y_ULTIMA_LINEA = 478.5 // la última línea de producto no pasa de aquí (abajo sigue el total en kilos)
const PASO_PRODUCTO = 39.7 // de un producto al siguiente
const PASO_LINEA = 14.2 // del producto a su línea de pedimentos
const ANCHO_PEDIMENTOS = 318 // hasta donde llega el texto antes de la columna del precio

const mayus = (t) => (t == null ? '' : String(t).toUpperCase())
const miles = (n, dec = 2, min = dec) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: min, maximumFractionDigits: dec })
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
// 04-nov-26
export const fechaRt = (f) => {
  const d = new Date(f)
  return `${String(d.getDate()).padStart(2, '0')}-${MESES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`
}
// RT-236 (con varios destinos: RT-236 - Destino 1)
export const nombreArchivoRt = (numero, destino) => `RT-${numero ?? ''}${destino ? ` - ${destino}` : ''}`.trim()

// Lo que se anexa, por tipo de archivo.
const esPdf = (tipo) => /pdf/i.test(tipo || '')
const esPng = (tipo) => /png/i.test(tipo || '')
const esJpg = (tipo) => /jpe?g/i.test(tipo || '')

// Reparte los productos en la columna de la hoja: cada uno ocupa su renglón (+ las líneas de pedimentos) al paso de la hoja
// impresa. Si no caben, se junta el espacio entre productos (hasta un mínimo) y, si ni así, se achica la letra. Devuelve la
// línea base de cada producto, el factor de tamaño (1 = normal) y el paso entre líneas de pedimentos.
export function repartirProductos(productos, medirLineas) {
  const lineas = productos.map((p) => Math.max(1, medirLineas(p)))
  const n = lineas.length
  const disponible = Y_ULTIMA_LINEA - Y_PRIMER_PRODUCTO // de la primera línea base a la última permitida
  const GAP_NORMAL = PASO_PRODUCTO - PASO_LINEA // de la última línea de un producto al siguiente producto
  const GAP_MINIMO = 10.5
  const suma = lineas.reduce((s, l) => s + l * PASO_LINEA, 0)
  let factor = 1
  let gap = GAP_NORMAL
  if (n > 1 && suma + (n - 1) * GAP_NORMAL > disponible) {
    if (suma + (n - 1) * GAP_MINIMO <= disponible) gap = (disponible - suma) / (n - 1)
    else {
      factor = Math.max(0.6, (disponible - (n - 1) * GAP_MINIMO) / suma)
      gap = GAP_MINIMO
    }
  }
  const posiciones = []
  let y = Y_PRIMER_PRODUCTO
  lineas.forEach((l) => {
    posiciones.push(y)
    y += l * PASO_LINEA * factor + gap
  })
  return { posiciones, factor, lineasPaso: PASO_LINEA * factor }
}

// datos = respuesta de GET /Embarques/{id}/rt-documento.
// obtenerArchivo(idDocumento) → { datos: ArrayBuffer, tipo } (el archivo del documento que se anexa).
// Devuelve { nombre, sinAnexar: [texto, …] }.
export async function descargarRtPdf(datos, destino, obtenerArchivo) {
  const cfg = datos.configuracion || {}
  const ax = Number(cfg.AjusteX) || 0
  const ay = Number(cfg.AjusteY) || 0
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })

  const texto = (valor, x, y, { size = 8, bold = false, italic = false, align = 'left', maxAncho } = {}) => {
    const v = valor == null ? '' : String(valor)
    if (!v) return
    doc.setFont('helvetica', bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal')
    let tam = size
    doc.setFontSize(tam)
    // Si no cabe en su espacio se achica la letra (hasta un mínimo) en vez de pasarse de la línea.
    while (maxAncho && tam > 5.5 && doc.getTextWidth(v) > maxAncho) {
      tam -= 0.25
      doc.setFontSize(tam)
    }
    doc.setTextColor(0)
    doc.text(v, x + ax, y + ay, { align, baseline: 'alphabetic' })
  }
  const c = datos.cliente || {}

  // ── Encabezado: fecha, cliente, dirección y ciudad ───────────────────────────────────────────────────────────────────
  texto(datos.fecha ? fechaRt(datos.fecha) : '', 492, 105.5, { size: 8.6, bold: true, align: 'center' })
  texto(mayus(c.nombre), X_TEXTO, 127.8, { size: 8, bold: true, maxAncho: 315 })
  texto(mayus(c.rfc), 492.7, 125.3, { size: 8.4, bold: true, align: 'center', maxAncho: 84 })
  texto(mayus(c.direccion), X_TEXTO, 139.7, { size: 8, bold: true, maxAncho: 315 })
  texto(mayus(c.ciudad), X_TEXTO, 152.6, { size: 8.4, bold: true, maxAncho: 205 })
  texto(c.codigoPostal, 321.5, 152.6, { size: 8.4, bold: true, maxAncho: 40 })

  // ── Productos ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const productos = datos.productos || []
  const lineasDe = (p) => {
    const t = (p.documentos || []).join(', ')
    if (!t) return 1
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    return doc.splitTextToSize(t, ANCHO_PEDIMENTOS).length
  }
  const reparto = repartirProductos(productos, lineasDe)
  const tam = Math.max(5.5, 8 * reparto.factor)
  productos.forEach((p, i) => {
    const y = reparto.posiciones[i]
    texto(miles(p.kilos, 2, 0), X_CANT, y, { size: tam, bold: true, align: 'center', maxAncho: 44 })
    texto(mayus(p.descripcion), X_TEXTO, y, { size: tam, bold: true, maxAncho: 318 })
    texto('$', X_SIGNO_PRECIO, y, { size: tam })
    texto(miles(p.precio), X_PRECIO, y, { size: tam, align: 'right' })
    texto('$', X_SIGNO_IMPORTE, y, { size: tam })
    texto(miles(p.importe), X_IMPORTE, y, { size: tam, align: 'right', maxAncho: 55 })
    const t = (p.documentos || []).join(', ')
    if (t) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(tam)
      doc.splitTextToSize(t, ANCHO_PEDIMENTOS).forEach((l, k) => texto(l, X_TEXTO, y + reparto.lineasPaso * (k + 1), { size: tam, italic: true }))
    }
  })

  // ── Total en kilos y domicilio de origen ─────────────────────────────────────────────────────────────────────────────
  texto(miles(datos.totalKilos, 2, 0), X_CANT, 488.5, { size: 8.4, bold: true, align: 'center', maxAncho: 44 })
  texto('KG', X_TEXTO, 488.5, { size: 8.4, bold: true })
  texto('DOMICILIO ORIGEN:', X_TEXTO, 502.2, { size: 8.4, bold: true })
  texto(mayus(cfg.OrigenNombre), 93.2, 515.9, { size: 7.8, italic: true })
  texto(mayus(cfg.OrigenRfc), 258.5, 515.9, { size: 7.8, italic: true })
  texto(mayus(cfg.OrigenCalle), 93.2, 529.5, { size: 7.8, italic: true, maxAncho: 340 })
  texto(mayus(cfg.OrigenCiudad), 93.2, 541, { size: 7.8, italic: true, maxAncho: 190 })
  // El código postal va después de la ciudad (a más tardar donde lo lleva la hoja de ejemplo).
  const finCiudad = 93.2 + doc.getTextWidth(mayus(cfg.OrigenCiudad))
  texto(cfg.OrigenCp ? `CP ${cfg.OrigenCp}` : '', Math.max(203.4, finCiudad + 14), 540.7, { size: 7.8, italic: true })

  // ── Clave SAT: kilos, descripción e importe de cada una, y el total ──────────────────────────────────────────────────
  texto('CLAVE SAT:', 93.2, 563.8, { size: 8.4, bold: true })
  const claves = datos.claves || []
  const paso = Math.min(13.9, (634.5 - 578.9) / Math.max(1, claves.length))
  claves.forEach((k, i) => {
    const y = 578.9 + i * paso
    texto(miles(k.kilos, 2, 0), X_CANT, y, { size: 8, align: 'center', maxAncho: 44 })
    texto(`${k.codigo ?? ''} ${mayus(k.nombre)}`.trim(), 93.2, y, { size: 8, italic: true, maxAncho: 240 })
    texto('$', 339.8, y, { size: 8 })
    texto(miles(k.importe), 411.8, y, { size: 8, align: 'right' })
  })
  const yTotal = 578.9 + claves.length * paso
  texto(miles(datos.totalKilos, 2, 0), X_CANT, yTotal, { size: 8, bold: true, align: 'center', maxAncho: 44 })
  texto('$', 339.8, yTotal, { size: 8, bold: true })
  texto(miles(datos.total), 411.8, yTotal, { size: 8, bold: true, align: 'right' })

  // ── Importe con letra (debajo del rótulo "IMPORTE CON LETRA", ya impreso) y total ─────────────────────────────────────
  const letra = importeConLetra(datos.total)
  const MAX_LETRA = 338
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.8)
  if (doc.getTextWidth(letra) <= MAX_LETRA) texto(letra, 40, 660.3, { size: 7.8, italic: true })
  else {
    let t = 7
    doc.setFontSize(t)
    let partes = doc.splitTextToSize(letra, MAX_LETRA)
    while (partes.length > 2 && t > 5.5) {
      t -= 0.25
      doc.setFontSize(t)
      partes = doc.splitTextToSize(letra, MAX_LETRA)
    }
    partes.slice(0, 2).forEach((l, i) => texto(l, 40, 656.3 + i * 7.4, { size: t, italic: true }))
  }
  texto('$', X_SIGNO_IMPORTE + 3, 656, { size: 9, bold: true })
  texto(miles(datos.total), X_IMPORTE + 1, 656, { size: 9, bold: true, align: 'right', maxAncho: 70 })

  // ── Se arma el archivo: la hoja del RT + los documentos seleccionados ─────────────────────────────────────────────────
  const nombre = `${nombreArchivoRt(datos.numero, destino)}.pdf`
  const sinAnexar = []
  let bytes = new Uint8Array(doc.output('arraybuffer'))
  const anexos = (datos.anexos || []).filter((a) => a.tieneArchivo)
  if (anexos.length > 0 && obtenerArchivo) {
    const { PDFDocument } = await import('pdf-lib')
    const principal = await PDFDocument.load(bytes)
    for (const a of anexos) {
      try {
        const { datos: contenido, tipo } = await obtenerArchivo(a.idDocumento)
        const tipoReal = tipo || a.archivoTipo
        if (esPdf(tipoReal)) {
          const origen = await PDFDocument.load(contenido, { ignoreEncryption: true })
          const paginas = await principal.copyPages(origen, origen.getPageIndices())
          paginas.forEach((p) => principal.addPage(p))
        } else if (esPng(tipoReal) || esJpg(tipoReal)) {
          const imagen = esPng(tipoReal) ? await principal.embedPng(contenido) : await principal.embedJpg(contenido)
          const pagina = principal.addPage(PAGINA)
          const margen = 24
          const escala = Math.min((PAGINA[0] - margen * 2) / imagen.width, (PAGINA[1] - margen * 2) / imagen.height)
          const ancho = imagen.width * escala
          const alto = imagen.height * escala
          pagina.drawImage(imagen, { x: (PAGINA[0] - ancho) / 2, y: (PAGINA[1] - alto) / 2, width: ancho, height: alto })
        } else sinAnexar.push(`${a.etiqueta}: tipo de archivo no compatible`)
      } catch {
        sinAnexar.push(`${a.etiqueta}: no se pudo leer el archivo`)
      }
    }
    bytes = await principal.save()
  }

  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { nombre, sinAnexar }
}
