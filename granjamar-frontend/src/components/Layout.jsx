import { useState } from 'react'
import TokenExpiry from './TokenExpiry'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  const [sidebarAbierto, setSidebarAbierto] = useState(false)

  return (
    <div className="min-h-screen bg-fondo">
      <div className="no-imprimir">
        <Sidebar abierto={sidebarAbierto} onCerrar={() => setSidebarAbierto(false)} />
      </div>

      <button
        onClick={() => setSidebarAbierto(true)}
        aria-label="Abrir menú"
        className="gm-hamburguesa no-imprimir"
      >
        <span className="flex flex-col gap-[5px]">
          <span className="block w-6 h-[3px] rounded bg-black" />
          <span className="block w-6 h-[3px] rounded bg-black" />
          <span className="block w-6 h-[3px] rounded bg-black" />
        </span>
      </button>

      <main className="pb-16">{children}</main>
      <div className="no-imprimir">
        <TokenExpiry />
      </div>
    </div>
  )
}
