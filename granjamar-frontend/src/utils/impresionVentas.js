import { formatearFecha, formatearHora, formatearFechaHora } from './fecha'

// Impresión de ventas: el ticket de UNA venta y el reporte de un rango de fechas. Cada uno se arma en una ventana
// aparte (solo lo que se imprime, sin menú ni botones) y se manda a imprimir. La ventana se abre ANTES de pedir los
// datos al servidor para que el navegador no la bloquee como ventana emergente.

const dinero = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const kilos = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// 'yyyy-MM-dd' del selector de fecha → 'dd/MM/yyyy' (sin pasar por Date, que lo movería de día por la zona horaria).
const fechaCorta = (iso) => (iso ? iso.split('-').reverse().join('/') : '')

const ESTILOS = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 16px; font-size: 12px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 16px 0 6px; }
  .sub { color: #555; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 6px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; font-size: 11px; }
  .num { text-align: right; white-space: nowrap; }
  .total td { font-weight: bold; border-top: 2px solid #111; border-bottom: none; }
  .ticket { max-width: 300px; margin: 0 auto; }
  .ticket table th, .ticket table td { padding: 3px 2px; }
  .centro { text-align: center; }
  .datos p { margin: 2px 0; }
  @media print { body { padding: 0; } @page { margin: 10mm; } }
`

function abrirVentana(titulo) {
  const ventana = window.open('', '_blank')
  if (!ventana) return null
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <style>${ESTILOS}</style></head><body><p>Preparando…</p></body></html>`)
  ventana.document.close()
  return ventana
}

