import { useState, useMemo } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkouts } from '../../hooks/useWorkouts'
import { getTodayLocal, dateToLocal } from '../../utils/dates'
import ExerciseProgress from './ExerciseProgress'
import WorkoutHistorial from './WorkoutHistorial'
import { Dumbbell, Activity, Heart, Zap, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

const GREEN = '#22c55e'
const RED   = '#ef4444'
const AMBER = '#eab308'
const GRAY  = '#6B7280'

// ─── Semana actual y anterior ─────────────────────────────────────────────────
function getWeekBounds() {
  const now = new Date()
  const day  = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() + diff)
  thisMonday.setHours(0, 0, 0, 0)
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const lastSunday = new Date(thisMonday)
  lastSunday.setDate(thisMonday.getDate() - 1)
  return {
    thisMondayStr: dateToLocal(thisMonday),
    lastMondayStr: dateToLocal(lastMonday),
    lastSundayStr: dateToLocal(lastSunday),
    today:         getTodayLocal(),
  }
}

// ─── Métricas de semana ───────────────────────────────────────────────────────
function computeWeekMetrics(workouts) {
  const { thisMondayStr, lastMondayStr, lastSundayStr, today } = getWeekBounds()

  const thisWeek = workouts.filter(w => w.date >= thisMondayStr && w.date <= today && w.type !== 'descanso')
  const lastWeek = workouts.filter(w => w.date >= lastMondayStr && w.date <= lastSundayStr && w.type !== 'descanso')

  // Consistencia
  const thisDays = new Set(thisWeek.map(w => w.date)).size
  const lastDays = new Set(lastWeek.map(w => w.date)).size

  // PRs esta semana
  const priorBest = {}
  workouts.filter(w => w.date < thisMondayStr && w.type === 'fuerza').forEach(w => {
    w.exercises?.forEach(e => {
      if (!e.exerciseId || !e.sets?.length) return
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (maxW > (priorBest[e.exerciseId] ?? 0)) priorBest[e.exerciseId] = maxW
    })
  })
  const weekBest = {}
  thisWeek.filter(w => w.type === 'fuerza').forEach(w => {
    w.exercises?.forEach(e => {
      if (!e.exerciseId || !e.sets?.length) return
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (maxW > (weekBest[e.exerciseId] ?? 0)) weekBest[e.exerciseId] = maxW
    })
  })
  const prCount = Object.keys(weekBest).filter(
    id => priorBest[id] != null && weekBest[id] > priorBest[id]
  ).length

  // Cardio
  const cardioCount = thisWeek.filter(w => w.type === 'cardio' || w.type === 'clase').length

  // Fatiga
  const thisFatigues = thisWeek.filter(w => w.fatigue != null).map(w => w.fatigue)
  const lastFatigues = lastWeek.filter(w => w.fatigue != null).map(w => w.fatigue)
  const avgThis = thisFatigues.length ? thisFatigues.reduce((a, b) => a + b, 0) / thisFatigues.length : null
  const avgLast = lastFatigues.length ? lastFatigues.reduce((a, b) => a + b, 0) / lastFatigues.length : null

  return { thisDays, lastDays, prCount, cardioCount, avgThis, avgLast }
}

// ─── Top 3 ejercicios último mes ─────────────────────────────────────────────
function computeTopExercises(workouts) {
  const d = new Date(); d.setDate(d.getDate() - 30)
  const oneMonthAgo = dateToLocal(d)

  const byExercise = {}
  workouts
    .filter(w => w.date >= oneMonthAgo && w.type === 'fuerza')
    .forEach(w => {
      w.exercises?.forEach(e => {
        if (!e.exerciseId || !e.sets?.length) return
        const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
        if (!maxW) return
        if (!byExercise[e.exerciseId])
          byExercise[e.exerciseId] = { name: e.name || e.exerciseId, entries: [] }
        byExercise[e.exerciseId].entries.push({ date: w.date, maxW })
      })
    })

  return Object.values(byExercise)
    .sort((a, b) => b.entries.length - a.entries.length)
    .slice(0, 3)
    .map(ex => {
      const sorted = [...ex.entries].sort((a, b) => a.date.localeCompare(b.date))
      const first = sorted[0].maxW
      const last  = sorted[sorted.length - 1].maxW
      return { name: ex.name, first, last, delta: last - first, sessions: ex.entries.length }
    })
}

