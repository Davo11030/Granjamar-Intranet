import { Fragment, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { getEmbarque, getEmbarquesPorNumero, guardarRt } from '../../api/embarques'
import { getProductos, getPedimentosPorProducto } from '../../api/inventario'
import { abrirArchivoDocumento } from '../../api/documentos'

const money = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const n3 = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
const EPS = 0.0005

const baseDoc = (tipo, numero) => `${tipo || 'Pedimento'} ${numero}`

// --- Compatibilidad con RT guardadas antes del conteo por documento ---------------------------
// Esas solo traían un texto ("Pedimento DOC-A (150.00 kg), …") sin documentos estructurados; se
// reconocen por "tipo número" para saber cuáles estaban marcados.
const esDoc = (texto, tipo, numero) => {
  const base = baseDoc(tipo, numero)
  return texto === base || texto.startsWith(`${base} (`)
}
// El texto viejo va separado por comas, pero los kilos llevan separador de miles ("3,500.00 kg") —
// se separa SOLO por las comas que quedan fuera de paréntesis.
function separarPedimentos(texto) {
  const partes = []
  let profundidad = 0
  let actual = ''
  for (const c of texto || '') {
    if (c === '(') profundidad++
    if (c === ')') profundidad = Math.max(0, profundidad - 1)
    if (c === ',' && profundidad === 0) {
      partes.push(actual)
      actual = ''
    } else actual += c
  }
  partes.push(actual)
  return partes.map((t) => t.trim()).filter(Boolean)
}

const claveDoc = (codigo, idDocumento) => `${codigo}|${idDocumento}`

// Documentos de un renglón de PRODUCTO. Los automáticos son los de los lotes usados en la
// Solicitud (uno por DOCUMENTO — un mismo lote puede haber ingresado con documentos distintos);
// los demás los agregó el usuario de la lista de documentos de ese código. "guardada" es la RT ya
// guardada de ese producto, si existe: ahí está qué documentos se usaron y cuántos kilos se
// descontaron de cada uno.
function construirDocumentos(docsAuto, guardada, docsDelCodigo) {
  const infoDe = (idDocumento) => docsDelCodigo.find((d) => d.idDocumento === idDocumento)
  const items = []
  const nuevoItem = (d, activo, auto, kilos) => ({
    idDocumento: d.idDocumento,
    tipoDocumento: d.tipoDocumento,
    numeroDocumento: d.numeroDocumento,
    activo,
    auto,
    kilosInput: kilos > 0 ? String(kilos) : '',
  })

  if (guardada?.documentos?.length > 0) {
    const guardados = new Map(guardada.documentos.map((x) => [x.idDocumento, Number(x.kilos) || 0]))
    for (const d of docsAuto) items.push(nuevoItem(d, guardados.has(d.idDocumento), true, guardados.get(d.idDocumento)))
    for (const [idDocumento, kilos] of guardados) {
      if (docsAuto.some((d) => d.idDocumento === idDocumento)) continue
      const info = infoDe(idDocumento)
      if (info) items.push(nuevoItem(info, true, false, kilos))
    }
    return items
  }

  if (guardada) {
    const textos = separarPedimentos(guardada.pedimentos ?? '')
    for (const d of docsAuto)
      items.push(nuevoItem(d, textos.some((t) => esDoc(t, d.tipoDocumento, d.numeroDocumento)), true, 0))
    for (const info of docsDelCodigo) {
      if (docsAuto.some((d) => d.idDocumento === info.idDocumento)) continue
      if (textos.some((t) => esDoc(t, info.tipoDocumento, info.numeroDocumento))) items.push(nuevoItem(info, true, false, 0))
    }
    return items
  }

  // Nunca se había guardado: todos los documentos de los lotes usados vienen marcados.
  for (const d of docsAuto) items.push(nuevoItem(d, true, true, 0))
  return items
}

export default function RT() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { usuario, puede } = useAuth()
  // Un bloque por destino (un embarque real del back cada uno) — igual que en Solicitud, nunca
  // se mezclan sus renglones entre sí.
  const [bloques, setBloques] = useState([])
  // {codigoProducto: [{idDocumento, tipoDocumento, numeroDocumento, kilosOriginales, kilosUsados, lotes}]}
  // — documentos de ese código, con los kilos con que entraron y lo que las RT ya les descontaron.
  const [pedimentosDisponibles, setPedimentosDisponibles] = useState({})
  // {"codigo|idDocumento": kilos} — lo que las RT ya guardadas de ESTAS MISMAS pantallas (destinos)
  // tienen descontado: se resta del "ya usado" del documento porque aquí se vuelve a asignar.
  const [usoGuardado, setUsoGuardado] = useState({})
  const [confirmar, setConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([getEmbarque(id), getProductos()])
      .then(async ([resEmbarque, resProductos]) => {
        const e = resEmbarque.data
        const catalogo = resProductos.data
        const productoDe = (codigo) => catalogo.find((p) => p.codigo === codigo)

        const hermanos = e?.numero
          ? await getEmbarquesPorNumero(e.numero)
              .then((r) => (r.data.length ? r.data : [e]))
              .catch(() => [e])
          : [e]

        // Por cada código de producto presente, TODOS sus documentos con los kilos con que
        // entraron y lo ya descontado por RT (un renglón por documento).
        const codigos = [
          ...new Set(
            hermanos.flatMap((s) => [...(s?.solicitudDetalles || []), ...(s?.rtDetalles || [])].map((d) => d.codigoProducto)),
          ),
        ]
        const entradas = await Promise.all(
          codigos.map((codigo) =>
            getPedimentosPorProducto(codigo)
              .then((r) => [codigo, r.data])
              .catch(() => [codigo, []]),
          ),
        )
        const porProducto = Object.fromEntries(entradas)
        setPedimentosDisponibles(porProducto)

        const uso = {}
        for (const s of hermanos)
          for (const d of s?.rtDetalles || [])
            for (const x of d.documentos || []) {
              const k = claveDoc(d.codigoProducto, x.idDocumento)
              uso[k] = (uso[k] || 0) + (Number(x.kilos) || 0)
            }
        setUsoGuardado(uso)

        const nuevosBloques = hermanos.map((s) => {
          const solicitud = s?.solicitudDetalles || []
          const rtGuardada = s?.rtDetalles || []
          const guardadas = new Map(rtGuardada.map((d) => [d.codigoProducto, d]))
          const yaHabiaRt = rtGuardada.length > 0

          // Se agrupa por producto — nunca por lote. Los documentos de los lotes que contribuyeron
          // se registran aparte, uno por DOCUMENTO (no por nombre de lote).
          const porCodigo = new Map()
          for (const d of solicitud) {
            const kilos = Number(d.kilos || 0)
            let prod = porCodigo.get(d.codigoProducto)
            if (!prod) {
              prod = { codigo: d.codigoProducto, nombre: d.nombre, kilos: 0, documentos: new Map() }
              porCodigo.set(d.codigoProducto, prod)
            }
            prod.kilos += kilos
            if (d.idDocumentoOrigen != null && d.numeroDocumento && !prod.documentos.has(d.idDocumentoOrigen))
              prod.documentos.set(d.idDocumentoOrigen, {
                idDocumento: d.idDocumentoOrigen,
                tipoDocumento: d.tipoDocumento,
                numeroDocumento: d.numeroDocumento,
              })
          }

          const idsSolicitud = new Set(porCodigo.keys())
          const filasSolicitud = [...porCodigo.values()].map((prod) => {
            const g = guardadas.get(prod.codigo)
            const p = productoDe(prod.codigo)
            return {
              codigo: prod.codigo,
              nombre: prod.nombre,
              kilos: prod.kilos,
              // Si ya se había guardado un precio (aunque lo hayan editado a mano), se respeta;
              // si es la primera vez, se predispone con el precio del producto como sugerencia.
              precioUnitario: g ? Number(g.precioUnitario) || 0 : Number(p?.precioKilo) || 0,
              claveSat: p?.claveSat || '',
              descripcionSat: p?.descripcionSat || '',
              documentos: construirDocumentos([...prod.documentos.values()], g, porProducto[prod.codigo] || []),
              // amarillo solo si la RT ya existía antes y este producto es nuevo en la solicitud
              estado: yaHabiaRt && !g ? 'nuevo' : 'normal',
            }
          })

          // Renglones de una RT ya guardada cuyo producto la Solicitud ya no tiene — se conservan
          // en rojo para que el usuario decida (no se envían de vuelta al guardar).
          const filasHuerfanas = rtGuardada
            .filter((d) => !idsSolicitud.has(d.codigoProducto))
            .map((d) => {
              const p = productoDe(d.codigoProducto)
              return {
                codigo: d.codigoProducto,
                nombre: p?.especie || '',
                kilos: 0,
                precioUnitario: Number(d.precioUnitario) || Number(p?.precioKilo) || 0,
                claveSat: p?.claveSat || d.claveSat || '',
                descripcionSat: p?.descripcionSat || d.descripcionSat || '',
                documentos: construirDocumentos([], d, porProducto[d.codigoProducto] || []),
                estado: 'eliminado',
              }
            })

          return {
            idEmbarque: s.id,
            destino: s?.destino || s?.direccion || '',
            // Kilos que este destino ya tenía descontados de documentos (para decidir el orden de guardado).
            usoPrevio: rtGuardada.reduce(
              (t, d) => t + (d.documentos || []).reduce((t2, x) => t2 + (Number(x.kilos) || 0), 0),
              0,
            ),
            filas: [...filasSolicitud, ...filasHuerfanas],
          }
        })

        setBloques(nuevosBloques)
      })
      .catch(() => {})
  }, [id])

  // Conteo LEGAL por documento (aparte del stock físico). Un documento entra con ciertos kilos y
  // cada RT descuenta los que declara usar; "restan" = lo que entró − lo ya descontado (por otras
  // RT, y por los renglones anteriores de esta misma pantalla). Reglas por renglón:
  //  - un solo documento marcado CON kilos → se le descuentan los kilos del renglón (hasta lo que
  //    le reste) sin preguntar;
  //  - dos o más documentos marcados con kilos → el usuario indica cuántos kilos usar de cada uno;
  //  - los documentos sin kilos se pueden marcar (solo se muestra que no tienen), no descuentan.
  const calculo = useMemo(() => {
    const pool = new Map()
    const docInfo = (codigo, idDocumento) => (pedimentosDisponibles[codigo] || []).find((d) => d.idDocumento === idDocumento)
    const poolDe = (codigo, idDocumento) => {
      const k = claveDoc(codigo, idDocumento)
      if (!pool.has(k)) {
        const info = docInfo(codigo, idDocumento)
        const original = Number(info?.kilosOriginales) || 0
        const usadoPorOtros = (Number(info?.kilosUsados) || 0) - (usoGuardado[k] || 0)
        pool.set(k, Math.max(0, original - usadoPorOtros))
      }
      return pool.get(k)
    }
    const filas = bloques.map((b) =>
      b.filas.map((f) => {
        if (f.estado === 'eliminado') return null
        const docs = f.documentos.map((d) => ({
          d,
          total: Number(docInfo(f.codigo, d.idDocumento)?.kilosOriginales) || 0,
          disponible: poolDe(f.codigo, d.idDocumento),
        }))
        const activos = docs.filter((x) => x.d.activo)
        const conKilos = activos.filter((x) => x.disponible > EPS)
        const manual = conKilos.length >= 2
        const necesario = Math.min(f.kilos, conKilos.reduce((s, x) => s + x.disponible, 0))
        let suma = 0
        const detalle = docs.map((x) => {
          let asignado = 0
          if (x.d.activo) {
            if (manual) asignado = Math.max(0, Number(x.d.kilosInput) || 0)
            else if (conKilos.length === 1 && conKilos[0] === x) asignado = Math.min(f.kilos, x.disponible)
          }
          suma += asignado
          return { ...x, asignado, restante: Math.max(0, x.disponible - asignado), sinKilos: x.disponible <= EPS }
        })
        for (const x of detalle) pool.set(claveDoc(f.codigo, x.d.idDocumento), x.restante)
        return { docs: detalle, manual, necesario, suma, activos: activos.length }
      }),
    )
    return { filas, pool, poolDe }
  }, [bloques, pedimentosDisponibles, usoGuardado])

  const setFila = (bi, fi, cambios) =>
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi ? { ...b, filas: b.filas.map((f, fidx) => (fidx === fi ? { ...f, ...cambios } : f)) } : b,
      ),
    )
  const setDocumento = (bi, fi, idDocumento, cambios) =>
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi
          ? {
              ...b,
              filas: b.filas.map((f, fidx) =>
                fidx === fi
                  ? { ...f, documentos: f.documentos.map((d) => (d.idDocumento === idDocumento ? { ...d, ...cambios } : d)) }
                  : f,
              ),
            }
          : b,
      ),
    )
  const quitarDocumento = (bi, fi, idDocumento) =>
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi
          ? {
              ...b,
              filas: b.filas.map((f, fidx) =>
                fidx === fi ? { ...f, documentos: f.documentos.filter((d) => d.idDocumento !== idDocumento) } : f,
              ),
            }
          : b,
      ),
    )
  const agregarDocumento = (bi, fi, info) =>
    setBloques((prev) =>
      prev.map((b, idx) =>
        idx === bi
          ? {
              ...b,
              filas: b.filas.map((f, fidx) =>
                fidx === fi
                  ? {
                      ...f,
                      documentos: [
                        ...f.documentos,
                        {
                          idDocumento: info.idDocumento,
                          tipoDocumento: info.tipoDocumento,
                          numeroDocumento: info.numeroDocumento,
                          activo: true,
                          auto: false,
                          kilosInput: '',
                        },
                      ],
                    }
                  : f,
              ),
            }
          : b,
      ),
    )

  const importe = (f) => Number(f.kilos || 0) * Number(f.precioUnitario || 0)
  const total = useMemo(
    () => bloques.reduce((s, b) => s + b.filas.reduce((s2, f) => s2 + importe(f), 0), 0),
    [bloques],
  )

  // Un producto sin documento no puede enviarse; y con dos o más documentos con kilos hay que
  // indicar cuántos kilos se usan de cada uno (cada uno ≤ lo que le resta, y todos suman lo necesario).
  const validar = () => {
    for (let bi = 0; bi < bloques.length; bi++) {
      for (let fi = 0; fi < bloques[bi].filas.length; fi++) {
        const f = bloques[bi].filas[fi]
        const c = calculo.filas[bi][fi]
        if (!c) continue
        const donde = bloques.length > 1 ? `${f.codigo} (Destino ${bi + 1})` : f.codigo
        if (c.activos === 0) return `${donde}: selecciona al menos un documento — no se puede enviar un producto sin documento`
        if (c.manual) {
          const pasado = c.docs.find((x) => x.d.activo && x.asignado > x.disponible + 0.01)
          if (pasado)
            return `${donde}: el documento ${baseDoc(pasado.d.tipoDocumento, pasado.d.numeroDocumento)} solo tiene ${n3(pasado.disponible)} kg restantes`
          if (Math.abs(c.suma - c.necesario) > 0.01)
            return `${donde}: indica cuántos kilos usar de cada documento (asignados ${n3(c.suma)} de ${n3(c.necesario)} kg)`
        }
      }
    }
    return null
  }

  const enviar = async () => {
    const problema = validar()
    if (problema) {
      setConfirmar(false)
      return toast.advertencia(problema)
    }
    const bloquesValidos = bloques
      .map((b, bi) => ({
        ...b,
        bi,
        validas: b.filas.map((f, fi) => ({ f, c: calculo.filas[bi][fi] })).filter((x) => x.f.estado !== 'eliminado'),
      }))
      .filter((b) => b.validas.length > 0)

    if (bloquesValidos.length === 0) return toast.advertencia('No hay productos para enviar')

    // Se guardan primero los destinos que LIBERAN kilos de un documento (el servidor valida cada
    // guardado contra lo que otras RT ya tienen descontado) y al final los que consumen más.
    const delta = (b) =>
      b.validas.reduce((s, { c }) => s + c.docs.reduce((s2, x) => s2 + x.asignado, 0), 0) - (b.usoPrevio || 0)
    bloquesValidos.sort((a, b) => delta(a) - delta(b))

    setGuardando(true)
    try {
      for (const b of bloquesValidos) {
        await guardarRt(b.idEmbarque, {
          idUsuario: usuario?.id,
          detalles: b.validas.map(({ f, c }) => {
            const usados = c.docs.filter((x) => x.d.activo)
            return {
              codigoProducto: f.codigo,
              precioUnitario: Number(f.precioUnitario) || 0,
              claveSat: f.claveSat || null,
              descripcionSat: f.descripcionSat || null,
              // Texto legible (para mostrar/imprimir): cada documento con los kilos que se le descontaron.
              pedimentos: usados
                .map((x) => `${baseDoc(x.d.tipoDocumento, x.d.numeroDocumento)} (${x.asignado > 0 ? `${n3(x.asignado)} kg` : 'sin kilos'})`)
                .join(', '),
              // Conteo legal: qué documentos y cuántos kilos se descuentan de cada uno.
              documentos: usados.map((x) => ({
                idDocumento: x.d.idDocumento,
                kilos: Math.round(x.asignado * 1000) / 1000,
              })),
            }
          }),
        })
      }
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la RT')
      setGuardando(false)
      setConfirmar(false)
      return
    }
    toast.exito('RT enviada')
    navigate(`/salidas/embarques/${id}/ciego`)
  }

  const hayFilas = bloques.some((b) => b.filas.length > 0)

  return (
    <Layout>
      <PageHeader titulo="RT" />

      <div className="px-6 md:px-10">
        {!hayFilas && (
          <p className="mb-4 text-sm text-gray-400">
            No hay productos en la Solicitud de este embarque todavía.
          </p>
        )}

        {bloques.length > 1 && (
          <p className="mb-3 text-xs text-gray-400">Cada destino se guarda y se envía por separado.</p>
        )}

        <div className="overflow-x-auto">
          <table className="gm-tabla-grid">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Kilos</th>
                <th>Producto</th>
                <th>Precio unitario</th>
                <th>Importe</th>
                <th>Clave del SAT</th>
                <th>Descripción SAT</th>
                <th>Pedimentos y/o Facturas</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {bloques.map((bloque, bi) => (
                <Fragment key={bloque.idEmbarque}>
                  {bloques.length > 1 && (
                    <tr className="bg-gray-100">
                      <td colSpan={9} className="px-3 py-2">
                        <span className="font-bold text-teal">
                          Destino {bi + 1}
                          {bloque.destino ? `: ${bloque.destino}` : ''}
                        </span>
                      </td>
                    </tr>
                  )}
                  {bloque.filas.map((f, fi) => {
                    const c = calculo.filas[bi][fi]
                    const eliminado = f.estado === 'eliminado'
                    const disponibles = (pedimentosDisponibles[f.codigo] || []).filter(
                      (d) => !f.documentos.some((x) => x.idDocumento === d.idDocumento),
                    )
                    return (
                      <tr key={f.codigo} className={eliminado ? 'bg-red-50' : f.estado === 'nuevo' ? 'bg-yellow-50' : ''}>
                        <td className="text-sm font-semibold">
                          {f.codigo}
                          {eliminado && (
                            <span className="mt-0.5 block text-xs font-semibold text-cancelar">Ya no está en la solicitud</span>
                          )}
                          {f.estado === 'nuevo' && (
                            <span className="mt-0.5 block text-xs font-semibold text-amber-600">Nuevo en la solicitud</span>
                          )}
                        </td>
                        <td className="text-sm text-right">{n3(f.kilos)}</td>
                        <td className="text-sm">{f.nombre}</td>
                        <td>
                          <input
                            type="number"
                            className="w-24 bg-transparent text-right text-sm outline-none"
                            value={f.precioUnitario}
                            disabled={eliminado}
                            onChange={(e) => setFila(bi, fi, { precioUnitario: e.target.value })}
                          />
                        </td>
                        <td className="text-sm font-semibold">{money(importe(f))}</td>
                        <td className="text-sm">{f.claveSat || '—'}</td>
                        <td className="text-sm">{f.descripcionSat || '—'}</td>
                        <td className="min-w-72">
                          <div className="flex flex-col gap-1.5">
                            {(c ? c.docs : f.documentos.map((d) => ({ d, total: 0, disponible: 0, asignado: 0, restante: 0, sinKilos: true }))).map(
                              (x) => (
                                <div key={x.d.idDocumento} className="text-xs">
                                  <label className="flex items-center gap-1.5">
                                    <input
                                      type="checkbox"
                                      checked={x.d.activo}
                                      disabled={eliminado}
                                      onChange={() => setDocumento(bi, fi, x.d.idDocumento, { activo: !x.d.activo })}
                                    />
                                    <span className={x.d.activo ? 'font-semibold' : 'text-gray-400 line-through'}>
                                      {baseDoc(x.d.tipoDocumento, x.d.numeroDocumento)}
                                    </span>
                                    {(pedimentosDisponibles[f.codigo] || []).find((d) => d.idDocumento === x.d.idDocumento)?.tieneArchivo && (
                                      <button
                                        type="button"
                                        className="text-[11px] font-semibold text-marca underline"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          abrirArchivoDocumento(x.d.idDocumento).catch(() => toast.error('No se pudo abrir el documento'))
                                        }}
                                      >
                                        ver
                                      </button>
                                    )}
                                    {!x.d.auto && !eliminado && (
                                      <button
                                        onClick={() => quitarDocumento(bi, fi, x.d.idDocumento)}
                                        className="text-cancelar hover:brightness-90"
                                        aria-label="Quitar documento"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </label>
                                  {!eliminado && (
                                    <div className="ml-5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
                                      <span>Total {n3(x.total)} kg</span>
                                      <span>·</span>
                                      {x.sinKilos ? (
                                        <span className="font-semibold text-cancelar">Sin kilos restantes</span>
                                      ) : (
                                        <span>Restan {n3(x.restante)} kg</span>
                                      )}
                                      {x.asignado > 0 && (
                                        <span className="font-semibold text-teal">usa {n3(x.asignado)} kg</span>
                                      )}
                                      {c?.manual && x.d.activo && !x.sinKilos && (
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.001"
                                          placeholder="kg a usar"
                                          className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-right text-xs outline-none"
                                          value={x.d.kilosInput}
                                          onChange={(e) => setDocumento(bi, fi, x.d.idDocumento, { kilosInput: e.target.value })}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              ),
                            )}
                            {!eliminado && c && c.activos === 0 && (
                              <span className="text-[11px] font-semibold text-cancelar">
                                Selecciona al menos un documento
                              </span>
                            )}
                            {!eliminado && c?.manual && Math.abs(c.suma - c.necesario) > 0.01 && (
                              <span className="text-[11px] font-semibold text-amber-600">
                                Indica cuántos kilos usar de cada documento: {n3(c.suma)} de {n3(c.necesario)} kg
                              </span>
                            )}
                            {!eliminado && disponibles.length > 0 && (
                              <select
                                className="w-full border-b border-gray-200 bg-transparent text-xs outline-none"
                                value=""
                                onChange={(e) => {
                                  const info = disponibles.find((d) => String(d.idDocumento) === e.target.value)
                                  if (info) agregarDocumento(bi, fi, info)
                                }}
                              >
                                <option value="">+ agregar pedimento/factura…</option>
                                {disponibles.map((d) => {
                                  const restan = calculo.poolDe(f.codigo, d.idDocumento)
                                  return (
                                    <option key={d.idDocumento} value={d.idDocumento}>
                                      {d.tipoDocumento || 'Pedimento'} — {d.numeroDocumento} (total {n3(d.kilosOriginales)} kg ·{' '}
                                      {restan > EPS ? `restan ${n3(restan)} kg` : 'sin kilos restantes'})
                                    </option>
                                  )
                                })}
                              </select>
                            )}
                          </div>
                        </td>
                        <td>
                          {eliminado && (
                            <button
                              onClick={() =>
                                setBloques((prev) =>
                                  prev.map((b, idx) => (idx === bi ? { ...b, filas: b.filas.filter((_, fidx) => fidx !== fi) } : b)),
                                )
                              }
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
                <td colSpan={3} className="text-right font-bold">
                  Total
                </td>
                <td className="font-bold text-marca">{money(total)}</td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
        </div>

        {puede('embarques', 'editar') && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => {
                const problema = validar()
                if (problema) return toast.advertencia(problema)
                setConfirmar(true)
              }}
              disabled={!hayFilas}
              className="rounded-full px-10 py-2.5 font-bold text-gray-800 transition hover:brightness-95 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-entrar)' }}
            >
              Enviar
            </button>
          </div>
        )}
      </div>

      <Modal abierto={confirmar} onCerrar={() => setConfirmar(false)} variante="cyan" ancho="max-w-sm">
        <p className="mb-6 text-center text-lg">¿Desea marcar como completado el RT?</p>
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
    </Layout>
  )
}
