import logoUrl from '../assets/logo-granjamar.png'

// Imagen (PNG) del "Pedido de mercancía" que se manda a la empresa en consignación: mismo formato de la hoja que se
// usaba antes. Se dibuja en un canvas con las medidas de la hoja original (817 px de ancho) al doble de resolución y se
// descarga con el número del pedido como nombre (Ens-127.png).
const ESCALA = 2
const ANCHO = 817
const FILAS_MINIMAS = 13
const ALTO_FILA = 19.4
const FUENTE = 'Calibri, Carlito, Arial, sans-serif'
const SALMON = '#fcd5b4'
const AMARILLO = '#ffff00'

const sinAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
const numero = (n, decimales) => String(Number(Number(n || 0).toFixed(decimales)))

const cargarImagen = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

// "jueves, 22 de octubre de 2026"
const fechaLarga = (f) => new Date(f).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export async function descargarPedidoPng(pedido) {
  const cfg = pedido.configuracion || {}
  const logo = await cargarImagen(logoUrl)
  const filas = Math.max(FILAS_MINIMAS, pedido.detalles.length)
  const extra = (filas - FILAS_MINIMAS) * ALTO_FILA
  const alto = Math.round(613 + extra)

  const canvas = document.createElement('canvas')
  canvas.width = ANCHO * ESCALA
  canvas.height = alto * ESCALA
  const c = canvas.getContext('2d')
  c.scale(ESCALA, ESCALA)
  c.fillStyle = '#fff'
  c.fillRect(0, 0, ANCHO, alto)

  const texto = (t, x, y, { tam = 12, peso = 'normal', alinear = 'center', subrayado = false } = {}) => {
    c.font = `${peso} ${tam}px ${FUENTE}`
    c.fillStyle = '#000'
    c.textAlign = alinear
    c.textBaseline = 'middle'
    c.fillText(t, x, y)
    if (subrayado) {
      const w = c.measureText(t).width
      const x0 = alinear === 'center' ? x - w / 2 : x
      c.fillRect(x0, y + tam * 0.55, w, 1)
    }
  }
  const caja = (x, y, w, h, relleno, grosor = 1) => {
    if (relleno) {
      c.fillStyle = relleno
      c.fillRect(x, y, w, h)
    }
    c.strokeStyle = '#000'
    c.lineWidth = grosor
    c.strokeRect(x, y, w, h)
  }

  // Logo y encabezado del pedido.
  c.drawImage(logo, 67, 30, 118, 105)
  caja(304, 55, 235, 20, SALMON)
  texto('PEDIDO DE MERCANCIA Nº :', 421.5, 65, { peso: 'bold' })
  caja(539, 55, 221, 20, SALMON)
  texto(pedido.numero.toUpperCase(), 649.5, 65, { tam: 14, subrayado: true })
  caja(422, 75, 117, 20, AMARILLO)
  texto('FECHA :', 480.5, 85, { tam: 13, peso: 'bold' })
  caja(539, 75, 221, 20, AMARILLO)
  texto(fechaLarga(pedido.fecha), 649.5, 85, { tam: 11, subrayado: true })

  texto(cfg.Titulo || '', 409, 127, { tam: 17, peso: 'bold' })

  // Tabla de producto.
  const columnas = [28, 205, 539, 760]
  const arriba = 158
  caja(28, arriba, 732, 20, null, 2)
  ;['CANTIDAD EN KGS', 'PRODUCTO', 'CANTIDAD EN CAJAS'].forEach((t, i) =>
    texto(t, (columnas[i] + columnas[i + 1]) / 2, arriba + 10, { peso: 'bold' }),
  )
  for (let i = 1; i < 3; i++) {
    c.fillStyle = '#000'
    c.fillRect(columnas[i] - 1, arriba, 2, 20)
    c.fillRect(columnas[i] - 0.5, arriba + 20, 1, filas * ALTO_FILA)
  }
  for (let i = 0; i < filas; i++) {
    const y = arriba + 20 + i * ALTO_FILA
    caja(28, y, 732, ALTO_FILA, null, 1)
    const d = pedido.detalles[i]
    if (!d) continue
    const medio = y + ALTO_FILA / 2
    texto(numero(d.kilos, 3), (columnas[0] + columnas[1]) / 2, medio, { tam: 13 })
    texto(sinAcentos(`${d.descripcion} ${d.talla || ''}`).trim().toUpperCase(), (columnas[1] + columnas[2]) / 2, medio, { tam: 13 })
    texto(d.cajas != null ? numero(d.cajas, 2) : '', (columnas[2] + columnas[3]) / 2, medio, { tam: 13 })
  }
  caja(28, arriba, 732, 20 + filas * ALTO_FILA, null, 2)

  // Totales.
  const yTotal = 449 + extra
  const totalKilos = pedido.detalles.reduce((s, d) => s + Number(d.kilos || 0), 0)
  const totalCajas = pedido.detalles.reduce((s, d) => s + Number(d.cajas || 0), 0)
  caja(28, yTotal, 177, 23, AMARILLO, 2)
  texto(numero(totalKilos, 3), 116.5, yTotal + 12, { tam: 14, peso: 'bold' })
  caja(539, yTotal, 221, 23, AMARILLO, 2)
  texto(numero(totalCajas, 2), 649.5, yTotal + 12, { tam: 14, peso: 'bold' })

  // Pie: la empresa a la que se pide y quién lo emite.
  const yLinea = 530 + extra
  c.fillStyle = '#000'
  c.fillRect(28, yLinea, 177, 1.5)
  c.fillRect(540, yLinea, 220, 1.5)
  texto(pedido.empresa.toUpperCase(), 116.5, yLinea - 11, { tam: 13 })
  texto('Atencion', 116.5, yLinea + 11, { tam: 10 })
  texto(cfg.Firma || '', 650, yLinea + 11, { tam: 10 })

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${pedido.numero}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return a.download
}
