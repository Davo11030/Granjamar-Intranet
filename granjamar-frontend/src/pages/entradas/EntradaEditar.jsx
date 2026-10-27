import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import Cargando from '../../components/Cargando'
import EntradaForm from '../../components/entrada/EntradaForm'
import { getEntrada } from '../../api/entradas'

// Modifica una entrada ya cargada a Conpaq: el tipo (traspaso, importación o nacional) se deduce de cómo se guardó.
export default function EntradaEditar() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [modo, setModo] = useState(null)

  useEffect(() => {
    getEntrada(id)
      .then(({ data }) => {
        const embarque = (data.numeroEmbarque || '').trim()
        setModo(embarque.toUpperCase() === 'TRASPASO' ? 'traspaso' : embarque ? 'internacional' : 'nacional')
      })
      .catch(() => navigate('/entradas'))
  }, [id, navigate])

  if (!modo)
    return (
      <Layout>
        <Cargando />
      </Layout>
    )
  return <EntradaForm modo={modo} idEditar={id} />
}
