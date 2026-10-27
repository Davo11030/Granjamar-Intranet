import { useEffect, useRef, useState } from 'react'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useToast } from '../../context/ToastContext'
import { getPedimentos, crearPedimento } from '../../api/pedimentos'
import {
  getDocumentosTipo,
  adjuntarArchivoDocumento,
  abrirArchivoDocumento,
  validarArchivoDocumento,
  TIPOS_ARCHIVO_DOCUMENTO,
} from '../../api/documentos'
import { formatearFecha } from '../../utils/fecha'

export default function Pedimentos() {
  const { puede } = useAuth()
  const toast = useToast()
  const inputFile = useRef(null)
  const [datos, setDatos] = useState([])
  const [tipos, setTipos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [subiendoId, setSubiendoId] = useState(null)
  const [form, setForm] = useState({ numero: '', idTipo: '', lotes: '', descripcion: '', archivo: null })

  const cargar = () =>
    getPedimentos().then((r) => setDatos(r.data)).catch(console.error).finally(() => setCargando(false))
  useEffect(() => {
    cargar()
    getDocumentosTipo().then((r) => setTipos(r.data)).catch(console.error)
  }, [])

  // Se busca por número (ej. "2026import"), tipo, lote, producto o nombre del archivo.
  const filtrados = datos.filter((d) => {
    const q = busqueda.trim().toLowerCase()
    return [d.numero, d.tipo, d.lotes, d.producto, d.archivoNombre].some((v) => (v || '').toLowerCase().includes(q))
  })

  const elegirArchivo = (archivo) => {
    if (!archivo) return
    const error = validarArchivoDocumento(archivo)
    if (error) return toast.advertencia(error)
    setForm((f) => ({ ...f, archivo }))
  }

  const ver = (d) => abrirArchivoDocumento(d.id).catch(() => toast.error('No se pudo abrir el documento'))

  // Adjunta (o reemplaza) el archivo de un documento ya registrado — para los que se registraron
  // antes de que se pidiera el archivo.
  const subirArchivo = async (d, archivo) => {
    if (!archivo) return
    const error = validarArchivoDocumento(archivo)
    if (error) return toast.advertencia(error)
    setSubiendoId(d.id)
    try {
      await adjuntarArchivoDocumento(d.id, archivo)
      toast.exito(`Archivo de ${d.tipo} ${d.numero} guardado`)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo subir el archivo')
    } finally {
      setSubiendoId(null)
    }
  }

  const guardar = async () => {
    if (!form.numero.trim()) return toast.advertencia('Indica el número de pedimento o factura')
    if (!form.idTipo) return toast.advertencia('Elige el tipo de documento')
    if (!form.archivo) return toast.advertencia('Adjunta el documento')
    setGuardando(true)
    let creado = null
    try {
      const r = await crearPedimento({
        numero: form.numero.trim(),
        fecha: new Date().toISOString(),
        idDocumentoTipo: Number(form.idTipo),
        ruta: form.archivo.name,
      })
      creado = r.data
      await adjuntarArchivoDocumento(creado.id, form.archivo)
      toast.exito('Documento registrado')
      setModal(false)
      setForm({ numero: '', idTipo: '', lotes: '', descripcion: '', archivo: null })
    } catch (e) {
      toast.error(
        creado
          ? 'El documento se registró pero no se pudo subir el archivo; súbelo desde la lista'
          : e.response?.data?.mensaje || 'No se pudo registrar el documento',
      )
      if (creado) setModal(false)
    } finally {
      setGuardando(false)
      cargar()
    }
  }

  return (
    <Layout>
      <PageHeader titulo="Pedimentos" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Busca por número, tipo, lote o producto"
            className="w-80 max-w-full"
          />
          {puede('documentos', 'crear') && <AgregarBoton onClick={() => setModal(true)}>Documento</AgregarBoton>}
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Numero</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Lotes</th>
                  <th>Producto</th>
                  <th>Archivo</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium text-marca">{d.numero || d.ruta}</td>
                    <td>{d.tipo || '—'}</td>
                    <td>{formatearFecha(d.fecha)}</td>
                    <td className="text-sm text-gray-500">{d.lotes || '—'}</td>
                    <td className="text-sm text-gray-500">{d.producto || '—'}</td>
                    <td className="text-sm">
                      {d.tieneArchivo ? (
                        <div className="flex items-center gap-2">
                          <button type="button" className="gm-pill" onClick={() => ver(d)}>
                            Ver
                          </button>
                          <span className="max-w-40 truncate text-xs text-gray-400" title={d.archivoNombre}>
                            {d.archivoNombre}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-cancelar">Sin archivo</span>
                          {puede('documentos', 'editar') && (
                            <label className="cursor-pointer text-xs font-semibold text-marca underline">
                              {subiendoId === d.id ? 'Subiendo…' : 'Subir'}
                              <input
                                type="file"
                                hidden
                                accept={TIPOS_ARCHIVO_DOCUMENTO}
                                disabled={subiendoId === d.id}
                                onChange={(e) => {
                                  subirArchivo(d, e.target.files[0])
                                  e.target.value = ''
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="!py-12 text-center text-gray-400">
                      Sin documentos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo="Pedimentos" ancho="max-w-lg">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-marca">Número de pedimento o factura</span>
            <input
              className="gm-input mt-1"
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              placeholder="738932jf9"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-marca">Tipo de pedimento o factura</span>
            <select
              className="gm-input mt-1"
              value={form.idTipo}
              onChange={(e) => setForm({ ...form, idTipo: e.target.value })}
            >
              <option value="">Selecciona…</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-marca">Lotes a los que corresponde</span>
            <input
              className="gm-input mt-1"
              value={form.lotes}
              onChange={(e) => setForm({ ...form, lotes: e.target.value })}
              placeholder="Escribe aqui.."
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-marca">Descripción de los productos a los que pertenece</span>
            <textarea
              rows={3}
              className="gm-input mt-1"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Escribe aqui..."
            />
          </label>
          <div>
            <span className="text-sm font-semibold text-marca">Subir documento aquí</span>
            <button
              type="button"
              onClick={() => inputFile.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                elegirArchivo(e.dataTransfer.files[0])
              }}
              className="mt-1 flex w-full items-center justify-center rounded-xl border-2 border-dashed border-teal px-6 py-10 text-center text-teal transition hover:brightness-95"
              style={{ backgroundColor: 'var(--color-pill)' }}
            >
              {form.archivo ? form.archivo.name : 'Arrastrar o examinar'}
            </button>
            <input
              ref={inputFile}
              type="file"
              hidden
              accept={TIPOS_ARCHIVO_DOCUMENTO}
              onChange={(e) => elegirArchivo(e.target.files[0])}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setModal(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
