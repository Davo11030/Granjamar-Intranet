import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import { useAuth } from '../../context/AuthContext'
import { getVentas } from '../../api/ventas'
import { getUsuarios } from '../../api/usuarios'
import { fechaHoy, formatearHora } from '../../utils/fecha'

const money = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const esAdmin = (puesto) => ['admin', 'administrador'].includes((puesto || '').toLowerCase())

export default function CorteCaja() {
  const { usuario } = useAuth()
  const admin = esAdmin(usuario?.puesto)

  const [fecha, setFecha] = useState(fechaHoy())
  const [usuarios, setUsuarios] = useState([])
  const [idUsuario, setIdUsuario] = useState(admin ? '' : String(usuario?.id ?? ''))
  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (admin) getUsuarios().then((r) => setUsuarios(r.data)).catch(console.error)
  }, [admin])

  useEffect(() => {
    setCargando(true)
    const params = { desde: fecha, hasta: fecha }
    if (idUsuario) params.idUsuario = idUsuario
    getVentas(params)
      .then((r) => setVentas(r.data))
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [fecha, idUsuario])

  const porFormaPago = useMemo(() => {
    const grupos = {}
    for (const v of ventas) {
      const clave = v.formaPago || 'Sin forma de pago'
      if (!grupos[clave]) grupos[clave] = { formaPago: clave, cantidad: 0, total: 0 }
      grupos[clave].cantidad += 1
      grupos[clave].total += Number(v.total || 0)
    }
    return Object.values(grupos).sort((a, b) => b.total - a.total)
  }, [ventas])

  const totalGeneral = useMemo(() => ventas.reduce((s, v) => s + Number(v.total || 0), 0), [ventas])
  const totalEfectivo = useMemo(
    () =>
      ventas
        .filter((v) => (v.formaPago || '').toLowerCase() === 'efectivo')
        .reduce((s, v) => s + Number(v.total || 0), 0),
    [ventas],
  )

  return (
    <Layout>
      <PageHeader titulo="Corte de caja" />

      <div className="px-6 md:px-10">
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl bg-gray-50 p-4">
          <label className="text-xs text-gray-500">
            Fecha
            <input
              type="date"
              className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm outline-none"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          {admin && (
            <label className="text-xs text-gray-500">
              Cajero
              <select
                className="mt-1 block rounded border border-gray-300 px-3 py-1.5 text-sm outline-none"
                value={idUsuario}
                onChange={(e) => setIdUsuario(e.target.value)}
              >
                <option value="">Todos</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="gm-btn-guardar py-1.5" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>

        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">Ventas</p>
                <p className="text-2xl font-extrabold text-teal">{ventas.length}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">Total general</p>
                <p className="text-2xl font-extrabold text-marca">{money(totalGeneral)}</p>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50 p-5 shadow-sm">
                <p className="text-xs text-green-700">Efectivo esperado en caja</p>
                <p className="text-2xl font-extrabold text-green-700">{money(totalEfectivo)}</p>
              </div>
            </div>

            <h2 className="mb-3 text-lg font-bold text-teal">Desglose por forma de pago</h2>
            <div className="mb-8 overflow-x-auto">
              <table className="gm-tabla">
                <thead>
                  <tr>
                    <th>Forma de pago</th>
                    <th className="text-right">Ventas</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {porFormaPago.map((g) => (
                    <tr key={g.formaPago}>
                      <td>{g.formaPago}</td>
                      <td className="text-right">{g.cantidad}</td>
                      <td className="text-right font-semibold">{money(g.total)}</td>
                    </tr>
                  ))}
                  {porFormaPago.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center !py-8 text-gray-400">
                        Sin ventas en este rango
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="mb-3 text-lg font-bold text-teal">Detalle de ventas</h2>
            <div className="overflow-x-auto">
              <table className="gm-tabla">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Cajero</th>
                    <th>Forma de pago</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((v) => (
                    <tr key={v.id}>
                      <td>{formatearHora(v.fechaRegistro)}</td>
                      <td>{v.cliente || 'Venta mostrador'}</td>
                      <td>{v.usuario || '—'}</td>
                      <td>{v.formaPago || '—'}</td>
                      <td className="text-right font-semibold">{money(v.total)}</td>
                    </tr>
                  ))}
                  {ventas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center !py-8 text-gray-400">
                        Sin ventas en este rango
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
