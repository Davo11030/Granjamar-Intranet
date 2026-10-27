import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getEmpresas } from '../api/destinos'
import { getEmbarque } from '../api/embarques'
import ModalPerfil from './ModalPerfil'

const menuItems = [
  { label: 'Inicio', path: '/' },
  {
    label: 'Inventario',
    path: '/inventario',
    sub: [
      { label: 'Conpaq', path: '/inventario/conpaq', permiso: ['inventario', 'ver'] },
      { label: 'Pedimentos', path: '/pedimentos', permiso: ['documentos', 'ver'] },
      { label: 'Otros', path: '/otros', permiso: [['productos', 'ver'], ['catalogos', 'ver'], ['direcciones', 'ver']] },
    ],
  },
  { label: 'Clientes', path: '/clientes', permiso: ['clientes', 'ver'] },
  { label: 'Produccion', path: '/produccion', permiso: ['produccion', 'ver'] },
  { label: 'Entradas', path: '/entradas', permiso: ['compras', 'ver'] },
  {
    label: 'Salidas',
    path: '/salidas',
    sub: [
      { label: 'Ventas', path: '/salidas/ventas', permiso: ['ventas', 'ver'] },
      { label: 'Corte de caja', path: '/salidas/ventas/corte', permiso: [['ventas', 'corte'], ['ventas', 'ver']] },
      { label: 'Embarques', path: '/salidas/embarques', permiso: ['embarques', 'ver'] },
    ],
  },
]

const adminItems = [
  { label: 'Movimientos', path: '/admin/movimientos' },
  { label: 'Usuarios', path: '/admin/usuarios' },
  { label: 'Empresas', path: '/admin/empresas' },
  { label: 'Visitantes', path: '/admin/visitantes' },
]

