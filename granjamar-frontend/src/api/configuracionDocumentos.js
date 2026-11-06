import api from './config'

// Los datos fijos de cada documento que genera el sistema (solo administrador).
export const getConfiguracionDocumentos = () => api.get('/ConfiguracionDocumentos')
// valores = { Clave: 'valor' }; un valor vacío vuelve al valor de fábrica.
export const guardarConfiguracionDocumento = (documento, valores) => api.put(`/ConfiguracionDocumentos/${documento}`, { valores })
