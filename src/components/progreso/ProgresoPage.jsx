import { useState, useMemo } from 'react'
import { parseISO, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkouts } from '../../hooks/useWorkouts'
import { getTodayLocal, dateToLocal } from '../../utils/dates'
import { ChevronDown, Loader2 } from 'lucide-react'

const REAL_TYPES = new Set(['fuerza', 'cardio', 'clase', 'tabata'])
import ExerciseProgress from './ExerciseProgress'
import WorkoutHistorial from './WorkoutHistorial'
import { detectPRs } from '../../utils/prUtils'
import { WorkoutIcon } from '../icons/WorkoutIcons'

const GREEN    = '#22c55e'
const RED      = '#ef4444'
const AMBER    = '#eab308'
const PURPLE   = '#9B7FD4'
const ICE_BLUE = '#38bdf8'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getThisWeekDays() {
  const now = new Date()
  const dow = now.getDay() || 7
  const mon = new Date(now)
  mon.setDate(now.getDate() - dow + 1)
  mon.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return dateToLocal(d)
  })
}

function weekMonday(dateStr) {
  const dt  = new Date(dateStr + 'T12:00:00')
  const dow = dt.getDay() || 7
  dt.setDate(dt.getDate() - dow + 1)
  return dateToLocal(dt)
}

// ─── Data computation ─────────────────────────────────────────────────────────

function computeAll(workouts) {
  const real  = workouts.filter(w => REAL_TYPES.has(w.type) && w.date)
  const total = real.length

  let months = 0
  if (real.length > 0) {
    const oldest = [...real].sort((a, b) => a.date.localeCompare(b.date))[0]
    const first  = new Date(oldest.date + 'T12:00:00')
    const now    = new Date()
    months = Math.max(1,
      (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth())
    )
  }

  const uniqueDays = new Set(real.map(w => w.date)).size

  const weekMap = {}
  real.forEach(w => {
    const mon = weekMonday(w.date)
    if (!weekMap[mon]) weekMap[mon] = new Set()
    weekMap[mon].add(w.date)
  })
  const qualifying = Object.keys(weekMap).filter(k => weekMap[k].size >= 3).sort()

  let record = qualifying.length > 0 ? 1 : 0, run = 1
  for (let i = 1; i < qualifying.length; i++) {
    const diff = Math.round(
      (new Date(qualifying[i] + 'T12:00:00') - new Date(qualifying[i - 1] + 'T12:00:00')) / 86400000
    )
    if (diff === 7) { run++; record = Math.max(record, run) } else run = 1
  }

  const fuerza    = [...workouts].filter(w => w.type === 'fuerza').sort((a, b) => a.date.localeCompare(b.date))
  const exFirst   = {}, exLast = {}, exName = {}, exSessions = {}
  const bestSoFar = {}
  let totalPRs = 0

  fuerza.forEach(w => {
    w.exercises?.forEach(e => {
      if (!e.exerciseId || !e.sets?.length) return
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (maxW <= 0) return
      if (maxW > (bestSoFar[e.exerciseId] ?? 0)) {
        if (bestSoFar[e.exerciseId] != null) totalPRs++
        bestSoFar[e.exerciseId] = maxW
      }
      if (exFirst[e.exerciseId] == null) exFirst[e.exerciseId] = maxW
      exLast[e.exerciseId]     = maxW
      exName[e.exerciseId]     = e.name || e.exerciseId
      exSessions[e.exerciseId] = (exSessions[e.exerciseId] ?? 0) + 1
    })
  })

  let maxPct = -1, maxPctId = ''
  Object.keys(exFirst).forEach(id => {
    if (exFirst[id] > 0) {
      const pct = ((exLast[id] - exFirst[id]) / exFirst[id]) * 100
      if (pct > maxPct) { maxPct = pct; maxPctId = id }
    }
  })
  const mayorProgresoVal  = maxPct > 0 ? `+${Math.round(maxPct)}%` : '—'
  const mayorProgresoName = maxPctId ? exName[maxPctId] : ''

  let topN = 0, topId = ''
  Object.keys(exSessions).forEach(id => {
    if (exSessions[id] > topN) { topN = exSessions[id]; topId = id }
  })
  const masEntrenadoVal  = topN > 0 ? `${topN} ses.` : '—'
  const masEntrenadoName = topId ? exName[topId] : ''

  let maxDelta = 0, maxDeltaEx = ''
  Object.keys(exFirst).forEach(id => {
    const d = (exLast[id] ?? 0) - exFirst[id]
    if (d > maxDelta) { maxDelta = d; maxDeltaEx = exName[id] }
  })
  const mejorMarcaVal = maxDelta > 0 ? `+${maxDelta}kg` : '—'
  const mejorMarcaSub = maxDelta > 0 ? `en ${maxDeltaEx.split(' ').slice(0, 2).join(' ')}` : ''

  const allFatigues = workouts.filter(w => REAL_TYPES.has(w.type) && w.fatigue != null).map(w => w.fatigue)
  const avgFatigaHistorica = allFatigues.length >= 3
    ? allFatigues.reduce((a, b) => a + b, 0) / allFatigues.length
    : null

  const today   = getTodayLocal()
  const now2    = new Date()
  const dow2    = now2.getDay() || 7
  const thisMon = new Date(now2)
  thisMon.setDate(now2.getDate() - dow2 + 1)
  thisMon.setHours(0, 0, 0, 0)
  const thisMonStr = dateToLocal(thisMon)
  const thisWeekW  = workouts.filter(w => w.date >= thisMonStr && w.date <= today && REAL_TYPES.has(w.type))
  const thisDays   = new Set(thisWeekW.map(w => w.date)).size

  return {
    total, months, uniqueDays, record, totalPRs,
    mayorProgresoVal, mayorProgresoName,
    masEntrenadoVal, masEntrenadoName,
    mejorMarcaVal, mejorMarcaSub,
    avgFatigaHistorica, thisDays,
  }
}

