import { Fragment, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { getEmbarque, getEmbarquesPorNumero, marcarDocumentoEmbarque } from '../../api/embarques'

const n3 = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })

export default function CiegoDeCarga() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { usuario, puede } = useAuth()

  // Un bloque por destino (un embarque real del back cada uno) — igual que en RT y Solicitud,
  // nunca se mezclan sus tarimas entre sí. Cada bloque trae exactamente las tarimas que se
  // especificaron en la Solicitud de ese destino: {idEmbarque, destino, productos, filas}.
  const [bloques, setBloques] = useState([])
  const [filaAbierta, setFilaAbierta] = useState(null) // "bi-fi" del buscador abierto, o null
  const [posLista, setPosLista] = useState(null) // {left, top, bottom, arriba} de la lista abierta (posición fija)

  // Calcula dónde dibujar la lista de sugerencias a partir del campo — abajo si cabe, si no arriba.
  const abrirLista = (input, clave) => {
    const r = input.getBoundingClientRect()
    const arriba = window.innerHeight - r.bottom < 200 && r.top > 200
    setPosLista({ left: r.left, top: r.bottom + 4, bottom: window.innerHeight - r.top + 4, arriba })
    setFilaAbierta(clave)
  }

  // La lista tiene posición fija: si la página se desplaza dejaría de coincidir con su campo.
  useEffect(() => {
    if (!filaAbierta) return
    const cerrar = () => setFilaAbierta(null)
    window.addEventListener('scroll', cerrar, true)
    return () => window.removeEventListener('scroll', cerrar, true)
  }, [filaAbierta])
  const [confirmar, setConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getEmbarque(id)
      .then(async (r) => {
        const e = r.data
        const hermanos = e?.numero
          ? await getEmbarquesPorNumero(e.numero)
              .then((x) => (x.data.length ? x.data : [e]))
              .catch(() => [e])
          : [e]

        setBloques(
          hermanos.map((s) => {
            const detalles = s?.solicitudDetalles || []
            // Datos del producto (nombre, peso de caja, kilos reales de la Solicitud) — salen de
            // los renglones de la Solicitud, que ya traen todo eso por lote.
            const productos = new Map()
            for (const d of detalles) {
              const p = productos.get(d.codigoProducto)
              if (p) p.kilosSolicitud += Number(d.kilos || 0)
              else
                productos.set(d.codigoProducto, {
                  codigo: d.codigoProducto,
                  nombre: d.nombre,
                  pesoCaja: Number(d.pesoCaja) || 0,
                  kilosSolicitud: Number(d.kilos || 0),
                  cajasPorTarima: [], // una entrada por tarima física: cuántas cajas lleva
                })
            }

            // Las tarimas exactas de la Solicitud: "N tarimas de C cajas" → N tarimas de C cajas.
            let tarimas = s?.solicitudTarimas || []
            // Solicitudes guardadas antes de que se guardaran las tarimas capturadas: lo mejor
            // que se puede hacer es leer los renglones por lote — pueden no coincidir con las
            // tarimas reales hasta que la Solicitud se vuelva a enviar.
            const anterior = tarimas.length === 0 && detalles.length > 0
            if (anterior)
              tarimas = detalles.map((d) => ({ codigoProducto: d.codigoProducto, numTarimas: d.numTarimas, cajasPorTarima: d.cajasPorTarima }))
            for (const t of tarimas) {
              const p = productos.get(t.codigoProducto)
              if (p) for (let i = 0; i < t.numTarimas; i++) p.cajasPorTarima.push(t.cajasPorTarima)
            }

            const total = [...productos.values()].reduce((sum, p) => sum + p.cajasPorTarima.length, 0)
            return {
              idEmbarque: s.id,
              destino: s?.destino || s?.direccion || '',
              productos: [...productos.values()],
              anterior,
              filas: Array.from({ length: total }, (_, i) => ({ tarima: i + 1, codigo: '', busqueda: '' })),
            }
          }),
        )
      })
      .catch(console.error)
  }, [id])

  const productoDe = (bloque, codigo) => bloque.productos.find((p) => p.codigo === codigo)

  // Cuál tarima (0, 1, 2…) de ese producto es esta fila, contando solo las filas anteriores ya
  // asignadas al mismo producto — de ahí sale cuántas cajas lleva y cuánto pesa, sin pedírselo
  // al usuario: kg = cajas × peso de la caja.
  const datosFila = (bloque, i) => {
    const f = bloque.filas[i]
    const producto = productoDe(bloque, f.codigo)
    if (!producto) return { producto: null, cajas: null, kg: null, excede: false }
    const ocurrencia = bloque.filas.slice(0, i).filter((x) => x.codigo === f.codigo).length
    const excede = ocurrencia >= producto.cajasPorTarima.length
    const cajas = excede ? null : producto.cajasPorTarima[ocurrencia]
    return { producto, cajas, kg: cajas != null ? cajas * producto.pesoCaja : null, excede }
  }

  const asignadas = (bloque, codigo) => bloque.filas.filter((f) => f.codigo === codigo).length

  const setFila = (bi, i, cambios) =>
    setBloques((prev) =>
      prev.map((b, idx) => (idx === bi ? { ...b, filas: b.filas.map((f, fidx) => (fidx === i ? { ...f, ...cambios } : f)) } : b)),
    )

  const sugerenciasPara = (bloque, texto) => {
    const t = texto.trim().toLowerCase()
    if (!t) return bloque.productos
    return bloque.productos.filter((p) => p.codigo.toLowerCase().includes(t) || (p.nombre || '').toLowerCase().includes(t))
  }

  const elegirProducto = (bi, i, p) => {
    setFila(bi, i, { codigo: p.codigo, busqueda: p.codigo })
    setFilaAbierta(null)
  }

  // Cada destino debe quedar con EXACTAMENTE sus tarimas: cada tarima con producto, y de cada
  // producto justo las que pidió la Solicitud (ni de más ni de menos).
  const validar = () => {
    for (let bi = 0; bi < bloques.length; bi++) {
      const b = bloques[bi]
      const donde = bloques.length > 1 ? ` (Destino ${bi + 1})` : ''
      if (b.filas.some((f) => !f.codigo)) return `Asigna un producto a cada tarima${donde}`
      for (const p of b.productos) {
        const n = asignadas(b, p.codigo)
        if (n !== p.cajasPorTarima.length)
          return `${p.codigo}${donde}: la Solicitud pide ${p.cajasPorTarima.length} tarima(s) y asignaste ${n}`
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
    setGuardando(true)
    try {
      for (const b of bloques)
        await marcarDocumentoEmbarque(b.idEmbarque, { documento: 'ciego', completo: true, idUsuario: usuario?.id })
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar el ciego de carga')
      setGuardando(false)
      setConfirmar(false)
      return
    }
    toast.exito('Ciego de carga enviado')
    navigate(`/salidas/embarques/${id}`)
  }

  const hayTarimas = bloques.some((b) => b.filas.length > 0)

  return (
    <Layout>
      <PageHeader titulo="Ciego de carga" />

      <div className="px-6 md:px-10">
        {!hayTarimas ? (
          <p className="mb-4 text-sm text-gray-400">No hay tarimas definidas en la Solicitud de este embarque todavía.</p>
        ) : (
          <p className="mb-3 text-xs text-gray-400">
            Escribe código o nombre y elige el producto de cada tarima — las cajas y los kilos se
            completan solos a partir de las tarimas que se especificaron en la Solicitud
            {bloques.length > 1 ? '; cada destino lleva exactamente las suyas' : ''}.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="gm-tabla-grid select-none">
            <thead>
              <tr>
                <th>Tarima</th>
                <th>Producto</th>
                <th>Cajas</th>
                <th>Kg tarima</th>
              </tr>
            </thead>
            <tbody>
              {bloques.map((bloque, bi) => {
                const totalTarimas = bloque.filas.length
                const totalCajas = bloque.productos.reduce((s, p) => s + p.cajasPorTarima.reduce((a, c) => a + c, 0), 0)
                const kgTarimas = bloque.productos.reduce((s, p) => s + p.cajasPorTarima.reduce((a, c) => a + c, 0) * p.pesoCaja, 0)
                const kgSolicitud = bloque.productos.reduce((s, p) => s + p.kilosSolicitud, 0)
                return (
                  <Fragment key={bloque.idEmbarque}>
                    <tr className="bg-gray-100">
                      <td colSpan={4} className="px-3 py-2">
                        <span className="font-bold text-teal">
                          {bloques.length > 1 ? `Destino ${bi + 1}` : 'Destino'}
                          {bloque.destino ? `: ${bloque.destino}` : ''}
                        </span>
                        <span className="ml-3 text-xs text-gray-500">
                          {totalTarimas} tarima(s) · {n3(totalCajas)} cajas · {n3(kgTarimas)} kg
                        </span>
                        {Math.abs(kgTarimas - kgSolicitud) > 0.01 && (
                          <span className="ml-3 text-xs font-semibold text-amber-600">
                            La Solicitud/RT lleva {n3(kgSolicitud)} kg (difiere por cajas incompletas)
                          </span>
                        )}
                        {bloque.anterior && (
                          <span className="ml-3 text-xs font-semibold text-amber-600">
                            Solicitud guardada antes de registrar las tarimas: vuelve a enviarla para que el ciego refleje las tarimas exactas
                          </span>
                        )}
                      </td>
                    </tr>
                    {bloque.filas.map((f, i) => {
                      const { producto, cajas, kg, excede } = datosFila(bloque, i)
                      const clave = `${bi}-${i}`
                      const sugerencias = sugerenciasPara(bloque, f.busqueda)
                      return (
                        <tr key={clave} className={excede ? 'bg-red-50' : ''}>
                          <td className="w-16 text-center font-semibold">{f.tarima}</td>
                          <td className="relative min-w-[12rem] text-left">
                            <input
                              className="w-full bg-transparent text-sm outline-none"
                              placeholder="Código o nombre…"
                              value={f.busqueda}
                              onChange={(e) => {
                                setFila(bi, i, { busqueda: e.target.value, codigo: '' })
                                abrirLista(e.currentTarget, clave)
                              }}
                              onFocus={(e) => abrirLista(e.currentTarget, clave)}
                              onBlur={() => setTimeout(() => setFilaAbierta((a) => (a === clave ? null : a)), 150)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  if (sugerencias[0]) elegirProducto(bi, i, sugerencias[0])
                                }
                              }}
                            />
                            {/* En un portal a document.body y con posición fija — el contenedor de la
                                tabla (overflow-x-auto) también recorta verticalmente, y la lista de
                                la última fila quedaba oculta. Si no cabe abajo, se abre hacia arriba. */}
                            {filaAbierta === clave &&
                              posLista &&
                              sugerencias.length > 0 &&
                              createPortal(
                                <div
                                  style={{
                                    position: 'fixed',
                                    left: posLista.left,
                                    width: 256,
                                    ...(posLista.arriba ? { bottom: posLista.bottom } : { top: posLista.top }),
                                  }}
                                  className="z-50 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white text-left shadow-lg"
                                >
                                  {sugerencias.map((p) => (
                                    <button
                                      key={p.codigo}
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => elegirProducto(bi, i, p)}
                                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50"
                                    >
                                      <span className="font-semibold">{p.codigo}</span>
                                      <span className="ml-1 text-gray-400">{p.nombre}</span>
                                      <span className="ml-1 text-gray-400">
                                        ({asignadas(bloque, p.codigo)}/{p.cajasPorTarima.length} tarimas)
                                      </span>
                                    </button>
                                  ))}
                                </div>,
                                document.body,
                              )}
                            {excede && producto && (
                              <span className="mt-1 block text-xs font-semibold text-cancelar">
                                {producto.codigo}: excede sus {producto.cajasPorTarima.length} tarima(s)
                              </span>
                            )}
                          </td>
                          <td className="text-center text-sm">{cajas != null ? cajas : '—'}</td>
                          <td className="text-center text-sm">{kg != null ? n3(kg) : '—'}</td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
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
              disabled={!hayTarimas}
              className="rounded-full px-10 py-2.5 font-bold text-gray-800 transition hover:brightness-95 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-entrar)' }}
            >
              Enviar
            </button>
          </div>
        )}
      </div>

      <Modal abierto={confirmar} onCerrar={() => setConfirmar(false)} variante="cyan" ancho="max-w-sm">
        <p className="mb-6 text-center text-lg">¿Desea marcar como completado el ciego de carga?</p>
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
