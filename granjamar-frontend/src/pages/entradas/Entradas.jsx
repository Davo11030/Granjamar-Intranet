import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import AgregarBoton from '../../components/AgregarBoton'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import usePaginacion from '../../hooks/usePaginacion'
import { getEntradas, getEntrada, cambiarEstadoEntrada, getHistorialEstadoEntrada } from '../../api/entradas'
import { abrirArchivoDocumento } from '../../api/documentos'
import { formatearFecha, formatearFechaHora } from '../../utils/fecha'

const ESTADOS_COMPRA = ['Solicitado', 'Pendiente por recibir', 'Pendiente por pagar', 'Completado']
const ESTADO_COMPRA_CLASE = {
  Solicitado: 'bg-gray-100 text-gray-600',
  'Pendiente por recibir': 'bg-amber-100 text-amber-700',
  'Pendiente por pagar': 'bg-blue-100 text-blue-700',
  Completado: 'bg-green-100 text-green-700',
}

export default function Entradas() {
  const navigate = useNavigate()
  const toast = useToast()
  const { usuario, puede } = useAuth()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [tipo, setTipo] = useState('')
  const [historial, setHistorial] = useState(null)
  const [historialDatos, setHistorialDatos] = useState([])
  const [detalle, setDetalle] = useState(null)

  const cargar = () => {
    getEntradas().then((r) => setDatos(r.data)).catch(console.error).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const cambiarEstado = async (id, estado) => {
    try {
      await cambiarEstadoEntrada(id, { estado, idUsuario: usuario?.id })
      toast.exito('Estado actualizado')
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo actualizar el estado')
    }
  }

  const verHistorial = async (d) => {
    setHistorial(d)
    try {
      const res = await getHistorialEstadoEntrada(d.id)
      setHistorialDatos(res.data)
    } catch {
      toast.error('No se pudo cargar el historial')
    }
  }

  const verDetalle = async (d) => {
    try {
      const res = await getEntrada(d.id)
      setDetalle(res.data)
    } catch {
      toast.error('No se pudo cargar la entrada')
    }
  }

  const continuar = () => {
    if (!tipo) return toast.advertencia('Selecciona el tipo de entrada')
    setModal(false)
    navigate(`/entradas/${tipo}`)
  }

  const tipoEntrada = (d) => {
    const ne = (d.numeroEmbarque || '').trim()
    if (ne.toUpperCase() === 'TRASPASO') return 'Traspaso'
    if (ne) return 'Importación'
    return 'Nacional'
  }
  // Más nuevas primero (a igual fecha, la de mayor id).
  const filtrados = datos
    .filter((d) => {
      const q = busqueda.toLowerCase()
      return (d.empresa || '').toLowerCase().includes(q) || (d.numeroEmbarque || '').toLowerCase().includes(q)
    })
    .sort((a, b) => new Date(b.fechaRegistro) - new Date(a.fechaRegistro) || b.id - a.id)
  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(filtrados, 20)

  return (
    <Layout>
      <PageHeader titulo="Entradas" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Buscador
            valor={busqueda}
            onChange={(v) => {
              setBusqueda(v)
              setPagina(1)
            }}
            placeholder="Buscar por empresa u origen"
            className="w-72 max-w-full"
          />
          {puede('compras', 'crear') && <AgregarBoton onClick={() => setModal(true)}>Entrada</AgregarBoton>}
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="gm-tabla-grid">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Origen</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((d) => (
                    <tr key={d.id}>
                      <td>{formatearFecha(d.fechaRegistro)}</td>
                      <td>{d.empresa || d.origen || '—'}</td>
                      <td>{tipoEntrada(d)}</td>
                      <td>
                        <div className="flex flex-col items-center gap-1">
                          <select
                            className={`rounded-full border-0 px-3 py-1 text-xs font-semibold outline-none ${
                              ESTADO_COMPRA_CLASE[d.estado] || 'bg-gray-100 text-gray-600'
                            }`}
                            value={d.estado || 'Solicitado'}
                            disabled={!puede('compras', 'editar')}
                            onChange={(e) => cambiarEstado(d.id, e.target.value)}
                          >
                            {ESTADOS_COMPRA.map((e) => (
                              <option key={e} value={e}>
                                {e}
                              </option>
                            ))}
                          </select>
                          <button className="text-xs text-teal underline" onClick={() => verHistorial(d)}>
                            Historial
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="rounded-full bg-marca px-4 py-1 text-sm font-semibold text-white transition hover:brightness-95"
                            onClick={() => verDetalle(d)}
                          >
                            Visualizar
                          </button>
                          {puede('compras', 'editar') && !d.folioEmpresa && (
                            <button className="gm-pill" onClick={() => navigate(`/entradas/${d.id}/editar`)}>
                              Editar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={5} className="!py-12 text-center text-gray-400">
                        Sin entradas registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Paginacion total={total} porPagina={porPagina} paginaActual={pagina} onCambiar={setPagina} />
          </>
        )}
      </div>

      <Modal abierto={modal} onCerrar={() => setModal(false)} variante="cyan" ancho="max-w-md" titulo="Tipo de entrada:">
        {[
          ['nacional', 'Nacional', 'Compra de mercancía dentro de México (con factura).'],
          ['internacional', 'Importación', 'Importación de mercancía (con pedimento y régimen).'],
          ['traspaso', 'Traspaso', 'Movimiento interno de mercancía entre bodegas.'],
        ].map(([val, label, ayuda]) => (
          <label key={val} className="mb-3 flex cursor-pointer items-start gap-3 text-lg">
            <input type="radio" name="tipo" className="mt-1.5" checked={tipo === val} onChange={() => setTipo(val)} />
            <span>
              {label}
              <span className="block text-sm text-gray-500">{ayuda}</span>
            </span>
          </label>
        ))}

        <div className="mt-4 flex justify-end gap-3">
          <button className="gm-btn-cancelar" onClick={() => setModal(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={continuar}>
            Continuar
          </button>
        </div>
      </Modal>

      <Modal
        abierto={!!historial}
        onCerrar={() => setHistorial(null)}
        ancho="max-w-md"
        titulo={historial ? `Historial — ${historial.empresa || historial.origen || `Entrada #${historial.id}`}` : ''}
      >
        {historialDatos.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">Sin movimientos de estado registrados.</p>
        ) : (
          <ol className="space-y-4 border-l-2 border-linea pl-4">
            {historialDatos.map((h, i) => (
              <li key={i} className="relative">
                <span
                  className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-teal)' }}
                />
                <p className="text-sm font-semibold text-teal">{h.estado}</p>
                <p className="text-xs text-gray-400">
                  {formatearFechaHora(h.fecha)} — {h.usuario}
                </p>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-6 flex justify-end">
          <button className="gm-btn-guardar" onClick={() => setHistorial(null)}>
            Cerrar
          </button>
        </div>
      </Modal>

      <Modal
        abierto={!!detalle}
        onCerrar={() => setDetalle(null)}
        ancho="max-w-2xl"
        titulo={detalle ? `Entrada — ${detalle.empresa || 'Traspaso'}` : ''}
      >
        {detalle && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <span className="block text-xs text-gray-400">Fecha</span>
                {formatearFecha(detalle.fechaRegistro)}
              </div>
              <div>
                <span className="block text-xs text-gray-400">Tipo</span>
                {tipoEntrada(detalle)}
              </div>
              <div>
                <span className="block text-xs text-gray-400">Estado</span>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    ESTADO_COMPRA_CLASE[detalle.estado] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {detalle.estado || 'Solicitado'}
                </span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Usuario</span>
                {detalle.usuario || '—'}
              </div>
              {detalle.numeroContenedor && (
                <div>
                  <span className="block text-xs text-gray-400">No. Contenedor</span>
                  {detalle.numeroContenedor}
                </div>
              )}
            </div>

            {/* Cada renglón trae su propio documento de origen (pedimento o factura según el
                tipo) — una misma entrada puede traer más de uno, distinto por producto/lote. */}
            <div className="overflow-x-auto">
              <table className="gm-tabla-grid w-full">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Producto</th>
                    <th>Lote</th>
                    <th>Kilos</th>
                    <th>Costo</th>
                    <th>Caducidad</th>
                    <th>Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {(detalle.detalles || []).map((d) => (
                    <tr key={d.id}>
                      <td className="text-sm font-semibold">{d.codigoProducto}</td>
                      <td className="text-sm">{d.nombre || '—'}</td>
                      <td className="text-sm">{d.lote || '—'}</td>
                      <td className="text-sm">{Number(d.kilos || 0).toLocaleString('es-MX', { maximumFractionDigits: 3 })}</td>
                      <td className="text-sm">
                        {d.costo != null ? Number(d.costo).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '—'}
                      </td>
                      <td className="text-sm">{d.caducidad ? formatearFecha(d.caducidad) : '—'}</td>
                      <td className="text-sm">
                        {d.numeroDocumento ? `${d.tipoDocumento ? `${d.tipoDocumento} — ` : ''}${d.numeroDocumento}` : '—'}
                        {d.tieneArchivo && (
                          <button
                            type="button"
                            className="ml-2 text-xs font-semibold text-marca underline"
                            onClick={() =>
                              abrirArchivoDocumento(d.idDocumento).catch(() => toast.error('No se pudo abrir el documento'))
                            }
                          >
                            Ver
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(detalle.detalles || []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="!py-6 text-center text-gray-400">
                        Sin productos registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="mt-6 flex justify-end">
          <button className="gm-btn-guardar" onClick={() => setDetalle(null)}>
            Cerrar
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
