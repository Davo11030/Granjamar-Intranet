import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Cargando from '../../components/Cargando'
import { getDirecciones, getEmpresas } from '../../api/destinos'
import { avisar } from '../../utils/avisoCarga'

// Destinos: solo para consultar. Las direcciones (con su C.P. y # de segmento) se agregan y se modifican en
// Admin → Empresas, dentro de cada empresa.
export default function Destinos() {
  const [errorCarga, setErrorCarga] = useState(false)
  const [datos, setDatos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    Promise.all([getDirecciones(), getEmpresas()])
      .then(([d, e]) => {
        setDatos(d.data)
        setEmpresas(e.data)
      })
      .catch(avisar('No se pudieron cargar los destinos', () => setErrorCarga(true)))
      .finally(() => setCargando(false))
  }, [])

  const rfcPorEmpresa = useMemo(
    () => Object.fromEntries(empresas.map((e) => [e.nombre, e.rfc])),
    [empresas],
  )

  const filtrados = datos.filter((d) => {
    const q = busqueda.toLowerCase()
    return (
      (d.empresa || '').toLowerCase().includes(q) ||
      (d.direccion || '').toLowerCase().includes(q) ||
      (d.municipio || '').toLowerCase().includes(q) ||
      (d.estado || '').toLowerCase().includes(q)
    )
  })

  return (
    <Layout>
      <PageHeader titulo="Destinos" />

      <div className="px-6 md:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar por empresa, estado o dirección" className="w-80 max-w-full" />
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-tabla">
              <thead>
                <tr>
                  <th className="italic">Empresa</th>
                  <th>Estado</th>
                  <th>Municipio</th>
                  <th>C.P.</th>
                  <th># Segmento</th>
                  <th>Direccion</th>
                  <th>RFC</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr key={d.id}>
                    <td>{d.empresa || '—'}</td>
                    <td>{d.estado || '—'}</td>
                    <td>{d.municipio || '—'}</td>
                    <td>{d.codigoPostal || '—'}</td>
                    <td className="font-mono text-sm">{d.segmento || '—'}</td>
                    <td>{d.direccion}</td>
                    <td className="font-mono text-sm">{rfcPorEmpresa[d.empresa] || '—'}</td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="!py-12 text-center text-gray-400">
                      {errorCarga ? 'No se pudo cargar la información. Recarga la página para intentar de nuevo.' : 'Sin destinos registrados'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
