import { Fragment, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { getEmbarque, getEmbarquesPorNumero, guardarSolicitud } from '../../api/embarques'
import { getProductos, getUbicaciones } from '../../api/inventario'

const n3 = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
// En la Solicitud un lote se elige UNA sola vez: un mismo nombre de lote puede haber ingresado
// varias veces con documentos distintos (cada ingreso es su propia existencia, con sus propios
// kilos), pero aquí no se repite ni se muestra el nombre del documento — solo los TIPOS de
// documento que tiene el lote. Internamente el reparto sigue siendo por existencia (así cada
// kilo descontado queda ligado a su documento); esto solo agrupa para mostrar y elegir.
const agruparLotes = (lotes) => {
  const mapa = new Map()
  for (const u of lotes) {
    const nombre = u.lote ?? ''
    let g = mapa.get(nombre)
    if (!g) {
      g = { lote: nombre, items: [], ids: [], cantidadKilos: 0, tipos: [] }
      mapa.set(nombre, g)
    }
    g.items.push(u)
    g.ids.push(u.idExistencia)
    g.cantidadKilos += u.cantidadKilos
    if (u.tipoDocumento && !g.tipos.includes(u.tipoDocumento)) g.tipos.push(u.tipoDocumento)
  }
  return [...mapa.values()]
}
const GRUPO_TARIMA = () => ({ numTarimas: '', cajasPorTarima: '' })
// estado: 'normal' | 'nuevo' (agregado a la requisición después de guardar esta solicitud) |
// 'eliminado' (ya no está en la requisición — se conserva para que el usuario decida, no se borra solo)
// Un renglón = un producto+ubicación de la Requisición, nunca elegido a mano ni repetido — el
// usuario llena tarimas (packing físico, como siempre) y, por separado, solo MARCA qué lotes de
// los disponibles se van a usar ("lotesSeleccionados"). El reparto de kilos entre los lotes
// marcados es automático: primero se agota el de menor cantidad, y si no alcanza, sigue con el
// siguiente — salvo que el usuario haya personalizado las cantidades a mano ("repartoManual",
// un {idExistencia: kilos} que reemplaza por completo el cálculo automático para ese renglón).
// "grupos" es la lista de tarimas de ese producto — normalmente una sola, pero puede haber
// varias desiguales (13 tarimas de 198 cajas + 1 de 33).
const FILA_VACIA = (clave = '', codigo = '', estado = 'normal') => ({
  clave,
  codigo,
  grupos: [GRUPO_TARIMA()],
  lotesSeleccionados: [],
  lotesCajaIncompleta: [], // idExistencia confirmados para usarse aunque no alcancen una caja completa
  repartoManual: null,
  repartoManualIncompleta: [], // idExistencia, dentro de repartoManual, que son cajas incompletas (reconstruido al reabrir)
  loteEspecificaciones: '',
  estado,
})

// Reparte las tarimas (packing físico, en cajas) entre los lotes marcados —ya ordenados de
// menor a mayor cantidad— agotando primero el que tiene menos. Un grupo que cruza la frontera
// de un lote se parte en tantos renglones como lotes le toquen; cada renglón manda al backend
// con NumTarimas=1 y las cajas que realmente salen de ESE lote. Un lote marcado como "caja
// incompleta" (ver repartoDe) se cierra como 1 sola caja física con sus kilos reales (menores al
// peso nominal) — "cajasPendientes" se descuenta en proporción a esos kilos (no 1 caja fija),
// porque puede hacer falta MÁS DE UNA caja incompleta para cubrir el peso de una sola caja
// nominal (ej. 3 lotes de 5-10-10kg para una caja de 25kg generan 3 renglones, no 1).
function generarDetalles(grupos, lotesOrdenados, pesoCaja) {
  if (!pesoCaja) return []
  const colas = lotesOrdenados.map((u) => ({
    idExistencia: u.idExistencia,
    kilosRestantes: u.cantidadKilos,
    cajaIncompleta: !!u.cajaIncompleta,
  }))
  let idx = 0
  const renglones = []
  for (const g of grupos) {
    let cajasPendientes = Number(g.numTarimas || 0) * Number(g.cajasPorTarima || 0)
    while (cajasPendientes > 0.0001 && idx < colas.length) {
      const lote = colas[idx]
      if (lote.cajaIncompleta) {
        if (lote.kilosRestantes <= 0) {
          idx++
          continue
        }
        // Un reparto reabierto junta, por lote, las cajas enteras y su sobrante en un solo bloque
        // marcado "incompleto": primero salen sus cajas enteras (como cualquier lote) y solo el
        // resto queda como caja incompleta — así un reenvío reproduce el mismo guardado.
        const cajasEnteras = Math.min(
          Math.floor(cajasPendientes + 0.0001),
          Math.floor((lote.kilosRestantes + 0.0001) / pesoCaja),
        )
        if (cajasEnteras > 0) {
          renglones.push({ idExistencia: lote.idExistencia, numTarimas: 1, cajasPorTarima: cajasEnteras })
          lote.kilosRestantes -= cajasEnteras * pesoCaja
          cajasPendientes -= cajasEnteras
          if (lote.kilosRestantes <= 0.0001) idx++
          continue
        }
        const kilosATomar = Math.min(lote.kilosRestantes, cajasPendientes * pesoCaja)
        renglones.push({
          idExistencia: lote.idExistencia,
          numTarimas: 1,
          cajasPorTarima: 1,
          kilos: kilosATomar,
          cajaIncompleta: true,
        })
        lote.kilosRestantes -= kilosATomar
        cajasPendientes -= kilosATomar / pesoCaja
        if (lote.kilosRestantes <= 0.0001) idx++
        continue
      }
      const cajasDisponibles = Math.floor(lote.kilosRestantes / pesoCaja)
      if (cajasDisponibles <= 0) {
        idx++
        continue
      }
      // Math.floor en cajasPendientes — puede venir fraccionario si un lote de caja incompleta
      // ya tomó parte del renglón; un lote normal nunca puede aportar una caja de más.
      const cajasATomar = Math.min(Math.floor(cajasPendientes + 0.0001), cajasDisponibles)
      if (cajasATomar <= 0) {
        idx++
        continue
      }
      renglones.push({ idExistencia: lote.idExistencia, numTarimas: 1, cajasPorTarima: cajasATomar })
      lote.kilosRestantes -= cajasATomar * pesoCaja
      cajasPendientes -= cajasATomar
      if (lote.kilosRestantes < pesoCaja) idx++
    }
  }
  return renglones
}

export default function Solicitud() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { usuario, puede } = useAuth()
  // Un bloque por destino (un embarque real del back cada uno), en el orden en que el usuario
  // decida mostrarlos — no se pueden mezclar sus renglones entre sí.
  const [bloques, setBloques] = useState([])
  const [ubicaciones, setUbicaciones] = useState([])
  const [arrastrando, setArrastrando] = useState(null)
  const [confirmar, setConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [dropdownLotes, setDropdownLotes] = useState(null) // "bi-fi" del desplegable de lotes abierto, o null
  const [dropdownPos, setDropdownPos] = useState(null) // {top, left, width} del botón que lo abrió
  const [personalizando, setPersonalizando] = useState(null) // {bi, fi} del renglón en personalización manual, o null
  const [valoresPersonalizar, setValoresPersonalizar] = useState({}) // {nombre de lote: 'texto del input'} mientras el cuadro está abierto
  const [confirmarIncompleta, setConfirmarIncompleta] = useState(null) // {bi, fi, ids, lote, disponible, aUsar, pesoCaja} del lote por confirmar, o null

  // Cierra el desplegable de lotes al hacer clic fuera de él, o al hacer scroll — como el panel
  // se dibuja en un portal con posición fija calculada al abrirse, si la tabla se desplaza
  // quedaría flotando en un lugar que ya no corresponde al botón.
  useEffect(() => {
    if (!dropdownLotes) return
    const cerrar = (e) => {
      if (!e.target.closest('[data-lotes-dropdown]') && !e.target.closest('[data-lotes-boton]')) setDropdownLotes(null)
    }
    const cerrarPorScroll = () => setDropdownLotes(null)
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('scroll', cerrarPorScroll, true)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('scroll', cerrarPorScroll, true)
    }
  }, [dropdownLotes])

  useEffect(() => {
    Promise.all([getEmbarque(id), getProductos(), getUbicaciones()])
      .then(async ([resEmbarque, resProductos, resUbicaciones]) => {
        const e = resEmbarque.data
        const productos = resProductos.data
        setUbicaciones(resUbicaciones.data)
        const hermanos = e?.numero
          ? await getEmbarquesPorNumero(e.numero)
              .then((r) => (r.data.length ? r.data : [e]))
              .catch(() => [e])
          : [e]

        setBloques(
          hermanos.map((s) => {
            // Lo que la Requisición de este destino pidió: producto + ubicación de origen +
            // kilos totales — ya no un lote específico, eso se elige aquí abajo.
            const acumulado = new Map()
            for (const d of s?.detalles || []) {
              if (!d.codigoProducto || !d.idDireccion) continue
              const clave = `${d.codigoProducto}|${d.idDireccion}`
              const prev = acumulado.get(clave)
              const producto = productos.find((p) => p.codigo === d.codigoProducto)
              acumulado.set(clave, {
                clave,
                codigo: d.codigoProducto,
                idDireccion: d.idDireccion,
                nombre: producto?.especie || '',
                pesoCaja: Number(producto?.pesoCaja) || 0,
                kilosPedidos: (prev?.kilosPedidos || 0) + Number(d.kilos || 0),
              })
            }
            const pedidosActuales = [...acumulado.values()]

            const guardados = s?.solicitudDetalles || []
            const idsActuales = new Set(pedidosActuales.map((p) => p.clave))

            // Cuánto de cada lote ya trae reservado ESTA MISMA solicitud (guardado antes) — para
            // que al reabrir sin cambiar nada no se vea como "sin stock" lo que ella misma apartó.
            // Se usa el kilos REAL guardado (d.kilos), no NumTarimas×CajasPorTarima×PesoCaja —
            // para un renglón de caja incompleta esas dos cosas no coinciden.
            const ajusteLotes = {}
            for (const d of guardados) {
              const claveLote = `${d.idExistencia}|${d.idDireccion}`
              ajusteLotes[claveLote] = (ajusteLotes[claveLote] || 0) + Number(d.kilos || 0)
            }

            // Los renglones guardados vienen planos (uno por grupo×lote) — se re-agrupan por
            // producto+ubicación; los grupos se muestran tal cual quedaron (packing real ya
            // partido por lote), y se reconstruye el reparto EXACTO tal como quedó guardado
            // (como "repartoManual") — así reabrir y volver a guardar sin tocar nada nunca
            // recalcula un reparto distinto al que ya existía.
            const porClave = new Map()
            for (const d of guardados) {
              const clave = `${d.codigoProducto}|${d.idDireccion}`
              const grupo = { numTarimas: String(d.numTarimas), cajasPorTarima: String(d.cajasPorTarima) }
              // Kilos real guardado (no recalculado) — así una caja incompleta reabierta se
              // respeta tal cual quedó, no como si fuera una caja completa de peso nominal.
              const kilosRenglon = Number(d.kilos || 0)
              const previo = porClave.get(clave)
              if (previo) {
                previo.grupos.push(grupo)
                if (!previo.lotesSeleccionados.includes(d.idExistencia)) previo.lotesSeleccionados.push(d.idExistencia)
                previo.repartoManual[d.idExistencia] = (previo.repartoManual[d.idExistencia] || 0) + kilosRenglon
                // Se marca también la excepción de "caja incompleta" — sin esto, al reabrir y
                // volver a guardar sin cambios, generarDetalles trataría ese lote como uno
                // normal y lo descartaría por no alcanzar una caja completa.
                if (d.cajaIncompleta && !previo.repartoManualIncompleta.includes(d.idExistencia))
                  previo.repartoManualIncompleta.push(d.idExistencia)
              } else
                porClave.set(clave, {
                  clave,
                  codigo: d.codigoProducto || '',
                  grupos: [grupo],
                  gruposDeRenglones: true,
                  lotesSeleccionados: [d.idExistencia],
                  lotesCajaIncompleta: [],
                  repartoManual: { [d.idExistencia]: kilosRenglon },
                  repartoManualIncompleta: d.cajaIncompleta ? [d.idExistencia] : [],
                  loteEspecificaciones: d.loteEspecificaciones || '',
                  estado: idsActuales.has(clave) ? 'normal' : 'eliminado',
                })
            }

            // Las tarimas físicas que se capturaron (13 de 198 cajas + 1 de 33…) se guardan aparte
            // de los renglones por lote; al reabrir se muestran tal cual — si no, un reenvío las
            // reemplazaría por las "tarimas" partidas por lote y el Ciego de carga perdería su base.
            for (const fila of porClave.values()) {
              const tarimas = (s?.solicitudTarimas || []).filter((t) => `${t.codigoProducto}|${t.idDireccion}` === fila.clave)
              if (tarimas.length > 0) {
                fila.grupos = tarimas.map((t) => ({ numTarimas: String(t.numTarimas), cajasPorTarima: String(t.cajasPorTarima) }))
                fila.gruposDeRenglones = false
              }
            }

            let filas
            if (porClave.size > 0) {
              // Ya existía una solicitud: se conserva tal cual, marcando en rojo lo que la
              // requisición ya no pide, y se agregan en amarillo los productos nuevos.
              const filasGuardadas = [...porClave.values()]
              const filasNuevas = pedidosActuales
                .filter((p) => !porClave.has(p.clave))
                .map((p) => FILA_VACIA(p.clave, p.codigo, 'nuevo'))
              filas = [...filasGuardadas, ...filasNuevas]
            } else {
              // Se predispone un renglón por cada producto de la requisición — el usuario no
              // elige productos aquí, solo llena las tarimas y marca los lotes de los que ya
              // vienen de ahí.
              filas = pedidosActuales.map((p) => FILA_VACIA(p.clave, p.codigo))
            }

            return {
              idEmbarque: s.id,
              destino: s?.destino || s?.direccion || '',
              pedidos: pedidosActuales,
              ajusteLotes,
              filas,
            }
          }),
        )
      })
      .catch(() => {})
  }, [id])

  const setLote = (bi, fi, loteEspecificaciones) =>
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi ? { ...b, filas: b.filas.map((f, fidx) => (fidx === fi ? { ...f, loteEspecificaciones } : f)) } : b,
      ),
    )
  const setGrupo = (bi, fi, gi, cambios) =>
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi
          ? {
              ...b,
              filas: b.filas.map((f, fidx) =>
                fidx === fi ? { ...f, gruposDeRenglones: false, grupos: f.grupos.map((g, gidx) => (gidx === gi ? { ...g, ...cambios } : g)) } : f,
              ),
            }
          : b,
      ),
    )
  const agregarGrupo = (bi, fi) =>
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi ? { ...b, filas: b.filas.map((f, fidx) => (fidx === fi ? { ...f, gruposDeRenglones: false, grupos: [...f.grupos, GRUPO_TARIMA()] } : f)) } : b,
      ),
    )
  const quitarGrupo = (bi, fi, gi) =>
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi
          ? {
              ...b,
              filas: b.filas.map((f, fidx) =>
                fidx === fi
                  ? { ...f, gruposDeRenglones: false, grupos: f.grupos.length === 1 ? f.grupos : f.grupos.filter((_, gidx) => gidx !== gi) }
                  : f,
              ),
            }
          : b,
      ),
    )
  // "ids" son todas las existencias del lote elegido (más de una si ese nombre de lote ingresó
  // con documentos distintos) — marcar/desmarcar el lote las marca/desmarca juntas.
  const toggleLote = (bi, fi, ids) =>
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi
          ? {
              ...b,
              filas: b.filas.map((f, fidx) =>
                fidx === fi
                  ? {
                      ...f,
                      lotesSeleccionados: ids.every((x) => f.lotesSeleccionados.includes(x))
                        ? f.lotesSeleccionados.filter((x) => !ids.includes(x))
                        : [...f.lotesSeleccionados, ...ids.filter((x) => !f.lotesSeleccionados.includes(x))],
                      // Tocar el checkbox siempre limpia la excepción de "caja incompleta" de ese
                      // lote — si sigue sin alcanzar para una caja completa, el botón para
                      // confirmarla de nuevo vuelve a aparecer.
                      lotesCajaIncompleta: (f.lotesCajaIncompleta || []).filter((x) => !ids.includes(x)),
                      // Marcar/desmarcar a mano vuelve al reparto automático — mezclar ambos
                      // modos a la vez sería confuso; para ajustar cantidades exactas está
                      // "Personalizar cantidades…".
                      repartoManual: null,
                      repartoManualIncompleta: [],
                    }
                  : f,
              ),
            }
          : b,
      ),
    )
  // Abre el cuadro de personalización precargado con el reparto actual (manual si ya había uno,
  // si no el automático) como punto de partida editable.
  const abrirPersonalizar = (bi, fi, bloque, f) => {
    const { reparto } = repartoDe(bi, bloque, f)
    const valores = {}
    // Se captura por NOMBRE de lote (un renglón por lote). Un mismo lote puede aparecer varias
    // veces en "reparto" (cajas enteras + un extra de caja incompleta, o varios documentos) —
    // se suman, no se sobrescriben.
    for (const r of reparto) {
      const previo = Number(valores[r.lote ?? '']) || 0
      valores[r.lote ?? ''] = String(Math.round((previo + r.kilosTomados) * 1000) / 1000)
    }
    setValoresPersonalizar(valores)
    setPersonalizando({ bi, fi })
  }
  const setValorPersonalizar = (nombreLote, valor) =>
    setValoresPersonalizar((prev) => ({ ...prev, [nombreLote]: valor }))
  const guardarPersonalizacion = () => {
    if (!personalizando) return
    const { bi, fi } = personalizando
    const repartoManual = {}
    const seleccionados = []
    // Los kilos capturados por lote se reparten entre sus existencias (documentos) de menor a
    // mayor stock, para que cada kilo descontado quede ligado a su documento real.
    const bloque = bloques[bi]
    const fila = bloque.filas[fi]
    const porNombre = new Map(agruparLotes(lotesPara(bi, bloque, pedidoDe(bloque, fila.clave))).map((g) => [g.lote, g]))
    for (const [nombre, valor] of Object.entries(valoresPersonalizar)) {
      let restante = Number(valor) || 0
      const items = [...(porNombre.get(nombre)?.items || [])].sort((a, b) => a.cantidadKilos - b.cantidadKilos)
      for (const u of items) {
        if (restante <= 0) break
        const tomar = Math.min(restante, Math.max(u.cantidadKilos, 0))
        if (tomar <= 0) continue
        repartoManual[u.idExistencia] = tomar
        seleccionados.push(u.idExistencia)
        restante -= tomar
      }
    }
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi
          ? {
              ...b,
              filas: b.filas.map((f, fidx) =>
                // Una personalización nueva no hereda excepciones de "caja incompleta" previas —
                // el usuario está fijando las cantidades a mano, así que el cruce normal a cajas
                // enteras (con su propio aviso si no calzan) aplica igual que siempre.
                fidx === fi ? { ...f, lotesSeleccionados: seleccionados, repartoManual, repartoManualIncompleta: [] } : f,
              ),
            }
          : b,
      ),
    )
    setPersonalizando(null)
  }
  // Un lote marcado que no aporta nada (o no aporta TODO) al reparto automático normalmente deja
  // el resto como stock "muerto" (no alcanza para una caja completa, o lo que falta ya es menos
  // de una caja). Esto abre la confirmación para, en su lugar, usar ese resto tal cual haga
  // falta — como una caja incompleta o abriendo una nueva, nunca más de lo que realmente falta.
  // "restanteLote" ya descuenta lo que el lote aporta por cajas enteras, si aportó algo.
  const abrirConfirmarCajaIncompleta = (bi, fi, g, pesoCaja, faltante, restanteLote) =>
    setConfirmarIncompleta({
      bi,
      fi,
      ids: g.ids,
      lote: g.lote,
      disponible: restanteLote,
      aUsar: Math.min(restanteLote, faltante),
      pesoCaja,
    })
  const confirmarCajaIncompleta = () => {
    if (!confirmarIncompleta) return
    const { bi, fi, ids } = confirmarIncompleta
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi
          ? {
              ...b,
              filas: b.filas.map((f, fidx) =>
                fidx === fi
                  ? { ...f, lotesCajaIncompleta: [...new Set([...(f.lotesCajaIncompleta || []), ...ids])] }
                  : f,
              ),
            }
          : b,
      ),
    )
    setConfirmarIncompleta(null)
  }
  const usarAutomatico = () => {
    if (!personalizando) return
    const { bi, fi } = personalizando
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi
          ? { ...b, filas: b.filas.map((f, fidx) => (fidx === fi ? { ...f, repartoManual: null, repartoManualIncompleta: [] } : f)) }
          : b,
      ),
    )
    setPersonalizando(null)
  }
  // Solo se puede "quitar" un renglón huérfano (ya no está en la requisición) — los demás son un
  // espejo directo de la requisición, no se agregan ni se quitan a mano.
  const quitarFila = (bi, fi) =>
    setBloques((prev) =>
      prev.map((b, idx) => (idx === bi ? { ...b, filas: b.filas.filter((_, fidx) => fidx !== fi) } : b)),
    )

  const pedidoDe = (bloque, clave) => bloque.pedidos.find((p) => p.clave === clave)
  const kilosDe = (bloque, f) => {
    // Lo que cuentan las tarimas capturadas (cajas × peso de caja) — se recalcula en cuanto se
    // cambia una tarima, también en una fila ya guardada. Única excepción: una solicitud guardada
    // antes de registrar las tarimas se reabre con "tarimas" reconstruidas de los renglones por
    // lote (1 tarima × 1 caja por cada caja incompleta), que no representan el peso real; ahí
    // los kilos reales guardados son la fuente de verdad hasta que se editen las tarimas.
    if (f.repartoManual && f.gruposDeRenglones) return Object.values(f.repartoManual).reduce((s, k) => s + (Number(k) || 0), 0)
    const pesoCaja = pedidoDe(bloque, f.clave)?.pesoCaja || 0
    return f.grupos.reduce((s, g) => s + Number(g.numTarimas || 0) * Number(g.cajasPorTarima || 0) * pesoCaja, 0)
  }
  const totalKilos = bloques.reduce((s, b) => s + b.filas.reduce((s2, f) => s2 + kilosDe(b, f), 0), 0)
  const totalPedidos = bloques.reduce((s, b) => s + b.pedidos.reduce((s2, p) => s2 + p.kilosPedidos, 0), 0)

  // Cuánto de un lote ya se llevó el reparto automático de los DESTINOS ANTERIORES (índice menor
  // que "bi") en esta misma pantalla — así el descuento va en cascada empezando por el Destino 1:
  // si dos destinos piden el mismo producto del mismo origen, el segundo ve el stock ya reducido
  // por lo que el primero se llevó, nunca al revés.
  const kilosUsadosPorAnteriores = (bi, idExistencia, idDireccion) => {
    let usado = 0
    for (let i = 0; i < bi; i++) {
      const otroBloque = bloques[i]
      for (const f of otroBloque.filas) {
        if (f.estado === 'eliminado') continue
        const pedido = pedidoDe(otroBloque, f.clave)
        if (!pedido || pedido.idDireccion !== idDireccion) continue
        const { reparto } = repartoDe(i, otroBloque, f)
        // Un mismo lote puede aparecer dos veces en "reparto" (cajas enteras + un extra de caja
        // incompleta del mismo lote) — se suma todo lo que ese destino se llevó de él.
        const tomado = reparto
          .filter((r) => r.idExistencia === idExistencia)
          .reduce((s, r) => s + r.kilosTomados, 0)
        // Lo que ese destino anterior YA tenía guardado para este lote (ajusteLotes) ya está
        // descontado del stock real que se cargó al abrir la pantalla — solo lo NUEVO (lo que
        // cambió en esta misma edición, todavía sin guardar) debe restarse aquí. Si no, un
        // destino anterior ya guardado se resta dos veces: una en el stock real, otra aquí.
        const yaReflejado = otroBloque.ajusteLotes[`${idExistencia}|${idDireccion}`] || 0
        usado += Math.max(0, tomado - yaReflejado)
      }
    }
    return usado
  }

  // Lotes disponibles de un pedido (mismo producto + misma ubicación de origen que fijó la
  // Requisición): su stock se ajusta sumando lo que esta misma solicitud ya trae reservado, y
  // restando lo que los destinos anteriores (ver arriba) ya se hayan repartido de ese lote.
  const lotesPara = (bi, bloque, pedido) => {
    if (!pedido) return []
    return ubicaciones
      .filter((u) => u.codigoProducto === pedido.codigo && u.idDireccion === pedido.idDireccion)
      .map((u) => {
        const ajuste = bloque.ajusteLotes[`${u.idExistencia}|${u.idDireccion}`] || 0
        const usadoPorAnteriores = kilosUsadosPorAnteriores(bi, u.idExistencia, u.idDireccion)
        return { ...u, cantidadKilos: Number(u.cantidadKilos || 0) + ajuste - usadoPorAnteriores }
      })
  }
  // Solo los lotes que el usuario marcó, de menor a mayor cantidad — el orden en el que se
  // agotan automáticamente.
  const lotesMarcadosOrdenados = (bi, bloque, f, pedido) =>
    lotesPara(bi, bloque, pedido)
      .filter((u) => f.lotesSeleccionados.includes(u.idExistencia))
      .sort((a, b) => a.cantidadKilos - b.cantidadKilos)

  // Reparto de kilos por lote para este renglón: si el usuario personalizó las cantidades a
  // mano ("repartoManual"), se respetan tal cual (topadas al stock real, por si el stock cambió
  // desde que se personalizó); si no, es el automático — de los lotes marcados, menor primero.
  const repartoDe = (bi, bloque, f) => {
    const pedido = pedidoDe(bloque, f.clave)
    const necesarios = kilosDe(bloque, f)

    if (f.repartoManual) {
      const disponibles = lotesPara(bi, bloque, pedido)
      const reparto = Object.entries(f.repartoManual)
        .map(([idExistencia, kilos]) => {
          const u = disponibles.find((x) => String(x.idExistencia) === idExistencia)
          if (!u) return null
          const kilosTomados = Math.min(Number(kilos) || 0, Math.max(u.cantidadKilos, 0))
          // Preserva la excepción de "caja incompleta" reconstruida al reabrir — si no se
          // propaga, generarDetalles trataría este lote como uno normal y lo descartaría al
          // no alcanzar una caja completa.
          const cajaIncompleta = (f.repartoManualIncompleta || []).some((id) => String(id) === idExistencia)
          return kilosTomados > 0 ? { ...u, kilosTomados, cajaIncompleta } : null
        })
        .filter(Boolean)
      const asignado = reparto.reduce((s, r) => s + r.kilosTomados, 0)
      return { reparto, faltante: Math.max(0, necesarios - asignado) }
    }

    // Reparto automático, menor a mayor cantidad. Una caja física nunca puede salir de dos
    // lotes a la vez: un lote normal solo aporta CAJAS ENTERAS (Math.floor), nunca una de más.
    // Al ir en el MISMO orden ascendente, un lote ya abierto/con sobra de un destino anterior se
    // consume PRIMERO — nunca se queda "cruzado de brazos" mientras un lote completo (sin abrir)
    // se usa en su lugar.
    //
    // Si un lote fue confirmado como "caja incompleta" (ver abrirConfirmarCajaIncompleta), por
    // cada visita a ese lote se intenta PRIMERO lo normal (cajas enteras) y, si todavía falta
    // algo y al lote le queda stock, se agrega un renglón EXTRA con exactamente lo que falte —
    // así el mismo lote puede cumplir todo el requerimiento él solo (cajas enteras + el
    // remanente) sin necesidad de abrir un lote distinto, cuando alcanza para eso.
    const pesoCaja = pedido?.pesoCaja || 0
    if (!pesoCaja) return { reparto: [], faltante: necesarios }
    const cajasPedidas = f.grupos.reduce((s, g) => s + Number(g.numTarimas || 0) * Number(g.cajasPorTarima || 0), 0)
    const ordenados = lotesMarcadosOrdenados(bi, bloque, f, pedido)
    const reparto = []
    let cajasRestantes = cajasPedidas
    for (const u of ordenados) {
      if (cajasRestantes <= 0.0001) break
      const disponible = Math.max(u.cantidadKilos, 0)
      if (disponible <= 0) continue
      let usadoDeEste = 0

      const cajasDisponibles = Math.floor(disponible / pesoCaja)
      if (cajasDisponibles > 0) {
        const cajasATomar = Math.min(Math.floor(cajasRestantes + 0.0001), cajasDisponibles)
        if (cajasATomar > 0) {
          reparto.push({ ...u, kilosTomados: cajasATomar * pesoCaja })
          usadoDeEste += cajasATomar * pesoCaja
          cajasRestantes -= cajasATomar
        }
      }

      if (cajasRestantes > 0.0001 && (f.lotesCajaIncompleta || []).includes(u.idExistencia)) {
        const restante = disponible - usadoDeEste
        const tomarExtra = Math.min(restante, cajasRestantes * pesoCaja)
        if (tomarExtra > 0) {
          reparto.push({ ...u, kilosTomados: tomarExtra, cajaIncompleta: true })
          cajasRestantes -= tomarExtra / pesoCaja
        }
      }
    }
    return { reparto, faltante: Math.max(0, cajasRestantes * pesoCaja) }
  }

  const moverBloque = (destinoIdx) => {
    if (arrastrando === null || arrastrando === destinoIdx) return
    setBloques((prev) => {
      const copia = [...prev]
      const [movido] = copia.splice(arrastrando, 1)
      copia.splice(destinoIdx, 0, movido)
      return copia
    })
    setArrastrando(null)
  }

  const enviar = async () => {
    for (const bloque of bloques) {
      if (bloque.filas.some((f) => f.estado === 'eliminado'))
        return toast.advertencia(
          `Destino "${bloque.destino}": quita los productos marcados en rojo, la requisición ya no los pide`,
        )
    }

    // Se conserva el índice original de cada bloque (bi) — es lo que define el orden de
    // "primero descuenta el Destino 1" en repartoDe/lotesPara, y .filter() lo desalinearía si
    // no se guarda explícitamente aquí.
    const bloquesValidos = bloques
      .map((b, bi) => ({
        ...b,
        bi,
        validas: b.filas
          .map((f) => ({ ...f, gruposValidos: f.grupos.filter((g) => Number(g.numTarimas) > 0 && Number(g.cajasPorTarima) > 0) }))
          .filter((f) => f.clave && f.gruposValidos.length > 0),
      }))
      .filter((b) => b.validas.length > 0)

    if (bloquesValidos.length === 0) return toast.advertencia('Agrega al menos un producto con tarimas')

    // Se valida y se genera TODO primero (sin llamar al backend todavía) para no guardar unos
    // bloques y fallar a medias en otro.
    const payloads = []
    for (const bloque of bloquesValidos) {
      const detalles = []
      for (const f of bloque.validas) {
        const pedido = pedidoDe(bloque, f.clave)
        if (f.lotesSeleccionados.length === 0)
          return toast.advertencia(`${pedido?.codigo || f.codigo} (Destino: ${bloque.destino}): selecciona al menos un lote`)
        // El número de tarimas es físico (entero); las cajas por tarima pueden ser parciales
        // (una tarima con una caja incompleta, ej. 2.8 cajas = 70 kg).
        if (f.gruposValidos.some((g) => !Number.isInteger(Number(g.numTarimas))))
          return toast.advertencia(
            `${pedido?.codigo || f.codigo} (Destino: ${bloque.destino}): el número de tarimas debe ser un entero`,
          )
        const asignado = kilosDe(bloque, f)
        if (pedido && asignado > pedido.kilosPedidos + 0.01) {
          return toast.advertencia(
            `${pedido.codigo} (Destino: ${bloque.destino}): asignaste ${n3(asignado)} kg pero la requisición solo pidió ${n3(pedido.kilosPedidos)} kg`,
          )
        }
        const { reparto, faltante } = repartoDe(bloque.bi, bloque, f)
        if (faltante > 0.01) {
          return toast.advertencia(
            `${pedido?.codigo || f.codigo} (Destino: ${bloque.destino}): los lotes marcados no alcanzan — faltan ${n3(faltante)} kg`,
          )
        }

        // Se usa el reparto ya calculado (automático o personalizado) como límite real por lote
        // al cruzar con las cajas — así "cuánto se va a usar de cada uno" es siempre la misma
        // fuente que la mostrada en pantalla, sea cual sea el modo.
        const ordenados = reparto.map((r) => ({
          idExistencia: r.idExistencia,
          cantidadKilos: r.kilosTomados,
          cajaIncompleta: !!r.cajaIncompleta,
        }))
        const renglones = generarDetalles(f.gruposValidos, ordenados, pedido?.pesoCaja)
        // El reparto de arriba trabaja en kilos "continuos"; el backend necesita cajas enteras
        // por lote — si un lote marcado no alcanza ni para una caja completa, el cruce real
        // puede quedar corto aunque los kilos "alcanzaran" en teoría.
        const cajasPedidas = f.gruposValidos.reduce((s, g) => s + Number(g.numTarimas || 0) * Number(g.cajasPorTarima || 0), 0)
        const cajasGeneradas = renglones.reduce((s, r) => s + r.numTarimas * r.cajasPorTarima, 0)
        if (cajasGeneradas < cajasPedidas) {
          return toast.advertencia(
            `${pedido?.codigo || f.codigo} (Destino: ${bloque.destino}): los lotes marcados no completan cajas enteras — marca otro lote o ajusta las tarimas`,
          )
        }

        detalles.push(
          ...renglones.map((r) => ({
            ...r,
            idDireccion: pedido.idDireccion,
            loteEspecificaciones: f.loteEspecificaciones || null,
          })),
        )
      }
      // Las tarimas físicas tal como se capturaron — el Ciego de carga se arma con ellas (los
      // renglones de arriba se parten por lote y ya no dicen cuántas tarimas son).
      const tarimas = bloque.validas.flatMap((f) => {
        const pedido = pedidoDe(bloque, f.clave)
        return f.gruposValidos.map((g) => ({
          codigoProducto: pedido.codigo,
          idDireccion: pedido.idDireccion,
          numTarimas: Number(g.numTarimas),
          cajasPorTarima: Number(g.cajasPorTarima),
        }))
      })
      payloads.push({ idEmbarque: bloque.idEmbarque, detalles, tarimas })
    }

    setGuardando(true)
    try {
      for (const p of payloads) {
        await guardarSolicitud(p.idEmbarque, { idUsuario: usuario?.id, detalles: p.detalles, tarimas: p.tarimas })
      }
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la solicitud')
      setGuardando(false)
      return
    }
    toast.exito('Solicitud de embarque enviada')
    navigate(`/salidas/embarques/${id}/rt`)
  }

  // Datos del renglón en personalización (si el cuadro está abierto) — se recalculan en cada
  // render, cálculo ligero, sin necesidad de memoizar.
  const bloquePersonalizando = personalizando ? bloques[personalizando.bi] : null
  const filaPersonalizando = bloquePersonalizando ? bloquePersonalizando.filas[personalizando.fi] : null
  const pedidoPersonalizando = filaPersonalizando ? pedidoDe(bloquePersonalizando, filaPersonalizando.clave) : null
  // Mismo criterio que el desplegable normal: se ocultan los lotes sin kilos, salvo que ya
  // tengan un valor escrito en el cuadro (para no esconder algo que el usuario ya fijó).
  const lotesPersonalizando = pedidoPersonalizando
    ? agruparLotes(lotesPara(personalizando.bi, bloquePersonalizando, pedidoPersonalizando)).filter(
        (g) => g.cantidadKilos > 0 || Number(valoresPersonalizar[g.lote]) > 0,
      )
    : []
  const necesariosPersonalizando = filaPersonalizando ? kilosDe(bloquePersonalizando, filaPersonalizando) : 0
  const totalPersonalizando = Object.values(valoresPersonalizar).reduce((s, v) => s + (Number(v) || 0), 0)

  return (
    <Layout>
      <PageHeader titulo="Solicitud de embarque" />

      <div className="px-6 md:px-10">
        {bloques.length > 1 && (
          <p className="mb-3 text-xs text-gray-400">
            Arrastra el renglón gris de cada destino (⠿) para cambiar el orden en que aparecen.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="gm-tabla-grid">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Kilos</th>
                <th>Producto</th>
                <th>Tarimas</th>
                <th>Lotes</th>
                <th>Lotes y/o especificaciones</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {bloques.map((bloque, bi) => (
                <Fragment key={bloque.idEmbarque}>
                  <tr
                    draggable={bloques.length > 1}
                    onDragStart={() => setArrastrando(bi)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => moverBloque(bi)}
                    className={bloques.length > 1 ? 'cursor-grab bg-gray-100 active:cursor-grabbing' : 'bg-gray-100'}
                  >
                    <td colSpan={7} className="px-3 py-2">
                      <span className="font-bold text-teal">
                        {bloques.length > 1 && <span className="mr-1 text-gray-400">⠿</span>}
                        Destino {bi + 1}
                        {bloque.destino ? `: ${bloque.destino}` : ''}
                      </span>
                    </td>
                  </tr>
                  {bloque.filas.map((f, fi) => {
                    const pedido = pedidoDe(bloque, f.clave)
                    const asignado = kilosDe(bloque, f)
                    const excede = pedido != null && asignado > pedido.kilosPedidos + 0.01
                    const { reparto, faltante } = repartoDe(bi, bloque, f)
                    const faltaLote = f.lotesSeleccionados.length > 0 && faltante > 0.01
                    const completo = f.lotesSeleccionados.length > 0 && faltante <= 0.01 && asignado > 0
                    const claseFila =
                      excede || f.estado === 'eliminado'
                        ? 'bg-red-50'
                        : f.estado === 'nuevo'
                          ? 'bg-yellow-50'
                          : completo
                            ? 'bg-blue-50'
                            : ''
                    // No se muestran lotes sin kilos disponibles — salvo que el usuario ya lo
                    // tenga marcado, para no ocultarle algo que ya eligió.
                    const lotes = lotesPara(bi, bloque, pedido).filter(
                      (u) => u.cantidadKilos > 0 || f.lotesSeleccionados.includes(u.idExistencia),
                    )
                    return (
                      <tr key={`${bloque.idEmbarque}-${fi}`} className={claseFila}>
                        <td className="text-sm font-semibold">
                          {pedido?.codigo || f.codigo || '—'}
                          {f.estado === 'eliminado' && (
                            <span className="mt-0.5 block text-xs font-semibold text-cancelar">Ya no está en la requisición</span>
                          )}
                          {f.estado === 'nuevo' && (
                            <span className="mt-0.5 block text-xs font-semibold text-amber-600">Nuevo en la requisición</span>
                          )}
                        </td>
                        <td className="text-sm font-semibold">
                          {n3(asignado)}
                          {pedido && (
                            <span className={`ml-1 text-xs font-semibold ${excede ? 'text-cancelar' : 'text-gray-400'}`}>
                              / {n3(pedido.kilosPedidos)}
                            </span>
                          )}
                          {/* Cuánto falta (o sobra) para llegar a lo que pidió la requisición, en
                              cuanto se captura una tarima — en kilos y en cajas. */}
                          {pedido && f.estado !== 'eliminado' && (
                            <span
                              className={`mt-0.5 block text-xs font-semibold ${
                                Math.abs(pedido.kilosPedidos - asignado) <= 0.01
                                  ? 'text-teal'
                                  : pedido.kilosPedidos > asignado
                                    ? 'text-amber-600'
                                    : 'text-cancelar'
                              }`}
                            >
                              {Math.abs(pedido.kilosPedidos - asignado) <= 0.01
                                ? 'Completo'
                                : `${pedido.kilosPedidos > asignado ? 'Faltan' : 'Sobran'} ${n3(Math.abs(pedido.kilosPedidos - asignado))} kg${
                                    pedido.pesoCaja > 0 ? ` (${n3(Math.abs(pedido.kilosPedidos - asignado) / pedido.pesoCaja)} cajas)` : ''
                                  }`}
                            </span>
                          )}
                        </td>
                        <td className="text-sm">{pedido?.nombre || f.codigo || '—'}</td>
                        <td>
                          <div className="flex flex-col gap-1">
                            {f.grupos.map((g, gi) => (
                              <div key={gi} className="flex items-center justify-center gap-1 whitespace-nowrap text-sm">
                                <input
                                  type="number"
                                  min="0"
                                  className="w-12 bg-transparent text-center outline-none"
                                  disabled={f.estado === 'eliminado'}
                                  value={g.numTarimas}
                                  onChange={(e) => setGrupo(bi, fi, gi, { numTarimas: e.target.value })}
                                />
                                <span className="text-gray-400">X</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="w-16 bg-transparent text-center outline-none"
                                  placeholder="cajas"
                                  disabled={f.estado === 'eliminado'}
                                  value={g.cajasPorTarima}
                                  onChange={(e) => setGrupo(bi, fi, gi, { cajasPorTarima: e.target.value })}
                                />
                                {f.grupos.length > 1 && (
                                  <button
                                    onClick={() => quitarGrupo(bi, fi, gi)}
                                    className="text-cancelar hover:brightness-90"
                                    aria-label="Quitar tarima"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            {f.estado !== 'eliminado' && (
                              <button
                                onClick={() => agregarGrupo(bi, fi)}
                                className="text-center text-xs text-marca underline"
                                title="Para tarimas desiguales, ej. 6 X 11 y 1 X 33"
                              >
                                + tarima distinta
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="relative">
                          {lotes.length === 0 ? (
                            <span className="text-xs text-cancelar">Sin lotes</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                data-lotes-boton
                                disabled={f.estado === 'eliminado'}
                                onClick={(e) => {
                                  const clave = `${bi}-${fi}`
                                  if (dropdownLotes === clave) {
                                    setDropdownLotes(null)
                                    return
                                  }
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width })
                                  setDropdownLotes(clave)
                                }}
                                className="w-full max-w-40 truncate rounded border border-gray-200 bg-transparent px-2 py-1 text-left text-xs outline-none disabled:opacity-50"
                              >
                                {f.lotesSeleccionados.length === 0
                                  ? 'Selecciona lotes…'
                                  : [
                                      ...new Set(
                                        lotes.filter((u) => f.lotesSeleccionados.includes(u.idExistencia)).map((u) => u.lote),
                                      ),
                                    ].join(', ')}
                                {f.repartoManual && <span className="ml-1 font-semibold text-teal">(personalizado)</span>}
                              </button>
                              {/* En un portal a document.body — así el panel no se recorta cuando
                                  la fila está cerca del final de la tabla (el contenedor con
                                  overflow-x-auto también recorta verticalmente). */}
                              {dropdownLotes === `${bi}-${fi}` &&
                                dropdownPos &&
                                createPortal(
                                  <div
                                    data-lotes-dropdown
                                    style={{
                                      position: 'fixed',
                                      top: dropdownPos.top,
                                      left: dropdownPos.left,
                                      minWidth: Math.max(dropdownPos.width, 220),
                                    }}
                                    className="z-50 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
                                  >
                                    {agruparLotes(lotes).map((g) => {
                                      // Un lote = una sola fila aunque haya ingresado con varios
                                      // documentos: se suman sus kilos y se listan solo los TIPOS.
                                      const marcado = g.ids.some((x) => f.lotesSeleccionados.includes(x))
                                      const entradas = reparto.filter((r) => g.ids.includes(r.idExistencia))
                                      const tomado = entradas.reduce((s, r) => s + r.kilosTomados, 0)
                                      const tieneIncompleta = entradas.some((r) => r.cajaIncompleta)
                                      const pesoCaja = pedido?.pesoCaja || 0
                                      // Lo que le queda a este lote DESPUÉS de lo que ya aporta
                                      // (cajas enteras, si alcanzó para alguna) — si con eso puede
                                      // cubrir lo que falta, no hace falta tocar otro lote.
                                      const restanteLote = g.cantidadKilos - tomado
                                      const yaIncompleta = g.ids.every((x) => f.lotesCajaIncompleta?.includes(x))
                                      const puedeIncompleta =
                                        marcado && !yaIncompleta && pesoCaja > 0 && restanteLote > 0.0001 && faltante > 0.001
                                      return (
                                        <div key={g.lote} className="py-1">
                                          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                                            <input
                                              type="checkbox"
                                              checked={marcado}
                                              onChange={() => toggleLote(bi, fi, g.ids)}
                                            />
                                            <span>
                                              {g.lote} — {n3(g.cantidadKilos)} kg
                                              {g.tipos.length > 0 && (
                                                <span className="ml-1 text-gray-400">({g.tipos.join(', ')})</span>
                                              )}
                                              {marcado && tomado > 0 && (
                                                <span className="ml-1 font-semibold text-teal">(usa {n3(tomado)} kg)</span>
                                              )}
                                              {tieneIncompleta && (
                                                <span className="ml-1 font-semibold text-amber-600">(caja incompleta)</span>
                                              )}
                                            </span>
                                          </label>
                                          {puedeIncompleta && (
                                            <button
                                              type="button"
                                              onClick={() => abrirConfirmarCajaIncompleta(bi, fi, g, pesoCaja, faltante, restanteLote)}
                                              className="ml-5 text-xs text-marca underline"
                                            >
                                              Usar caja incompleta…
                                            </button>
                                          )}
                                        </div>
                                      )
                                    })}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        abrirPersonalizar(bi, fi, bloque, f)
                                        setDropdownLotes(null)
                                      }}
                                      className="mt-1 w-full border-t border-gray-200 pt-1.5 text-left text-xs font-semibold text-marca underline"
                                    >
                                      Personalizar cantidades…
                                    </button>
                                  </div>,
                                  document.body,
                                )}
                              {faltaLote && (
                                <span className="mt-1 block text-xs font-semibold text-amber-600">
                                  Faltan {n3(faltante)} kg — marca otro lote
                                </span>
                              )}
                            </>
                          )}
                        </td>
                        <td>
                          <input
                            className="w-full bg-transparent text-sm outline-none"
                            value={f.loteEspecificaciones}
                            onChange={(e) => setLote(bi, fi, e.target.value)}
                          />
                        </td>
                        <td>
                          {f.estado === 'eliminado' && (
                            <button
                              onClick={() => quitarFila(bi, fi)}
                              className="text-cancelar hover:brightness-90 text-lg"
                              aria-label="Quitar"
                            >
                              −
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
              <tr>
                <td colSpan={1} className="text-right font-bold">
                  Total
                </td>
                <td className="font-bold">
                  {n3(totalKilos)}
                  <span className="ml-1 text-xs font-semibold text-gray-400">/ {n3(totalPedidos)}</span>
                  {totalPedidos - totalKilos > 0.01 && (
                    <span className="mt-0.5 block text-xs font-semibold text-amber-600">Faltan {n3(totalPedidos - totalKilos)} kg</span>
                  )}
                </td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
        </div>

        {puede('embarques', 'editar') && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => {
                if (bloques.every((b) => b.filas.every((f) => !f.clave))) return toast.advertencia('Agrega al menos un producto')
                setConfirmar(true)
              }}
              className="rounded-full px-10 py-2.5 font-bold text-gray-800 transition hover:brightness-95"
              style={{ backgroundColor: 'var(--color-entrar)' }}
            >
              Enviar
            </button>
          </div>
        )}
      </div>

      <Modal abierto={!!confirmarIncompleta} onCerrar={() => setConfirmarIncompleta(null)} variante="cyan" ancho="max-w-sm" titulo="Caja incompleta">
        {confirmarIncompleta && (
          <p className="mb-6 text-center text-sm text-gray-600">
            {confirmarIncompleta.aUsar >= confirmarIncompleta.disponible - 0.001 ? (
              <>
                El lote <span className="font-semibold">{confirmarIncompleta.lote}</span> solo tiene{' '}
                <span className="font-semibold">{n3(confirmarIncompleta.disponible)} kg</span> disponibles — una
                caja de este producto pesa {n3(confirmarIncompleta.pesoCaja)} kg, así que no alcanza para una caja
                completa.
                <br />
                <br />
                Si continúas, se usará todo lo que queda de este lote como una sola caja incompleta (pesará menos
                de lo normal) y el lote quedará en 0 kg.
              </>
            ) : (
              <>
                Para completar este renglón solo faltan{' '}
                <span className="font-semibold">{n3(confirmarIncompleta.aUsar)} kg</span> — tomar una caja completa
                del lote <span className="font-semibold">{confirmarIncompleta.lote}</span> ({n3(confirmarIncompleta.pesoCaja)} kg)
                se pasaría de lo pedido.
                <br />
                <br />
                Si continúas, se abrirá una caja de este lote y se usarán solo esos{' '}
                {n3(confirmarIncompleta.aUsar)} kg — el resto de esa caja queda disponible como sobrante abierto
                en el lote.
              </>
            )}
          </p>
        )}
        <div className="flex justify-center gap-4">
          <button className="gm-btn-cancelar" onClick={() => setConfirmarIncompleta(null)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={confirmarCajaIncompleta}>
            Usar de todas formas
          </button>
        </div>
      </Modal>

      <Modal abierto={confirmar} onCerrar={() => setConfirmar(false)} variante="cyan" ancho="max-w-sm">
        <p className="mb-6 text-center text-lg">¿Desea marcar como completado la solicitud de embarque?</p>
        <div className="flex justify-center gap-4">
          <button className="gm-btn-guardar" onClick={() => setConfirmar(false)}>
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={guardando}
            className="rounded-full px-8 py-2.5 font-bold text-gray-800 transition hover:brightness-95 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-entrar)' }}
          >
            {guardando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </Modal>

      <Modal abierto={!!personalizando} onCerrar={() => setPersonalizando(null)} ancho="max-w-md" titulo="Personalizar lotes">
        {filaPersonalizando && (
          <>
            <p className="mb-3 text-sm text-gray-500">
              {pedidoPersonalizando?.codigo} — se necesitan {n3(necesariosPersonalizando)} kg
            </p>
            <div className="space-y-2">
              {lotesPersonalizando.map((g) => (
                <div key={g.lote} className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {g.lote}
                    {g.tipos.length > 0 && <span className="ml-1 text-xs text-gray-400">({g.tipos.join(', ')})</span>}{' '}
                    <span className="text-xs text-gray-400">({n3(g.cantidadKilos)} kg disponibles)</span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={g.cantidadKilos}
                    step="0.001"
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm outline-none"
                    value={valoresPersonalizar[g.lote] ?? ''}
                    onChange={(e) => setValorPersonalizar(g.lote, e.target.value)}
                  />
                </div>
              ))}
              {lotesPersonalizando.length === 0 && <p className="text-sm text-cancelar">Sin lotes disponibles</p>}
            </div>
            <div
              className={`mt-3 text-right text-sm font-semibold ${
                Math.abs(totalPersonalizando - necesariosPersonalizando) < 0.01 ? 'text-teal' : 'text-cancelar'
              }`}
            >
              Total: {n3(totalPersonalizando)} / {n3(necesariosPersonalizando)} kg
            </div>
          </>
        )}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className="text-sm text-gray-500 underline" onClick={usarAutomatico}>
            Usar automático
          </button>
          <div className="flex gap-3">
            <button className="gm-btn-cancelar" onClick={() => setPersonalizando(null)}>
              Cancelar
            </button>
            <button className="gm-btn-guardar" onClick={guardarPersonalizacion}>
              Guardar
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
