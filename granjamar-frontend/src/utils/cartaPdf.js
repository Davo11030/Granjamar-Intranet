import { jsPDF } from 'jspdf'
import { mayus, fechaCorta } from './ciegoPdf'

// Carta responsiva de los sellos de seguridad (PDF), igual que la hoja base: dos hojas carta con el mismo texto, en las mismas
// posiciones (en pt, tomadas de la base). Solo cambia lo que se llena: la fecha, el destino final, los números de sello (el
// segundo solo si se capturó) y la compañía de transporte que firma. La base está en Calibri; como el PDF usa Helvetica (más
// ancha) la letra se ajusta sola para que ningún renglón pase del margen derecho de la base.
const X = 85.1 // margen izquierdo del texto
const X_BALA = 103.1
const X_BALA_TEXTO = 121.1
const X_SELLOS = 174.1
const DERECHA = 527 // hasta dónde llega el texto en la base
const TAM_BASE = 16
const CENTRO = 306

const PARRAFO_1 = [
  [168.0, 'Por medio de la presenta hago constar que la persona que rompa el'],
  [189.1, 'sello de seguridad de este camión de carga debe registrarse en el'],
  [210.2, 'inventario correspondiente. En el registro se debe incluir:'],
]
const LISTA_1 = [
  [268.3, 'El nombre de la persona que rompió el sello'],
  [297.5, 'El motivo de la ruptura'],
  [326.5, 'La hora y fecha exacta'],
  [355.6, 'El número de serie del sello'],
]
const PARRAFO_2 = [
  [413.8, 'Los sellos de seguridad, también conocidos como precintos, son'],
  [434.9, 'dispositivos que se colocan en los mecanismos de cierre de los'],
  [455.9, 'camiones para garantizar que no se abran sin autorización. Su'],
  [477.0, 'función es:'],
]
const LISTA_2 = [
  [535.1, 'Proteger y controlar el manejo de la carga'],
  [564.2, 'Garantizar la seguridad y la integridad de la carga'],
  [593.3, 'Prevenir el robo, el sabotaje y la manipulación de la carga'],
  [622.3, 'Ayudar a los transportistas a cumplir con las regulaciones de'],
  [643.4, 'los organismos gubernamentales', true], // continuación del punto anterior (sin viñeta)
]
const HOJA_2_INTRO = [
  [86.0, 'A continuación, les comparto los números de sello asignados a esta'],
]
const HOJA_2_FINAL = [
  [281.7, 'Cabe mencionar que dicha unidad de carga se encuentra'],
  [302.8, 'monitoreada las 24 horas del día por medio de sistema gps, el cual'],
  [323.8, 'lleva un seguimiento continuo por medio de una empresa externa.'],
  [382.0, 'Dicho escrito se realiza con el objetivo de poder transitar de forma'],
  [403.0, 'segura en las carreteras y espacio públicos, en condiciones de'],
  [424.1, 'equidad, igualdad y accesibilidad para todos.'],
  [511.4, 'Agradeciendo las atenciones de antemano quedo de Ud.'],
]

export const nombreArchivoCarta = (numero) => `Carta responsiva ${numero ?? ''}`.trim()

