import { jsPDF } from 'jspdf'
import logoUrl from '../assets/logo-granjamar.png'

// Hoja de Solicitud de embarque (PDF) con el formato de la hoja que se usaba antes: arriba el embarque, el logo, la fecha
// y el transporte; un bloque por DESTINO (recuadro oscuro con a quién va, encabezado con a dónde, y sus productos con
// kilos, descripción, tarimas y lotes); los totales; y los datos del operador y del tractocamión. Las medidas están en
// los píxeles de la hoja de ejemplo (A4 a 130 dpi) y se pasan a puntos con ESC. Si falta algún dato el campo queda en
// blanco: quien llama avisa antes de descargar (ver "faltantes" de la API).
const ESC = 72 / 130
const COLS = [62, 162, 292, 578, 702, 967] // código · kilos · descripción · tarimas · lotes y/o especificaciones
const ARRIBA = 357 // donde empieza el primer bloque (su recuadro oscuro)
const ABAJO = 1020 // donde termina la tabla (aquí van los totales)
const ALTO_TABLA = ABAJO - ARRIBA
const ALTO_ETIQUETA = 31 // recuadro oscuro del destinatario
const ALTO_ENCABEZADO = 29 // CODIGO | destino | TARIMAS | LOTES…
const ALTO = 26.2 // renglón normal
const ALTO_DOBLE = 40 // renglón con texto en dos líneas
const OSCURO = [37, 37, 37]
const AZUL = [95, 211, 255]
const VERDE = [0, 128, 0]

