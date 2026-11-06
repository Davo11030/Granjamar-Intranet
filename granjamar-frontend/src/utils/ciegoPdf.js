import { jsPDF } from 'jspdf'
import logoUrl from '../assets/logo-granjamar.png'

// Hoja de Ciego de carga (PDF) con el formato de la hoja que se usaba antes: un recuadro verde con el título y la fecha,
// el logo, el embarque con su destino (la empresa), la sucursal (dónde está ubicada), el transporte y el operador, y la
// tabla con UNA FILA POR TARIMA (producto, cajas, kilos y sucursal) con el total abajo. Las medidas salen de la hoja de
// ejemplo (en px) y se pasan a puntos con S. Si falta algún dato el campo queda en blanco: quien llama avisa antes de
// descargar (ver "faltantes" de la API).
const S = 1.1
const X0 = 35
// TARIMA · PRODUCTO · CAJAS · KG TARIMA · DESTINO
export const COLS = [0, 55, 273, 334, 395, 477].map((v) => X0 + v * S)
const ANCHO = COLS[5] - COLS[0]
const ARRIBA = 40 // donde empieza el recuadro del título
const ALTO_TITULO = 31
const TABLA_Y = 184 // donde empieza la tabla (su encabezado)
const ALTO_ENCABEZADO = 18
export const ALTO_FILA = 16
export const ALTO_DOBLE = 27 // fila con el producto en dos líneas
const ALTO_TOTAL = 27
const ABAJO = 806
// Alto que tienen las filas de tarimas en cada hoja (se reserva siempre el lugar del total).
export const CAPACIDAD = ABAJO - ALTO_TOTAL - 4 - TABLA_Y - ALTO_ENCABEZADO
const AMARILLO = [255, 255, 0]
const VERDE_CLARO = [226, 239, 218]

// Cuando el embarque lleva varios destinos, las filas de cada destino (menos el primero) se tiñen de un color suave para
// distinguirlas a simple vista. Devuelve, para una tarima, el relleno [r, g, b] o null si no se tiñe.
const TINTES = [
  [221, 235, 247], // azul
  [252, 228, 214], // naranja
  [237, 226, 246], // morado
  [255, 242, 204], // amarillo suave
  [226, 239, 218], // verde
]
export const tinteDe = (tarimas) => {
  const grupos = []
  ;(tarimas || []).forEach((t) => {
    if (!grupos.includes(t.grupo)) grupos.push(t.grupo)
  })
  return (t) => {
    const orden = grupos.indexOf(t.grupo)
    return grupos.length > 1 && orden > 0 ? TINTES[(orden - 1) % TINTES.length] : null
  }
}

