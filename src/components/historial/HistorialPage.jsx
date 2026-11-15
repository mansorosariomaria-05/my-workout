import { useMemo } from 'react'
import { useWorkouts } from '../../hooks/useWorkouts'
import { groupSessionsByMonth } from '../../utils/historyView'
import { formatNumber } from '../../utils/format'
import { ProgressCard, SectionTitle } from '../progreso/ProgressUI'
import MonthCalendar from './MonthCalendar'
import SessionList from './SessionList'

// Pestaña Historial: calendario mensual y lista completa de sesiones agrupada por mes.
// Mismo estilo que Progreso (tarjetas, espaciados y títulos de sección). Los cálculos viven en utils/historyView.js.
export default function HistorialPage() {
  const { workouts, loading } = useWorkouts()
  const groups = useMemo(() => groupSessionsByMonth(workouts), [workouts])

  if (loading) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <p className="text-app-muted text-sm animate-pulse">Cargando...</p>
    </div>
  )

  const total = groups.reduce((n, g) => n + g.count, 0)

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-6 pb-10 space-y-6">

        <div>
          <h1 className="text-3xl font-bold text-app-text">Historial</h1>
          {total > 0 && (
            <p className="mt-1 text-sm text-app-muted">
              {formatNumber(total)} {total === 1 ? 'sesión registrada' : 'sesiones registradas'}
            </p>
          )}
        </div>

        <div>
          <SectionTitle>Calendario</SectionTitle>
          <ProgressCard>
            <MonthCalendar workouts={workouts} />
          </ProgressCard>
        </div>

        <div>
          <SectionTitle>Sesiones</SectionTitle>
          <SessionList groups={groups} />
        </div>

      </div>
    </div>
  )
}
