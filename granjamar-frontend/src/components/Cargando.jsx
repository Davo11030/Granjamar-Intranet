export default function Cargando({ texto = 'Cargando...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
      <div className="w-9 h-9 border-[3px] border-teal/25 border-t-teal rounded-full animate-spin" />
      <p className="text-teal-oscuro text-sm font-medium">{texto}</p>
    </div>
  )
}