export const mayus =(t) => (t == null ? '' : String(t).toUpperCase())
// 03/11/2026
export const fechaCorta = (f) => {
  const d = new Date(f)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
// 1000 · 28.5 (como en la hoja: sin separador de miles)
export const sinCeros = (n, dec = 2) => String(Number(Number(n || 0).toFixed(dec)))
export const miles = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const nombreArchivoCiego = (numero) => `Ciego ${numero ?? ''}`.trim()
// El título lleva la fecha al final: "CIEGO DE CARGA GRANJAMAR SUCURSAL ENSENADA 03/11/2026".
export const tituloCiego = (datos) => `${mayus(datos.configuracion?.Titulo)} ${datos.fecha ? fechaCorta(datos.fecha) : ''}`.trim()

// Reparte las filas en hojas: cada hoja admite `capacidad` pt de filas. altoDe(fila) = alto de esa fila.
export const repartirTarimas = (filas, altoDe, capacidad) => {
  const paginas = [[]]
  let usado = 0
  filas.forEach((r) => {
    const h = altoDe(r)
    if (usado + h > capacidad + 0.01 && paginas[paginas.length - 1].length) {
      paginas.push([])
      usado = 0
    }
    paginas[paginas.length - 1].push({ r, h })
    usado += h
  })
  return paginas
}

const cargarImagen = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

// datos = respuesta de GET /Embarques/{id}/ciego-documento. Devuelve el nombre del archivo descargado.
export async function descargarCiegoPdf(datos) {
  const logo = await cargarImagen(logoUrl)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const texto = (valor, x, y, { size = 9, bold = false, align = 'center', maxAncho } = {}) => {
    const v = valor == null ? '' : String(valor)
    if (!v) return
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    let tam = size
    doc.setFontSize(tam)
    // Si no cabe en su casilla se achica la letra (hasta un mínimo) en vez de salirse.
    while (maxAncho && tam > 5.5 && doc.getTextWidth(v) > maxAncho) {
      tam -= 0.25
      doc.setFontSize(tam)
    }
    doc.setTextColor(0)
    doc.text(v, x, y, { align, baseline: 'middle' })
  }
  const rect = (x, y, w, h, { relleno, grosor = 0.6 } = {}) => {
    if (relleno) {
      doc.setFillColor(...relleno)
      doc.rect(x, y, w, h, 'F')
    }
    doc.setDrawColor(0)
    doc.setLineWidth(grosor)
    doc.rect(x, y, w, h, 'S')
  }
  // Una línea con partes en normal y negrita ("DESTINO: " normal + la empresa en negrita), centrada en x.
  const ancho = (partes, tam) =>
    partes.reduce((s, p) => {
      doc.setFont('helvetica', p.b ? 'bold' : 'normal')
      doc.setFontSize(tam)
      return s + doc.getTextWidth(p.t)
    }, 0)
  const lineaMixta = (partes, xc, y, size, maxAncho) => {
    let tam = size
    while (tam > 6 && ancho(partes, tam) > maxAncho) tam -= 0.25
    let x = xc - ancho(partes, tam) / 2
    doc.setTextColor(0)
    partes.forEach((p) => {
      doc.setFont('helvetica', p.b ? 'bold' : 'normal')
      doc.setFontSize(tam)
      doc.text(p.t, x, y, { baseline: 'middle' })
      x += doc.getTextWidth(p.t)
    })
  }
  // Lo que se escribe en la casilla del producto: una línea si cabe; si no, dos con la misma letra (solo si ni así caben se
  // achica un poco). La fila que lleva dos líneas se hace más alta.
  const lineasProducto = (valor) => {
    const v = mayus(valor)
    const max = COLS[2] - COLS[1] - 8
    let tam = 9
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(tam)
    if (doc.getTextWidth(v) <= max) return { lineas: [v], tam }
    let lineas = doc.splitTextToSize(v, max)
    while (lineas.length > 2 && tam > 5.5) {
      tam -= 0.25
      doc.setFontSize(tam)
      lineas = doc.splitTextToSize(v, max)
    }
    return { lineas: lineas.slice(0, 2), tam }
  }
  const altoDe = (r) => (lineasProducto(r.producto).lineas.length > 1 ? ALTO_DOBLE : ALTO_FILA)

  const paginas = repartirTarimas(datos.tarimas || [], altoDe, CAPACIDAD)
  const tinteDeFila = tinteDe(datos.tarimas)

  // Los datos del encabezado: si "DESTINO: … SUCURSAL: …" no cabe en una línea se parten en dos.
  const destino = mayus(datos.destino)
  const sucursal = mayus(datos.sucursal)
  const lineaDestino = [{ t: 'DESTINO: ' }, { t: destino, b: true }, { t: '      SUCURSAL: ' }, { t: sucursal, b: true }]
  const MAX_TEXTO = 380
  const partido = ancho(lineaDestino, 10) > MAX_TEXTO
  const lineas = [
    [{ t: `EMBARQUE # ${datos.numero ?? ''}`, b: true }],
    ...(partido ? [[{ t: 'DESTINO: ' }, { t: destino, b: true }], [{ t: 'SUCURSAL: ' }, { t: sucursal, b: true }]] : [lineaDestino]),
    [{ t: 'TRANSPORTES: ' }, { t: mayus(datos.transportes), b: true }],
    [{ t: 'OPERADOR: ' }, { t: mayus(datos.operador), b: true }],
  ]
  const XC = X0 + 256 * S

  paginas.forEach((pagina, indice) => {
    if (indice > 0) doc.addPage()

    // ── Encabezado ──────────────────────────────────────────────────────────────────────────────────────────────────
    rect(COLS[0], ARRIBA, ANCHO, ALTO_TITULO, { relleno: VERDE_CLARO, grosor: 1.6 })
    texto(tituloCiego(datos), X0 + ANCHO / 2, ARRIBA + ALTO_TITULO / 2, { size: 13, bold: true, maxAncho: ANCHO - 16 })
    doc.addImage(logo, 'PNG', X0 - 3, 78, 82, 74)
    lineas.forEach((partes, i) => lineaMixta(partes, XC, 94 + i * 15.7, 10, MAX_TEXTO))

    // ── Tabla: una fila por tarima ──────────────────────────────────────────────────────────────────────────────────
    let y = TABLA_Y
    ;['TARIMA', 'PRODUCTO', 'CAJAS', 'KG TARIMA', 'DESTINO'].forEach((t, c) => {
      rect(COLS[c], y, COLS[c + 1] - COLS[c], ALTO_ENCABEZADO, { relleno: AMARILLO, grosor: 0.9 })
      texto(t, (COLS[c] + COLS[c + 1]) / 2, y + ALTO_ENCABEZADO / 2, { size: 9, bold: true, maxAncho: COLS[c + 1] - COLS[c] - 4 })
    })
    y += ALTO_ENCABEZADO
    pagina.forEach(({ r, h }) => {
      const tinte = tinteDeFila(r)
      for (let c = 0; c < 5; c++) rect(COLS[c], y, COLS[c + 1] - COLS[c], h, { relleno: tinte, grosor: 0.6 })
      const medio = y + h / 2
      const producto = lineasProducto(r.producto)
      texto(r.tarima, (COLS[0] + COLS[1]) / 2, medio, { size: 9 })
      producto.lineas.forEach((l, i) =>
        texto(l, (COLS[1] + COLS[2]) / 2, producto.lineas.length > 1 ? medio + (i === 0 ? -5.5 : 5.5) : medio, { size: producto.tam }),
      )
      texto(sinCeros(r.cajas), (COLS[2] + COLS[3]) / 2, medio, { size: 9, maxAncho: COLS[3] - COLS[2] - 4 })
      texto(sinCeros(r.kilos), (COLS[3] + COLS[4]) / 2, medio, { size: 9, maxAncho: COLS[4] - COLS[3] - 4 })
      texto(mayus(r.destino), (COLS[4] + COLS[5]) / 2, medio, { size: 9, maxAncho: COLS[5] - COLS[4] - 5 })
      y += h
    })

    // ── Total (en la última hoja) ───────────────────────────────────────────────────────────────────────────────────
    if (indice === paginas.length - 1) {
      y += 4
      rect(COLS[2], y, COLS[3] - COLS[2], ALTO_TOTAL, { relleno: AMARILLO, grosor: 1.6 })
      texto('TOTAL', (COLS[2] + COLS[3]) / 2, y + ALTO_TOTAL / 2, { size: 12, bold: true, maxAncho: COLS[3] - COLS[2] - 4 })
      rect(COLS[3], y, COLS[4] - COLS[3] + 12, ALTO_TOTAL, { relleno: AMARILLO, grosor: 1.6 })
      texto(miles(datos.totalKilos), (COLS[3] + COLS[4] + 12) / 2, y + ALTO_TOTAL / 2, { size: 12, bold: true, maxAncho: COLS[4] - COLS[3] + 6 })
    }

    if (paginas.length > 1) texto(`Hoja ${indice + 1} de ${paginas.length}`, COLS[5], 826, { size: 7, align: 'right' })
  })

  const nombre = `${nombreArchivoCiego(datos.numero)}.pdf`
  doc.save(nombre)
  return nombre
}