const miles = (n, dec = 2, min = dec) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: min, maximumFractionDigits: dec })
const mayus = (t) => (t == null ? '' : String(t).toUpperCase())
// 04/11/2026
const fechaCorta = (f) => {
  const d = new Date(f)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const cargarImagen = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

export const nombreArchivoSolicitud = (numero) => `Solicitud ${numero ?? ''}`.trim()

// datos = respuesta de GET /Embarques/{id}/solicitud-documento. Devuelve el nombre del archivo descargado.
export async function descargarSolicitudPdf(datos) {
  const logo = await cargarImagen(logoUrl)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const cfg = datos.configuracion || {}
  const t = datos.transporte || {}

  const px = (v) => v * ESC
  const texto = (valor, x, y, { size = 9, bold = false, align = 'center', color = [0, 0, 0], maxAncho } = {}) => {
    const v = valor == null ? '' : String(valor)
    if (!v) return
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    let tam = size
    doc.setFontSize(tam)
    // Si no cabe en su casilla se achica la letra (hasta un mínimo) en vez de salirse.
    while (maxAncho && tam > 5.5 && doc.getTextWidth(v) > px(maxAncho)) {
      tam -= 0.25
      doc.setFontSize(tam)
    }
    doc.setTextColor(...color)
    doc.text(v, px(x), px(y), { align, baseline: 'middle' })
  }
  const rect = (x, y, w, h, { relleno, grosor = 0.6 } = {}) => {
    if (relleno) {
      doc.setFillColor(...relleno)
      doc.rect(px(x), px(y), px(w), px(h), 'F')
    }
    doc.setDrawColor(0)
    doc.setLineWidth(grosor)
    doc.rect(px(x), px(y), px(w), px(h), 'S')
  }
  const linea = (x1, y1, x2, y2, grosor = 0.6) => {
    doc.setDrawColor(0)
    doc.setLineWidth(grosor)
    doc.line(px(x1), px(y1), px(x2), px(y2))
  }

  // Lo que se escribe en una casilla: una línea si cabe; si no, dos líneas con la misma letra (solo si ni así caben se
  // achica un poco). El renglón que lleva dos líneas se hace más alto.
  const lineasCelda = (valor, ancho, tam, negrita) => {
    const v = valor == null ? '' : String(valor)
    doc.setFont('helvetica', negrita ? 'bold' : 'normal')
    let t2 = tam
    doc.setFontSize(t2)
    if (doc.getTextWidth(v) <= px(ancho)) return { lineas: [v], tam: t2 }
    let lineas = doc.splitTextToSize(v, px(ancho))
    while (lineas.length > 2 && t2 > 5.5) {
      t2 -= 0.25
      doc.setFontSize(t2)
      lineas = doc.splitTextToSize(v, px(ancho))
    }
    return { lineas: lineas.slice(0, 2), tam: t2 }
  }
  // Texto de un recuadro (destinatario, destino, transporte) de `alto` px: una línea si cabe y, si no, dos líneas con una
  // letra que quepa en el alto del recuadro (y que no parta ninguna palabra).
  const textoCaja = (valor, x, yMedio, ancho, alto, { size, bold = false, color = [0, 0, 0] }) => {
    const v = valor == null ? '' : String(valor)
    if (!v) return
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    if (doc.getTextWidth(v) <= px(ancho)) return texto(v, x, yMedio, { size, bold, color })
    let tam = Math.min(size, (alto * ESC) / 2.4)
    let lineas
    for (;;) {
      doc.setFontSize(tam)
      lineas = doc.splitTextToSize(v, px(ancho))
      const palabraLarga = v.split(' ').some((w) => doc.getTextWidth(w) > px(ancho))
      if ((lineas.length <= 2 && !palabraLarga) || tam <= 5) break
      tam -= 0.25
    }
    const sep = (tam * 0.6) / ESC
    lineas.slice(0, 2).forEach((l, i) => texto(l, x, lineas.length > 1 ? yMedio + (i === 0 ? -sep : sep) : yMedio, { size: tam, bold, color }))
  }
  const celdasDe = (r) => ({
    descripcion: lineasCelda(mayus(r.descripcion), COLS[3] - COLS[2] - 12, 9, true),
    lotes: lineasCelda(mayus(r.lotes), COLS[5] - COLS[4] - 12, 9.5, true),
  })
  const altoDe = (r) => (Object.values(celdasDe(r)).some((c) => c.lineas.length > 1) ? ALTO_DOBLE : ALTO)

  // ── Reparto de los destinos en hojas: cada hoja tiene el mismo alto de tabla; un bloque lleva su recuadro oscuro y su
  // encabezado, y si sus productos no caben sigue en la hoja siguiente (repitiendo el encabezado).
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
    const primero = d.productos.length ? altoDe(d.productos[0]) : ALTO
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

  paginas.forEach((pag, indice) => {
    if (indice > 0) doc.addPage()

    // ── Encabezado ──────────────────────────────────────────────────────────────────────────────────────────────────
    rect(162, 200, 130, 122, { grosor: 1.3 })
    linea(162, 235, 292, 235, 1.3)
    texto('EMBARQUE', 227, 218, { size: 10.5, bold: true, maxAncho: 120 })
    texto(datos.numero, 227, 280, { size: 32, maxAncho: 104 })
    doc.addImage(logo, 'PNG', px(480), px(207), px(123), px(111))
    texto(cfg.Titulo, 535, 339, { size: 10.5, bold: true, maxAncho: 280 })
    rect(818, 200, 149, 70, { grosor: 1.3 })
    linea(818, 232, 967, 232, 1.3)
    texto('FECHA', 892.5, 216, { size: 11, bold: true })
    texto(datos.fecha ? fechaCorta(datos.fecha) : '', 892.5, 251, { size: 13 })
    rect(818, 296, 149, 62, { grosor: 1.3 })
    linea(818, 317, 967, 317, 1.3)
    texto('TRANSPORTES', 892.5, 307, { size: 9.5 })
    textoCaja(mayus(datos.transportes), 892.5, 338, 138, 41, { size: 10.5, bold: true })

    // ── Un bloque por destino ───────────────────────────────────────────────────────────────────────────────────────
    const libre = ALTO_TABLA - pag.usado
    const vacios = Math.floor(libre / ALTO)
    let y = ARRIBA
    pag.grupos.forEach((g, gi) => {
      rect(162, y, 130, ALTO_ETIQUETA, { relleno: OSCURO, grosor: 0.6 })
      textoCaja(mayus(g.destino.empresa), 227, y + ALTO_ETIQUETA / 2, 120, ALTO_ETIQUETA, { size: 9.5, color: [255, 255, 255] })
      y += ALTO_ETIQUETA
      // Encabezado de la tabla.
      COLS.slice(0, -1).forEach((x, c) => rect(x, y, COLS[c + 1] - x, ALTO_ENCABEZADO, { grosor: 0.9 }))
      const medioEnc = y + ALTO_ENCABEZADO / 2
      texto('CODIGO', (COLS[0] + COLS[1]) / 2, medioEnc, { size: 8, bold: true, maxAncho: 94 })
      textoCaja(mayus(g.destino.etiqueta), (COLS[1] + COLS[2]) / 2, medioEnc, 120, ALTO_ENCABEZADO, { size: 9.5, bold: true })
      texto('TARIMAS', (COLS[3] + COLS[4]) / 2, medioEnc, { size: 8.6, bold: true })
      texto('LOTES Y/O ESPECIFICACIONES', (COLS[4] + COLS[5]) / 2, medioEnc, { size: 7.8, bold: true, maxAncho: 255 })
      y += ALTO_ENCABEZADO

      // Renglones con producto y, con el alto que sobra, los vacíos (repartidos entre los bloques de la hoja).
      g.filas.forEach(({ r, h }) => {
        const celdas = celdasDe(r)
        COLS.slice(0, -1).forEach((x, c) => rect(x, y, COLS[c + 1] - x, h, { grosor: 0.6 }))
        const medio = y + h / 2
        const enCelda = (celda, x, bold) =>
          celda.lineas.forEach((l, i) => texto(l, x, celda.lineas.length > 1 ? medio + (i === 0 ? -9 : 9) : medio, { size: celda.tam, bold }))
        texto(r.codigo, (COLS[0] + COLS[1]) / 2, medio, { size: 9, maxAncho: 94 })
        texto(miles(r.kilos, 2, 0), (COLS[1] + COLS[2]) / 2, medio, { size: 10, bold: true, maxAncho: 122 })
        enCelda(celdas.descripcion, (COLS[2] + COLS[3]) / 2, true)
        texto(r.tarimas, (COLS[3] + COLS[4]) / 2, medio, { size: 10, bold: true, maxAncho: 118 })
        enCelda(celdas.lotes, (COLS[4] + COLS[5]) / 2, true)
        y += h
      })
      const enEste = gi === pag.grupos.length - 1 ? vacios - Math.floor(vacios / pag.grupos.length) * (pag.grupos.length - 1) : Math.floor(vacios / pag.grupos.length)
      const hVacio = vacios > 0 ? libre / vacios : ALTO
      for (let i = 0; i < enEste; i++) {
        COLS.slice(0, -1).forEach((x, c) => rect(x, y, COLS[c + 1] - x, hVacio, { grosor: 0.6 }))
        y += hVacio
      }
    })

    // ── Totales (en la última hoja) ────────────────────────────────────────────────────────────────────────────────
    if (indice === paginas.length - 1) {
      rect(162, ABAJO, 130, 32, { grosor: 1.5 })
      texto(miles(datos.totalKilos), 227, ABAJO + 16.5, { size: 14, bold: true, maxAncho: 122 })
      rect(578, ABAJO, 125, 32, { grosor: 1.5 })
      texto(String(datos.totalTarimas ?? 0), 640.5, ABAJO + 16.5, { size: 20, bold: true, maxAncho: 118 })
      rect(703, ABAJO, 117, 32, { grosor: 1.5 })
      texto('TARIMAS', 761.5, ABAJO + 16.5, { size: 10, bold: true })
    }

    // ── Operador y tractocamión ────────────────────────────────────────────────────────────────────────────────────
    rect(401, 1132, 303, 132, { relleno: AZUL, grosor: 1.6 })
    ;[
      `OP. ${mayus(t.operador)}`,
      `TRACTO: ${mayus(t.tracto)}`,
      `PLACAS: ${mayus(t.placasTractor)}`,
      `CAJA: ${mayus(t.placasCaja)}`,
      `CELULAR: ${t.celular ?? ''}`,
      `SELLO SEGURIDAD: ${mayus(t.sellos)}`,
    ].forEach((l, i) => texto(l, 405, 1144 + i * 21, { size: 8.5, align: 'left', color: VERDE, maxAncho: 294 }))
    linea(162, 1338, 291, 1338, 1)

    if (paginas.length > 1) texto(`Hoja ${indice + 1} de ${paginas.length}`, 967, 1400, { size: 7, align: 'right', color: [90, 90, 90] })
  })

  const nombre = `${nombreArchivoSolicitud(datos.numero)}.pdf`
  doc.save(nombre)
  return nombre
}
