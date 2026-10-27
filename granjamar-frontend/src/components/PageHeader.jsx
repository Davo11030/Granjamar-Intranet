// Encabezado de página estilo mockup: título azul grande centrado + subtítulo opcional.
// El botón hamburguesa lo pinta Layout de forma fija; aquí solo dejamos el espacio.
export default function PageHeader({ titulo, subtitulo, children }) {
  return (
    <header className="pt-6 pb-8 px-20">
      <h1 className="gm-titulo">{titulo}</h1>
      {subtitulo && <p className="gm-subtitulo mt-2">{subtitulo}</p>}
      {children}
    </header>
  )
}
