import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getMisPermisos } from '../api/permisos'

const AuthContext = createContext()

const tokenEsValido = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

const parsearToken = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

const esAdminPuesto = (puesto) => ['admin', 'administrador'].includes((puesto || '').trim().toLowerCase())

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [token, setToken] = useState(null)
  const [cargando, setCargando] = useState(true)
  // Permisos del usuario ("modulo:accion"). null = todavía cargando. El administrador lo puede todo;
  // el servidor vuelve a verificar cada petición, esto solo decide qué se muestra.
  const [permisos, setPermisos] = useState(null)

  const cargarPermisos = useCallback(() => {
    return getMisPermisos()
      .then((r) => setPermisos(new Set(r.data.map((p) => `${p.modulo}:${p.accion}`))))
      .catch(() => setPermisos(new Set()))
  }, [])

  const cerrarSesion = useCallback(() => {
    setToken(null)
    setUsuario(null)
    setPermisos(null)
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    window.location.href = '/login'
  }, [])

  useEffect(() => {
    const tokenGuardado = localStorage.getItem('token')
    const usuarioGuardado = localStorage.getItem('usuario')

    if (tokenGuardado && usuarioGuardado) {
      if (tokenEsValido(tokenGuardado)) {
        setToken(tokenGuardado)
        setUsuario(JSON.parse(usuarioGuardado))
        cargarPermisos()

        // Programar cierre de sesión automático
        const payload = parsearToken(tokenGuardado)
        const msRestantes = payload.exp * 1000 - Date.now()
        const timer = setTimeout(cerrarSesion, msRestantes)
        setCargando(false)
        return () => clearTimeout(timer)
      } else {
        // Token expirado al recargar
        localStorage.removeItem('token')
        localStorage.removeItem('usuario')
      }
    }
    setCargando(false)
  }, [cerrarSesion, cargarPermisos])

  const iniciarSesion = async (datos) => {
    setToken(datos.token)
    const usuarioData = {
      id: datos.id,
      nombre: datos.nombre,
      puesto: datos.puesto
    }
    setUsuario(usuarioData)
    localStorage.setItem('token', datos.token)
    localStorage.setItem('usuario', JSON.stringify(usuarioData))

    // Programar cierre automático
    const payload = parsearToken(datos.token)
    const msRestantes = payload.exp * 1000 - Date.now()
    setTimeout(cerrarSesion, msRestantes)

    await cargarPermisos()
  }

  const esAdmin = esAdminPuesto(usuario?.puesto)

  // ¿Puede `accion` en `modulo`? "ver" también lo tiene quien puede crear/editar/eliminar ahí
  // (igual que en el servidor).
  const puede = (modulo, accion = 'ver') => {
    if (esAdmin) return true
    if (!permisos) return false
    if (permisos.has(`${modulo}:${accion}`)) return true
    return accion === 'ver' && ['crear', 'editar', 'eliminar'].some((a) => permisos.has(`${modulo}:${a}`))
  }
  // Basta con tener alguno de los permisos de la lista: [['ventas','ver'], ['ventas','corte']].
  const puedeAlguno = (lista) => lista.some(([m, a]) => puede(m, a))

  return (
    <AuthContext.Provider value={{ usuario, token, cargando, iniciarSesion, cerrarSesion, esAdmin, puede, puedeAlguno, permisosListos: esAdmin || permisos !== null }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)