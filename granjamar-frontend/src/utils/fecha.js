const ZONA = 'America/Tijuana'

export const formatearFecha = (fecha) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-MX', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export const formatearHora = (fecha) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleTimeString('es-MX', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const formatearFechaHora = (fecha) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-MX', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const fechaISO = () => {
  return new Date().toISOString()
}

export const fechaHoy = () => {
  return new Date().toLocaleDateString('es-MX', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/').reverse().join('-')
}