import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useWorkouts } from '../../hooks/useWorkouts'
import { getTodayLocal } from '../../utils/dates'
import { VIEW_PERIODS } from '../../utils/progressView'
import { computeRunningDetail, dateLabel, weekLabel } from '../../utils/running'
import { formatKm, formatNumber } from '../../utils/format'
import { formatPace, formatDuration } from '../../utils/cardio'
import { ProgressCard, SectionTitle } from './ProgressUI'
import PeriodSelector from './PeriodSelector'
import KmBarsChart from './KmBarsChart'
import { PaceChart, EffortChart } from './RunningCharts'

const MIN_POINTS = 2   // puntos mínimos para dibujar una línea

function Stat({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-widest text-app-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-app-text break-words">{children}</p>
    </div>
  )
}

function RecordRow({ label, value, detail }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-t border-white/[0.06] first:border-t-0">
      <p className="min-w-0 text-sm text-app-muted">{label}</p>
      <div className="text-right min-w-0">
        <p className="text-sm font-semibold text-app-text">{value}</p>
        <p className="text-xs text-app-muted">{detail}</p>
      </div>
    </div>
  )
}

function RunCard({ run }) {
  const { dateLabel: date, km, seconds, pace, fatigue, notes } = run
  return (
    <ProgressCard className="!px-4 !py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-semibold text-app-text">{date}</span>
        <span className="shrink-0 text-sm font-semibold text-app-green-light">{formatKm(km)}</span>
      </div>
      <p className="mt-1 text-xs text-app-muted flex flex-wrap gap-x-3 gap-y-0.5">
        <span>{formatDuration(seconds)}</span>
        <span>{formatPace(pace)}</span>
        {fatigue != null && <span>esfuerzo {formatNumber(fatigue)}/10</span>}
      </p>
      {notes && <p className="mt-0.5 text-xs line-clamp-2 text-app-muted break-words"><em>{notes}</em></p>}
    </ProgressCard>
  )
}

// Pantalla /progreso/running: solo contenedor (datos y navegación). El cálculo vive en utils/running.js
// (computeRunningDetail) y la presentación en RunningView.
export default function RunningPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { workouts, loading } = useWorkouts()
  // Arranca con el período que estaba elegido en Progreso.
  const [period, setPeriod] = useState(() => (VIEW_PERIODS.some(p => p.key === location.state?.period) ? location.state.period : '4w'))
  const today = getTodayLocal()

  useEffect(() => { window.scrollTo(0, 0) }, [])

  const d = useMemo(() => computeRunningDetail(workouts, period, today), [workouts, period, today])

  if (loading) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <p className="text-app-muted text-sm animate-pulse">Cargando...</p>
    </div>
  )

  return <RunningView d={d} period={period} onPeriod={setPeriod} onBack={() => navigate('/progreso', { state: { period } })} today={today} />
}

