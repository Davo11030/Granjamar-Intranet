import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import BadgeEmpresa from '../../components/BadgeEmpresa'
import BadgeStock from '../../components/BadgeStock'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getDirecciones, getEmpresas } from '../../api/destinos'
import { getClientes } from '../../api/clientes'
import { getProductos, getUbicaciones } from '../../api/inventario'
import { crearEmbarque, actualizarEmbarque, eliminarEmbarque, getEmbarque, getEmbarques, getEmbarquesPorNumero } from '../../api/embarques'
import { getChoferes, getTractocamiones, getCajas } from '../../api/operadores'
import { esBodegaRestringida, esEmpresaInterna, ubicacionSugerida } from '../../utils/ubicaciones'

const n3 = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
// La Requisición ya no liga a un lote (idExistencia) específico — solo a una ubicación
// (empresa/dirección) y un total de kilos. El lote real se elige hasta la Solicitud.
const FILA = {
  idDireccionOrigen: null,
  codigo: '',
  nombre: '',
  marca: '',
  talla: '',
  pesoCaja: 0,
  totalCajas: '',
}
// idEmbarque: id del embarque (destino) ya guardado que representa este grupo, o null/undefined
// si todavía no existe (destino agregado en pantalla, se crea al guardar).
// El destino de un grupo es una dirección ("d:5") o un cliente ("c:2") — un embarque puede ir directo
// a un cliente. Aquí se separa en lo que espera el servidor.
const destinoPayload = (idDestino) => {
  const [tipo, id] = String(idDestino).split(':')
  return tipo === 'c' ? { idDireccion: null, idCliente: Number(id) } : { idDireccion: Number(id), idCliente: null }
}

const GRUPO = () => ({ idEmbarque: null, idDestino: '', filas: [{ ...FILA }] })

function CircleBtn({ tipo, onClick }) {
  const color = tipo === 'mas' ? 'var(--color-agregar)' : 'var(--color-cancelar)'
  return (
    <button onClick={onClick} aria-label={tipo === 'mas' ? 'Agregar fila' : 'Quitar fila'}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="white" />
        {tipo === 'mas' && <path d="M12 7.5v9" stroke={color} strokeWidth="2.2" strokeLinecap="round" />}
        <path d="M7.5 12h9" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  )
}

