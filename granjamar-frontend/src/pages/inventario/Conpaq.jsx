import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Buscador from '../../components/Buscador'
import Paginacion from '../../components/Paginacion'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import usePaginacion from '../../hooks/usePaginacion'
import { getUbicaciones, getProductos, ajustarInventario } from '../../api/inventario'
import { getEmpresas } from '../../api/destinos'
import { avisar } from '../../utils/avisoCarga'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const kg = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const money = (n) =>
  n == null ? '—' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

export default function Conpaq() {
  const [errorCarga, setErrorCarga] = useState(false)
  const [datos, setDatos] = useState([])
  const [productos, setProductos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [lotesDe, setLotesDe] = useState(null)
  const [sinInterna, setSinInterna] = useState(false)
  const [ajuste, setAjuste] = useState(null) // { lote, kilos, motivo } del lote que se está ajustando
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)
  const { puede } = useAuth()
  const toast = useToast()

  const cargar = () =>
    Promise.all([getUbicaciones(), getEmpresas(), getProductos()])
      .then(([ubs, emps, prods]) => {
        // Conpaq es el inventario propio: el de las empresas INTERNAS. Si todavía no hay ninguna dada de alta no se
        // muestra nada (antes se mezclaba el inventario de todas las empresas, incluidas consignación y resguardo).
        const internas = new Set(
          emps.data.filter((e) => e.tipo?.toLowerCase() === 'interna' || /granjamar/i.test(e.nombre)).map((e) => String(e.id)),
        )
        setSinInterna(internas.size === 0)
        const filas = ubs.data.filter((u) => internas.has(String(u.idEmpresa)))
        setDatos(filas)
        setProductos(
          Object.fromEntries((prods.data || []).map((p) => [p.codigo, p])),
        )
      })
      .catch(avisar('No se pudo cargar el inventario', () => setErrorCarga(true)))
      .finally(() => setCargando(false))
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const guardarAjuste = async () => {
    const kilos = Number(ajuste.kilos)
    if (ajuste.kilos === '' || !(kilos >= 0)) return toast.advertencia('Escribe los kilos que hay físicamente (0 o más)')
    if (!ajuste.motivo.trim()) return toast.advertencia('Escribe el motivo del ajuste')
    setGuardandoAjuste(true)
    try {
      const { data } = await ajustarInventario(ajuste.lote.id, { kilosContados: kilos, motivo: ajuste.motivo.trim() })
      const dif = Number(data.diferencia)
      toast.exito(`Ajuste registrado (#${data.registro}): ${dif > 0 ? '+' : '−'}${kg(Math.abs(dif))} kg en el lote ${ajuste.lote.lote}`)
      setAjuste(null)
      setLotesDe(null)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo registrar el ajuste')
    } finally {
      setGuardandoAjuste(false)
    }
  }

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
        bodega: [d.empresa, d.direccion].filter(Boolean).join(' · '),
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
                        {busqueda ? 'Sin resultados para esa búsqueda' : (errorCarga ? 'No se pudo cargar la información. Recarga la página para intentar de nuevo.' : sinInterna ? 'No hay ninguna empresa de tipo INTERNA. Dala de alta en Admin → Empresas para ver aquí su inventario.' : 'Sin existencias registradas en Conpaq')}
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
                <th>Bodega</th>
                <th className="text-right">Kilos</th>
                <th>Pedimento</th>
                {puede('inventario', 'editar') && <th aria-hidden="true" />}
              </tr>
            </thead>
            <tbody>
              {lotesDe.lotes.map((l) => (
                <tr key={l.id}>
                  <td className="text-sm">{l.lote || '—'}</td>
                  <td className="text-sm">{l.bodega || '—'}</td>
                  <td className="text-right text-sm font-semibold">{kg(l.cantidadKilos)}</td>
                  <td className="text-sm">
                    {l.numeroDocumento ? `${l.tipoDocumento ? `${l.tipoDocumento} — ` : ''}${l.numeroDocumento}` : '—'}
                  </td>
                  {puede('inventario', 'editar') && (
                    <td className="text-right">
                      <button className="text-xs font-semibold text-marca underline" onClick={() => setAjuste({ lote: l, kilos: '', motivo: '' })}>
                        Ajustar
                      </button>
                    </td>
                  )}
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
      <Modal abierto={!!ajuste} onCerrar={() => setAjuste(null)} ancho="max-w-md" titulo={ajuste ? `Ajustar lote ${ajuste.lote.lote}` : ''}>
        {ajuste && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Registrados: <strong>{kg(ajuste.lote.cantidadKilos)} kg</strong>. Escribe lo que hay físicamente; la diferencia queda como
              ajuste en el historial y en Movimientos, con su motivo.
            </p>
            <label className="block">
              <span className="text-sm font-semibold text-marca">Kilos contados *</span>
              <input
                type="number"
                min="0"
                step="0.001"
                className="gm-input mt-1"
                autoFocus
                value={ajuste.kilos}
                onChange={(e) => setAjuste({ ...ajuste, kilos: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-marca">Motivo *</span>
              <input
                className="gm-input mt-1"
                placeholder="Conteo físico, merma, producto dañado…"
                value={ajuste.motivo}
                onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })}
              />
            </label>
          </div>
        )}
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setAjuste(null)}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={guardarAjuste} disabled={guardandoAjuste}>
            {guardandoAjuste ? 'Guardando…' : 'Registrar ajuste'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