// d: computeRunningDetail()
export function RunningView({ d, period, onPeriod, onBack, today }) {
  const pacedPoints = d.series.filter(s => s.pace != null).length
  const { records } = d
  const hasRecords = records.longest || records.bestPace || records.bestWeek

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-6 pb-10 space-y-6">

        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Volver a Progreso"
            className="-ml-2 p-2 rounded-xl text-app-muted active:bg-white/5 shrink-0">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-app-text">Running</h1>
        </div>

        <PeriodSelector value={period} onChange={onPeriod} />

        {d.count === 0 ? (
          <ProgressCard>
            <p className="text-app-muted text-sm text-center py-4">
              Todavía no hay carreras en este período. ¡Cuando salgas a correr, vas a ver tu progreso acá!
            </p>
          </ProgressCard>
        ) : (
          <>
            {/* DISTANCIA */}
            <div>
              <SectionTitle>Distancia</SectionTitle>
              <ProgressCard>
                <KmBarsChart bars={d.bars.bars} />
                <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-4">
                  <Stat label="Total del período">{formatKm(d.distance.total)}</Stat>
                  <Stat label="Carrera más larga">
                    {d.distance.longest ? <>{formatKm(d.distance.longest.km)} <span className="font-normal text-app-muted">· {dateLabel(d.distance.longest.date, today)}</span></> : '—'}
                  </Stat>
                </div>
              </ProgressCard>
            </div>

            {/* RITMO */}
            <div>
              <SectionTitle>Ritmo</SectionTitle>
              <ProgressCard>
                {pacedPoints < MIN_POINTS ? (
                  <p className="text-app-muted text-sm text-center py-4">Con 2 carreras o más en este período vas a ver cómo evoluciona tu ritmo.</p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-app-text">
                      Ritmo promedio <span className="font-semibold">{formatPace(d.pace)}</span>
                    </p>
                    {d.comparison && (
                      <p className={`-mt-2 mb-3 text-xs font-medium ${d.comparison.direction === 'better' ? 'text-app-green-light' : 'text-app-muted'}`}>
                        {d.comparison.direction === 'better' ? '↑ ' : ''}{d.comparison.text}
                      </p>
                    )}
                    <PaceChart series={d.series} axis={d.paceAxis} />
                  </>
                )}
              </ProgressCard>
            </div>

            {/* ESFUERZO */}
            <div>
              <SectionTitle>Esfuerzo</SectionTitle>
              <ProgressCard>
                {d.effortCount < MIN_POINTS ? (
                  <p className="text-app-muted text-sm text-center py-4">Con el esfuerzo anotado en 2 carreras o más vas a ver cómo se mueve.</p>
                ) : (
                  <>
                    <p className="mb-2 text-[10px] text-app-muted">Esfuerzo percibido de cada carrera (1 a 10). Las carreras sin esfuerzo anotado no tienen punto.</p>
                    <EffortChart series={d.series} />
                  </>
                )}
              </ProgressCard>
            </div>

            {/* CONCLUSIÓN */}
            {d.conclusion && (
              <div>
                <SectionTitle>Conclusión</SectionTitle>
                <ProgressCard className="p-5">
                  <p className="text-lg font-bold leading-snug text-app-text">{d.conclusion.text}</p>
                  <p className="mt-2 text-xs text-app-muted">
                    Comparando tus primeras {formatNumber(d.conclusion.groupSize)} carreras del período con las últimas {formatNumber(d.conclusion.groupSize)}.
                  </p>
                </ProgressCard>
              </div>
            )}
          </>
        )}

        {/* RÉCORDS (todo el historial) */}
        <div>
          <SectionTitle aside={<span className="text-[10px] text-app-muted">todo tu historial</span>}>Récords</SectionTitle>
          <ProgressCard className="!py-1">
            {hasRecords ? (
              <>
                {records.longest && <RecordRow label="🏆 Carrera más larga" value={formatKm(records.longest.km)} detail={dateLabel(records.longest.date, today)} />}
                {records.bestPace && (
                  <RecordRow label="🏆 Mejor ritmo (3 km o más)" value={formatPace(records.bestPace.pace)}
                    detail={`${dateLabel(records.bestPace.date, today)} · ${formatKm(records.bestPace.km)}`} />
                )}
                {records.bestWeek && <RecordRow label="🏆 Semana con más km" value={formatKm(records.bestWeek.km)} detail={weekLabel(records.bestWeek.weekStart, today)} />}
              </>
            ) : (
              <p className="text-app-muted text-sm text-center py-4">Tus récords de running aparecen después de tu primera carrera.</p>
            )}
          </ProgressCard>
        </div>

        {/* CARRERAS */}
        {d.list.length > 0 && (
          <div>
            <SectionTitle>Carreras</SectionTitle>
            <div className="space-y-2">
              {d.list.map((run, i) => <RunCard key={`${run.id ?? run.date}-${i}`} run={run} />)}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