// Top 3 most recent progress events (weight PR, reps PR, or double)
function computeTopExercises(workouts) {
  const sorted = [...workouts]
    .filter(w => w.type === 'fuerza')
    .sort((a, b) => a.date.localeCompare(b.date))

  const state  = {}   // id -> { maxW, maxReps }
  const events = []   // { name, date, weight, reps, type, deltaW, deltaR }

  sorted.forEach(w => {
    w.exercises?.forEach(e => {
      if (!e.exerciseId || !e.sets?.length) return
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (maxW <= 0) return
      const maxReps = Math.max(0, ...e.sets
        .filter(s => Number(s.weight) === maxW)
        .map(s => Number(s.reps) || 0))

      if (!state[e.exerciseId]) {
        state[e.exerciseId] = { maxW, maxReps }
        return
      }

      const prev  = state[e.exerciseId]
      const wUp   = maxW > prev.maxW
      const rUp   = maxW === prev.maxW && maxReps > prev.maxReps
      const dUp   = maxW > prev.maxW && maxReps > prev.maxReps

      let type = null, deltaW = 0, deltaR = 0
      if (dUp)      { type = 'double'; deltaW = maxW - prev.maxW; deltaR = maxReps - prev.maxReps }
      else if (wUp) { type = 'weight'; deltaW = maxW - prev.maxW }
      else if (rUp) { type = 'reps';   deltaR = maxReps - prev.maxReps }

      if (type) {
        events.push({ name: e.name || e.exerciseId, date: w.date, weight: maxW, reps: maxReps, type, deltaW, deltaR })
        if (wUp || dUp) state[e.exerciseId] = { maxW, maxReps }
        else state[e.exerciseId].maxReps = maxReps
      }
    })
  })

  return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
}

function daysAgo(dateStr) {
  const today = new Date(getTodayLocal() + 'T12:00:00')
  const then  = new Date(dateStr + 'T12:00:00')
  const days  = Math.round((today - then) / 86400000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'hace 1 día'
  if (days < 7)  return `hace ${days} días`
  const weeks = Math.round(days / 7)
  return weeks === 1 ? 'hace 1 sem.' : `hace ${weeks} sem.`
}

// ─── UI components ────────────────────────────────────────────────────────────

function SectionTitle({ children, aside }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748B' }}>{children}</p>
      {aside}
    </div>
  )
}

