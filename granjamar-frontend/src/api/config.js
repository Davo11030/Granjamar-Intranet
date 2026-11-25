import axios from 'axios'

// Dirección de la API: VITE_API_URL si se definió (ver .env.example); si no, el mismo equipo desde
// el que se abrió la página, en el puerto 5145. Así funciona igual en el servidor (localhost) y
// desde otras PCs de la red (http://<ip-del-servidor>:5173 → http://<ip-del-servidor>:5145/api).
export const API_URL =
  import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5145/api`

const api = axios.create({
  baseURL: API_URL,
})

// Agrega el token automáticamente a cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Si el token expira, redirige al login. El 401 del propio login (usuario o contraseña incorrectos) no
// redirige: recargar la página borraría el mensaje de error antes de que el usuario lo vea.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const esLogin = /\/Usuarios\/login$/i.test(error.config?.url || '')
    if (error.response?.status === 401 && !esLogin) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api