// ─── MetricCard ───────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, arrow, arrowColor, sub }) {
  return (
    <div className="rounded-xl border border-white/[0.06] px-3 py-3" style={{ backgroundColor: '#1a1625' }}>
      <div className="flex items-center gap-1 mb-2">
        <Icon size={11} color={GRAY} />
        <p className="text-[9px] uppercase tracking-wider font-medium" style={{ color: GRAY }}>{label}</p>
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <p className="text-app-text font-bold text-base leading-none">{value}</p>
        {arrow && <p className="text-xs font-semibold leading-none" style={{ color: arrowColor }}>{arrow}</p>}
      </div>
      {sub && <p className="text-[9px] mt-1.5 leading-tight" style={{ color: '#4a4560' }}>{sub}</p>}
    </div>
  )
}

// ─── Recomendaciones (placeholder — lógica con API en próximo prompt) ─────────
function Recomendaciones({ recomendaciones = [] }) {
  if (recomendaciones.length > 0) {
    return (
      <div className="space-y-2">
        {recomendaciones.map((r, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] px-4 py-3" style={{ backgroundColor: '#1a1625' }}>
            <p className="text-app-text text-sm font-medium">{r.titulo}</p>
            <p className="text-app-muted text-xs mt-0.5">{r.descripcion}</p>
            {r.accion && (
              <button className="text-xs mt-1.5 font-medium" style={{ color: '#9B7FD4' }}>{r.accion}</button>
            )}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-white/[0.06] px-4 py-4" style={{ backgroundColor: '#1a1625' }}>
      <div className="flex items-center gap-2 mb-1">
        <Loader2 size={13} color={GRAY} />
        <p className="text-app-muted text-sm">Analizando tu historial...</p>
      </div>
      <p className="text-[10px]" style={{ color: '#4a4560' }}>Las recomendaciones personalizadas estarán disponibles pronto.</p>
    </div>
  )
}

// ─── Bloque de sección ────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#94A3B8' }}>
      {children}
    </p>
  )
}

// ─── ProgresoPage ─────────────────────────────────────────────────────────────
export default function ProgresoPage() {
  const { user, profile } = useAuthContext()
  const { workouts, loading } = useWorkouts(user?.uid)
  const [showAllExercises, setShowAllExercises] = useState(false)

  const metrics      = useMemo(() => computeWeekMetrics(workouts), [workouts])
  const topExercises = useMemo(() => computeTopExercises(workouts), [workouts])

  if (loading) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <p className="text-app-muted text-sm animate-pulse-slow">Cargando...</p>
    </div>
  )

  const { thisDays, lastDays, prCount, cardioCount, avgThis, avgLast } = metrics
  const daysDelta = thisDays - lastDays

  // — Consistencia
  const consColor = daysDelta >= 0 ? GREEN : RED
  const consArrow = daysDelta > 0 ? `↑ +${daysDelta}` : daysDelta < 0 ? `↓ ${daysDelta}` : '→'
  const consSub   = lastDays > 0 ? `sem. ant. ${lastDays} días` : 'primera semana'

  // — Fuerza
  const fuerzaColor = prCount > 0 ? GREEN : GRAY
  const fuerzaArrow = prCount > 0 ? '↑' : '→'
  const fuerzaValue = prCount > 0 ? `${prCount} PR${prCount > 1 ? 's' : ''}` : 'Sin PRs'

  // — Cardio
  const cardioColor = cardioCount >= 2 ? GREEN : cardioCount === 1 ? AMBER : RED
  const cardioArrow = cardioCount >= 2 ? '✓' : cardioCount === 0 ? '↓' : '→'
  const cardioSub   = `objetivo: 2 sesiones`

  // — Fatiga
  let fatigaColor = GRAY, fatigaArrow = '→', fatigaSub = 'sin datos esta semana'
  if (avgThis != null) {
    fatigaSub = avgLast != null ? `sem. ant. ${avgLast.toFixed(1)}/10` : 'primera semana'
    if (avgLast != null) {
      const diff = avgThis - avgLast
      if (diff < 0)    { fatigaColor = GREEN; fatigaArrow = '↓ mejorando' }
      else if (diff >= 2) { fatigaColor = RED;   fatigaArrow = '↑ subió' }
      else             { fatigaArrow = '→ estable' }
    }
  }

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-app-text text-xl font-bold">Progreso</h1>
      </div>

      <div className="px-4 space-y-5 pb-10">

        {/* Bloque 1 — Tu semana en un vistazo */}
        <div>
          <SectionTitle>Tu semana en un vistazo</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              icon={Activity}
              label="Consistencia"
              value={`${thisDays} días`}
              arrow={consArrow}
              arrowColor={consColor}
              sub={consSub}
            />
            <MetricCard
              icon={Dumbbell}
              label="Fuerza"
              value={fuerzaValue}
              arrow={fuerzaArrow}
              arrowColor={fuerzaColor}
              sub="esta semana"
            />
            <MetricCard
              icon={Heart}
              label="Cardio"
              value={`${cardioCount}/2`}
              arrow={cardioArrow}
              arrowColor={cardioColor}
              sub={cardioSub}
            />
            <MetricCard
              icon={Zap}
              label="Fatiga"
              value={avgThis != null ? `${avgThis.toFixed(1)}/10` : '—'}
              arrow={avgThis != null ? fatigaArrow : null}
              arrowColor={fatigaColor}
              sub={fatigaSub}
            />
          </div>
        </div>

        {/* Bloque 2 — Recomendaciones */}
        <div>
          <SectionTitle>Recomendaciones</SectionTitle>
          <Recomendaciones />
        </div>

        {/* Bloque 3 — Tus ejercicios */}
        <div>
          <SectionTitle>Tus ejercicios</SectionTitle>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ backgroundColor: '#1a1625' }}>
            {topExercises.length === 0 ? (
              <p className="text-app-muted text-sm text-center py-6 px-4">Sin entrenamientos de fuerza en el último mes</p>
            ) : (
              topExercises.map((ex, i) => {
                const color = ex.delta > 0 ? GREEN : ex.delta < 0 ? RED : GRAY
                const arrow = ex.delta > 0 ? '↑' : ex.delta < 0 ? '↓' : '→'
                const deltaLabel = ex.delta !== 0
                  ? `${arrow} ${ex.delta > 0 ? '+' : ''}${ex.delta}kg`
                  : arrow
                return (
                  <div
                    key={i}
                    className="px-4 py-3 border-b border-white/[0.06]"
                  >
                    <p className="text-app-text text-sm font-medium mb-0.5">{ex.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-app-muted text-xs">{ex.first}kg → {ex.last}kg</span>
                      <span className="text-xs font-semibold" style={{ color }}>{deltaLabel}</span>
                      <span className="text-[9px]" style={{ color: '#4a4560' }}>· {ex.sessions} ses.</span>
                    </div>
                  </div>
                )
              })
            )}

            <button
              onClick={() => setShowAllExercises(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-3"
              style={{ color: '#9B7FD4' }}
            >
              <span className="text-xs font-medium">
                {showAllExercises ? 'Ocultar ejercicios' : 'Ver todos los ejercicios'}
              </span>
              {showAllExercises ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showAllExercises && (
              <div className="border-t border-white/[0.06] px-4 py-4">
                <ExerciseProgress workouts={workouts} profile={profile} />
              </div>
            )}
          </div>
        </div>

        {/* Bloque 4 — Historial */}
        <div>
          <SectionTitle>Historial</SectionTitle>
          <div className="rounded-xl border border-white/[0.06] px-4 py-4" style={{ backgroundColor: '#1a1625' }}>
            <WorkoutHistorial workouts={workouts} />
          </div>
        </div>

      </div>
    </div>
  )
}
