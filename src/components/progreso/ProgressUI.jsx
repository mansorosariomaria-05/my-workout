import Card from '../ui/Card'

// Piezas compartidas de la pantalla Progreso: todas las tarjetas usan Card (fondo surface) con el mismo borde y radio.
// La única que cambia es la de Constancia, que es más grande (se le pasa className="p-5").

export function ProgressCard({ children, className = '' }) {
  return <Card className={`border border-white/[0.06] ${className}`}>{children}</Card>
}

// Título de sección: mayúsculas pequeñas, muted, tracking amplio.
export function SectionTitle({ children, aside }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-app-muted">{children}</h2>
      {aside}
    </div>
  )
}