function valueSize(v) {
  const len = String(v).length
  if (len <= 4) return '26px'
  if (len <= 9) return '17px'
  return '12px'
}

function CaminoCard({ emoji, value, label, name }) {
  return (
    <div className="rounded-2xl flex flex-col items-center justify-center py-4 px-2 text-center gap-1"
      style={{ backgroundColor: '#1a1625' }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span className="font-bold leading-tight" style={{ color: PURPLE, fontSize: name ? '22px' : valueSize(value) }}>
        {value}
      </span>
      {name && (
        <span className="w-full leading-none truncate px-1" style={{ color: '#94A3B8', fontSize: 9 }}>
          {name}
        </span>
      )}
      <span className="leading-tight" style={{ color: '#6B7280', fontSize: 9 }}>{label}</span>
    </div>
  )
}

function VictoriaCard({ icon, value, sub, color, label }) {
  return (
    <div className="flex-1 rounded-2xl flex flex-col items-center justify-center py-4 px-2 text-center gap-1"
      style={{ backgroundColor: '#1e1830' }}>
      {icon ? <span className="text-2xl">{icon}</span> : null}
      <span className="font-bold text-lg leading-none" style={{ color }}>{value}</span>
      {sub ? <span className="leading-tight px-1" style={{ color: '#6B7280', fontSize: 9 }}>{sub}</span> : null}
      <span className="uppercase tracking-wider leading-tight mt-0.5" style={{ color: '#4a4560', fontSize: 8 }}>{label}</span>
    </div>
  )
}

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const TYPE_LABEL  = { fuerza: 'Fuerza', cardio: 'Cardio', clase: 'Clase', tabata: 'Tabata' }

function WeekRow({ workouts }) {
  const today  = getTodayLocal()
  const days   = getThisWeekDays()

  // Build byDate with explicit priority: real workout > descanso > pausa
  const byDate = {}
  workouts.forEach(w => {
    if (REAL_TYPES.has(w.type) && w.date && !byDate[w.date]) byDate[w.date] = w
  })
  workouts.forEach(w => {
    if (w.type === 'descanso' && w.date && !byDate[w.date]) byDate[w.date] = w
  })
  workouts.forEach(w => {
    if (w.type !== 'pausa') return
    const start = parseISO((w.pausaInicio || w.date) + 'T12:00:00')
    const end   = parseISO((w.pausaFin   || w.date) + 'T12:00:00')
    for (let d = new Date(start.getTime()); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = dateToLocal(d)
      if (!byDate[ds]) byDate[ds] = w
    }
  })

  return (
    <div className="flex justify-between gap-1">
      {days.map((dateStr, i) => {
        const w        = byDate[dateStr]
        const trained  = w && REAL_TYPES.has(w.type)
        const isPausa  = w?.type === 'pausa'
        const isToday  = dateStr === today
        const future   = dateStr > today
        const isFrozen = isPausa && (w.pausaMotivo === 'enfermedad' || w.pausaMotivo === 'lesion')
        const pausaColor = isFrozen ? '#38bdf8' : '#4B5563'

        return (
          <div key={i} className="flex flex-col items-center gap-1.5" style={{ flex: 1 }}>
            <span className="font-medium" style={{ fontSize: 9, color: isToday ? PURPLE : '#4a4560' }}>
              {DAY_LETTERS[i]}
            </span>
            <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {trained ? (
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7.5L5.5 10.5L11.5 4.5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              ) : isPausa ? (
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${pausaColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: isFrozen ? 'rgba(56,189,248,0.25)' : 'rgba(75,85,99,0.4)',
                    border: `1.5px solid ${pausaColor}`,
                  }} />
                </div>
              ) : isToday ? (
                <div className="animate-pulse" style={{ width: 32, height: 32, borderRadius: '50%', border: `2px dashed ${PURPLE}` }} />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  backgroundColor: future ? '#160f25' : '#1e1a2e',
                  border: future ? '1px solid rgba(107,114,128,0.35)' : 'none',
                }} />
              )}
            </div>
            <span style={{ fontSize: 8, color: '#4a4560', textAlign: 'center', lineHeight: 1.2 }}>
              {trained ? (TYPE_LABEL[w.type] ?? '') : isToday ? 'Hoy' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Recomendaciones({ items = [] }) {
  if (items.length > 0) {
    return (
      <div className="space-y-2">
        {items.map((r, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] px-4 py-3" style={{ backgroundColor: '#1a1625' }}>
            <p className="text-app-text text-sm font-medium">{r.titulo}</p>
            <p className="text-app-muted text-xs mt-0.5">{r.descripcion}</p>
            {r.accion && <button className="text-xs mt-1.5 font-medium" style={{ color: PURPLE }}>{r.accion}</button>}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-white/[0.06] px-4 py-4" style={{ backgroundColor: '#1a1625' }}>
      <div className="flex items-center gap-2 mb-1">
        <Loader2 size={13} color="#6B7280" />
        <p className="text-app-muted text-sm">Analizando tu historial...</p>
      </div>
      <p style={{ color: '#4a4560', fontSize: 10 }}>Las recomendaciones personalizadas estarán disponibles pronto.</p>
    </div>
  )
}

// ─── Últimas sesiones (Bloque 7) ──────────────────────────────────────────────

const WORKOUT_ICON_COLORS = {
  fuerza: '#9B7FD4',
  cardio: '#4ade80',
  clase:  '#60a5fa',
  tabata: '#f59e0b',
}

function UltimasSesiones({ workouts }) {
  const sessions = workouts.filter(w => REAL_TYPES.has(w.type) && w.date).slice(0, 5)

  if (!sessions.length) {
    return <p className="text-app-muted text-sm text-center py-4">Sin sesiones registradas aún</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((w, i) => {
        const iconColor = WORKOUT_ICON_COLORS[w.type] ?? '#94A3B8'
        const relDate   = formatDistanceToNow(parseISO(w.date + 'T12:00:00'), { addSuffix: true, locale: es })
        const hasPR     = w.type === 'fuerza' && detectPRs(w, workouts.filter(h => h.date < w.date)).length > 0

        // Fatigue badge
        let fatLabel = null, fatDot = null
        if (w.fatigue != null) {
          if (w.fatigue <= 3)      { fatLabel = 'liviana';  fatDot = '#4ade80' }
          else if (w.fatigue <= 6) { fatLabel = 'moderada'; fatDot = '#facc15' }
          else                     { fatLabel = 'alta';     fatDot = '#f87171' }
        }

        // Line 2: subtitle by type
        let subtitle = null
        if (w.type === 'fuerza' && w.muscleGroups?.length) subtitle = w.muscleGroups.join(' · ')
        else if (w.type === 'cardio' && w.activity)        subtitle = w.activity
        else if (w.type === 'clase' && w.clase)            subtitle = w.clase

        // Line 3: tiempo + notes
        const tiempo   = w.tiempo ?? w.duracion ?? null
        const hasLine3 = tiempo || w.notes

        return (
          <div key={i} className="rounded-xl px-4 py-3" style={{ backgroundColor: '#1a1625' }}>
            {/* Row 1: icon · type · fatigue · [PR] · date */}
            <div className="flex items-center gap-2">
              <div style={{ color: iconColor, flexShrink: 0 }}>
                <WorkoutIcon type={w.type} size={20} />
              </div>
              <span className="text-sm font-semibold text-app-text">{TYPE_LABEL[w.type] ?? w.type}</span>
              {fatLabel && (
                <div className="flex items-center gap-1">
                  <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: fatDot, flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: '#9090A8' }}>{fatLabel}</span>
                </div>
              )}
              <div className="flex-1" />
              {hasPR && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full mr-1 flex-shrink-0"
                  style={{ backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                  🏆 PR
                </span>
              )}
              <span className="text-xs flex-shrink-0" style={{ color: '#6B7280' }}>{relDate}</span>
            </div>

            {/* Row 2: subtitle */}
            {subtitle && (
              <p className="mt-1 text-xs truncate" style={{ color: '#9090A8' }}>{subtitle}</p>
            )}

            {/* Row 3: tiempo · notes italic */}
            {hasLine3 && (
              <p className="mt-0.5 text-xs truncate" style={{ color: '#6B7280' }}>
                {tiempo && <span>{tiempo} min</span>}
                {tiempo && w.notes && <span> · </span>}
                {w.notes && <em>{w.notes}</em>}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── ProgresoPage ─────────────────────────────────────────────────────────────

export default function ProgresoPage() {
  const { user, profile } = useAuthContext()
  const { workouts, loading, getCurrentStreak } = useWorkouts(user?.uid)
  const [showAllExercises, setShowAllExercises] = useState(false)
  const [showHistorial, setShowHistorial]        = useState(false)

  const data        = useMemo(() => computeAll(workouts),            [workouts])
  const topEx       = useMemo(() => computeTopExercises(workouts),   [workouts])
  const { state: streakState } = useMemo(() => getCurrentStreak(),   [workouts]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <p className="text-app-muted text-sm animate-pulse">Cargando...</p>
    </div>
  )

  const {
    total, months, uniqueDays, record, totalPRs,
    mayorProgresoVal, mayorProgresoName,
    masEntrenadoVal, masEntrenadoName,
    mejorMarcaVal, mejorMarcaSub,
    avgFatigaHistorica, thisDays,
  } = data

  const diasSemana = profile?.diasSemana ?? 3
  const semanaOK   = thisDays >= diasSemana * 0.5
  const greetName  = profile?.name ?? (profile?.genero === 'masculino' ? 'campeón' : 'campeona')

  const fatigaColor = avgFatigaHistorica == null ? '#6B7280'
    : avgFatigaHistorica <= 5 ? GREEN
    : avgFatigaHistorica <= 7 ? AMBER
    : RED
  const fatigaSub = avgFatigaHistorica == null ? null
    : avgFatigaHistorica <= 5 ? 'Recuperación óptima 💪'
    : avgFatigaHistorica <= 7 ? 'Carga bien gestionada'
    : 'Entrenás al límite 🔥'
  const fatigaLabel = avgFatigaHistorica == null ? 'sin datos aún' : 'fatiga'

  const semanaMsg = thisDays === 0
    ? '¡arrancá hoy!'
    : semanaOK ? '¡vas bien!' : '¡vamos!'

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-6 pb-10 space-y-6">

        {/* Bloque 1 — Header */}
        <div>
          <h1 className="text-3xl font-bold text-app-text">Tu Progreso</h1>
          <p className="mt-1 text-base font-medium" style={{ color: PURPLE }}>
            ¡Llevas un camino increíble, {greetName}! 🚀
          </p>
          <p className="mt-0.5 text-sm" style={{ color: '#94A3B8' }}>
            {total} entrenamientos · {months} {months === 1 ? 'mes' : 'meses'} entrenando
          </p>
        </div>

        {/* Bloque 2 — Tu camino */}
        <div>
          <SectionTitle>Tu camino</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <CaminoCard emoji="🏋️" value={String(total)}       label="entrenamientos totales" />
            <CaminoCard
              emoji={streakState === 'frozen' ? '🧊' : streakState === 'paused' ? '⏸' : '🔥'}
              value={`${record} sem.`}
              label="récord de racha"
            />
            <CaminoCard emoji="🏆" value={String(totalPRs)}    label="PRs históricos" />
            <CaminoCard emoji="📅" value={String(uniqueDays)}  label="días únicos entrenados" />
            <CaminoCard emoji="📈" value={mayorProgresoVal} name={mayorProgresoName} label="mayor progreso" />
            <CaminoCard emoji="⭐" value={masEntrenadoVal}  name={masEntrenadoName}  label="más trabajado" />
          </div>
        </div>

        {/* Bloque 3 — Tus victorias */}
        <div>
          <SectionTitle>Tus victorias</SectionTitle>
          <div className="flex gap-2">
            <VictoriaCard icon="🏆" value={mejorMarcaVal} sub={mejorMarcaSub || null} color={GREEN}  label="mejor marca" />
            <VictoriaCard
              icon={streakState === 'frozen' ? '🧊' : streakState === 'paused' ? '⏸' : '🔥'}
              value={`${record} sem.`} sub={null}
              color={streakState === 'frozen' ? ICE_BLUE : PURPLE}
              label="récord de racha"
            />
            <VictoriaCard
              icon={avgFatigaHistorica != null ? '💪' : ''}
              value={avgFatigaHistorica != null ? avgFatigaHistorica.toFixed(1) : '—'}
              sub={fatigaSub}
              color={fatigaColor}
              label={fatigaLabel}
            />
          </div>
        </div>

        {/* Bloque 4 — Esta semana */}
        <div>
          <SectionTitle aside={
            <p className="text-xs" style={{ color: semanaOK && thisDays > 0 ? GREEN : AMBER }}>
              {thisDays} de {diasSemana} días · {semanaMsg}
            </p>
          }>
            Esta semana
          </SectionTitle>
          <div className="rounded-2xl border border-white/[0.06] px-4 py-4" style={{ backgroundColor: '#1a1625' }}>
            <WeekRow workouts={workouts} />
          </div>
        </div>

        {/* Bloque 5 — Recomendaciones */}
        <div>
          <SectionTitle>Recomendaciones</SectionTitle>
          <Recomendaciones />
        </div>

        {/* Bloque 6 — Principales progresiones */}
        <div>
          <SectionTitle>Principales progresiones</SectionTitle>
          <div className="rounded-2xl border border-white/[0.06]" style={{ backgroundColor: '#1a1625' }}>
            {topEx.length === 0 ? (
              <p className="text-app-muted text-sm text-center py-6 px-4">
                Todavía no hay progresos registrados. ¡Seguí entrenando!
              </p>
            ) : topEx.map((ex, i) => {
              const delta = ex.type === 'double'
                ? `+${ex.deltaW}kg · +${ex.deltaR} reps`
                : ex.type === 'weight'
                ? `+${ex.deltaW}kg`
                : `+${ex.deltaR} reps`
              return (
                <div key={i}
                  className={`flex items-center gap-2 px-4 py-3${i < topEx.length - 1 ? ' border-b border-white/[0.06]' : ''}`}>
                  <p className="text-sm font-medium text-app-text flex-1 min-w-0 truncate">{ex.name}</p>
                  <p className="text-sm flex-shrink-0" style={{ color: '#94A3B8' }}>{ex.weight}kg × {ex.reps}</p>
                  <p className="text-xs font-semibold flex-shrink-0" style={{ color: GREEN }}>({delta})</p>
                  <p className="text-xs flex-shrink-0" style={{ color: '#6B7280' }}>{daysAgo(ex.date)}</p>
                </div>
              )
            })}

            <button
              onClick={() => setShowAllExercises(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-white/[0.06]"
              style={{ color: PURPLE }}
            >
              <span className="text-sm font-medium">Ejercicios</span>
              <ChevronDown size={14} style={{
                transform: showAllExercises ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }} />
            </button>

            {showAllExercises && (
              <div className="border-t border-white/[0.06] px-4 py-4">
                <ExerciseProgress workouts={workouts} />
              </div>
            )}
          </div>
        </div>

        {/* Bloque 7 — Historial: últimas sesiones */}
        <div>
          <SectionTitle>Últimas sesiones</SectionTitle>
          <div className="space-y-3">
            <UltimasSesiones workouts={workouts} />

            <button
              onClick={() => setShowHistorial(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-white/[0.06]"
              style={{ color: PURPLE, backgroundColor: '#1a1625' }}
            >
              <span className="text-sm font-medium">Ver todo el historial</span>
              <ChevronDown size={13} style={{
                transform: showHistorial ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }} />
            </button>

            {showHistorial && (
              <div className="rounded-2xl border border-white/[0.06] px-4 pt-4 pb-2" style={{ backgroundColor: '#1a1625' }}>
                <WorkoutHistorial workouts={workouts} />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
