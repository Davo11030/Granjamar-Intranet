// Aviso en rojo cuando una carga falla, en vez de solo dejar la tabla vacía:
//   getProductos().then(...).catch(avisar('No se pudieron cargar los productos'))
// Es una función normal (no un hook) para poder usarla dentro de cualquier useEffect sin dependencias.
// ToastProvider registra aquí su función de error al montarse.

let mostrarError = null
export const registrarAvisoError = (fn) => {
  mostrarError = fn
}

// Texto para el usuario a partir de un error de axios.
export function mensajeDeError(e) {
  if (!e?.response) return 'No hay conexión con el servidor; revisa que esté encendido.'
  const { status, data } = e.response
  if (data?.mensaje) return data.mensaje
  if (status === 403) return 'No tienes permiso para ver esta información.'
  if (status === 404) return 'No se encontró la información.'
  if (status >= 500) return 'El servidor tuvo un error.'
  return `Error ${status}.`
}

// `alFallar` (opcional) se llama con el error, p. ej. para marcar la tabla como "no se pudo cargar".
// El 401 no se avisa: el interceptor de api/config.js ya manda al login.
export const avisar = (que, alFallar) => (e) => {
  console.error(que, e)
  alFallar?.(e)
  if (e?.response?.status === 401) return
  mostrarError?.(`${que}. ${mensajeDeError(e)}`)
}