function escribirEImprimir(ventana, titulo, cuerpo) {
  ventana.document.open()
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <style>${ESTILOS}</style></head><body>${cuerpo}</body></html>`)
  ventana.document.close()
  ventana.focus()
  // Un momento para que el navegador termine de dibujar antes de abrir el cuadro de impresión.
  setTimeout(() => ventana.print(), 250)
}

// Ticket de una venta. `cargar` es una función que devuelve la venta completa (con sus detalles).
export async function imprimirTicketVenta(cargar) {
  const ventana = abrirVentana('Ticket de venta')
  if (!ventana) throw new Error('El navegador bloqueó la ventana de impresión')
  let v
  try {
    v = await cargar()
  } catch (e) {
    ventana.close()
    throw e
  }
  const detalles = v.detalles || []
  const subtotal = detalles.length > 0 && detalles.every((d) => d.importe != null)
    ? detalles.reduce((s, d) => s + Number(d.importe), 0)
    : null
  const filas = detalles
    .map(
      (d) => `<tr>
        <td>${esc(d.descripcion || d.producto || '—')}<br><small>${esc(d.producto || '')}${d.lote ? ` · Lote ${esc(d.lote)}` : ''}</small></td>
        <td class="num">${kilos(d.kilos)} kg${d.precioKilo != null ? `<br><small>${dinero(d.precioKilo)}/kg</small>` : ''}</td>
        <td class="num">${d.importe != null ? dinero(d.importe) : '—'}</td>
      </tr>`,
    )
    .join('')
  const descuento = Number(v.descuento) > 0 && subtotal != null
    ? `<tr><td colspan="2">Subtotal</td><td class="num">${dinero(subtotal)}</td></tr>
       <tr><td colspan="2">Descuento ${Number(v.descuento)}%</td><td class="num">−${dinero(subtotal - Number(v.total))}</td></tr>`
    : ''
  const efectivo = v.efectivoRecibido != null && Number(v.efectivoRecibido) > 0
    ? `<tr><td colspan="2">Efectivo recibido</td><td class="num">${dinero(v.efectivoRecibido)}</td></tr>
       <tr><td colspan="2">Cambio</td><td class="num">${dinero(Math.max(0, Number(v.efectivoRecibido) - Number(v.total)))}</td></tr>`
    : ''
  escribirEImprimir(
    ventana,
    `Venta ${v.id}`,
    `<div class="ticket">
      <h1 class="centro">GRANJAMAR</h1>
      <p class="centro sub">Venta #${esc(v.id)}</p>
      <div class="datos">
        <p>Fecha: ${esc(formatearFechaHora(v.fechaRegistro))}</p>
        <p>Cliente: ${esc(v.cliente || 'Público en general')}</p>
        <p>Forma de pago: ${esc(v.formaPago || '—')}</p>
        ${v.usuario ? `<p>Atendió: ${esc(v.usuario)}</p>` : ''}
      </div>
      <table style="margin-top:8px">
        <thead><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Importe</th></tr></thead>
        <tbody>${filas || '<tr><td colspan="3" class="centro">Sin productos</td></tr>'}</tbody>
        <tfoot>
          ${descuento}
          <tr class="total"><td colspan="2">TOTAL</td><td class="num">${dinero(v.total)}</td></tr>
          ${efectivo}
        </tfoot>
      </table>
      <p class="centro sub" style="margin-top:12px">Gracias por su compra</p>
    </div>`,
  )
}

// Reporte de ventas de un rango de fechas ('yyyy-MM-dd'). `cargar` devuelve la lista de ventas de ese rango.
export async function imprimirReporteVentas(cargar, desde, hasta) {
  const ventana = abrirVentana('Reporte de ventas')
  if (!ventana) throw new Error('El navegador bloqueó la ventana de impresión')
  let ventas
  try {
    ventas = await cargar()
  } catch (e) {
    ventana.close()
    throw e
  }
  ventas = [...ventas].sort((a, b) => new Date(a.fechaRegistro) - new Date(b.fechaRegistro))
  const total = ventas.reduce((s, v) => s + Number(v.total || 0), 0)

  const porForma = {}
  for (const v of ventas) {
    const k = v.formaPago || 'Sin forma de pago'
    porForma[k] ||= { cantidad: 0, total: 0 }
    porForma[k].cantidad += 1
    porForma[k].total += Number(v.total || 0)
  }
  const resumen = Object.entries(porForma)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([k, g]) => `<tr><td>${esc(k)}</td><td class="num">${g.cantidad}</td><td class="num">${dinero(g.total)}</td></tr>`)
    .join('')

  const filas = ventas
    .map(
      (v) => `<tr>
        <td>${esc(v.id)}</td>
        <td>${esc(formatearFecha(v.fechaRegistro))}</td>
        <td>${esc(formatearHora(v.fechaRegistro))}</td>
        <td>${esc(v.cliente || 'Público en general')}</td>
        <td>${esc(v.formaPago || '—')}</td>
        <td>${esc(v.usuario || '—')}</td>
        <td class="num">${dinero(v.total)}</td>
      </tr>`,
    )
    .join('')

  const periodo = desde === hasta ? fechaCorta(desde) : `${fechaCorta(desde)} al ${fechaCorta(hasta)}`
  escribirEImprimir(
    ventana,
    `Reporte de ventas ${periodo}`,
    `<h1>GRANJAMAR · Reporte de ventas</h1>
    <p class="sub">Periodo: ${esc(periodo)} · ${ventas.length} venta${ventas.length === 1 ? '' : 's'} · Total ${dinero(total)}</p>
    <h2>Por forma de pago</h2>
    <table>
      <thead><tr><th>Forma de pago</th><th class="num">Ventas</th><th class="num">Total</th></tr></thead>
      <tbody>${resumen || '<tr><td colspan="3">Sin ventas</td></tr>'}</tbody>
      <tfoot><tr class="total"><td>Total</td><td class="num">${ventas.length}</td><td class="num">${dinero(total)}</td></tr></tfoot>
    </table>
    <h2>Detalle</h2>
    <table>
      <thead><tr><th>#</th><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Forma de pago</th><th>Registró</th><th class="num">Total</th></tr></thead>
      <tbody>${filas || '<tr><td colspan="7">No hay ventas en este periodo</td></tr>'}</tbody>
    </table>
    <p class="sub" style="margin-top:12px">Generado el ${esc(formatearFechaHora(new Date()))}</p>`,
  )
}