// datos = respuesta de GET /Embarques/{id}/carta-documento. Devuelve el nombre del archivo descargado.
export function descargarCartaPdf(datos) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  doc.setFont('helvetica', 'normal')

  // La letra más grande (hasta la de la base) con la que el renglón más ancho cabe en el margen.
  const renglones = [...PARRAFO_1, ...PARRAFO_2, ...HOJA_2_INTRO, ...HOJA_2_FINAL].map((r) => [X, r[1]])
  renglones.push(...LISTA_1.map((r) => [X_BALA_TEXTO, r[1]]), ...LISTA_2.map((r) => [X_BALA_TEXTO, r[1]]))
  let tam = TAM_BASE
  const cabe = () => {
    doc.setFontSize(tam)
    return renglones.every(([x, t]) => x + doc.getTextWidth(t) <= DERECHA + 0.5)
  }
  while (tam > 10 && !cabe()) tam -= 0.25
  doc.setFontSize(tam)

  const texto = (t, x, y, opciones = {}) => doc.text(t, x, y, opciones)
  const subrayado = (x1, x2, y) => {
    doc.setLineWidth(0.6)
    doc.line(x1, y + 2.5, x2, y + 2.5)
  }
  const bloque = (renglonesBloque) => renglonesBloque.forEach(([y, t]) => texto(t, X, y))
  const lista = (items) =>
    items.forEach(([y, t, continuacion]) => {
      if (!continuacion) {
        doc.setFontSize(10)
        texto('•', X_BALA, y)
        doc.setFontSize(tam)
      }
      texto(t, X_BALA_TEXTO, y)
    })

  // ── Hoja 1 ──────────────────────────────────────────────────────────────────────────────────────────────────────
  doc.setFontSize(12)
  texto('Fecha:', 361, 82.2)
  const fecha = datos.fecha ? fechaCorta(datos.fecha) : ''
  texto(fecha, 462, 81.2, { align: 'center' })
  subrayado(400, 525, 82.2)
  doc.setFontSize(tam)
  texto('A quien corresponda:', X, 109.9)
  bloque(PARRAFO_1)
  lista(LISTA_1)
  bloque(PARRAFO_2)
  lista(LISTA_2)

  // ── Hoja 2 ──────────────────────────────────────────────────────────────────────────────────────────────────────
  doc.addPage()
  doc.setFontSize(tam)
  bloque(HOJA_2_INTRO)
  const etiquetaDestino = 'unidad de carga, con destino final: '
  texto(etiquetaDestino, X, 107.2)
  const destino = mayus(datos.destinoFinal)
  const xDestino = X + doc.getTextWidth(etiquetaDestino)
  let renglonesDestino = 1
  if (destino) {
    if (xDestino + doc.getTextWidth(destino) <= DERECHA) {
      texto(destino, xDestino, 107.2)
      subrayado(xDestino, xDestino + doc.getTextWidth(destino), 107.2)
    } else {
      // No cabe junto a la etiqueta: pasa al renglón de abajo (en dos renglones como máximo).
      const partes = doc.splitTextToSize(destino, DERECHA - X).slice(0, 2)
      renglonesDestino += partes.length
      partes.forEach((linea, i) => {
        const y = 128.3 + i * 21.1
        texto(linea, X, y)
        subrayado(X, X + doc.getTextWidth(linea), y)
      })
    }
  } else subrayado(xDestino, xDestino + 140, 107.2)

  // Sellos: el 1 siempre; el 2 solo si se capturó.
  const sellos = [datos.sello1, datos.sello2].map((s) => (s == null ? '' : String(s).trim()))
  // Si el destino ocupó más renglones, los sellos bajan lo mismo para no encimarse.
  const baja = (renglonesDestino - 1) * 21.1
  ;[
    [165.4 + baja, 1, sellos[0]],
    [194.4 + baja, 2, sellos[1]],
  ].forEach(([y, n, valor]) => {
    if (n === 2 && !valor) return
    const etiqueta = `SELLO DE SEGURIDAD #${n}: `
    texto(etiqueta, X_SELLOS, y)
    const x = X_SELLOS + doc.getTextWidth(etiqueta)
    if (valor) {
      texto(mayus(valor), x, y)
      subrayado(x, x + Math.max(doc.getTextWidth(mayus(valor)), 60), y)
    } else subrayado(x, x + 80, y)
  })

  bloque(HOJA_2_FINAL)
  texto(mayus(datos.transportista), CENTRO, 598.6, { align: 'center' })

  const nombre = `${nombreArchivoCarta(datos.numero)}.pdf`
  doc.save(nombre)
  return nombre
}
