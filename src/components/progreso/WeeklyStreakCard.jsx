import FlipCard from '../ui/FlipCard'
import { formatDaysPerWeek } from '../../utils/progressStats'
import { TYPE_COLORS, TYPE_LABELS } from '../../utils/workoutTypes'

const PURPLE = '#9B7FD4'
const CARD_BG = '#1a1625'
const BAR_ORDER = ['fuerza', 'cardio', 'clase', 'otros']

// Tarjeta "Racha semanal 3+" (Inicio y Progreso comparten esta misma tarjeta).
//   Frente: cantidad TOTAL de semanas con 3+ días distintos de entrenamiento (nunca baja).
//   Dorso (al tocarla): resumen del mes calendario en curso — días por semana y % de fuerza / cardio / clase
//   (y "otros" solo si existen), con una barra segmentada. Sin entrenamientos en el mes: estado vacío.
// total: número (computeWeeklyStreak3Plus().total) · month: computeMonthSummary().
export default function WeeklyStreakCard({ total, month, height = '108px' }) {
  const face = 'w-full h-full rounded-2xl border border-white/[0.06]'

  const front = (
    <div className={`${face} py-3 px-3 flex flex-col items-center justify-center`} style={{ backgroundColor: CARD_BG }}>
      <p className="text-[11px] font-medium text-app-text text-center leading-tight">Racha semanal 3+</p>
      <span className="text-4xl font-bold leading-none flex items-center gap-1.5 mt-1.5" style={{ color: PURPLE }}>
        <span className="text-3xl">🔥</span>{total}
      </span>
      <p className="text-[10px] text-app-muted text-center mt-1 leading-tight">semanas con 3+ días</p>
    </div>
  )

  // Categorías a mostrar: fuerza, cardio y clase siempre; "otros" solo si existe en el resumen.
  const keys = month && !month.empty ? BAR_ORDER.filter(k => k in month.percentages) : []

  const back = (
    <div className={`${face} px-3 py-2 flex flex-col justify-center`} style={{ backgroundColor: CARD_BG }}>
      <span className="text-[9px] text-app-muted leading-none">Este mes</span>
      {!month || month.empty ? (
        <p className="text-xs text-app-muted text-center my-auto leading-snug">Todavía no entrenaste este mes</p>
      ) : (
        <>
          <p className="text-sm font-bold leading-tight mt-1.5" style={{ color: PURPLE }}>
            {formatDaysPerWeek(month.avgDaysPerWeek)} días por semana
          </p>
          <div className="flex h-1.5 rounded-full overflow-hidden mt-2 bg-white/5" role="img"
            aria-label={keys.map(k => `${TYPE_LABELS[k]} ${month.percentages[k]} %`).join(', ')}>
            {keys.map(k => (
              <div key={k} style={{ width: `${month.percentages[k]}%`, backgroundColor: TYPE_COLORS[k] }} />
            ))}
          </div>
          <div className="flex justify-between gap-1 mt-1.5">
            {keys.map(k => (
              <div key={k} className="flex flex-col items-center flex-1 min-w-0">
                <span className="text-xs font-bold leading-none" style={{ color: TYPE_COLORS[k] }}>{month.percentages[k]} %</span>
                <span className="text-[10px] text-app-muted leading-tight mt-0.5 truncate max-w-full">{TYPE_LABELS[k]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <FlipCard
      height={height}
      flipLabel="Ver el resumen del mes"
      unflipLabel="Volver a la racha semanal"
      front={front}
      back={back}
    />
  )
}
