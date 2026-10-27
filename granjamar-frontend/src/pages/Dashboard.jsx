import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

const MISION =
  'En Granjamar nos dedicamos a la comercialización y distribución de productos del mar, ' +
  'comprometidos con la calidad, la frescura y la trazabilidad de cada lote que entregamos a ' +
  'nuestros clientes, sustentados en procesos eficientes, responsables y transparentes.'

const VISION =
  'Ser la empresa líder en distribución de productos del mar en México, reconocida por su ' +
  'innovación, su servicio y su compromiso con la sustentabilidad, ampliando su presencia a ' +
  'nivel nacional e internacional.'

export default function Dashboard() {
  const { usuario } = useAuth()

  return (
    <Layout>
      <div className="relative min-h-screen overflow-hidden px-6 pt-6">
        {/* marca de agua tenue (motivo de olas) */}
        <svg
          className="pointer-events-none absolute left-1/2 top-40 -translate-x-1/2 opacity-[0.06]"
          width="640" height="640" viewBox="0 0 200 200" fill="none" aria-hidden="true"
        >
          <circle cx="100" cy="100" r="96" fill="var(--color-teal)" />
          <path d="M20 120c20-16 40-16 60 0s40 16 60 0 40-16 60 0" stroke="#fff" strokeWidth="8" fill="none" />
          <path d="M20 95c20-16 40-16 60 0s40 16 60 0 40-16 60 0" stroke="#fff" strokeWidth="8" fill="none" />
        </svg>

        <div className="relative">
          <h1 className="gm-titulo">GRANJAMAR</h1>
          <p className="gm-subtitulo mt-2" style={{ color: 'var(--color-teal)' }}>
            BIENVENIDO {usuario?.nombre?.toUpperCase() || ''}
          </p>

          <div className="mx-auto mt-16 grid max-w-5xl gap-12 md:grid-cols-2">
            <section>
              <h2 className="text-center text-3xl font-extrabold text-black">MISIÓN</h2>
              <p className="mt-4 text-center leading-relaxed text-gray-700">{MISION}</p>
            </section>
            <section>
              <h2 className="text-center text-3xl font-extrabold text-black">VISIÓN</h2>
              <p className="mt-4 text-center leading-relaxed text-gray-700">{VISION}</p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  )
}
