import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import { Flecha } from '../../components/HistorialTrazabilidad'
import { getHistorialResguardo } from '../../api/inventario'
const num = (n) =>  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Historial de UN producto dentro de una empresa de resguardo: todos sus lotes en una sola tabla,
// con inventario final corriendo y el número de registro interno de cada salida.
export default function ResguardoHistorial() {
  const { IdEmpresa, id } = useParams()
  const codigo = decodeURIComponent(id)
  const navigate = useNavigate()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    getHistorialResguardo(IdEmpresa, codigo)
      .then((res) => setDatos(res.data))
      .catch((e) => console.error('Error cargando historial de resguardo:', e))
      .finally(() => setCargando(false))
  }, [IdEmpresa, codigo])

  // El servidor los entrega del más viejo al más nuevo (el Inv. final se acumula en ese orden); aquí se
  // muestran del más reciente al más viejo. El saldo previo sin fecha queda al final.
  const movs = [...(datos?.movimientos || [])].reverse()
  const p = datos?.producto

  return (
    <Layout>
      <PageHeader titulo="Historial de trazabilidad" subtitulo={datos ? `${p.codigo} — en ${datos.empresa}` : ''} />

      <div className="px-6 md:px-10">
        {p && (
          <div className="mb-4 flex flex-wrap gap-x-10 gap-y-2 text-sm">
            <div>
              <span className="block text-xs text-gray-400">Descripción producto</span>
              <span className="font-semibold">{p.descripcion || '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-400">Marca</span>
              <span className="font-semibold">{p.marca || '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-400">Talla</span>
              <span className="font-semibold">{p.talla || '—'}</span>
            </div>
          </div>
        )}

        {cargando ? (
          <Cargando />
        ) : !datos ? (
          <p className="text-center text-gray-400 py-12">No se encontró el producto</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Fecha</th>
                  <th>Empresa transporte</th>
                  <th>Nombre chofer</th>
                  <th>Lote</th>
                  <th>Contenedor</th>
                  <th>Tipo documento</th>
                  <th>Nombre documento</th>
                  <th>Bodega destino</th>
                  <th className="text-right">Transacción</th>
                  <th className="text-right">Inv. final</th>
                  <th className="text-right">Cajas</th>
                  <th className="text-right">Salida</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className="whitespace-nowrap rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">
                        {m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX') : '—'}
                      </span>
                    </td>
                    <td className="text-sm">{m.empresaTransporte || '—'}</td>
                    <td className="text-sm">{m.nombreChofer || '—'}</td>
                    <td className="text-sm">{m.lote || '—'}</td>
                    <td className="text-sm">{m.contenedor || '—'}</td>
                    <td className="text-sm">{m.tipoDocumento || '—'}</td>
                    <td className="text-sm">{m.numeroDocumento || '—'}</td>
                    <td className="text-sm text-gray-500">{m.bodega || '—'}</td>
                    <td className="whitespace-nowrap text-right font-semibold" title={m.tipoMovimiento}>
                      {num(m.kilos)} <Flecha arriba={m.esEntrada} />
                    </td>
                    <td className="text-right font-bold text-marca">{num(m.invFinal)}</td>
                    <td className="text-right text-sm">{m.cajas != null ? num(m.cajas) : '—'}</td>
                    <td className="text-right text-sm font-semibold">{m.salida ?? '—'}</td>
                  </tr>
                ))}
                {movs.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center !py-12 text-gray-400">
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
    </Layout>
  )
}
