import { useState, useMemo } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkouts } from '../../hooks/useWorkouts'
import { getTodayLocal, dateToLocal } from '../../utils/dates'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import ExerciseProgress from './ExerciseProgress'
import WorkoutHistorial from './WorkoutHistorial'

const GREEN  = '#22c55e'
const RED    = '#ef4444'
const AMBER  = '#eab308'
const PURPLE = '#9B7FD4'

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
  const real  = workouts.filter(w => w.type !== 'descanso' && w.date)
  const total = real.length

  // Months since first workout
  let months = 0
  if (real.length > 0) {
    const oldest = [...real].sort((a, b) => a.date.localeCompare(b.date))[0]
    const first  = new Date(oldest.date + 'T12:00:00')
    const now    = new Date()
    months = Math.max(1,
      (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth())
    )
  }

  // Unique training days
  const uniqueDays = new Set(real.map(w => w.date)).size

  // Week buckets for streaks
  const weekMap = {}
  real.forEach(w => {
    const mon = weekMonday(w.date)
    if (!weekMap[mon]) weekMap[mon] = new Set()
    weekMap[mon].add(w.date)
  })
  const qualifying = Object.keys(weekMap).filter(k => weekMap[k].size >= 3).sort()

  // Record streak (max consecutive qualifying weeks)
  let record = qualifying.length > 0 ? 1 : 0, run = 1
  for (let i = 1; i < qualifying.length; i++) {
    const diff = Math.round(
      (new Date(qualifying[i] + 'T12:00:00') - new Date(qualifying[i - 1] + 'T12:00:00')) / 86400000
    )
    if (diff === 7) { run++; record = Math.max(record, run) } else run = 1
  }

  // Current streak (consecutive qualifying complete weeks ending at last Mon)
  const now2    = new Date()
  const dow2    = now2.getDay() || 7
  const thisMon = new Date(now2)
  thisMon.setDate(now2.getDate() - dow2 + 1)
  thisMon.setHours(0, 0, 0, 0)
  const lastMon = new Date(thisMon)
  lastMon.setDate(thisMon.getDate() - 7)
  let current = 0, checkD = new Date(lastMon)
  for (let i = 0; i < 52; i++) {
    const k = dateToLocal(checkD)
    if ((weekMap[k]?.size ?? 0) >= 3) { current++; checkD.setDate(checkD.getDate() - 7) } else break
  }

  // Per-exercise stats: PRs, first/last weight, session count
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

  // Mayor progreso % — exercise with biggest relative weight gain
  let maxPct = -1, maxPctName = ''
  Object.keys(exFirst).forEach(id => {
    if (exFirst[id] > 0) {
      const pct = ((exLast[id] - exFirst[id]) / exFirst[id]) * 100
      if (pct > maxPct) { maxPct = pct; maxPctName = exName[id] }
    }
  })
  const mayorProgreso = maxPct > 0
    ? `${maxPctName.split(' ').slice(0, 2).join(' ')} +${Math.round(maxPct)}%`
    : '—'

  // Más trabajado — most sessions
  let topN = 0, topName = ''
  Object.keys(exSessions).forEach(id => {
    if (exSessions[id] > topN) { topN = exSessions[id]; topName = exName[id] }
  })
  const masEntrenado = topN > 0
    ? `${topName.split(' ').slice(0, 2).join(' ')} · ${topN} ses.`
    : '—'

  // Mejor marca — biggest absolute kg gain
  let maxDelta = 0, maxDeltaEx = ''
  Object.keys(exFirst).forEach(id => {
    const d = (exLast[id] ?? 0) - exFirst[id]
    if (d > maxDelta) { maxDelta = d; maxDeltaEx = exName[id] }
  })
  const mejorMarcaVal = maxDelta > 0 ? `+${maxDelta}kg` : '—'
  const mejorMarcaSub = maxDelta > 0 ? `en ${maxDeltaEx.split(' ').slice(0, 2).join(' ')}` : ''

  // This week: avg fatigue + training days
  const today      = getTodayLocal()
  const thisMonStr = dateToLocal(thisMon)
  const thisWeekW  = workouts.filter(w => w.date >= thisMonStr && w.date <= today && w.type !== 'descanso')
  const fatigues   = thisWeekW.filter(w => w.fatigue != null).map(w => w.fatigue)
  const avgFatiga  = fatigues.length > 0 ? fatigues.reduce((a, b) => a + b, 0) / fatigues.length : null
  const thisDays   = new Set(thisWeekW.map(w => w.date)).size

  return {
    total, months, uniqueDays, record, current, totalPRs,
    mayorProgreso, masEntrenado,
    mejorMarcaVal, mejorMarcaSub,
    avgFatiga, thisDays,
  }
}

