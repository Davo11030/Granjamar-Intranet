import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import { Flecha } from '../../components/HistorialTrazabilidad'
import { getHistorialEmpresa } from '../../api/inventario'

const num = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// "martes, 6 de octubre de 2026"
const fechaCompleta = (f) => {
  const t = new Date(f).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Un ingreso por folio no tiene lote propio (el lote interno es el folio mismo): ahí no se muestra.
const loteInterno = (m) => (m.esEntrada && m.folio && m.lote === m.folio ? '—' : m.lote || '—')

// Historial de UN artículo dentro de una empresa en consignación: todos sus lotes en una sola tabla,
// con inventario final corriendo. En los embarques, la descripción es la empresa transportista y el
// lote interno es el número de embarque.
export default function ConsignacionHistorial() {
  const { IdEmpresa, idEmpresa, id } = useParams()
  const empresaId = IdEmpresa || idEmpresa
  const codigo = decodeURIComponent(id)
  const navigate = useNavigate()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    getHistorialEmpresa(empresaId, codigo)
      .then((res) => setDatos(res.data))
      .catch((e) => console.error('Error cargando historial de consignación:', e))
      .finally(() => setCargando(false))
  }, [empresaId, codigo])

  // El servidor los entrega del más viejo al más nuevo (el Inv. final se acumula en ese orden); aquí se
  // muestran del más reciente al más viejo. El saldo previo sin fecha queda al final.
  const movs = [...(datos?.movimientos || [])].reverse()
  const p = datos?.producto

  return (
    <Layout>
      <PageHeader titulo="Historial de trazabilidad" subtitulo={datos ? `${p.codigo} — con ${datos.empresa}` : ''} />

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
          <p className="py-12 text-center text-gray-400">No se encontró el artículo</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Fecha</th>
                  <th>Folio {datos.empresa}</th>
                  <th>Descripción</th>
                  <th className="text-right">Cajas</th>
                  <th className="text-right">Transacción</th>
                  <th className="text-right">Inv. final</th>
                  <th>Nombre del chofer</th>
                  <th>Lote interno</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => {
                  const esEmbarque = !!m.numeroEmbarque
                  return (
                    <tr key={m.id}>
                      <td>
                        <span className="whitespace-nowrap rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">
                          {m.fecha ? fechaCompleta(m.fecha) : '—'}
                        </span>
                      </td>
                      <td className="text-sm">{m.esEntrada ? m.folio || '—' : '—'}</td>
                      <td className="text-sm text-gray-500">
                        {esEmbarque ? m.empresaTransporte || '—' : m.bodega || '—'}
                      </td>
                      <td className="text-right text-sm">{m.cajas != null ? num(m.cajas) : '—'}</td>
                      <td className="whitespace-nowrap text-right font-semibold" title={m.tipoMovimiento}>
                        {num(m.kilos)} <Flecha arriba={m.esEntrada} />
                      </td>
                      <td className="text-right font-bold text-marca">{num(m.invFinal)}</td>
                      <td className="text-sm">{m.nombreChofer || '—'}</td>
                      <td className="text-sm font-semibold">{esEmbarque ? `Embarque #${m.numeroEmbarque}` : loteInterno(m)}</td>
                    </tr>
                  )
                })}
                {movs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="!py-12 text-center text-gray-400">
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
