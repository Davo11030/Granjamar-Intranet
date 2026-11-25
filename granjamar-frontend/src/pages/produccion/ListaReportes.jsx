import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Cargando from '../../components/Cargando'
import { getProducciones } from '../../api/produccion'
import { avisar } from '../../utils/avisoCarga'

// "2026-10-22" → "22/10/2026" (sin pasar por Date, para que la zona horaria no mueva el día)
const fechaLarga = (f) => String(f).slice(0, 10).split('-').reverse().join('/')
const kg = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const o = (n) => (Number(n) > 0 ? kg(n) : '—')

// Los reportes diarios de producción, uno por día, del más reciente al más viejo. Van debajo de la tabla general y se
// recorren con scroll dentro de su propio recuadro (el encabezado queda fijo).
export default function ListaReportes() {
  const [errorCarga, setErrorCarga] = useState(false)
  const { puede } = useAuth()
  const navigate = useNavigate()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    getProducciones().then((r) => setDatos(r.data)).catch(avisar('No se pudieron cargar los reportes de producción', () => setErrorCarga(true))).finally(() => setCargando(false))
  }, [])

  return (
    <section className="mt-12">
      <h2 className="mb-3 text-xl font-semibold text-teal">Reportes diarios</h2>
      {cargando ? (
        <Cargando />
      ) : (
        <div className="max-h-[28rem] overflow-auto rounded-2xl">
          <table className="gm-tabla">
            <thead className="sticky top-0 z-10">
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
              {datos.map((r) => (
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
                    {errorCarga ? 'No se pudo cargar la información. Recarga la página para intentar de nuevo.' : 'Sin reportes de producción registrados'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
