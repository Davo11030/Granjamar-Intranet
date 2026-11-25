import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import Cargando from '../../components/Cargando'
import VentaForm from '../../components/venta/VentaForm'
import { getVenta } from '../../api/ventas'
import { useToast } from '../../context/ToastContext'

// Corrige una venta ya registrada: la de un cliente de la lista es de mayoreo; la demás, de mostrador.
export default function VentaEditar() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [venta, setVenta] = useState(null)

  useEffect(() => {
    getVenta(id)
      .then(({ data }) => setVenta(data))
      .catch((e) => {
        toast.error(e.response?.data?.mensaje || 'No se pudo cargar la venta')
        navigate('/salidas/ventas')
      })
    // toast cambia en cada render del proveedor: no va en las dependencias para no volver a pedir la venta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate])

  if (!venta)
    return (
      <Layout>
        <Cargando />
      </Layout>
    )
  return <VentaForm modo={venta.idCliente ? 'mayoreo' : 'mostrador'} ventaEditar={venta} />
}
