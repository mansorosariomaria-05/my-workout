import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkouts } from '../../hooks/useWorkouts'
import { useDeload } from '../../hooks/useDeload'
import { getTodayLocal } from '../../utils/dates'
import { getWeeklyGoal } from '../../utils/progressStats'
import {
  normalizeViewPeriod, computeHistorySummary, computeMonthReport, computeConstanciaBars,
  computeStrengthRanking, computeBodySummary, computePeriodSummary,
} from '../../utils/progressView'
import { computeRunningSummary } from '../../utils/running'
import { textoGenero } from '../../utils/genero'
import { formatNumber } from '../../utils/format'
import PeriodSelector from './PeriodSelector'
import ConstanciaBlock from './ConstanciaBlock'
import StrengthBlock from './StrengthBlock'
import RunningBlock from './RunningBlock'
import BodyBlock from './BodyBlock'

// ─── ProgresoPage ─────────────────────────────────────────────────────────────
// Una sola pantalla con scroll, enfocada en el análisis: encabezado · período · Constancia · Más fuerte que antes ·
// Tu running · Cómo está tu cuerpo. El período afecta a todos los bloques. El calendario y la lista de sesiones viven
// en la pestaña Historial (/historial) y el detalle de running en /progreso/running. Los cálculos viven en
// utils/progressView.js y utils/running.js.

export default function ProgresoPage() {
  const { profile, settings } = useAuthContext()
  const { workouts, loading, getWeeklyStreak3Plus } = useWorkouts()
  const { shouldSuggestDeload } = useDeload(settings, workouts)
  const navigate = useNavigate()
  const location = useLocation()
  // Al volver desde /progreso/running llega el período que se estaba mirando.
  const [period, setPeriod] = useState(() => normalizeViewPeriod(location.state?.period))   // por defecto "Este mes"

  const today  = getTodayLocal()
  const goal   = getWeeklyGoal(profile)
  const streak = getWeeklyStreak3Plus() // racha semanal 3+ (memoizada en useWorkouts, la misma que Inicio)

  const history    = useMemo(() => computeHistorySummary(workouts, today),              [workouts, today])
  const report     = useMemo(() => computeMonthReport(workouts, today),                 [workouts, today])
  const chart      = useMemo(() => computeConstanciaBars(workouts, period, today, goal), [workouts, period, today, goal])
  const summary    = useMemo(() => computePeriodSummary(workouts, period, today, goal), [workouts, period, today, goal])
  const ranking    = useMemo(() => computeStrengthRanking(workouts, period, today),     [workouts, period, today])
  const running    = useMemo(() => computeRunningSummary(workouts, period, today),      [workouts, period, today])
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

        <ConstanciaBlock report={report} streak={streak} goal={goal} chart={chart} summary={summary} />

        <StrengthBlock rows={ranking.rows} workouts={workouts} today={today} />

        <RunningBlock summary={running} onOpen={() => navigate('/progreso/running', { state: { period } })} />

        <BodyBlock body={body} period={period} suggestDeload={shouldSuggestDeload() && !settings?.deloadActive} />

      </div>
    </div>
  )
}
