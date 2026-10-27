import { useState, useMemo } from 'react'

export default function usePaginacion(datos, porPagina = 20) {
  const [pagina, setPagina] = useState(1)

  const datosPaginados = useMemo(() => {
    const inicio = (pagina - 1) * porPagina
    return datos.slice(inicio, inicio + porPagina)
  }, [datos, pagina, porPagina])

  const resetear = () => setPagina(1)

  return {
    datosPaginados,
    pagina,
    setPagina,
    total: datos.length,
    porPagina,
    resetear
  }
}