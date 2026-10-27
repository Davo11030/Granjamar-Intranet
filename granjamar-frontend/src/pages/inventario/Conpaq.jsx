import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import usePaginacion from '../../hooks/usePaginacion'
import { getUbicaciones, getProductos } from '../../api/inventario'
import { getEmpresas } from '../../api/destinos'

const kg = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const money = (n) =>
  n == null ? '—' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

export default function Conpaq() {
  const [datos, setDatos] = useState([])
  const [productos, setProductos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [lotesDe, setLotesDe] = useState(null)

  useEffect(() => {
    Promise.all([getUbicaciones(), getEmpresas(), getProductos()])
      .then(([ubs, emps, prods]) => {
        const interna = emps.data.find(
          (e) => e.tipo?.toLowerCase() === 'interna' || /granjamar/i.test(e.nombre),
        )
        const filas = interna
          ? ubs.data.filter((u) => String(u.idEmpresa) === String(interna.id))
          : ubs.data
        setDatos(filas)
        setProductos(
          Object.fromEntries((prods.data || []).map((p) => [p.codigo, p])),
        )
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [])

  const filtrados = useMemo(
    () =>
      datos.filter((d) => {
        const q = busqueda.toLowerCase()
        const p = productos[d.codigoProducto] || {}
        const descripcion = [p.especie, p.marca].filter(Boolean).join(' ') || d.codigoProducto
        return (
          d.codigoProducto?.toLowerCase().includes(q) ||
          descripcion.toLowerCase().includes(q) ||
          d.lote?.toLowerCase().includes(q)
        )
      }),
    [datos, productos, busqueda],
  )

  // Un solo renglón por producto, sumando todos sus lotes — el detalle de cada lote (cuánto hay
  // y a qué pedimento/factura pertenece) se ve en el modal "Ver lotes", no repetido en la tabla.
  const porProducto = useMemo(() => {
    const mapa = new Map()
    for (const d of filtrados) {
      // Un lote sin kilos ya no es inventario: no se lista en "Ver lotes".
      if (!(Number(d.cantidadKilos) > 0)) continue
      const p = productos[d.codigoProducto] || {}
      const previo = mapa.get(d.codigoProducto)
      const lote = {
        id: d.id,
        lote: d.lote,
        cantidadKilos: Number(d.cantidadKilos || 0),
        tipoDocumento: d.tipoDocumento,
        numeroDocumento: d.numeroDocumento,
      }
      if (previo) {
        previo.totalKilos += lote.cantidadKilos
        previo.lotes.push(lote)
      } else {
        mapa.set(d.codigoProducto, {
          codigoProducto: d.codigoProducto,
          descripcion: [p.especie, p.marca].filter(Boolean).join(' ') || d.codigoProducto,
          talla: p.talla || '—',
          pesoCaja: p.pesoCaja,
          precioKilo: p.precioKilo,
          totalKilos: lote.cantidadKilos,
          lotes: [lote],
        })
      }
    }
    // El catálogo completo de productos (tengan o no existencia) ya lo muestra Kardex — Conpaq
    // es inventario real, así que un producto sin kilos en ningún lote no aparece aquí.
    return [...mapa.values()]
  }, [filtrados, productos])

  const { datosPaginados, pagina, setPagina, total, porPagina } = usePaginacion(porProducto, 20)
  const totalKg = filtrados.reduce((s, d) => s + Number(d.cantidadKilos || 0), 0)

  return (
    <Layout>
      <PageHeader titulo="Conpaq" />

      <div className="px-6 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Buscador
            valor={busqueda}
            onChange={(v) => {
              setBusqueda(v)
              setPagina(1)
            }}
            placeholder="Ingresa código, descripción o lote"
            className="w-80 max-w-full"
          />
          <span className="text-sm font-semibold text-teal">Existencia total: {kg(totalKg)} kg</span>
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="gm-tabla">
                <thead>
                  <tr>
                    <th className="italic">Codigo</th>
                    <th>Descripcion</th>
                    <th>Talla</th>
                    <th className="text-right">Peso x caja kg</th>
                    <th className="text-right">Precio kg</th>
                    <th className="text-right">Existencias</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {datosPaginados.map((item) => (
                    <tr key={item.codigoProducto}>
                      <td className="font-mono text-sm">{item.codigoProducto}</td>
                      <td>{item.descripcion}</td>
                      <td>{item.talla}</td>
                      <td className="text-right">{item.pesoCaja != null ? kg(item.pesoCaja) : '—'}</td>
                      <td className="text-right">{money(item.precioKilo)}</td>
                      <td className="text-right font-semibold">{kg(item.totalKilos)}</td>
                      <td className="text-right">
                        <button className="gm-pill" onClick={() => setLotesDe(item)}>
                          Ver lotes
                        </button>
                      </td>
                    </tr>
                  ))}
                  {porProducto.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center !py-12 text-gray-400">
                        {busqueda ? 'Sin resultados para esa búsqueda' : 'Sin existencias registradas en Conpaq'}
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

      <Modal
        abierto={!!lotesDe}
        onCerrar={() => setLotesDe(null)}
        ancho="max-w-lg"
        titulo={lotesDe ? `Lotes — ${lotesDe.codigoProducto}` : ''}
      >
        {lotesDe && (
          <table className="gm-tabla-grid w-full">
            <thead>
              <tr>
                <th>Lote</th>
                <th className="text-right">Kilos</th>
                <th>Pedimento</th>
              </tr>
            </thead>
            <tbody>
              {lotesDe.lotes.map((l) => (
                <tr key={l.id}>
                  <td className="text-sm">{l.lote || '—'}</td>
                  <td className="text-right text-sm font-semibold">{kg(l.cantidadKilos)}</td>
                  <td className="text-sm">
                    {l.numeroDocumento ? `${l.tipoDocumento ? `${l.tipoDocumento} — ` : ''}${l.numeroDocumento}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-6 flex justify-end">
          <button className="gm-btn-guardar" onClick={() => setLotesDe(null)}>
            Cerrar
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