function computeTopExercises(workouts) {
  const d = new Date(); d.setDate(d.getDate() - 30)
  const oneMonthAgo = dateToLocal(d)
  const byEx = {}

  ;[...workouts].filter(w => w.type === 'fuerza').sort((a, b) => a.date.localeCompare(b.date)).forEach(w => {
    w.exercises?.forEach(e => {
      if (!e.exerciseId || !e.sets?.length) return
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (!maxW) return
      if (!byEx[e.exerciseId]) byEx[e.exerciseId] = { name: e.name || e.exerciseId, entries: [] }
      byEx[e.exerciseId].entries.push({ date: w.date, maxW })
    })
  })

  return Object.values(byEx)
    .map(ex => {
      const month = ex.entries.filter(e => e.date >= oneMonthAgo)
      if (!month.length) return null
      const pre      = ex.entries.filter(e => e.date < oneMonthAgo)
      const priorMax = pre.length ? Math.max(...pre.map(e => e.maxW)) : 0
      const sorted   = [...month].sort((a, b) => a.date.localeCompare(b.date))
      const first    = sorted[0].maxW
      const last     = sorted[sorted.length - 1].maxW
      return {
        name:      ex.name,
        first,     last,
        sessions:  month.length,
        isPR:      last > priorMax && priorMax > 0,
        sparkVals: sorted.slice(-5).map(e => e.maxW),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 3)
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

function Sparkline({ values, color, width = 80, height = 24 }) {
  if (!values || values.length < 2) return <div style={{ width, height }} />
  const min = Math.min(...values), max = Math.max(...values)
  const rng = max - min || 1
  const pad = 3
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = (height - pad) - ((v - min) / rng) * (height - pad * 2)
    return [x, y]
  })
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pts.map(p => p.join(',')).join(' ')}
        fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 2.5 : 1.5} fill={color} />
      ))}
    </svg>
  )
}