export default function Requisicion() {
  const { id } = useParams()
  const esEdicion = !!(id && id !== 'nuevo')
  const navigate = useNavigate()
  const { usuario, puede } = useAuth()
  const toast = useToast()

  const [numero, setNumero] = useState('')
  const [origen, setOrigen] = useState('Ensenada')
  const [grupos, setGrupos] = useState([GRUPO()]) // un grupo por destino: { idDestino, filas }
  const [destinos, setDestinos] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [ubicaciones, setUbicaciones] = useState([]) // cualquier empresa: el embarque puede salir de donde sea
  const [empresas, setEmpresas] = useState([])
  const [choferes, setChoferes] = useState([])
  const [tractos, setTractos] = useState([])
  const [cajas, setCajas] = useState([])
  const [idChofer, setIdChofer] = useState('')
  const [idTracto, setIdTracto] = useState('')
  const [idCaja, setIdCaja] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [embarqueData, setEmbarqueData] = useState(null)
  const [eliminados, setEliminados] = useState([]) // ids de embarques (destinos) que se quitan al guardar
  const [listo, setListo] = useState(!esEdicion)
  const reconstruido = useRef(false)

  useEffect(() => {
    getDirecciones().then((r) => setDestinos(r.data)).catch(console.error)
    getClientes().then((r) => setClientes(r.data)).catch(() => {})
    getProductos().then((r) => setProductos(r.data)).catch(console.error)
    getUbicaciones().then((r) => setUbicaciones(r.data)).catch(console.error)
    getEmpresas().then((r) => setEmpresas(r.data)).catch(console.error)
    getChoferes().then((r) => setChoferes(r.data)).catch(console.error)
    getTractocamiones().then((r) => setTractos(r.data)).catch(console.error)
    getCajas().then((r) => setCajas(r.data)).catch(console.error)
  }, [])

  useEffect(() => {
    if (esEdicion) getEmbarque(id).then((r) => setEmbarqueData(r.data)).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Predispone el siguiente número de embarque disponible en requisiciones nuevas — solo cuenta
  // los del año en curso, así que cada año nuevo el conteo reinicia en 1. El usuario puede
  // cambiarlo, es solo una sugerencia para que el campo no se vea vacío.
  useEffect(() => {
    if (esEdicion) return
    getEmbarques()
      .then((r) => {
        const anioActual = new Date().getFullYear()
        const numericos = r.data
          .filter((e) => e.fechaRegistro && new Date(e.fechaRegistro).getFullYear() === anioActual)
          .map((e) => parseInt(e.numero, 10))
          .filter((n) => !Number.isNaN(n))
        const siguiente = numericos.length > 0 ? Math.max(...numericos) + 1 : 1
        setNumero((prev) => prev || String(siguiente))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esEdicion])

  // Reconstruye la requisición ya existente para poder editarla — un grupo por cada destino que
  // ya comparte este mismo número de embarque (mismo número = mismo embarque para el usuario,
  // aunque en el back sea un registro por destino). Solo una vez, para no pisar lo que el
  // usuario ya esté escribiendo.
  useEffect(() => {
    if (!esEdicion || reconstruido.current || !embarqueData || productos.length === 0) return
    reconstruido.current = true

    setNumero(embarqueData.numero || '')
    setIdChofer(embarqueData.idChofer ? String(embarqueData.idChofer) : '')
    setIdTracto(embarqueData.idTractocamion ? String(embarqueData.idTractocamion) : '')
    setIdCaja(embarqueData.idCaja ? String(embarqueData.idCaja) : '')

    // La Requisición nunca descontó stock real, así que el total de la ubicación que se lee
    // ahora (opcionesPara, ya cargado con `ubicaciones`) ya es el correcto sin ajustar nada.
    const construirGrupo = (data) => {
      const filas = (data.detalles || [])
        .filter((d) => d.codigoProducto)
        .map((d) => {
          const p = productos.find((x) => x.codigo === d.codigoProducto)
          return {
            idDireccionOrigen: d.idDireccion,
            codigo: d.codigoProducto,
            nombre: p?.especie || '',
            marca: p?.marca || '',
            talla: p?.talla || '',
            pesoCaja: Number(p?.pesoCaja) || 0,
            totalCajas: p?.pesoCaja ? String(Math.round(Number(d.kilos || 0) / Number(p.pesoCaja))) : '',
          }
        })
      return {
        idEmbarque: data.id,
        idDestino: data.idDireccion ? `d:${data.idDireccion}` : data.idCliente ? `c:${data.idCliente}` : '',
        filas: filas.length ? filas : [{ ...FILA }],
      }
    }

    const cargar = embarqueData.numero
      ? getEmbarquesPorNumero(embarqueData.numero)
          .then((r) => (r.data.length ? r.data : [embarqueData]))
          .catch(() => [embarqueData])
      : Promise.resolve([embarqueData])

    cargar.then((lista) => {
      setGrupos(lista.map(construirGrupo))
      setListo(true)
    })
  }, [esEdicion, embarqueData, productos])

  const kilosDe = (f) => Number(f.totalCajas || 0) * Number(f.pesoCaja || 0)
  const kilosGrupo = (g) => g.filas.reduce((s, f) => s + kilosDe(f), 0)
  const totalKilos = useMemo(() => grupos.reduce((s, g) => s + kilosGrupo(g), 0), [grupos])
  const tractoSel = useMemo(() => tractos.find((t) => String(t.id) === String(idTracto)), [tractos, idTracto])
  const cajaSel = useMemo(() => cajas.find((c) => String(c.id) === String(idCaja)), [cajas, idCaja])

  const setIdDestino = (gi, idDestino) =>
    setGrupos((prev) => prev.map((g, idx) => (idx === gi ? { ...g, idDestino } : g)))

  const agregarDestino = () => setGrupos((prev) => [...prev, GRUPO()])
  const quitarDestino = (gi) => {
    if (grupos.length === 1) return
    const grupo = grupos[gi]
    if (grupo?.idEmbarque) setEliminados((prev) => [...prev, grupo.idEmbarque])
    setGrupos((prev) => prev.filter((_, idx) => idx !== gi))
  }

  const agregarFila = (gi) =>
    setGrupos((prev) => prev.map((g, idx) => (idx === gi ? { ...g, filas: [...g.filas, { ...FILA }] } : g)))
  const quitarFila = (gi, fi) =>
    setGrupos((prev) =>
      prev.map((g, idx) =>
        idx === gi ? (g.filas.length === 1 ? g : { ...g, filas: g.filas.filter((_, fidx) => fidx !== fi) }) : g,
      ),
    )
  const setFilaEnGrupo = (gi, fi, cambios) =>
    setGrupos((prev) =>
      prev.map((g, idx) =>
        idx === gi ? { ...g, filas: g.filas.map((f, fidx) => (fidx === fi ? { ...f, ...cambios } : f)) } : g,
      ),
    )

  // Ubicaciones (empresa/dirección) que tienen stock de ese producto, sumando TODOS los lotes
  // que haya en cada una — la Requisición ya no elige un lote, solo una ubicación de origen.
  const opcionesPara = (codigo) => {
    const porDireccion = new Map()
    for (const u of ubicaciones.filter((x) => x.codigoProducto === codigo)) {
      const prev = porDireccion.get(u.idDireccion)
      porDireccion.set(u.idDireccion, {
        idDireccion: u.idDireccion,
        idEmpresa: u.idEmpresa,
        empresa: u.empresa,
        direccion: u.direccion,
        cantidadKilos: (prev?.cantidadKilos || 0) + Number(u.cantidadKilos || 0),
      })
    }
    return [...porDireccion.values()]
  }

  // Cuántos kilos de ese producto+ubicación ya reclamaron OTRAS filas de esta misma pantalla —
  // el "descuento" es solo visual/local mientras se llena el formulario, nada se guarda hasta
  // enviar. Así dos renglones no pueden comprometer más de lo que en verdad hay ahí.
  const kilosYaUsados = (codigo, idDireccion, excluirGi, excluirFi) =>
    grupos.reduce(
      (s, g, gi) =>
        s +
        g.filas.reduce((s2, f, fi) => {
          if (gi === excluirGi && fi === excluirFi) return s2
          if (f.codigo !== codigo || f.idDireccionOrigen !== idDireccion) return s2
          return s2 + kilosDe(f)
        }, 0),
      0,
    )

  const stockDisponibleParaFila = (gi, fi, f) => {
    if (!f.codigo || !f.idDireccionOrigen) return 0
    const total = opcionesPara(f.codigo).find((u) => u.idDireccion === f.idDireccionOrigen)?.cantidadKilos || 0
    return total - kilosYaUsados(f.codigo, f.idDireccionOrigen, gi, fi)
  }

  const elegirProducto = (gi, fi, codigo) => {
    const p = productos.find((x) => x.codigo === codigo)
    if (!p) return setFilaEnGrupo(gi, fi, { ...FILA })
    const sugerida = ubicacionSugerida(opcionesPara(codigo), empresas)
    setFilaEnGrupo(gi, fi, {
      codigo: p.codigo,
      nombre: p.especie || '',
      marca: p.marca || '',
      talla: p.talla || '',
      pesoCaja: Number(p.pesoCaja) || 0,
      totalCajas: '',
      idDireccionOrigen: sugerida ? sugerida.idDireccion : null,
    })
  }

  const elegirUbicacion = (gi, fi, idDireccion) =>
    setFilaEnGrupo(gi, fi, { idDireccionOrigen: idDireccion ? Number(idDireccion) : null })

  const enviar = async () => {
    const transporte =
      idChofer || idTracto || idCaja
        ? {
            idChofer: idChofer ? Number(idChofer) : null,
            idTractocamion: idTracto ? Number(idTracto) : null,
            idCaja: idCaja ? Number(idCaja) : null,
          }
        : null

    const gruposValidos = grupos
      .map((g) => ({ ...g, validas: g.filas.filter((f) => f.codigo && Number(f.totalCajas) > 0) }))
      .filter((g) => g.validas.length > 0)

    if (gruposValidos.length === 0) return toast.advertencia('Agrega al menos un producto con cajas')
    for (const g of gruposValidos) {
      if (!g.idDestino) return toast.advertencia('Selecciona un destino para cada tabla de productos')
      for (const f of g.validas) {
        if (!f.idDireccionOrigen) return toast.advertencia(`${f.codigo}: selecciona un origen`)
        if (g.idDestino === `d:${f.idDireccionOrigen}`)
          return toast.advertencia(`${f.codigo}: el destino no puede ser el mismo lugar de origen — un embarque no se envía a sí mismo`)
        // La comprobación exacta contra el stock real la hace también el backend; aquí solo se
        // valida a nivel ubicación (total de todos los lotes), no por lote específico.
        const totalUbicacion = opcionesPara(f.codigo).find((u) => u.idDireccion === f.idDireccionOrigen)?.cantidadKilos || 0
        if (kilosDe(f) > totalUbicacion)
          return toast.advertencia(`${f.codigo}: supera el stock disponible en el origen seleccionado`)
      }
    }

    // Una requisición NUEVA nunca debe compartir número con una que ya existe — eso solo es
    // válido cuando se está editando esa misma requisición para agregarle más destinos (otro
    // flujo). Si el número ya está en uso por algo que no es esto, Solicitud/RT más adelante
    // tratarían ambas como "la misma", mezclando su stock y su reparto sin ninguna relación real.
    if (!esEdicion && numero) {
      const yaExiste = await getEmbarquesPorNumero(numero)
        .then((r) => r.data.length > 0)
        .catch(() => false)
      if (yaExiste) {
        return toast.advertencia(
          `El número "${numero}" ya lo usa otra requisición. Si quieres agregarle un destino a esa, ábrela y edítala ahí — no crees una nueva con el mismo número.`,
        )
      }
    }

    const detallesDeGrupo = (g) =>
      g.validas.map((f) => ({
        codigoProducto: f.codigo,
        kilos: kilosDe(f),
        idDireccion: f.idDireccionOrigen,
        idDepartamento: null,
      }))

    setGuardando(true)
    try {
      if (esEdicion) {
        for (const g of gruposValidos) {
          const payload = {
            idUsuario: usuario?.id,
            numero: numero || null,
            ...destinoPayload(g.idDestino),
            transporte,
            detalles: detallesDeGrupo(g),
          }
          if (g.idEmbarque) await actualizarEmbarque(g.idEmbarque, payload)
          else await crearEmbarque(payload)
        }
        for (const idEliminar of eliminados) {
          await eliminarEmbarque(idEliminar, usuario?.id)
        }

        toast.exito('Requisición actualizada')
        // Si el destino que abrimos originalmente se quitó, no hay a dónde regresar dentro de
        // él — vamos a la lista; si no, seguimos viendo su propio detalle.
        navigate(eliminados.includes(id) || eliminados.includes(Number(id)) ? '/salidas/embarques' : `/salidas/embarques/${id}`)
      } else {
        // Un embarque por destino, mismo numero y mismo transporte para los N — se
        // hacen en serie (no Promise.all) porque distintos destinos pueden descontar
        // de la misma ubicación de origen y no deben pisarse entre sí.
        const idsCreados = []
        for (const g of gruposValidos) {
          const res = await crearEmbarque({
            idUsuario: usuario?.id,
            numero: numero || null,
            ...destinoPayload(g.idDestino),
            transporte,
            detalles: detallesDeGrupo(g),
          })
          idsCreados.push(res.data.id)
        }

        toast.exito(idsCreados.length > 1 ? `${idsCreados.length} embarques creados` : 'Requisición enviada')
        navigate(idsCreados.length === 1 ? `/salidas/embarques/${idsCreados[0]}` : '/salidas/embarques')
      }
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar el embarque')
    } finally {
      setGuardando(false)
      setConfirmar(false)
    }
  }

  if (!listo) {
    return (
      <Layout>
        <PageHeader titulo="Requisicion de embarque" />
      </Layout>
    )
  }

  return (
    <Layout>
      <PageHeader titulo="Requisicion de embarque" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-3 text-teal font-semibold">
            No. Embarque:
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="auto"
              className="w-28 rounded-lg border-2 border-gray-300 px-3 py-1.5 font-bold text-black outline-none"
            />
          </label>
          <label className="flex items-center gap-3 text-teal font-semibold">
            Origen:
            <select
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              className="rounded-lg border-2 border-gray-300 px-3 py-1.5 font-bold text-black"
            >
              <option>Ensenada</option>
              <option>La Paz</option>
              <option>Guaymas</option>
            </select>
          </label>
        </div>

        {grupos.map((g, gi) => {
          return (
            <div key={gi} className="mb-6">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-3 text-teal font-semibold">
                  Destino{grupos.length > 1 ? ` ${gi + 1}` : ''}:
                  <select
                    value={g.idDestino}
                    onChange={(e) => setIdDestino(gi, e.target.value)}
                    className="rounded-lg border-2 border-gray-300 px-3 py-1.5 text-black"
                  >
                    <option value="">Selecciona destino</option>
                    <optgroup label="Bodegas y direcciones">
                      {destinos.filter((x) => !esBodegaRestringida(empresas, x.idEmpresa, { resguardo: false })).map((x) => (
                        <option
                          key={`d${x.id}`}
                          value={`d:${x.id}`}
                          disabled={g.filas.some((f) => f.codigo && f.idDireccionOrigen === x.id)}
                        >
                          {x.direccion}
                          {x.municipio ? `, ${x.municipio}` : ''}
                          {g.filas.some((f) => f.codigo && f.idDireccionOrigen === x.id) ? ' (es el origen)' : ''}
                        </option>
                      ))}
                    </optgroup>
                    {clientes.length > 0 && (
                      <optgroup label="Clientes (envío directo)">
                        {clientes.map((c) => (
                          <option key={`c${c.id}`} value={`c:${c.id}`}>
                            {c.nombre}
                            {c.municipio ? `, ${c.municipio}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {grupos.length > 1 && <CircleBtn tipo="menos" onClick={() => quitarDestino(gi)} />}
                </label>
              </div>
              <h2 className="mb-3 text-xl font-bold text-marca">Detalles de mercancia</h2>
              <div className="flex items-start gap-3">
                <div className="flex-1 overflow-x-auto">
                  <table className="gm-tabla-grid !overflow-visible">
                    <thead>
                      <tr>
                        <th>Codigo</th>
                        <th>Nombre</th>
                        <th>Marca</th>
                        <th>Talla</th>
                        <th>Origen</th>
                        <th>Peso x caja</th>
                        <th>Total Cajas</th>
                        <th>Total kilos</th>
                        <th aria-hidden="true" className="sticky right-0 w-8 !border-0 !bg-[var(--color-fondo)] align-middle" />
                      </tr>
                    </thead>
                    <tbody>
                      {g.filas.map((f, fi) => {
                        const opciones = opcionesPara(f.codigo)
                        const ubicacionSel = opciones.find((u) => u.idDireccion === f.idDireccionOrigen)
                        const stockDisponible = stockDisponibleParaFila(gi, fi, f)
                        const kilosPedidos = kilosDe(f)
                        const excede = f.codigo && f.totalCajas && kilosPedidos > stockDisponible
                        return (
                          <tr key={fi} className={excede ? 'bg-red-50' : ''}>
                            <td>
                              <select
                                className="w-full text-sm outline-none bg-transparent"
                                value={f.codigo}
                                onChange={(e) => elegirProducto(gi, fi, e.target.value)}
                              >
                                <option value="">▼</option>
                                {productos.map((p) => (
                                  <option key={p.codigo} value={p.codigo}>
                                    {p.codigo}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="text-sm">{f.nombre || '—'}</td>
                            <td className="text-sm">{f.marca || '—'}</td>
                            <td className="text-sm">{f.talla || '—'}</td>
                            <td>
                              {f.codigo && opciones.length === 0 && (
                                <span className="text-xs text-cancelar">Sin stock</span>
                              )}
                              {f.codigo && opciones.length > 0 && (
                                <div className="flex flex-col gap-1">
                                  <select
                                    className={`text-xs outline-none bg-transparent ${
                                      g.idDestino === `d:${f.idDireccionOrigen}` ? 'font-semibold text-amber-600' : ''
                                    }`}
                                    value={f.idDireccionOrigen ?? ''}
                                    onChange={(e) => elegirUbicacion(gi, fi, e.target.value)}
                                  >
                                    {opciones.map((u) => (
                                      <option
                                        key={u.idDireccion}
                                        value={u.idDireccion}
                                        style={g.idDestino === `d:${u.idDireccion}` ? { color: '#d97706', fontWeight: 600 } : undefined}
                                      >
                                        {u.empresa} — {u.direccion}
                                        {g.idDestino === `d:${u.idDireccion}` ? ' ⚠ es el destino' : ''}
                                      </option>
                                    ))}
                                  </select>
                                  {g.idDestino === `d:${f.idDireccionOrigen}` && (
                                    <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                      ⚠ El origen es igual al destino: un embarque no se envía a sí mismo
                                    </span>
                                  )}
                                  <div className="flex flex-wrap items-center gap-1">
                                    <BadgeEmpresa
                                      nombre={ubicacionSel?.empresa}
                                      esPropia={esEmpresaInterna(empresas, ubicacionSel?.idEmpresa)}
                                    />
                                    <BadgeStock kilos={stockDisponible} insuficiente={excede} />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="text-sm">{f.pesoCaja || '—'}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={f.pesoCaja > 0 ? Math.floor(stockDisponible / f.pesoCaja) : undefined}
                                className="w-20 text-right text-sm outline-none bg-transparent"
                                value={f.totalCajas}
                                onChange={(e) => setFilaEnGrupo(gi, fi, { totalCajas: e.target.value })}
                              />
                              {excede && (
                                <span className="mt-0.5 block text-right text-xs font-semibold text-cancelar">
                                  supera lo disponible
                                </span>
                              )}
                            </td>
                            <td className="text-sm font-semibold">{n3(kilosPedidos)}</td>
                            <td className="sticky right-0 w-8 !border-0 !bg-[var(--color-fondo)] align-middle">
                              <CircleBtn tipo="menos" onClick={() => quitarFila(gi, fi)} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="pt-12">
                  <CircleBtn tipo="mas" onClick={() => agregarFila(gi)} />
                </div>
              </div>
              {grupos.length > 1 && (
                <div className="mt-1 text-right text-sm font-bold text-teal">
                  Subtotal destino {gi + 1}: <span className="text-black">{n3(kilosGrupo(g))} Kg</span>
                </div>
              )}
            </div>
          )
        })}

        <div className="mt-3 flex items-center gap-6">
          <div
            className="flex items-center gap-2 font-bold text-marca cursor-pointer select-none"
            onClick={agregarDestino}
          >
            <CircleBtn tipo="mas" />
            Destino
          </div>
          <span className="ml-auto text-xl font-extrabold text-teal">
            Total <span className="text-black">{n3(totalKilos)} Kg</span>
          </span>
        </div>

        <h2 className="mt-8 mb-3 text-center text-2xl font-bold text-marca">Datos Transporte</h2>
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-teal font-semibold">
            Nombre operador:
            <select value={idChofer} onChange={(e) => setIdChofer(e.target.value)} className="gm-input mt-1">
              <option value="">Sin operador</option>
              {choferes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.numeroTelefono ? `— ${c.numeroTelefono}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="text-teal font-semibold">
            Tractocamión:
            <select value={idTracto} onChange={(e) => setIdTracto(e.target.value)} className="gm-input mt-1">
              <option value="">Sin tractocamión</option>
              {tractos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.placa || t.placas} {t.marca ? `— ${t.marca}` : ''}
                </option>
              ))}
            </select>
            {tractoSel && (
              <div className="mt-1">
                <BadgeEmpresa nombre={tractoSel.empresa || 'Sin empresa'} esPropia={esEmpresaInterna(empresas, tractoSel.idEmpresa)} />
              </div>
            )}
          </label>
          <label className="text-teal font-semibold">
            Caja:
            <select value={idCaja} onChange={(e) => setIdCaja(e.target.value)} className="gm-input mt-1">
              <option value="">Sin caja</option>
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cajaPlaca || c.placa} {c.cajaTamano ? `— ${c.cajaTamano}` : ''}
                </option>
              ))}
            </select>
            {cajaSel && (
              <div className="mt-1">
                <BadgeEmpresa nombre={cajaSel.empresa || 'Sin empresa'} esPropia={esEmpresaInterna(empresas, cajaSel.idEmpresa)} />
              </div>
            )}
          </label>
        </div>

        {puede('embarques', esEdicion ? 'editar' : 'crear') && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => {
                if (grupos.every((g) => g.filas.every((f) => !f.codigo))) return toast.advertencia('Agrega al menos un producto')
                setConfirmar(true)
              }}
              className="rounded-full px-10 py-2.5 font-bold text-gray-800 transition hover:brightness-95"
              style={{ backgroundColor: 'var(--color-entrar)' }}
            >
              {esEdicion ? 'Guardar' : 'Enviar'}
            </button>
          </div>
        )}
      </div>

      <Modal abierto={confirmar} onCerrar={() => setConfirmar(false)} variante="cyan" ancho="max-w-sm">
        <p className="mb-6 text-center text-lg">
          {esEdicion
            ? eliminados.length > 0
              ? `¿Desea guardar los cambios? Esto eliminará ${eliminados.length} destino${eliminados.length > 1 ? 's' : ''} de este embarque.`
              : '¿Desea guardar los cambios de la requisición?'
            : '¿Desea marcar como completada la requisición del embarque?'}
        </p>
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
            {guardando ? 'Guardando…' : 'Enviar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
