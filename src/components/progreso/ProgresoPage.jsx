import { useState, useMemo } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkouts } from '../../hooks/useWorkouts'
import { useDeload } from '../../hooks/useDeload'
import { getTodayLocal } from '../../utils/dates'
import { getWeeklyGoal } from '../../utils/progressStats'
import {
  VIEW_PERIODS, computeHistorySummary, computeMonthComparison, computeConstanciaBars,
  computeStrengthRanking, computeBodySummary,
} from '../../utils/progressView'
import { textoGenero } from '../../utils/genero'
import { formatNumber } from '../../utils/format'
import { ProgressCard, SectionTitle } from './ProgressUI'
import ConstanciaBlock from './ConstanciaBlock'
import StrengthBlock from './StrengthBlock'
import BodyBlock from './BodyBlock'
import MonthCalendar from './MonthCalendar'
import UltimasSesiones from './UltimasSesiones'

// ─── Selector de período ──────────────────────────────────────────────────────

// Segmented control. Afecta Constancia (gráfico), Más fuerte que antes y Cómo está tu cuerpo; no el calendario ni las sesiones.
function PeriodSelector({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Período" className="flex rounded-xl p-1 bg-app-surface border border-white/[0.06]">
      {VIEW_PERIODS.map(p => {
        const active = p.key === value
        return (
          <button key={p.key} type="button" role="radio" aria-checked={active} onClick={() => onChange(p.key)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              active ? 'bg-app-purple/25 text-app-purple-light' : 'text-app-muted'
            }`}>
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── ProgresoPage ─────────────────────────────────────────────────────────────
// Una sola pantalla con scroll: encabezado · período · Constancia · Más fuerte que antes · Cómo está tu cuerpo ·
// calendario mensual · últimas sesiones. Los cálculos viven en utils/progressView.js.

export default function ProgresoPage() {
  const { profile, settings } = useAuthContext()
  const { workouts, loading, getWeeklyStreak3Plus } = useWorkouts()
  const { shouldSuggestDeload } = useDeload(settings, workouts)
  const [period, setPeriod] = useState('4w')

  const today  = getTodayLocal()
  const goal   = getWeeklyGoal(profile)
  const streak = getWeeklyStreak3Plus() // racha semanal 3+ (memoizada en useWorkouts, la misma que Inicio)

  const history    = useMemo(() => computeHistorySummary(workouts, today),              [workouts, today])
  const comparison = useMemo(() => computeMonthComparison(workouts, today),             [workouts, today])
  const chart      = useMemo(() => computeConstanciaBars(workouts, period, today, goal), [workouts, period, today, goal])
  const ranking    = useMemo(() => computeStrengthRanking(workouts, period, today),     [workouts, period, today])
  const body       = useMemo(() => computeBodySummary(workouts, period, today),         [workouts, period, today])

  if (loading) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <p className="text-app-muted text-sm animate-pulse">Cargando...</p>
    </div>
  )

  const greetName = profile?.name ?? textoGenero(profile?.genero, 'campeón', 'campeona', 'campeón')
  // La frase solo se muestra si entra en una línea (con un nombre largo se omite).
  const greeting  = `¡Llevás un camino increíble, ${greetName}!`

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-6 pb-10 space-y-6">

        {/* Encabezado */}
        <div>
          <h1 className="text-3xl font-bold text-app-text">Tu progreso</h1>
          <p className="mt-1 text-sm text-app-muted">
            {formatNumber(history.total)} {history.total === 1 ? 'entrenamiento' : 'entrenamientos'}
            {history.months > 0 && <> · {formatNumber(history.months)} {history.months === 1 ? 'mes' : 'meses'} entrenando</>}
          </p>
          {greeting.length <= 42 && <p className="mt-0.5 text-sm text-app-purple-light truncate">{greeting}</p>}
        </div>

        <PeriodSelector value={period} onChange={setPeriod} />

        <ConstanciaBlock comparison={comparison} streak={streak} goal={goal} chart={chart} />

        <StrengthBlock rows={ranking.rows} workouts={workouts} today={today} />

        <BodyBlock body={body} period={period} suggestDeload={shouldSuggestDeload() && !settings?.deloadActive} />

        <div>
          <SectionTitle>Calendario</SectionTitle>
          <ProgressCard>
            <MonthCalendar workouts={workouts} />
          </ProgressCard>
        </div>

        <div>
          <SectionTitle>Últimas sesiones</SectionTitle>
          <UltimasSesiones workouts={workouts} />
        </div>

      </div>
    </div>
  )
}