function CaminoCard({ emoji, value, label }) {
  return (
    <div className="rounded-2xl flex flex-col items-center justify-center py-4 px-2 text-center gap-1"
      style={{ backgroundColor: '#1a1625' }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span className="font-bold leading-tight" style={{ color: PURPLE, fontSize: valueSize(value) }}>{value}</span>
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
      {sub ? <span className="leading-tight" style={{ color: '#6B7280', fontSize: 9 }}>{sub}</span> : null}
      <span className="uppercase tracking-wider leading-tight mt-0.5" style={{ color: '#4a4560', fontSize: 8 }}>{label}</span>
    </div>
  )
}

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const TYPE_LABEL  = { fuerza: 'Fuerza', cardio: 'Cardio', clase: 'Clase', tabata: 'Tabata' }

function WeekRow({ workouts }) {
  const today  = getTodayLocal()
  const days   = getThisWeekDays()
  const byDate = {}
  workouts.forEach(w => { if (!byDate[w.date]) byDate[w.date] = w })

  return (
    <div className="flex justify-between gap-1">
      {days.map((dateStr, i) => {
        const w       = byDate[dateStr]
        const trained = w && w.type !== 'descanso'
        const isToday = dateStr === today
        const future  = dateStr > today

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
              ) : isToday ? (
                <div className="animate-pulse" style={{ width: 32, height: 32, borderRadius: '50%', border: `2px dashed ${PURPLE}` }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: future ? '#160f25' : '#1e1a2e' }} />
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

function flameSize(fatigue) {
  if (fatigue == null || fatigue <= 4) return 'text-lg'
  if (fatigue <= 7) return 'text-xl'
  return 'text-2xl'
}

function WeekFlames({ workouts }) {
  const today  = getTodayLocal()
  const days   = getThisWeekDays()
  const byDate = {}
  workouts.forEach(w => { if (!byDate[w.date]) byDate[w.date] = w })

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((dateStr, i) => {
        const w       = byDate[dateStr]
        const future  = dateStr > today
        const isToday = dateStr === today
        const trained = w && w.type !== 'descanso' && !future
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px]" style={{ color: isToday ? PURPLE : '#4a4560' }}>{DAY_LETTERS[i]}</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: trained ? 'rgba(124,92,191,0.1)' : 'transparent' }}>
              {trained
                ? <span className={flameSize(w.fatigue)}>🔥</span>
                : <span className="text-sm" style={{ color: future ? '#1e1a2e' : '#2a2440' }}>{future ? '' : '+'}</span>
              }
            </div>
            <span className="text-[8px] text-center leading-none" style={{ color: '#3a3550' }}>
              {trained ? (TYPE_LABEL[w.type] ?? '') : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── ProgresoPage ─────────────────────────────────────────────────────────────

export default function ProgresoPage() {
  const { user, profile } = useAuthContext()
  const { workouts, loading } = useWorkouts(user?.uid)
  const [showAllExercises, setShowAllExercises] = useState(false)
  const [showHistorial, setShowHistorial]        = useState(false)

  const data  = useMemo(() => computeAll(workouts),        [workouts])
  const topEx = useMemo(() => computeTopExercises(workouts), [workouts])

  if (loading) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <p className="text-app-muted text-sm animate-pulse">Cargando...</p>
    </div>
  )

  const {
    total, months, uniqueDays, record, current, totalPRs,
    mayorProgreso, masEntrenado,
    mejorMarcaVal, mejorMarcaSub,
    avgFatiga, thisDays,
  } = data

  const diasSemana = profile?.diasSemana ?? 3
  const semanaOK   = thisDays >= diasSemana * 0.5
  const greetName  = profile?.name ?? (profile?.genero === 'masculino' ? 'campeón' : 'campeona')

  const fatigaColor = avgFatiga == null ? '#6B7280'
    : avgFatiga <= 5 ? GREEN
    : avgFatiga <= 7 ? AMBER
    : RED
  const fatigaText = avgFatiga == null ? '—'
    : avgFatiga <= 5 ? 'Óptima'
    : avgFatiga <= 7 ? 'Buena'
    : 'Alta'

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
            <CaminoCard emoji="🏋️" value={String(total)}      label="entrenamientos totales" />
            <CaminoCard emoji="🔥" value={`${record} sem.`}   label="récord de racha" />
            <CaminoCard emoji="🏆" value={String(totalPRs)}   label="PRs históricos" />
            <CaminoCard emoji="📅" value={String(uniqueDays)} label="días únicos entrenados" />
            <CaminoCard emoji="📈" value={mayorProgreso}       label="mayor progreso" />
            <CaminoCard emoji="⭐" value={masEntrenado}        label="más trabajado" />
          </div>
        </div>

        {/* Bloque 3 — Tus victorias */}
        <div>
          <SectionTitle>Tus victorias</SectionTitle>
          <div className="flex gap-2">
            <VictoriaCard
              icon="🏆"
              value={mejorMarcaVal}
              sub={mejorMarcaSub || null}
              color={GREEN}
              label="mejor marca"
            />
            <VictoriaCard
              icon="🔥"
              value={`${current} sem.`}
              sub={null}
              color={PURPLE}
              label="racha activa"
            />
            <VictoriaCard
              icon={avgFatiga != null ? '💪' : ''}
              value={fatigaText}
              sub={avgFatiga != null ? `${avgFatiga.toFixed(1)}/10` : null}
              color={fatigaColor}
              label="fatiga"
            />
          </div>
        </div>

        {/* Bloque 4 — Esta semana */}
        <div>
          <SectionTitle aside={
            <p className="text-xs" style={{ color: semanaOK ? GREEN : AMBER }}>
              {thisDays} de {diasSemana} días{semanaOK ? ' · ¡vas bien!' : ' · ¡vamos!'}
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
              <p className="text-app-muted text-sm text-center py-6 px-4">Sin entrenamientos de fuerza en el último mes</p>
            ) : topEx.map((ex, i) => {
              const sparkColor = ex.last > ex.first ? GREEN : ex.last < ex.first ? RED : PURPLE
              return (
                <div key={i} className={i < topEx.length - 1 ? 'border-b border-white/[0.06]' : ''}>
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-app-text truncate flex-1 mr-2">{ex.name}</p>
                      {ex.isPR && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: GREEN }}>PR 🏆</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <Sparkline values={ex.sparkVals} color={sparkColor} width={80} height={24} />
                      <p className="text-lg font-bold text-app-text">{ex.last}kg</p>
                    </div>
                  </div>
                </div>
              )
            })}

            <button
              onClick={() => setShowAllExercises(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-white/[0.06]"
              style={{ color: PURPLE }}
            >
              <span className="text-sm font-medium">
                {showAllExercises ? 'Ocultar ejercicios' : 'Ver todos los ejercicios'}
              </span>
              {showAllExercises ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAllExercises && (
              <div className="border-t border-white/[0.06] px-4 py-4">
                <ExerciseProgress workouts={workouts} profile={profile} />
              </div>
            )}
          </div>
        </div>

        {/* Bloque 7 — Historial */}
        <div>
          <SectionTitle>Historial</SectionTitle>
          <div className="rounded-2xl border border-white/[0.06] px-4 py-4" style={{ backgroundColor: '#1a1625' }}>
            <WeekFlames workouts={workouts} />

            <button
              onClick={() => setShowHistorial(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-white/[0.06]"
              style={{ color: PURPLE }}
            >
              <span className="text-sm font-medium">
                {showHistorial ? 'Ocultar historial' : 'Ver historial completo'}
              </span>
              {showHistorial ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showHistorial && (
              <div className="mt-4">
                <WorkoutHistorial workouts={workouts} />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
