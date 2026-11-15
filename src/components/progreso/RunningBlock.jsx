import { ChevronRight } from 'lucide-react'
import { ProgressCard, SectionTitle } from './ProgressUI'
import KmBarsChart from './KmBarsChart'
import { formatNumber } from '../../utils/format'
import { formatPace } from '../../utils/cardio'

const PERIOD_TEXT = { '4w': 'últimas 4 semanas', '13w': 'últimos 3 meses', all: 'todo el historial' }

// "Tu running" en Progreso: km del período (número protagonista), carreras, ritmo promedio, tendencia contra el período
// anterior (solo con ≥ 3 carreras de ritmo válido en cada uno; verde si mejora, gris si no, nunca rojo) y mini gráfico
// de km por semana. Tocarlo abre /progreso/running. summary: computeRunningSummary() de utils/running.js.
export default function RunningBlock({ summary, onOpen }) {
  const { count, km, pace, comparison, bars, empty, periodKey } = summary
  const openable = count > 0

  const body = empty ? (
    <p className="text-app-muted text-sm text-center py-3">
      {count === 0
        ? 'Todavía no hay carreras en este período. ¡Cuando salgas a correr, vas a ver tu progreso acá!'
        : 'Con 2 carreras o más en este período vas a ver tu progreso de running.'}
    </p>
  ) : (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-5xl font-bold leading-none text-app-text">
            {formatNumber(km)}<span className="ml-1.5 text-lg font-medium text-app-muted">km</span>
          </p>
          <p className="mt-1.5 text-sm text-app-muted">
            {formatNumber(count)} {count === 1 ? 'carrera' : 'carreras'} · {PERIOD_TEXT[periodKey]}
          </p>
        </div>
        <ChevronRight size={18} className="text-app-muted shrink-0 mt-1" />
      </div>

      {pace != null && (
        <p className="mt-3 text-sm text-app-text">
          Ritmo promedio <span className="font-semibold">{formatPace(pace)}</span>
        </p>
      )}
      {comparison && (
        <p className={`mt-0.5 text-xs font-medium ${comparison.direction === 'better' ? 'text-app-green-light' : 'text-app-muted'}`}>
          {comparison.direction === 'better' ? '↑ ' : ''}{comparison.text}
        </p>
      )}

      <div className="mt-3">
        <KmBarsChart bars={bars.bars} compact />
      </div>
    </>
  )

  const card = <ProgressCard className="p-5">{body}</ProgressCard>

  return (
    <div>
      <SectionTitle>Tu running</SectionTitle>
      {openable ? (
        <button type="button" onClick={onOpen} aria-label="Ver el detalle de tu running"
          className="block w-full text-left active:opacity-80 transition-opacity">
          {card}
        </button>
      ) : card}
    </div>
  )
}
