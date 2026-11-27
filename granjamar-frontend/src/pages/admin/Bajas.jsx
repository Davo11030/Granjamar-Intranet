import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import PageHeader from '../../components/PageHeader'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import { useToast } from '../../context/ToastContext'
import api from '../../api/config'
import { avisar } from '../../utils/avisoCarga'

// Lo dado de baja en la intranet (las bajas no borran nada) y el botón para reactivarlo.
const TIPOS = [
  { tipo: 'usuario', titulo: 'Usuarios', detalle: 'Puesto' },
  { tipo: 'cliente', titulo: 'Clientes', detalle: 'RFC' },
  { tipo: 'empresa', titulo: 'Empresas', detalle: 'Tipo', nota: 'Sus direcciones regresan con ella.' },
  { tipo: 'direccion', titulo: 'Direcciones', detalle: 'Municipio y empresa' },
  { tipo: 'producto', titulo: 'Productos del kardex', detalle: '' },
  { tipo: 'operador', titulo: 'Operadores', detalle: 'Teléfono' },
  { tipo: 'tractocamion', titulo: 'Tractocamiones', detalle: 'Marca' },
  { tipo: 'caja', titulo: 'Cajas', detalle: 'Tamaño' },
]

export default function Bajas() {
  const toast = useToast()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [confirmar, setConfirmar] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = () =>
    api
      .get('/Bajas')
      .then((r) => {
        setDatos(r.data)
        setErrorCarga(false)
      })
      .catch(avisar('No se pudo cargar lo dado de baja', () => setErrorCarga(true)))
      .finally(() => setCargando(false))
  useEffect(() => {
    cargar()
  }, [])

  const grupos = useMemo(
    () => TIPOS.map((t) => ({ ...t, items: datos.filter((d) => d.tipo === t.tipo) })).filter((g) => g.items.length > 0),
    [datos],
  )

  const reactivar = async () => {
    setGuardando(true)
    try {
      await api.put(`/Bajas/${confirmar.tipo}/${encodeURIComponent(confirmar.id)}/reactivar`)
      toast.exito(`${confirmar.nombre} reactivado`)
      setConfirmar(null)
      cargar()
    } catch (e) {
      toast.error(e.response?.data?.mensaje || 'No se pudo reactivar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Layout>
      <PageHeader titulo="Dados de baja" />
      <div className="px-6 md:px-10">
        <p className="mb-6 text-sm text-gray-500">
          Lo que se da de baja deja de aparecer en listas y menús, pero no se borra. Aquí puedes reactivarlo.
        </p>
        {cargando ? (
          <Cargando />
        ) : grupos.length === 0 ? (
          <p className="py-12 text-center text-gray-400">
            {errorCarga ? 'No se pudo cargar la información. Recarga la página para intentar de nuevo.' : 'No hay nada dado de baja.'}
          </p>
        ) : (
          <div className="space-y-8">
            {grupos.map((g) => (
              <section key={g.tipo}>
                <h2 className="mb-2 text-lg font-bold text-marca">{g.titulo}</h2>
                <div className="overflow-x-auto">
                  <table className="gm-tabla">
                    <thead>
                      <tr>
                        <th className="italic">Nombre</th>
                        {g.detalle && <th>{g.detalle}</th>}
                        <th aria-hidden="true" />
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((d) => (
                        <tr key={`${d.tipo}-${d.id}`}>
                          <td className="font-semibold">{d.nombre}</td>
                          {g.detalle && <td>{d.detalle || '—'}</td>}
                          <td className="text-right">
                            <button className="gm-pill" onClick={() => setConfirmar(d)}>
                              Reactivar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Modal abierto={!!confirmar} onCerrar={guardando ? undefined : () => setConfirmar(null)} ancho="max-w-md" titulo="Reactivar">
        <p className="text-sm text-gray-600">
          ¿Reactivar <span className="font-semibold">{confirmar?.nombre}</span>? Volverá a aparecer en listas y menús.{' '}
          {TIPOS.find((t) => t.tipo === confirmar?.tipo)?.nota || ''}
        </p>
        <div className="mt-8 flex justify-between">
          <button className="gm-btn-cancelar" onClick={() => setConfirmar(null)} disabled={guardando}>
            Cancelar
          </button>
          <button className="gm-btn-guardar" onClick={reactivar} disabled={guardando}>
            {guardando ? 'Reactivando…' : 'Reactivar'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
