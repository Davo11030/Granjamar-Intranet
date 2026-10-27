import api from './config'
export const getDocumentos = () => api.get('/Documentos')
export const crearDocumento = (datos) => api.post('/Documentos', datos)
export const getDocumentosTipo = () => api.get('/Documentos/tipos')
export const crearDocumentoTipo = (datos) => api.post('/Documentos/tipos', datos)


// Sube el archivo de un documento ANTES de guardar la entrada; devuelve { token, nombre } que la
// entrada manda para ligarlo a su documento.
export const subirArchivoTemporal = (archivo) => {
  const datos = new FormData()
  datos.append('archivo', archivo)
  return api.post('/Documentos/archivo-temporal', datos)
}

// Adjunta (o reemplaza) el archivo de un documento ya registrado.
export const adjuntarArchivoDocumento = (id, archivo) => {
  const datos = new FormData()
  datos.append('archivo', archivo)
  return api.put(`/Documentos/${id}/archivo`, datos)
}

// Abre el archivo de un documento en una pestaña nueva. El endpoint pide sesión (token en el
// encabezado), así que no sirve un enlace directo: se descarga como blob y se abre. La pestaña se
// abre ANTES de la petición para que el navegador no la bloquee como ventana emergente.
export const abrirArchivoDocumento = async (id) => {
  const ventana = window.open('', '_blank')
  try {
    const r = await api.get(`/Documentos/${id}/archivo`, { responseType: 'blob' })
    const url = URL.createObjectURL(r.data)
    if (ventana) ventana.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
  } catch (e) {
    ventana?.close()
    throw e
  }
}

export const TIPOS_ARCHIVO_DOCUMENTO = '.pdf,.jpg,.jpeg,.png,.xml'
export const MAX_ARCHIVO_DOCUMENTO_MB = 15
export const validarArchivoDocumento = (archivo) => {
  const ext = (archivo.name.match(/\.[^.]+$/) || [''])[0].toLowerCase()
  if (!TIPOS_ARCHIVO_DOCUMENTO.split(',').includes(ext)) return `Tipo de archivo no permitido (usa ${TIPOS_ARCHIVO_DOCUMENTO.replace(/,/g, ', ')})`
  if (archivo.size > MAX_ARCHIVO_DOCUMENTO_MB * 1024 * 1024) return `El archivo pesa más de ${MAX_ARCHIVO_DOCUMENTO_MB} MB`
  if (archivo.size === 0) return 'El archivo está vacío'
  return null
}