export default function Sidebar({ abierto, onCerrar }) {
  const { usuario, cerrarSesion, esAdmin, puedeAlguno } = useAuth()
  // Solo se muestra lo que el usuario puede ver (el servidor lo vuelve a verificar).
  const visible = (permiso) => !permiso || puedeAlguno(Array.isArray(permiso[0]) ? permiso : [permiso])
  const puedeInventario = visible(['inventario', 'ver'])
  const location = useLocation()

  const [expandido, setExpandido] = useState(
    () => localStorage.getItem('sidebar-expandido') || null,
  )
  const [empresas, setEmpresas] = useState([])
  const [perfilAbierto, setPerfilAbierto] = useState(false)

  useEffect(() => {
    getEmpresas()
      .then((res) => setEmpresas(res.data))
      .catch((e) => console.error('Error cargando empresas:', e))
  }, [])

  // Mientras se navega dentro de un embarque (Requisición/Solicitud/RT/Ciego), se muestra ese
  // embarque como único artículo del submenú de Salidas — sustituye al botón "Regresar" de cada
  // pantalla, siempre visible como referencia de "dónde estoy".
  const idEmbarqueActual = location.pathname.match(/^\/salidas\/embarques\/(\d+)/)?.[1] || null
  const [numeroEmbarqueActual, setNumeroEmbarqueActual] = useState(null)

  useEffect(() => {
    if (idEmbarqueActual) setExpandido('Salidas')
  }, [idEmbarqueActual])

  // El sidebar debe mostrar el "No. Embarque" real (numero), no el id interno del registro —
  // son cosas distintas (un mismo numero puede repartirse en varios registros, uno por destino).
  useEffect(() => {
    if (!idEmbarqueActual) {
      setNumeroEmbarqueActual(null)
      return
    }
    getEmbarque(idEmbarqueActual)
      .then((r) => setNumeroEmbarqueActual(r.data?.numero ?? idEmbarqueActual))
      .catch(() => setNumeroEmbarqueActual(idEmbarqueActual))
  }, [idEmbarqueActual])

  const toggleExpand = (label) => {
    const nuevo = expandido === label ? null : label
    setExpandido(nuevo)
    localStorage.setItem('sidebar-expandido', nuevo || '')
  }

  const resguardos = puedeInventario ? empresas.filter((e) => e.tipo?.toLowerCase() === 'resguardo') : []
  const consignaciones = puedeInventario ? empresas.filter((e) => e.tipo?.toLowerCase() === 'consignacion') : []

  // Submenús sin ninguna opción visible desaparecen completos.
  const menuVisible = menuItems
    .map((item) => (item.sub ? { ...item, sub: item.sub.filter((s) => visible(s.permiso)) } : item))
    .filter((item) => {
      if (item.sub) return item.sub.length > 0 || (item.label === 'Inventario' && (resguardos.length || consignaciones.length))
      return visible(item.permiso)
    })

  const linkBase =
    'block py-2 px-3 rounded-xl transition-all duration-200 ease-out font-bold hover:bg-white/15 hover:pl-4'
  const linkActivo = ({ isActive }) =>
    `${linkBase} ${isActive ? 'bg-white/20 shadow-inner' : ''}`
  const subLinkBase =
    'block py-1.5 px-3 rounded-xl text-[0.95rem] transition-all duration-200 ease-out font-semibold hover:bg-white/15 hover:pl-4'
  const subLinkActivo = ({ isActive }) =>
    `${subLinkBase} ${isActive ? 'bg-white/20' : 'opacity-90'}`

  return (
    <>
      {abierto && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 animate-fondo-in"
          onClick={onCerrar}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col text-white
          rounded-r-3xl transform transition-transform duration-300 ease-out
          ${abierto ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          backgroundColor: 'var(--color-teal)',
          boxShadow: '12px 0 40px -12px rgb(6 147 164 / 0.5)',
        }}
      >
        <div className="p-5 border-b border-white/15">
          <p className="font-extrabold text-2xl tracking-tight">GRANJAMAR</p>
          <button
            onClick={() => setPerfilAbierto(true)}
            className="mt-1 text-left w-full rounded-lg -mx-1 px-1 py-0.5 transition-all duration-200 hover:bg-white/15"
            title="Ver mi perfil"
          >
            {usuario?.nombre && <p className="text-sm opacity-90">{usuario.nombre}</p>}
            {usuario?.puesto && <p className="text-xs opacity-70 capitalize">{usuario.puesto}</p>}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-0.5">
          {menuVisible.map((item) =>
            item.sub ? (
              <div key={item.label}>
                <button
                  onClick={() => toggleExpand(item.label)}
                  className={`${linkBase} w-full text-left flex justify-between items-center hover:pl-3`}
                >
                  {item.label}
                  <span
                    className={`text-xs transition-transform duration-200 ${expandido === item.label ? 'rotate-180' : ''}`}
                  >
                    ▼
                  </span>
                </button>

                {expandido === item.label && (
                  <div className="pl-3 ml-3 border-l border-white/20 mt-1 mb-1 space-y-0.5">
                    {item.sub.map((sub) => (
                      <div key={sub.path}>
                        <NavLink
                          to={sub.path}
                          end={sub.path === '/salidas/ventas'}
                          onClick={onCerrar}
                          className={
                            // Con un embarque abierto, el "#N" de abajo ya marca "aquí estoy" —
                            // no se duplica el resaltado fuerte aquí también.
                            sub.label === 'Embarques' && idEmbarqueActual
                              ? `${subLinkBase} opacity-90`
                              : subLinkActivo
                          }
                        >
                          {sub.label}
                        </NavLink>
                        {sub.label === 'Embarques' && idEmbarqueActual && (
                          <NavLink
                            to={`/salidas/embarques/${idEmbarqueActual}`}
                            onClick={onCerrar}
                            className={({ isActive }) =>
                              `block ml-4 py-1 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ease-out hover:bg-white/15 ${
                                isActive ? 'bg-white/20 text-white' : 'text-white/60'
                              }`
                            }
                          >
                            #{numeroEmbarqueActual ?? idEmbarqueActual}
                          </NavLink>
                        )}
                      </div>
                    ))}

                    {item.label === 'Inventario' &&
                      resguardos.map((empresa) => (
                        <NavLink
                          key={`resguardo-${empresa.id}`}
                          to={`/inventario/resguardo/${empresa.id}`}
                          onClick={onCerrar}
                          className={subLinkActivo}
                        >
                          {empresa.nombre}
                        </NavLink>
                      ))}

                    {item.label === 'Inventario' &&
                      consignaciones.map((empresa) => (
                        <NavLink
                          key={`consignacion-${empresa.id}`}
                          to={`/inventario/consignacion/${empresa.id}`}
                          onClick={onCerrar}
                          className={subLinkActivo}
                        >
                          {empresa.nombre}
                        </NavLink>
                      ))}

                  </div>
                )}
              </div>
            ) : (
              <NavLink key={item.path} to={item.path} onClick={onCerrar} className={linkActivo} end={item.path === '/'}>
                {item.label}
              </NavLink>
            ),
          )}

          {esAdmin && (
            <div className="mt-4 pt-4 border-t border-white/15">
              <p className="text-xs opacity-60 px-3 mb-2 uppercase tracking-wider">Administración</p>
              {adminItems.map((item) => (
                <NavLink key={item.path} to={item.path} onClick={onCerrar} className={linkActivo}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/15">
          <button
            onClick={cerrarSesion}
            className="w-full py-2 rounded-full text-white font-bold transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            style={{ backgroundColor: 'var(--color-cancelar)' }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <ModalPerfil abierto={perfilAbierto} onCerrar={() => setPerfilAbierto(false)} />
    </>
  )
}
