// Reglas de qué empresas puede usar cada módulo como origen de producto.
const esInterna = (e) => e.tipo?.toLowerCase() === 'interna' || /granjamar/i.test(e.nombre || '')
const esConsignacion = (e) => e.tipo?.toLowerCase() === 'consignacion'
const esResguardo = (e) => e.tipo?.toLowerCase() === 'resguardo'

// Devuelve el Set de ids de empresa permitidos según las reglas del módulo que llama.
// { interna, consignacion, resguardo } todos opcionales/booleanos; ninguno = ningún filtro (todas).
export function idsEmpresaPermitidos(empresas, { interna = false, consignacion = false, resguardo = false } = {}) {
  return new Set(
    (empresas || [])
      .filter(
        (e) =>
          (interna && esInterna(e)) ||
          (consignacion && esConsignacion(e)) ||
          (resguardo && esResguardo(e)),
      )
      .map((e) => e.id),
  )
}

// Las bodegas de consignación solo reciben producto desde su propio menú: ni entradas ni embarques van a ellas.
// Las de resguardo tampoco reciben entradas, pero a ellas sí se pueden hacer embarques.
export function esBodegaRestringida(empresas, idEmpresa, { resguardo = true } = {}) {
  const e = (empresas || []).find((x) => Number(x.id) === Number(idEmpresa))
  return !!e && (esConsignacion(e) || (resguardo && esResguardo(e)))
}

export function filtrarPorEmpresasPermitidas(ubicaciones, idsPermitidos) {
  return (ubicaciones || []).filter((u) => idsPermitidos.has(Number(u.idEmpresa)))
}

export function nombreEmpresa(empresas, idEmpresa) {
  return (empresas || []).find((e) => Number(e.id) === Number(idEmpresa))?.nombre || ''
}

export function esEmpresaInterna(empresas, idEmpresa) {
  const e = (empresas || []).find((x) => Number(x.id) === Number(idEmpresa))
  return !!e && esInterna(e)
}

// Sugiere una ubicación por defecto entre varias opciones para un mismo producto:
// primero Granjamar (nuestro inventario), y si no hay, la de mayor stock disponible.
// El usuario siempre puede cambiarla luego en el selector.
export function ubicacionSugerida(opciones, empresas) {
  if (!opciones || opciones.length === 0) return null
  const propia = opciones.find((u) => esEmpresaInterna(empresas, u.idEmpresa))
  if (propia) return propia
  return [...opciones].sort((a, b) => Number(b.cantidadKilos || 0) - Number(a.cantidadKilos || 0))[0]
}

// Ordena las opciones para mostrar primero lo propio, luego por mayor stock —
// así lo más relevante siempre aparece arriba del selector.
export function ordenarOpciones(opciones, empresas) {
  return [...(opciones || [])].sort((a, b) => {
    const aPropia = esEmpresaInterna(empresas, a.idEmpresa) ? 0 : 1
    const bPropia = esEmpresaInterna(empresas, b.idEmpresa) ? 0 : 1
    if (aPropia !== bPropia) return aPropia - bPropia
    return Number(b.cantidadKilos || 0) - Number(a.cantidadKilos || 0)
  })
}
