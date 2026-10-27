import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import IconoMas from '../../components/IconoMas'
import usePaginacion from '../../hooks/usePaginacion'
import { getVentas, cambiarEstadoVenta } from '../../api/ventas'
import { formatearFecha, formatearHora } from '../../utils/fecha'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const estadoClase = (estado = '') => {
  const e = estado.toLowerCase()
  if (e.includes('pend')) return 'bg-[color:var(--color-pendiente-bg)] text-red-700'
  if (e.includes('proceso')) return 'text-amber-600'
  return 'text-green-700'
}

const ESTADO_VENTA_CLASE = {
  Programada: 'bg-blue-100 text-blue-700',
  'Pendiente entrega': 'bg-amber-100 text-amber-700',
  Entregada: 'bg-green-100 text-green-700',
}

export default function Ventas() {
  const navigate = useNavigate()
  const { usuario, puede, puedeAlguno } = useAuth()
  const toast = useToast()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [menu, setMenu] = useState(false)
  const [reporte, setReporte] = useState(false)
  const [rango, setRango] = useState({ desde: '', hasta: '' })
  const menuRef = useRef(null)

  const cargar = () => {
    getVentas().then((r) => setDatos(r.data)).catch(console.error).finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  const marcarEntregada = async (id) => {
    try {
      await cambiarEstadoVenta(id, { estado: 'Entregada', idUsuario: usuario?.id })
      toast.exito('Venta marcada como entregada')
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo actualizar el estado')
    }
  }

  useEffect(() => {
    const cerrar = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false)
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  const filtrados = datos.filter((d) => (d.cliente || '').toLowerCase().includes(busqueda.toLowerCase()))
  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(filtrados, 20)

  return (
    <Layout>
      <PageHeader titulo="Ventas" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button className="gm-btn-guardar" onClick={() => setReporte(true)}>
              Reporte
            </button>
            {puedeAlguno([['ventas', 'corte'], ['ventas', 'ver']]) && (
              <button className="gm-pill" onClick={() => navigate('/salidas/ventas/corte')}>
                Corte de caja
              </button>
            )}
          </div>
          <Buscador
            valor={busqueda}
            onChange={(v) => {
              setBusqueda(v)
              setPagina(1)
            }}
            placeholder="Ingresa nombre de cliente"
            className="w-72 max-w-full"
          />
          <div className="relative" ref={menuRef}>
            {puede('ventas', 'crear') && (
              <button className="gm-agregar" onClick={() => setMenu((v) => !v)}>
                Venta <IconoMas />
              </button>
            )}
            {menu && (
              <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                <button
                  className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                  onClick={() => navigate('/salidas/ventas/mostrador')}
                >
                  Mostrador
                </button>
                <button
                  className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                  onClick={() => navigate('/salidas/ventas/mayoreo')}
                >
                  Mayoreo
                </button>
              </div>
            )}
          </div>
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="gm-tabla">
                <thead>
                  <tr>
                    <th aria-hidden="true" />
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Nombre cliente</th>
                    <th>Forma de pago</th>
                    <th className="text-right">Total</th>
                    <th>Estado recoleccion</th>
                    <th>Estado</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <button
                          onClick={() => window.print()}
                          className="text-gray-400 hover:text-teal"
                          aria-label="Imprimir"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M6 9V3h12v6M6 18H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-2M6 14h12v7H6z"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                      <td>{formatearFecha(v.fechaRegistro)}</td>
                      <td>{formatearHora(v.fechaRegistro)}</td>
                      <td>{v.cliente || 'Venta mostrador'}</td>
                      <td>{v.formaPago || '—'}</td>
                      <td className="text-right font-semibold">
                        {`$${Number(v.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td>
                        {v.estadoRecoleccion ? (
                          <span className={`rounded px-3 py-1 text-sm font-medium ${estadoClase(v.estadoRecoleccion)}`}>
                            {v.estadoRecoleccion}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            ESTADO_VENTA_CLASE[v.estado] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {v.estado || '—'}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {v.estado !== 'Entregada' && puede('ventas', 'editar') && (
                          <button className="gm-pill mr-2" onClick={() => marcarEntregada(v.id)}>
                            Marcar entregada
                          </button>
                        )}
                        <button className="gm-pill" onClick={() => navigate(`/salidas/ventas`)}>
                          Detalles
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center !py-12 text-gray-400">
                        Sin ventas registradas
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

      <Modal abierto={reporte} onCerrar={() => setReporte(false)} titulo="Reporte de ventas" ancho="max-w-md">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Fecha inicio</span>
            <input
              type="date"
              className="gm-input mt-1"
              value={rango.desde}
              onChange={(e) => setRango({ ...rango, desde: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Fecha fin</span>
            <input
              type="date"
              className="gm-input mt-1"
              value={rango.hasta}
              onChange={(e) => setRango({ ...rango, hasta: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-8 flex justify-end gap-4">
          <button className="gm-btn-cancelar" onClick={() => setReporte(false)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={() => window.print()}>
            Generar
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
