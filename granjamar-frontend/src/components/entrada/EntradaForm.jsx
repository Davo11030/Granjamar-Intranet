import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../Layout'
import PageHeader from '../PageHeader'
import AgregarBoton from '../AgregarBoton'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { crearEntrada, getEntrada, actualizarEntrada } from '../../api/entradas'
import { getEmpresas, crearEmpresa, getDirecciones } from '../../api/destinos'
import { esBodegaRestringida } from '../../utils/ubicaciones'
import { getProductos } from '../../api/inventario'
import { getChoferes, getTractocamiones } from '../../api/operadores'
import {
  getDocumentos,
  getDocumentosTipo,
  subirArchivoTemporal,
  abrirArchivoDocumento,
  validarArchivoDocumento,
  TIPOS_ARCHIVO_DOCUMENTO,
  MAX_ARCHIVO_DOCUMENTO_MB,
} from '../../api/documentos'

const FILA = {
  codigoProducto: '', articulo: '', cantidad: '', costo: '', lote: '',
  caducidad: '', factura: '', tipoDocumento: '', numeroDocumento: '',
  idDetalle: null, // al editar: el renglón que ya estaba cargado en Conpaq
  idDireccion: '', // al editar: la bodega con que se cargó el renglón
}

// Normaliza un texto de origen para evitar duplicados tipo "China" / "china" / " China ".
const normalizar = (s) =>
  s.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const TITULOS = {
  nacional: 'Entrada - Nacional',
  internacional: 'Entrada - Importación',
  traspaso: 'Entrada - Traspaso',
}

