import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from './Layout'
import PageHeader from './PageHeader'
import Cargando from './Cargando'
import Modal from './Modal'
import { getTrazabilidad } from '../api/inventario'

const num = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function Flecha({ arriba }) {
  return arriba ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="entrada" className="inline">
      <path d="M12 5v14M12 5l-6 6M12 5l6 6" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="salida" className="inline">
      <path d="M12 19V5M12 19l-6-6M12 19l6-6" stroke="#dc2626" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Vista de trazabilidad reutilizable (consignación y resguardo).
export default function HistorialTrazabilidad() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [info, setInfo] = useState(false)

  useEffect(() => {
    setCargando(true)
    getTrazabilidad(id)
      .then((res) => setDatos(res.data))
      .catch((e) => console.error('Error cargando trazabilidad:', e))
      .finally(() => setCargando(false))
  }, [id])

  const movs = datos?.movimientos || []

  return (
    <Layout>
      <PageHeader
        titulo="Historial de trazabilidad"
        subtitulo={datos ? `${datos.codigoProducto} — Lote: ${datos.lote}` : ''}
      />

      <div className="px-6 md:px-10">
        <div className="flex justify-end mb-4">
          <button className="gm-agregar" onClick={() => setInfo(true)}>
            Transacción
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--color-agregar)" strokeWidth="2" fill="white" />
              <path d="M12 7.5v9M7.5 12h9" stroke="var(--color-agregar)" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {cargando ? (
          <Cargando />
        ) : !datos ? (
          <p className="text-center text-gray-400 py-12">No se encontró la existencia</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Fecha</th>
                  <th>Empresa Transporte</th>
                  <th>Nombre Chofer</th>
                  <th className="text-right">Transacción</th>
                  <th className="text-right">Saldo</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((mov) => (
                  <tr key={mov.id}>
                    <td>
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm whitespace-nowrap">
                        {new Date(mov.fecha).toLocaleDateString('es-MX')}
                      </span>
                    </td>
                    <td className="text-sm">{mov.empresaTransporte || '—'}</td>
                    <td className="text-sm">{mov.nombreChofer || '—'}</td>
                    <td className="text-right font-semibold whitespace-nowrap">
                      {num(mov.kilos)} <Flecha arriba={mov.esEntrada} />
                    </td>
                    <td className="text-right font-bold text-marca">{num(mov.saldo)}</td>
                    <td className="text-sm text-gray-500">{mov.direccion || '—'}</td>
                  </tr>
                ))}
                {movs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center !py-12 text-gray-400">
                      Sin movimientos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8">
          <button className="gm-btn-guardar" onClick={() => navigate(-1)}>
            ← Regresar
          </button>
        </div>
      </div>

      <Modal abierto={info} onCerrar={() => setInfo(false)} titulo="Transacciones" ancho="max-w-md">
        <p className="text-sm text-gray-600">
          Las transacciones de este producto se generan automáticamente desde los módulos de{' '}
          <strong>Entradas</strong> y <strong>Salidas</strong>. Selecciona ahí este producto para
          registrar un movimiento; aquí solo se consulta el historial.
        </p>
        <div className="flex justify-end mt-6">
          <button className="gm-btn-guardar" onClick={() => setInfo(false)}>
            Entendido
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
