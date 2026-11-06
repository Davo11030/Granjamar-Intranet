import { jsPDF } from 'jspdf'
import logoUrl from '../assets/logo-granjamar.png'

// Hoja de Requisición de un embarque (PDF), con el formato de la hoja que se usaba antes. Las medidas están en los
// píxeles de la hoja de ejemplo (renderizada a 130 dpi) y se pasan a puntos con ESC. Si falta algún dato el campo queda
// en blanco: quien llama avisa antes de descargar (ver "faltantes" de la API).
const ESC = 72 / 130
// La tabla de mercancía mide lo mismo siempre (22 renglones normales); un renglón con texto largo se hace más alto
// (dos líneas) y le quita su lugar a los renglones vacíos, sin invadir el de abajo ni mover lo demás de la hoja.
const ALTO_RENGLON = 19.4
const ALTO_RENGLON_DOBLE = 28
const ALTO_TABLA = 22 * ALTO_RENGLON
// Límites (en px de la hoja) de las 7 columnas: código, descripción, marca, medida, peso por caja, cajas y kilos.
const COLS = [57, 152, 452, 635, 715, 807, 907, 1017]
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const AZUL = [47, 85, 151]
const AZUL_CLARO = [31, 107, 176]
const GRIS = [242, 242, 242]
const GRIS_CAJA = [217, 217, 217]

// 09-oct-26
const fechaCorta = (f) => {
  const d = new Date(f)
  return `${String(d.getDate()).padStart(2, '0')}-${MESES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`
}
const miles = (n, dec = 2) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const sinCeros = (n) => String(Number(Number(n || 0).toFixed(2)))
const mayus = (t) => (t == null ? '' : String(t).toUpperCase())

// "Oficina" | "Casa" | "Móvil" según el tipo de teléfono guardado (celular = móvil).
const tipoTelefono = (t) => {
  const v = String(t || '').toLowerCase()
  if (!v) return null
  if (v.includes('ofic')) return 'oficina'
  if (v.includes('casa')) return 'casa'
  return 'movil'
}

const cargarImagen = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

export const nombreArchivoRequisicion = (numero, destino) => `Requisision ${numero ?? ''}${destino ? ` - ${destino}` : ''}`.trim()

