import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import AvisoEmbarqueCompletado from '../../components/AvisoEmbarqueCompletado'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import BadgeEmpresa from '../../components/BadgeEmpresa'
import BadgeStock from '../../components/BadgeStock'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getDirecciones, getEmpresas } from '../../api/destinos'
import { getClientes } from '../../api/clientes'
import { getProductos, getUbicaciones } from '../../api/inventario'
import { crearRequisicion, actualizarRequisicion, getEmbarque, getEmbarquesPorNumero } from '../../api/embarques'
import { getChoferes, getTractocamiones, getCajas } from '../../api/operadores'
import { esBodegaRestringida, esEmpresaInterna, ubicacionSugerida } from '../../utils/ubicaciones'
import { avisar } from '../../utils/avisoCarga'

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
  kilos: '', // solo para productos de peso variado (sin peso por caja): ahí se captura la cantidad en kilos
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
  const { puede } = useAuth()
  const toast = useToast()

  const [numero, setNumero] = useState('')
  // Origen / remitente del embarque (junto al No. de embarque): una dirección de la empresa interna. No es el lugar de
  // donde sale cada producto (eso va en cada renglón).
  const [idOrigen, setIdOrigen] = useState('')
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
  const completado = embarqueData?.estado === 'Completado'
  const [eliminados, setEliminados] = useState([]) // ids de embarques (destinos) que se quitan al guardar
  const [listo, setListo] = useState(!esEdicion)
  const reconstruido = useRef(false)

  useEffect(() => {
    getDirecciones().then((r) => setDestinos(r.data)).catch(avisar('No se pudieron cargar los destinos'))
    getClientes().then((r) => setClientes(r.data)).catch(avisar('No se pudieron cargar los clientes'))
    getProductos().then((r) => setProductos(r.data)).catch(avisar('No se pudieron cargar los productos'))
    getUbicaciones().then((r) => setUbicaciones(r.data)).catch(avisar('No se pudieron cargar las existencias por ubicación'))
    getEmpresas().then((r) => setEmpresas(r.data)).catch(avisar('No se pudieron cargar las empresas'))
    getChoferes().then((r) => setChoferes(r.data)).catch(avisar('No se pudieron cargar los choferes'))
    getTractocamiones().then((r) => setTractos(r.data)).catch(avisar('No se pudieron cargar los tractocamiones'))
    getCajas().then((r) => setCajas(r.data)).catch(avisar('No se pudieron cargar las cajas'))
  }, [])

  useEffect(() => {
    if (esEdicion) getEmbarque(id).then((r) => setEmbarqueData(r.data)).catch(avisar('No se pudo cargar el embarque'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // El origen viene preseleccionado en Ensenada (se puede cambiar). En una requisición ya guardada se respeta el que
  // tenga; solo si no tiene ninguno (las anteriores a que se guardara) se predispone también.
  const origenPredispuesto = useRef(false)
  useEffect(() => {
    if (origenPredispuesto.current || destinos.length === 0 || empresas.length === 0) return
    if (esEdicion && !embarqueData) return
    origenPredispuesto.current = true
    if (embarqueData?.idDireccionOrigen) return
    const quita = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const internas = destinos.filter((x) => esEmpresaInterna(empresas, x.idEmpresa))
    const ensenada = internas.find((x) => quita(x.municipio).includes('ensenada')) || internas.find((x) => quita(x.direccion).includes('ensenada'))
    if (ensenada) setIdOrigen(String(ensenada.id))
  }, [destinos, empresas, embarqueData, esEdicion])

  // Reconstruye la requisición ya existente para poder editarla — un grupo por cada destino que
  // ya comparte este mismo número de embarque (mismo número = mismo embarque para el usuario,
  // aunque en el back sea un registro por destino). Solo una vez, para no pisar lo que el
  // usuario ya esté escribiendo.
  useEffect(() => {
    if (!esEdicion || reconstruido.current || !embarqueData || productos.length === 0) return
    reconstruido.current = true

    setNumero(embarqueData.numero || '')
    if (embarqueData.idDireccionOrigen) setIdOrigen(String(embarqueData.idDireccionOrigen))
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
            kilos: p?.pesoCaja ? '' : String(Number(d.kilos || 0)),
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

  // Un producto sin peso por caja es de PESO VARIADO: no se piden cajas, solo la cantidad de kilos.
  const esVariable = (f) => !!f.codigo && !(Number(f.pesoCaja) > 0)
  const kilosDe = (f) => (esVariable(f) ? Number(f.kilos || 0) : Number(f.totalCajas || 0) * Number(f.pesoCaja || 0))
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
      kilos: '',
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
      .map((g) => ({ ...g, validas: g.filas.filter((f) => f.codigo && kilosDe(f) > 0) }))
      .filter((g) => g.validas.length > 0)

    if (gruposValidos.length === 0) return toast.advertencia('Agrega al menos un producto con cajas o kilos')
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

    // Un destino que ya estaba guardado y se quedó sin productos: hay que quitarlo a propósito (botón de quitar
    // destino), no borrarlo sin avisar.
    const vacio = grupos.findIndex((g) => g.idEmbarque && !gruposValidos.some((v) => v.idEmbarque === g.idEmbarque))
    if (vacio >= 0) return toast.advertencia(`El destino ${vacio + 1} se quedó sin productos: agrégale alguno o quítalo`)

    // Toda la requisición (todos sus destinos) se guarda en una sola operación: o queda completa o no queda nada. El
    // servidor asigna el número si se deja vacío y rechaza uno que ya use otra requisición.
    const payload = {
      numero: numero.trim() || null,
      idDireccionOrigen: idOrigen ? Number(idOrigen) : null,
      transporte,
      destinos: gruposValidos.map((g) => ({
        idEmbarque: g.idEmbarque || null,
        ...destinoPayload(g.idDestino),
        detalles: g.validas.map((f) => ({
          codigoProducto: f.codigo,
          kilos: kilosDe(f),
          idDireccion: f.idDireccionOrigen,
          idDepartamento: null,
        })),
      })),
    }

    setGuardando(true)
    try {
      if (esEdicion) {
        const res = await actualizarRequisicion(id, payload)
        toast.exito('Requisición actualizada')
        // Si el destino que abrimos originalmente se quitó, no hay a dónde regresar dentro de
        // él — vamos a la lista; si no, seguimos viendo su propio detalle.
        const quitado = (res.data?.eliminados || []).map(Number).includes(Number(id))
        navigate(quitado ? '/salidas/embarques' : `/salidas/embarques/${id}`)
      } else {
        const res = await crearRequisicion(payload)
        const ids = res.data?.ids || []
        toast.exito(
          ids.length > 1
            ? `Embarque ${res.data.numero} creado con ${ids.length} destinos`
            : `Requisición enviada: embarque ${res.data.numero}`,
        )
        navigate(ids.length === 1 ? `/salidas/embarques/${ids[0]}` : '/salidas/embarques')
      }
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la requisición; no se guardó ningún destino')
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
        {completado && <AvisoEmbarqueCompletado />}
        <div className="mb-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-3 text-teal font-semibold">
            No. Embarque:
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Automático"
              title="Déjalo vacío y el sistema asigna el siguiente número al guardar"
              className="w-28 rounded-lg border-2 border-gray-300 px-3 py-1.5 font-bold text-black outline-none"
            />
          </label>
          <label className="flex items-center gap-3 text-teal font-semibold">
            Origen:
            <select
              value={idOrigen}
              onChange={(e) => setIdOrigen(e.target.value)}
              className="rounded-lg border-2 border-gray-300 px-3 py-1.5 font-bold text-black"
            >
              <option value="">Selecciona origen</option>
              {destinos
                .filter((x) => esEmpresaInterna(empresas, x.idEmpresa))
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.municipio ? `${x.municipio} — ${x.direccion}` : x.direccion}
                  </option>
                ))}
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
                        const excede = f.codigo && kilosPedidos > 0 && kilosPedidos > stockDisponible
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
                            <td className="text-sm">{esVariable(f) ? 'Peso variado' : f.pesoCaja || '—'}</td>
                            <td>
                              {esVariable(f) ? (
                                <span className="block text-right text-sm text-gray-400" title="Peso variado: solo se piden kilos">
                                  -
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max={f.pesoCaja > 0 ? Math.floor(stockDisponible / f.pesoCaja) : undefined}
                                  className="w-20 text-right text-sm outline-none bg-transparent"
                                  value={f.totalCajas}
                                  onChange={(e) => setFilaEnGrupo(gi, fi, { totalCajas: e.target.value })}
                                />
                              )}
                              {excede && (
                                <span className="mt-0.5 block text-right text-xs font-semibold text-cancelar">
                                  supera lo disponible
                                </span>
                              )}
                            </td>
                            <td className="text-sm font-semibold">
                              {esVariable(f) ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="w-24 text-right text-sm font-semibold outline-none bg-transparent"
                                  placeholder="kilos"
                                  value={f.kilos}
                                  onChange={(e) => setFilaEnGrupo(gi, fi, { kilos: e.target.value })}
                                />
                              ) : (
                                n3(kilosPedidos)
                              )}
                            </td>
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

        {puede('embarques', esEdicion ? 'editar' : 'crear') && !completado && (
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