// Con idEditar se modifica una entrada ya cargada a Conpaq (los renglones se cambian en su lugar).
export default function EntradaForm({ modo, idEditar }) {
  const esTraspaso = modo === 'traspaso'
  const esInternacional = modo === 'internacional'
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const toast = useToast()

  const [empresas, setEmpresas] = useState([])
  const [direcciones, setDirecciones] = useState([])
  const [productos, setProductos] = useState([])
  const [tiposDocumento, setTiposDocumento] = useState([])
  const [idOrigen, setIdOrigen] = useState('') // empresa/proveedor de origen
  const [nuevoOrigen, setNuevoOrigen] = useState('')
  const [agregandoOrigen, setAgregandoOrigen] = useState(false)
  const [idDireccion, setIdDireccion] = useState('')
  const [filas, setFilas] = useState([{ ...FILA }])
  const [numeroContenedor, setNumeroContenedor] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Un archivo por DOCUMENTO distinto de la entrada ({"tipo|número": File}) y los documentos que
  // ya existen en el sistema (con o sin archivo) — uno que ya tiene archivo no se vuelve a pedir.
  const [archivos, setArchivos] = useState({})
  const [documentosExistentes, setDocumentosExistentes] = useState([])

  // Datos de transporte (opcionales): quién trajo la mercancía.
  const [choferes, setChoferes] = useState([])
  const [tractocamiones, setTractocamiones] = useState([])
  const [idChofer, setIdChofer] = useState('')
  const [idTractocamion, setIdTractocamion] = useState('')

  const recargarEmpresas = () => getEmpresas().then((r) => setEmpresas(r.data))

  useEffect(() => {
    recargarEmpresas().catch(console.error)
    getDirecciones()
      .then((r) => {
        setDirecciones(r.data)
        // Bodega de destino predeterminada: la de Granjamar en Ensenada (se puede cambiar).
        if (idEditar) return
        const ensenada = r.data.find(
          (d) => /granjamar/i.test(d.empresa || '') && /ensenada/i.test(d.municipio || ''),
        )
        if (ensenada) setIdDireccion((actual) => actual || String(ensenada.id))
      })
      .catch(console.error)
    getProductos().then((r) => setProductos(r.data)).catch(console.error)
    getChoferes().then((r) => setChoferes(r.data)).catch(console.error)
    getTractocamiones().then((r) => setTractocamiones(r.data)).catch(console.error)
    if (esInternacional) getDocumentosTipo().then((r) => setTiposDocumento(r.data)).catch(console.error)
    if (!esTraspaso) getDocumentos().then((r) => setDocumentosExistentes(r.data)).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Al editar se llena el formulario con la entrada ya cargada.
  useEffect(() => {
    if (!idEditar) return
    getEntrada(idEditar)
      .then(({ data }) => {
        setIdOrigen(data.idEmpresa ? String(data.idEmpresa) : '')
        setNumeroContenedor(data.numeroContenedor || '')
        setIdChofer(data.idChofer ? String(data.idChofer) : '')
        setIdTractocamion(data.idTractocamion ? String(data.idTractocamion) : '')
        const detalles = data.detalles || []
        if (detalles[0]?.idDireccion) setIdDireccion(String(detalles[0].idDireccion))
        setFilas(
          detalles.map((d) => ({
            ...FILA,
            idDetalle: d.id,
            idDireccion: d.idDireccion ? String(d.idDireccion) : '',
            codigoProducto: d.codigoProducto,
            articulo: d.nombre || '',
            cantidad: String(d.kilos),
            costo: d.costo != null ? String(d.costo) : '',
            lote: d.lote || '',
            caducidad: d.caducidad ? String(d.caducidad).slice(0, 10) : '',
            factura: modo === 'nacional' ? d.numeroDocumento || '' : '',
            tipoDocumento: esInternacional ? d.tipoDocumento || '' : '',
            numeroDocumento: esInternacional ? d.numeroDocumento || '' : '',
          })),
        )
      })
      .catch(() => toast.error('No se pudo cargar la entrada'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEditar])

  const cols = esTraspaso
    ? ['cantidad', 'codigoProducto', 'articulo', 'lote']
    : esInternacional
    ? ['codigoProducto', 'cantidad', 'articulo', 'costo', 'numeroDocumento', 'tipoDocumento', 'lote', 'caducidad']
    : ['cantidad', 'codigoProducto', 'articulo', 'costo', 'lote', 'caducidad', 'factura']
  const encabezados = {
    cantidad: 'Kg', codigoProducto: 'Codigo', articulo: 'Descripcion articulo',
    costo: esInternacional ? 'Costo importacion' : 'Costo',
    lote: 'Lote', caducidad: 'Caducidad', factura: 'Factura',
    tipoDocumento: 'Tipo pedimento', numeroDocumento: 'Nombre pedimento',
  }
  // Las columnas de pedimento/factura casi siempre se repiten igual en todos los renglones de
  // una misma entrada — en vez de forzar a re-escribirlas, se ofrece duplicar desde el renglón
  // anterior.
  const COLUMNAS_DUPLICABLES = ['tipoDocumento', 'numeroDocumento', 'factura']

  const setFila = (i, c) => setFilas((p) => p.map((f, idx) => (idx === i ? { ...f, ...c } : f)))
  const elegirProducto = (i, codigo) => {
    const p = productos.find((x) => x.codigo === codigo)
    setFila(i, { codigoProducto: codigo, articulo: p?.especie || '' })
  }

  const totalKg = useMemo(() => filas.reduce((s, f) => s + Number(f.cantidad || 0), 0), [filas])

  // Los documentos DISTINTOS de la entrada (pedimento en importación, factura en nacional): un mismo
  // documento puede cubrir varios renglones, pero su archivo se sube una sola vez. Mismo criterio que
  // el servidor: tipo + número sin importar mayúsculas, y "Pedimento" si no se escribió el tipo.
  const documentosDe = (lista) => {
    if (esTraspaso) return []
    const mapa = new Map()
    for (const f of lista) {
      const numero = (esInternacional ? f.numeroDocumento : f.factura || '').trim()
      if (!numero) continue
      const tipo = esInternacional ? (f.tipoDocumento || '').trim() || 'Pedimento' : 'Factura'
      const clave = `${tipo.toLowerCase()}|${numero.toLowerCase()}`
      const previo = mapa.get(clave)
      if (previo) {
        previo.renglones += 1
        previo.kilos += Number(f.cantidad || 0)
      } else {
        const existente = documentosExistentes.find(
          (d) => (d.tipo || '').toLowerCase() === tipo.toLowerCase() && (d.numero || '').toLowerCase() === numero.toLowerCase(),
        )
        mapa.set(clave, { clave, tipo, numero, renglones: 1, kilos: Number(f.cantidad || 0), existente })
      }
    }
    return [...mapa.values()]
  }
  const documentosEntrada = useMemo(
    () => documentosDe(filas),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filas, documentosExistentes, modo],
  )

  const elegirArchivo = (clave, archivo) => {
    if (!archivo) return
    const error = validarArchivoDocumento(archivo)
    if (error) return toast.advertencia(error)
    setArchivos((p) => ({ ...p, [clave]: archivo }))
  }
  const quitarArchivo = (clave) =>
    setArchivos((p) => {
      const { [clave]: _quitado, ...resto } = p
      return resto
    })

  // Alta rápida de proveedor de origen (con deduplicación case-insensitive)
  const agregarOrigen = async () => {
    const nombre = normalizar(nuevoOrigen)
    if (!nombre) return toast.advertencia('Escribe el nombre del origen')
    const existente = empresas.find((e) => e.nombre.toLowerCase() === nombre.toLowerCase())
    if (existente) {
      setIdOrigen(String(existente.id))
      setNuevoOrigen('')
      setAgregandoOrigen(false)
      toast.info(`"${existente.nombre}" ya existía, se seleccionó ese.`)
      return
    }
    try {
      const { data } = await crearEmpresa({
        idUsuario: usuario?.id,
        nombre,
        tipo: 'Proveedor',
      })
      await recargarEmpresas()
      setIdOrigen(String(data.id))
      setNuevoOrigen('')
      setAgregandoOrigen(false)
      toast.exito(`Origen "${nombre}" agregado`)
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo agregar el origen')
    }
  }

  const guardar = async () => {
    if (!esTraspaso && !idOrigen) return toast.advertencia('Selecciona el origen')
    if (!idDireccion) return toast.advertencia('Selecciona la bodega de destino')
    const validas = filas.filter((f) => f.codigoProducto && f.lote && Number(f.cantidad) > 0)
    if (validas.length === 0)
      return toast.advertencia('Agrega al menos un producto con código, lote y cantidad')

    // Cada documento distinto debe llevar su archivo (salvo uno que ya lo tiene en el sistema).
    const docs = documentosDe(validas)
    const faltantes = docs.filter((d) => !d.existente?.tieneArchivo && !archivos[d.clave])
    if (faltantes.length > 0)
      return toast.advertencia(`Sube el archivo de: ${faltantes.map((d) => `${d.tipo} ${d.numero}`).join(', ')}`)

    setGuardando(true)
    try {
      // Los archivos se suben primero (quedan en espera) y la entrada los liga a su documento al
      // guardarse; si falta alguno el servidor rechaza la entrada completa.
      const archivosPayload = []
      for (const d of docs) {
        if (d.existente?.tieneArchivo) continue
        const subido = await subirArchivoTemporal(archivos[d.clave])
        archivosPayload.push({ tipoDocumento: d.tipo, numeroDocumento: d.numero, token: subido.data.token })
      }
      const facturas = [...new Set(validas.map((f) => f.factura).filter(Boolean))].join(', ')
      const pedimentos = [...new Set(validas.map((f) => f.numeroDocumento).filter(Boolean))].join(', ')
      const payload = {
        archivos: archivosPayload,
        idUsuario: usuario?.id,
        idEmpresa: esTraspaso ? null : Number(idOrigen),
        urlRemision: null,
        urlFactura: modo === 'nacional' ? facturas || null : null,
        numeroEmbarque: esTraspaso ? 'TRASPASO' : esInternacional ? pedimentos || null : null,
        numeroContenedor: esInternacional ? numeroContenedor || null : null,
        transporte:
          idChofer || idTractocamion
            ? {
                idChofer: idChofer ? Number(idChofer) : null,
                idTractocamion: idTractocamion ? Number(idTractocamion) : null,
                idCaja: null,
              }
            : null,
        detalles: validas.map((f) => ({
          codigoProducto: f.codigoProducto,
          lote: f.lote,
          kilos: Number(f.cantidad),
          costo: !esTraspaso && f.costo ? Number(f.costo) : null,
          caducidad: !esTraspaso && f.caducidad ? f.caducidad : null,
          idDetalle: f.idDetalle || null,
          idDireccion: Number(f.idDireccion || idDireccion),
          idDepartamento: null,
          // El documento de origen del lote: pedimento en internacional, factura en nacional —
          // mismo mecanismo (Existencia.DocumentoOrigen), así una misma entrada puede traer más
          // de un pedimento o factura distinto, uno por renglón.
          tipoDocumento: esInternacional && f.tipoDocumento ? f.tipoDocumento : modo === 'nacional' && f.factura ? 'Factura' : null,
          numeroDocumento: esInternacional && f.numeroDocumento ? f.numeroDocumento : modo === 'nacional' && f.factura ? f.factura : null,
        })),
      }
      const respuesta = idEditar ? await actualizarEntrada(idEditar, payload) : await crearEntrada(payload)
      toast.exito(idEditar ? 'Entrada actualizada' : 'Entrada registrada correctamente')
      const avisos = respuesta.data?.advertencias || []
      if (avisos.length > 0) toast.advertencia(avisos.join(' · '))
      navigate('/entradas')
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo guardar la entrada')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Layout>
      <PageHeader titulo={idEditar ? `Editar ${TITULOS[modo]}` : TITULOS[modo]} />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          {!esTraspaso && (
            <div>
              <span className="text-sm font-semibold text-teal">Origen</span>
              {agregandoOrigen ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    className="gm-input w-56 py-1.5"
                    placeholder="Nuevo origen (país, ciudad, proveedor…)"
                    value={nuevoOrigen}
                    autoFocus
                    onChange={(e) => setNuevoOrigen(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && agregarOrigen()}
                  />
                  <button className="gm-btn-guardar py-1.5" onClick={agregarOrigen}>
                    Agregar
                  </button>
                  <button
                    className="text-sm text-gray-500 hover:underline"
                    onClick={() => {
                      setAgregandoOrigen(false)
                      setNuevoOrigen('')
                    }}
                  >
                    cancelar
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <select
                    className="gm-input w-64"
                    value={idOrigen}
                    onChange={(e) => setIdOrigen(e.target.value)}
                  >
                    <option value="">Selecciona…</option>
                    {[...empresas]
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="text-sm font-semibold text-teal"
                    onClick={() => setAgregandoOrigen(true)}
                  >
                    + Nuevo
                  </button>
                </div>
              )}
            </div>
          )}

          <label className="text-sm font-semibold text-teal">
            Bodega de destino
            <select
              className="gm-input mt-1 w-64"
              value={idDireccion}
              onChange={(e) => {
                setIdDireccion(e.target.value)
                setFilas((p) => p.map((f) => ({ ...f, idDireccion: '' })))
              }}
            >
              <option value="">Selecciona…</option>
              {direcciones.filter((d) => !esBodegaRestringida(empresas, d.idEmpresa)).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.direccion} {d.municipio ? `— ${d.municipio}` : ''} {d.empresa ? `(${d.empresa})` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h2 className="mb-3 text-xl font-bold text-marca">Detalles de mercancia</h2>
        <div className="overflow-x-auto">
          <table className="gm-tabla-grid">
            <thead>
              <tr>
                {cols.map((k) => <th key={k}>{encabezados[k]}</th>)}
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i}>
                  {cols.map((k) => (
                    <td key={k}>
                      {k === 'codigoProducto' ? (
                        <select
                          className="w-full bg-transparent text-sm outline-none"
                          value={f.codigoProducto}
                          onChange={(e) => elegirProducto(i, e.target.value)}
                        >
                          <option value="">▼</option>
                          {productos.map((p) => (
                            <option key={p.codigo} value={p.codigo}>
                              {p.codigo}
                            </option>
                          ))}
                        </select>
                      ) : k === 'articulo' ? (
                        <span className="text-sm">{f.articulo || '—'}</span>
                      ) : COLUMNAS_DUPLICABLES.includes(k) ? (
                        <div className="flex items-center gap-1">
                          <input
                            className="w-full bg-transparent text-sm outline-none"
                            list={k === 'tipoDocumento' ? 'tipos-documento-list' : undefined}
                            placeholder={k === 'tipoDocumento' ? 'A1, C1…' : ''}
                            value={f[k]}
                            onChange={(e) => setFila(i, { [k]: e.target.value })}
                          />
                          {i > 0 && !f[k] && filas[i - 1][k] && (
                            <button
                              type="button"
                              className="shrink-0 text-xs text-marca underline"
                              onClick={() => setFila(i, { [k]: filas[i - 1][k] })}
                              title={`Copiar del renglón anterior: ${filas[i - 1][k]}`}
                            >
                              duplicar
                            </button>
                          )}
                        </div>
                      ) : (
                        <input
                          className="w-full bg-transparent text-sm outline-none"
                          type={k === 'cantidad' || k === 'costo' ? 'number' : k === 'caducidad' ? 'date' : 'text'}
                          value={f[k]}
                          onChange={(e) => setFila(i, { [k]: e.target.value })}
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <button
                      aria-label="Quitar fila"
                      onClick={() => setFilas((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)))}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="var(--color-cancelar)" strokeWidth="2" fill="white" />
                        <path d="M7.5 12h9" stroke="var(--color-cancelar)" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {esInternacional && (
            <datalist id="tipos-documento-list">
              {tiposDocumento.map((t) => (
                <option key={t.id} value={t.nombre} />
              ))}
            </datalist>
          )}
        </div>

        <div className="mt-3 flex items-center gap-4">
          <AgregarBoton onClick={() => setFilas((p) => [...p, { ...FILA }])}>Producto</AgregarBoton>
          <span className="ml-auto text-lg font-bold text-teal">
            Total <span className="text-black">{totalKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</span>
          </span>
        </div>

        {!esTraspaso && (
          <div className="mt-6">
            <h2 className="mb-1 text-xl font-bold text-marca">Documentos de esta entrada</h2>
            <p className="mb-3 text-xs text-gray-500">
              Cada {esInternacional ? 'pedimento' : 'factura'} distinto necesita su archivo (PDF, imagen o XML, máx.{' '}
              {MAX_ARCHIVO_DOCUMENTO_MB} MB). Se guarda ligado a su nombre para sacarlo después desde Pedimentos.
            </p>
            {documentosEntrada.length === 0 ? (
              <p className="text-sm text-gray-400">
                Escribe el {esInternacional ? 'nombre del pedimento' : 'número de factura'} en los renglones y aquí aparecerá
                el espacio para subir su documento.
              </p>
            ) : (
              <div className="max-w-3xl space-y-2">
                {documentosEntrada.map((d) => {
                  const archivo = archivos[d.clave]
                  const yaTiene = d.existente?.tieneArchivo
                  return (
                    <div
                      key={d.clave}
                      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
                        yaTiene || archivo ? 'border-teal/40 bg-teal/5' : 'border-cancelar/50 bg-red-50'
                      }`}
                    >
                      <div className="min-w-48 flex-1">
                        <span className="font-semibold">
                          {d.tipo} {d.numero}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          {d.renglones} renglón(es) · {d.kilos.toLocaleString('es-MX', { maximumFractionDigits: 3 })} kg
                        </span>
                      </div>
                      {yaTiene ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-teal">Ya tiene archivo: {d.existente.archivoNombre}</span>
                          <button
                            type="button"
                            className="font-semibold text-marca underline"
                            onClick={() =>
                              abrirArchivoDocumento(d.existente.id).catch(() => toast.error('No se pudo abrir el documento'))
                            }
                          >
                            Ver
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          {archivo ? (
                            <>
                              <span className="text-teal">
                                {archivo.name} ({Math.max(1, Math.round(archivo.size / 1024))} KB)
                              </span>
                              <button type="button" className="text-cancelar" onClick={() => quitarArchivo(d.clave)}>
                                quitar
                              </button>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-cancelar">Requerido</span>
                          )}
                          <label className="cursor-pointer rounded-full border border-teal px-3 py-1 text-xs font-semibold text-teal hover:bg-teal/10">
                            {archivo ? 'Cambiar' : 'Subir documento'}
                            <input
                              type="file"
                              hidden
                              accept={TIPOS_ARCHIVO_DOCUMENTO}
                              onChange={(e) => {
                                elegirArchivo(d.clave, e.target.files[0])
                                e.target.value = ''
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {esInternacional && (
          <label className="mt-3 block text-sm font-semibold text-teal">
            No. Contenedor
            <input
              className="gm-input mt-1 w-48"
              placeholder="Número"
              value={numeroContenedor}
              onChange={(e) => setNumeroContenedor(e.target.value)}
            />
          </label>
        )}

        <h2 className="mt-8 mb-3 text-xl font-bold text-marca">Datos de transporte (opcional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl">
          <label className="text-sm font-semibold text-teal">
            Chofer
            <select className="gm-input mt-1" value={idChofer} onChange={(e) => setIdChofer(e.target.value)}>
              <option value="">Sin chofer</option>
              {choferes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.numeroTelefono ? `— ${c.numeroTelefono}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-teal">
            Tractocamión / Empresa transporte
            <select
              className="gm-input mt-1"
              value={idTractocamion}
              onChange={(e) => setIdTractocamion(e.target.value)}
            >
              <option value="">Sin tractocamión</option>
              {tractocamiones.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.placa || t.placas} {t.empresa ? `— ${t.empresa}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button className="gm-btn-cancelar" onClick={() => navigate('/entradas')}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Layout>
  )
}
