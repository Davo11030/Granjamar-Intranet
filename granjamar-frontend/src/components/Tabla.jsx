import Cargando from './Cargando'

// Tabla estilo mockup: encabezados en negrita, filas separadas por líneas teal,
// sin bordes verticales. `columnas` = [{ key, label, render?, derecha?, italic?, mono?, bold? }]
export default function Tabla({ columnas, datos, cargando, sinDatos = 'Sin datos', acciones }) {
  if (cargando) return <Cargando />

  return (
    <div className="overflow-x-auto">
      <table className="gm-tabla">
        <thead>
          <tr>
            {columnas.map((col) => (
              <th
                key={col.key}
                className={`${col.derecha ? 'text-right' : 'text-left'} ${col.italic ? 'italic' : ''}`}
              >
                {col.label}
              </th>
            ))}
            {acciones && <th aria-hidden="true" />}
          </tr>
        </thead>
        <tbody>
          {datos.length === 0 ? (
            <tr>
              <td
                colSpan={columnas.length + (acciones ? 1 : 0)}
                className="text-center !py-12 text-gray-400"
              >
                {sinDatos}
              </td>
            </tr>
          ) : (
            datos.map((fila, i) => (
              <tr key={fila.id ?? i}>
                {columnas.map((col) => (
                  <td
                    key={col.key}
                    className={`${col.derecha ? 'text-right' : ''} ${
                      col.mono ? 'font-mono text-sm' : ''
                    } ${col.bold ? 'font-semibold' : ''}`}
                  >
                    {col.render ? col.render(fila) : (fila[col.key] ?? '—')}
                  </td>
                ))}
                {acciones && (
                  <td>
                    <div className="flex gap-2 justify-end">{acciones(fila)}</div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