// datos = respuesta de GET /Embarques/{id}/requisicion. Devuelve el nombre del archivo descargado.
export async function descargarRequisicionPdf(datos, destino) {
  const logo = await cargarImagen(logoUrl)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const px = (v) => v * ESC
  const texto = (t, x, y, { size = 7, bold = false, align = 'left', color = [0, 0, 0], maxAncho } = {}) => {
    const valor = t == null ? '' : String(t)
    if (!valor) return
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    let tam = size
    doc.setFontSize(tam)
    // Si no cabe en su casilla se achica la letra (hasta un mínimo) en vez de salirse.
    while (maxAncho && tam > 4 && doc.getTextWidth(valor) > px(maxAncho)) {
      tam -= 0.25
      doc.setFontSize(tam)
    }
    doc.setTextColor(...color)
    doc.text(valor, px(x), px(y), { align, baseline: 'middle' })
  }
  // La letra más grande (hasta 6.5) en que TODOS los valores de una columna caben en su casilla: así la columna entera
  // lleva la misma tipografía en vez de un renglón en letra diminuta junto a otros normales.
  const tamColumna = (valores, ancho) => {
    doc.setFont('helvetica', 'normal')
    let tam = 6.5
    while (tam > 4.5 && valores.some((v) => (doc.setFontSize(tam), doc.getTextWidth(v || '') > px(ancho)))) tam -= 0.25
    return tam
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

  const t = datos.transporte || {}
  const cfg = datos.configuracion || {}
  const destino_ = datos.destino || {}
  const paginasOrigen = datos.paginas?.length ? datos.paginas : [{ origen: {}, productos: [], ambito: null }]
  const totalKilos = paginasOrigen.reduce((s, p) => s + p.productos.reduce((k, r) => k + Number(r.kilos || 0), 0), 0)

  // Una página por lugar de origen; si trae más de 22 productos sigue en otra página (con su propio subtotal).
  // Lo que se escribe en una casilla: una línea si cabe (a 6.5), si no dos líneas con la misma letra (y solo si ni así
  // caben, se achica un poco la letra).
  const lineasCelda = (valor, ancho) => {
    const texto2 = valor == null ? '' : String(valor)
    doc.setFont('helvetica', 'normal')
    let tam = 6.5
    doc.setFontSize(tam)
    if (doc.getTextWidth(texto2) <= px(ancho)) return { lineas: [texto2], tam }
    let lineas = doc.splitTextToSize(texto2, px(ancho))
    while (lineas.length > 2 && tam > 4.5) {
      tam -= 0.25
      doc.setFontSize(tam)
      lineas = doc.splitTextToSize(texto2, px(ancho))
    }
    return { lineas: lineas.slice(0, 2), tam }
  }
  const celdasDe = (r) => ({
    descripcion: lineasCelda(mayus(r.descripcion), COLS[2] - COLS[1] - 8),
    marca: lineasCelda(mayus(r.marca), COLS[3] - COLS[2] - 8),
  })
  const altoDe = (r) => (Object.values(celdasDe(r)).some((c) => c.lineas.length > 1) ? ALTO_RENGLON_DOBLE : ALTO_RENGLON)
  const hojas = paginasOrigen.flatMap((p) => {
    const trozos = []
    let actual = []
    let usado = 0
    for (const r of p.productos) {
      const h = altoDe(r)
      if (actual.length && usado + h > ALTO_TABLA + 0.01) {
        trozos.push({ ...p, productos: actual })
        actual = []
        usado = 0
      }
      actual.push(r)
      usado += h
    }
    trozos.push({ ...p, productos: actual })
    return trozos
  })

  hojas.forEach((hoja, indice) => {
    if (indice > 0) doc.addPage()

    // Marco, logo y título.
    rect(47, 123, 980, 1188, { grosor: 1.2 })
    doc.addImage(logo, 'PNG', px(75), px(127), px(95), px(85))
    texto(cfg.Titulo, 537, 139, { size: 13.5, bold: true, align: 'center', color: AZUL })
    texto(cfg.Subtitulo, 542, 163, { size: 8.5, bold: true, align: 'center', color: AZUL_CLARO })
    texto('FECHA:', 801, 180, { size: 6.5, bold: true, align: 'right' })
    texto(datos.fecha ? fechaCorta(datos.fecha) : '', 857, 180, { size: 7, align: 'center' })
    linea(803, 187, 910, 187)
    texto('NUMERO DE EMBARQUE:', 907, 218, { size: 6.5, bold: true, align: 'right' })
    rect(912, 202, 105, 33)
    texto(datos.numero, 964, 219, { size: 15, align: 'center', maxAncho: 95 })

    // Origen y destino.
    // Origen y destino con UNA misma letra: la más grande en que todo cabe en su recuadro (la dirección en máximo dos
    // renglones), para que no haya renglones o bloques con tipografías distintas.
    const origen = hoja.origen || {}
    const lineaCiudad = (l) => [l.municipio, l.estado].filter(Boolean).map(mayus).join(', ')
    const cabe = (tam) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(tam)
      return [origen, destino_].every(
        (l) =>
          [lineaCiudad(l), l.empresa, l.rfc].every((t) => doc.getTextWidth(t || '') <= px(312)) &&
          doc.splitTextToSize(l.direccion || '', px(312)).length <= 2,
      )
    }
    let tamBloque = 6.5
    while (tamBloque > 4.5 && !cabe(tamBloque)) tamBloque -= 0.25

    const bloque = (x0, titulo, lugar, rol) => {
      texto('# Segmento o Cliente', x0 + 1, 234, { size: 5.4, bold: true })
      rect(x0 + 106, 235, 107, 15)
      texto(lugar.segmento, x0 + 106 + 53.5, 243, { size: 7, align: 'center', maxAncho: 100 })
      texto(`${titulo}:`, x0, 259, { size: 6, bold: true })
      texto(`${rol}:`, x0, 276, { size: 6, bold: true })
      texto('RFC:', x0, 293, { size: 6, bold: true })
      texto('Direccion:', x0, 309, { size: 6, bold: true })
      rect(x0 + 106, 250, 320, 84, { relleno: GRIS_CAJA })
      const xv = x0 + 108
      texto(lineaCiudad(lugar), xv, 259, { size: tamBloque })
      texto(lugar.empresa, xv, 276, { size: tamBloque })
      texto(lugar.rfc, xv, 293, { size: tamBloque })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(tamBloque)
      doc.splitTextToSize(lugar.direccion || '', px(312)).slice(0, 2).forEach((p, i) => texto(p, xv, 309 + i * 17, { size: tamBloque }))
    }
    bloque(59, 'Origen', origen, 'Remitente')
    bloque(593, 'Destino', destino_, 'Destinatario')

    // Tipo de salida.
    texto('TIPO DE SALIDA:', 59, 358, { size: 6.5, bold: true })
    const marca = (x, activo) => {
      rect(x, 383, 107, 18)
      if (activo) texto('X', x + 53, 392, { size: 7, bold: true, align: 'center' })
    }
    const marca2 = (x, activo) => {
      rect(x, 417, 107, 18)
      if (activo) texto('X', x + 53, 426, { size: 7, bold: true, align: 'center' })
    }
    texto('TRASPASO ENTRE ALMACENES', 145, 392, { size: 6, bold: true })
    marca(378, datos.tipoSalida === 'Traspaso entre almacenes')
    texto('VENTA DIRECTA', 805, 392, { size: 6, bold: true, align: 'center' })
    marca(909, datos.tipoSalida === 'Venta directa')
    texto('LOCAL', 112, 426, { size: 6, bold: true, align: 'center' })
    marca2(165, hoja.ambito === 'Local')
    texto('AL INTERIOR', 296, 426, { size: 6, bold: true })
    marca2(378, hoja.ambito === 'Al interior')
    texto('NACIONAL', 645, 426, { size: 6, bold: true, align: 'center' })
    marca2(697, hoja.ambito === 'Nacional')
    texto('EXPORTACION', 823, 426, { size: 6, bold: true })
    marca2(909, false)

    // Mercancía.
    texto('DATOS DE LA MERCANCIA:', 59, 451, { size: 6.5, bold: true })
    const cols = COLS
    rect(57, 468, 960, 32, { grosor: 1.2 })
    cols.slice(1, -1).forEach((x) => linea(x, 468, x, 500, 1))
    ;[['CODIGO', 0], ['DESCRIPCION', 1], ['MARCA', 2], ['MEDIDA', 3], ['NUMERO DE CAJAS', 5], ['TOTAL DE KILOS', 6]].forEach(([t2, i]) =>
      texto(t2, (cols[i] + cols[i + 1]) / 2, 484, { size: 6.5, bold: true, align: 'center', maxAncho: cols[i + 1] - cols[i] - 4 }),
    )
    texto('PESO POR CAJA', (cols[4] + cols[5]) / 2, 476, { size: 6, bold: true, align: 'center', maxAncho: cols[5] - cols[4] - 4 })
    texto('KG', (cols[4] + cols[5]) / 2, 492, { size: 6, bold: true, align: 'center' })

    // Renglones con producto (más altos si su texto va en dos líneas) y, con el alto que sobra, los vacíos.
    let y = 501
    hoja.productos.forEach((r) => {
      const celdas = celdasDe(r)
      const h = altoDe(r)
      cols.slice(0, -1).forEach((x, c) => rect(x, y, cols[c + 1] - x, h, { grosor: 0.5 }))
      const medio = y + h / 2
      // Texto de una casilla en 1 o 2 líneas, centrado verticalmente en el renglón.
      const enCelda = (celda, x, align) => {
        const sep = 6.5 // px entre las dos líneas
        celda.lineas.forEach((l, i) => texto(l, x, celda.lineas.length > 1 ? medio + (i === 0 ? -sep : sep) : medio, { size: celda.tam, align }))
      }
      texto(r.codigo, (cols[0] + cols[1]) / 2, medio, { size: 6.5, align: 'center', maxAncho: cols[1] - cols[0] - 4 })
      enCelda(celdas.descripcion, cols[1] + 4, 'left')
      enCelda(celdas.marca, (cols[2] + cols[3]) / 2, 'center')
      texto(r.medida, (cols[3] + cols[4]) / 2, medio, { size: 6.5, align: 'center', maxAncho: cols[4] - cols[3] - 4 })
      texto(r.pesoCaja != null ? sinCeros(r.pesoCaja) : '', (cols[4] + cols[5]) / 2, medio, { size: 6.5, align: 'center' })
      texto(r.cajas != null ? sinCeros(r.cajas) : '', (cols[5] + cols[6]) / 2, medio, { size: 6.5, align: 'center' })
      texto(miles(r.kilos), (cols[6] + cols[7]) / 2, medio, { size: 6.5, bold: true, align: 'center' })
      y += h
    })
    const sobra = 501 + ALTO_TABLA - y
    const vacios = Math.max(0, Math.round(sobra / ALTO_RENGLON))
    for (let i = 0; i < vacios; i++) {
      const h = sobra / vacios
      cols.slice(0, -1).forEach((x, c) => rect(x, y, cols[c + 1] - x, h, { relleno: c > 0 && c < 6 ? GRIS : null, grosor: 0.5 }))
      y += h
    }
    const subtotal = hoja.productos.reduce((s, r) => s + Number(r.kilos || 0), 0)
    texto('SUB TOTAL', 857, 935, { size: 6, bold: true, align: 'center' })
    texto('TOTAL DE KILOS ENVIADOS', 880, 951, { size: 7, bold: true, align: 'right' })
    linea(697, 960, 1017, 960)
    texto(miles(hoja.productos.length ? totalKilos : 0), 964, 951, { size: 7, bold: true, align: 'center' })
    if (hojas.length > 1) texto(`Sub total de esta hoja: ${miles(subtotal)}  ·  Hoja ${indice + 1} de ${hojas.length}`, 1015, 920, { size: 5.5, align: 'right', color: [90, 90, 90] })

    // Transporte.
    const campo = (rotulo, xr, valor, x1, x2, y, negrita = true) => {
      texto(rotulo, xr, y - 8, { size: 6, bold: negrita })
      texto(valor, (x1 + x2) / 2, y - 8, { size: 6.5, align: 'center', maxAncho: x2 - x1 - 4 })
      linea(x1, y, x2, y, 0.5)
    }
    campo('NOMBRE:', 59, mayus(t.nombre), 165, 485, 975)
    campo('COMPAÑÍA:', 510, mayus(t.compania), 593, 910, 975)
    campo('TELEFONO:', 59, t.telefono, 165, 485, 1000)
    texto('TIPO:', 510, 992, { size: 6, bold: true })
    const tt = tipoTelefono(t.tipoTelefono)
    ;[['oficina', 'OFICINA', 590], ['casa', 'CASA', 697], ['movil', 'MOVIL', 804]].forEach(([clave, etiqueta, x]) => {
      rect(x, 984, 107, 16, { grosor: 0.5 })
      if (tt === clave) texto('X', x + 53, 992, { size: 7, bold: true, align: 'center' })
      texto(etiqueta, x + 53, 1006, { size: 6, bold: true, align: 'center' })
    })
    texto('DATOS DEL TRANSPORTE:', 59, 1017, { size: 6.5, bold: true })
    campo('MODELO:', 59, t.modelo, 165, 272, 1049)
    campo('MARCA:', 380, mayus(t.marca), 485, 591, 1049)
    campo('COLOR:', 700, mayus(t.color), 805, 910, 1049)
    campo('PLACAS DE LA CAJA:', 59, mayus(t.placasCaja), 165, 378, 1074)
    campo('PLACAS DEL TRACTOR:', 588, mayus(t.placasTractor), 697, 910, 1074)
    campo('TAMAÑO DE LA CAJA:', 59, t.tamanoCaja, 165, 378, 1099)
    campo('CAPACIDAD DE LA CAJA (KG):', 555, t.capacidadKg != null ? `${miles(t.capacidadKg, 0)} KG` : '', 697, 910, 1099)

    // Autorizaciones (se llenan a mano: nombre y firma).
    texto('AUTORIZACIONES:', 59, 1117, { size: 6.5, bold: true })
    const tamNombres = tamColumna([cfg.Despacho, cfg.Reviso, cfg.Autorizo].map(mayus), 205)
    ;[['DESPACHO:', 57, 272, cfg.Despacho], ['REVISO:', 378, 591, cfg.Reviso], ['AUTORIZO:', 697, 910, cfg.Autorizo]].forEach(([titulo, x1, x2, nombre]) => {
      texto(titulo, x1 + 2, 1142, { size: 6, bold: true })
      texto(mayus(nombre), (x1 + x2) / 2, 1157.5, { size: Math.min(tamNombres, 6.5), align: 'center' })
      rect(x1, 1150, x2 - x1, 79, { grosor: 0.5 })
      linea(x1, 1165, x2, 1165, 0.5)
      linea(x1, 1213, x2, 1213, 0.5)
      texto('NOMBRE', (x1 + x2) / 2, 1173, { size: 6, bold: true, align: 'center' })
      texto('FIRMA', (x1 + x2) / 2, 1221, { size: 6, bold: true, align: 'center' })
    })
    texto('OBSERVACIONES:', 59, 1246, { size: 6, bold: true })
    ;[1253, 1269, 1285, 1301].forEach((y) => linea(272, y, 1017, y, 0.5))
  })

  const nombre = `${nombreArchivoRequisicion(datos.numero, destino)}.pdf`
  doc.save(nombre)
  return nombre
}
