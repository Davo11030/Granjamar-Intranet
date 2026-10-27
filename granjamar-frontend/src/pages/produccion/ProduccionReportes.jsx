import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import Paginacion from '../../components/Paginacion'
import AgregarBoton from '../../components/AgregarBoton'
import usePaginacion from '../../hooks/usePaginacion'
import { getProducciones } from '../../api/produccion'

// "2026-10-22" → "22/10/2026" (sin pasar por Date, para que la zona horaria no mueva el día)
const fechaLarga = (f) => String(f).slice(0, 10).split('-').reverse().join('/')
const kg = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const o = (n) => (Number(n) > 0 ? kg(n) : '—')

// Los reportes diarios en listado, uno por día, del más reciente al más viejo.
export default function ProduccionReportes() {
  const { puede } = useAuth()
  const navigate = useNavigate()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(datos, 20)

  useEffect(() => {
    getProducciones().then((r) => setDatos(r.data)).catch(console.error).finally(() => setCargando(false))
  }, [])

  return (
    <Layout>
      <PageHeader titulo="Reportes de produccion" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button className="gm-pill" onClick={() => navigate('/produccion')}>
            ← Producción
          </button>
          {puede('produccion', 'crear') && <AgregarBoton onClick={() => navigate('/produccion/nueva')}>Agregar</AgregarBoton>}
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="gm-tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="text-right">Renglones</th>
                    <th className="text-right">Entrada (kg)</th>
                    <th className="text-right">M.P. en procesos (kg)</th>
                    <th className="text-right">Salida (kg)</th>
                    <th>Registró</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((r) => (
                    <tr key={r.fecha}>
                      <td className="whitespace-nowrap font-semibold">{fechaLarga(r.fecha)}</td>
                      <td className="text-right">{r.renglones}</td>
                      <td className="text-right">{o(r.entrada)}</td>
                      <td className="text-right">{o(r.enProceso)}</td>
                      <td className="text-right">{o(r.salida)}</td>
                      <td className="text-sm text-gray-500">{r.usuario}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button className="gm-pill" onClick={() => navigate(`/produccion/${r.fecha}`)}>
                            Ver
                          </button>
                          {puede('produccion', 'editar') && (
                            <button className="gm-pill" onClick={() => navigate(`/produccion/${r.fecha}/editar`)}>
                              Editar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {datos.length === 0 && (
                    <tr>
                      <td colSpan={7} className="!py-12 text-center text-gray-400">
                        Sin reportes de producción registrados
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
    </Layout>
  )
}
