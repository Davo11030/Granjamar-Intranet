import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import AgregarBoton from '../../components/AgregarBoton'
import usePaginacion from '../../hooks/usePaginacion'
import { getEmbarques } from '../../api/embarques'
import { getDirecciones } from '../../api/destinos'
import { getClientes } from '../../api/clientes'

export default function Embarques() {
  const { puede } = useAuth()
  const navigate = useNavigate()
  const [datos, setDatos] = useState([])
  const [destinos, setDestinos] = useState([])
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroDestino, setFiltroDestino] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  useEffect(() => {
    getEmbarques().then((r) => setDatos(r.data)).catch(console.error).finally(() => setCargando(false))
    getDirecciones().then((r) => setDestinos(r.data)).catch(console.error)
    getClientes().then((r) => setClientes(r.data)).catch(() => {})
  }, [])

  // Filtro por destino/fecha opera sobre los registros individuales (cada uno es un destino real
  // en el back) — así, si solo uno de los destinos de una requisición cae en el filtro, igual
  // aparece el bloque (agrupado más abajo).
  const registrosFiltrados = useMemo(
    () =>
      datos.filter((d) => {
        if (filtroDestino && (d.idCliente ? `c:${d.idCliente}` : `d:${d.idDireccion}`) !== filtroDestino) return false
        const fecha = d.fechaRegistro ? d.fechaRegistro.slice(0, 10) : ''
        if (desde && fecha < desde) return false
        if (hasta && fecha > hasta) return false
        return true
      }),
    [datos, filtroDestino, desde, hasta],
  )

  // Varios destinos de una misma requisición comparten "numero" (son varios embarques en el
  // back, uno por destino) — para el usuario es un solo embarque, así que se agrupan en un solo
  // bloque en vez de mostrar uno duplicado por destino.
  const items = useMemo(() => {
    const grupos = []
    const porNumero = new Map()
    for (const d of registrosFiltrados) {
      if (!d.numero) {
        grupos.push([d])
        continue
      }
      const existente = porNumero.get(d.numero)
      if (existente) existente.push(d)
      else {
        const grupo = [d]
        porNumero.set(d.numero, grupo)
        grupos.push(grupo)
      }
    }
    return grupos.map((g) => ({
      id: g[0].id,
      numero: g[0].numero ?? g[0].id,
      anio: g[0].fechaRegistro ? new Date(g[0].fechaRegistro).getFullYear() : null,
      estado: g.every((x) => x.estado === 'Completado') ? 'Completado' : 'En proceso',
      activo: g.some((x) => x.activo !== false),
    }))
  }, [registrosFiltrados])

  const filtrados = items
    .filter((d) => String(d.numero).toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => {
      if ((b.anio ?? 0) !== (a.anio ?? 0)) return (b.anio ?? 0) - (a.anio ?? 0)
      const an = Number(a.numero)
      const bn = Number(b.numero)
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return bn - an
      return String(b.numero).localeCompare(String(a.numero))
    })

  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(filtrados, 20)

  const reiniciarPagina = (setter) => (v) => {
    setter(v)
    setPagina(1)
  }

  return (
    <Layout>
      <PageHeader titulo="Embarques" />

      <div className="px-6 md:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Buscador
              valor={busqueda}
              onChange={reiniciarPagina(setBusqueda)}
              placeholder="Ingresa numero de embarque o producto"
              className="w-64 max-w-full"
            />
            <label className="flex flex-col text-xs font-semibold text-teal">
              Destino
              <select
                value={filtroDestino}
                onChange={(e) => reiniciarPagina(setFiltroDestino)(e.target.value)}
                className="mt-1 rounded-lg border-2 border-gray-300 px-3 py-1.5 text-sm text-black"
              >
                <option value="">Todos</option>
                {destinos.map((x) => (
                  <option key={`d${x.id}`} value={`d:${x.id}`}>
                    {x.direccion}
                    {x.municipio ? `, ${x.municipio}` : ''}
                  </option>
                ))}
                {clientes.map((c) => (
                  <option key={`c${c.id}`} value={`c:${c.id}`}>
                    Cliente: {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold text-teal">
              Desde
              <input
                type="date"
                value={desde}
                onChange={(e) => reiniciarPagina(setDesde)(e.target.value)}
                className="mt-1 rounded-lg border-2 border-gray-300 px-3 py-1.5 text-sm text-black"
              />
            </label>
            <label className="flex flex-col text-xs font-semibold text-teal">
              Hasta
              <input
                type="date"
                value={hasta}
                onChange={(e) => reiniciarPagina(setHasta)(e.target.value)}
                className="mt-1 rounded-lg border-2 border-gray-300 px-3 py-1.5 text-sm text-black"
              />
            </label>
            {(filtroDestino || desde || hasta) && (
              <button
                onClick={() => {
                  setFiltroDestino('')
                  setDesde('')
                  setHasta('')
                  setPagina(1)
                }}
                className="text-xs font-semibold text-cancelar underline"
              >
                Quitar filtros
              </button>
            )}
          </div>
          {puede('embarques', 'crear') && (
            <AgregarBoton onClick={() => navigate('/salidas/embarques/nuevo/requisicion')}>Embarque</AgregarBoton>
          )}
        </div>

        {cargando ? (
          <Cargando />
        ) : filtrados.length === 0 ? (
          <p className="py-16 text-center text-gray-400">No hay embarques registrados</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {datosPaginados.map((emb, i) => {
                const nuevoAnio = i === 0 || emb.anio !== datosPaginados[i - 1].anio
                return (
                  <Fragment key={emb.id}>
                    {nuevoAnio && emb.anio && (
                      <div className="col-span-full mt-2 flex items-center gap-3 first:mt-0">
                        <span className="text-sm font-extrabold text-teal">{emb.anio}</span>
                        <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-borde)' }} />
                      </div>
                    )}
                    <button
                      onClick={() => navigate(`/salidas/embarques/${emb.id}`)}
                      className="flex flex-col items-center gap-1 rounded-2xl py-8 text-3xl font-extrabold text-gray-800 shadow-sm transition hover:brightness-95"
                      style={{
                        backgroundColor:
                          emb.activo === false ? '#f9c9c9' : emb.estado === 'Completado' ? '#cdf6ec' : '#fdeecb',
                      }}
                    >
                      <span>#{emb.numero}</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {emb.activo === false ? 'Inactivo' : emb.estado || 'En proceso'}
                      </span>
                    </button>
                  </Fragment>
                )
              })}
            </div>
            <Paginacion total={total} porPagina={porPagina} paginaActual={pagina} onCambiar={setPagina} />
          </>
        )}
      </div>
    </Layout>
  )
}
