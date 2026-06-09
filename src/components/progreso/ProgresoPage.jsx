import { useState, useMemo } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkouts } from '../../hooks/useWorkouts'
import { getTodayLocal, dateToLocal } from '../../utils/dates'
import ExerciseProgress from './ExerciseProgress'
import WorkoutHistorial from './WorkoutHistorial'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

const GREEN = '#22c55e'
const RED   = '#ef4444'
const AMBER = '#eab308'
const GRAY  = '#6B7280'

// ─── Week bounds ──────────────────────────────────────────────────────────────
function getWeekBounds() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(now); thisMonday.setDate(now.getDate() + diff); thisMonday.setHours(0,0,0,0)
  const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7)
  const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1)
  return {
    thisMon: dateToLocal(thisMonday),
    lastMon: dateToLocal(lastMonday),
    lastSun: dateToLocal(lastSunday),
    today:   getTodayLocal(),
    thisMondayDate: thisMonday,
  }
}

function countSets(ws) {
  return ws.reduce((s, w) => s + (w.exercises?.reduce((s2, e) => s2 + (e.sets?.length ?? 0), 0) ?? 0), 0)
}

// ─── Data computations ────────────────────────────────────────────────────────
function computeWeekData(workouts) {
  const { thisMon, lastMon, lastSun, today, thisMondayDate } = getWeekBounds()

  const thisWeek = workouts.filter(w => w.date >= thisMon && w.date <= today && w.type !== 'descanso')
  const lastWeek = workouts.filter(w => w.date >= lastMon && w.date <= lastSun && w.type !== 'descanso')

  const thisDays = new Set(thisWeek.map(w => w.date)).size
  const lastDays = new Set(lastWeek.map(w => w.date)).size

  const thisFuerza = thisWeek.filter(w => w.type === 'fuerza')
  const lastFuerza = lastWeek.filter(w => w.type === 'fuerza')
  const fuerzaSessions  = thisFuerza.length
  const thisFuerzaSets  = countSets(thisFuerza)
  const lastFuerzaSets  = countSets(lastFuerza)

  // Last 4 weekly volumes for sparkline (oldest first)
  const weeklyVolumes = []
  for (let i = 3; i >= 0; i--) {
    const wStart = new Date(thisMondayDate); wStart.setDate(thisMondayDate.getDate() - i * 7)
    const wEnd   = new Date(wStart); wEnd.setDate(wStart.getDate() + 6)
    const ws = workouts.filter(w => w.date >= dateToLocal(wStart) && w.date <= dateToLocal(wEnd) && w.type === 'fuerza')
    weeklyVolumes.push(countSets(ws))
  }

  const thisCardio    = thisWeek.filter(w => w.type === 'cardio' || w.type === 'clase')
  const cardioSessions = thisCardio.length
  const cardioMinutes  = thisCardio.reduce((s, w) => s + (Number(w.tiempo) || Number(w.duracion) || 0), 0)

  const thisFatigues = thisWeek.filter(w => w.fatigue != null).map(w => w.fatigue)
  const lastFatigues = lastWeek.filter(w => w.fatigue != null).map(w => w.fatigue)
  const avgFatigaThis = thisFatigues.length ? thisFatigues.reduce((a, b) => a + b, 0) / thisFatigues.length : null
  const avgFatigaLast = lastFatigues.length ? lastFatigues.reduce((a, b) => a + b, 0) / lastFatigues.length : null

  return { thisDays, lastDays, fuerzaSessions, thisFuerzaSets, lastFuerzaSets, weeklyVolumes, cardioSessions, cardioMinutes, avgFatigaThis, avgFatigaLast }
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
        name: ex.name,
        first, last,
        delta:    last - first,
        sessions: month.length,
        isPR:     last > priorMax && priorMax > 0,
        sparkVals: sorted.slice(-5).map(e => e.maxW),
        history:   sorted,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 3)
}

function computeHistoricalMetrics(workouts) {
  const real = workouts.filter(w => w.type !== 'descanso')
  const totalWorkouts = real.length
  const uniqueDays    = new Set(real.map(w => w.date)).size

  // Streak record
  const weekMap = {}
  real.forEach(w => {
    const dt = new Date(w.date + 'T12:00:00')
    const dow = dt.getDay() || 7
    dt.setDate(dt.getDate() - dow + 1)
    const mon = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
    if (!weekMap[mon]) weekMap[mon] = new Set()
    weekMap[mon].add(w.date)
  })
  const qualifying = Object.keys(weekMap).filter(k => weekMap[k].size >= 3).sort()
  let record = qualifying.length > 0 ? 1 : 0, run = 1
  for (let i = 1; i < qualifying.length; i++) {
    const diff = Math.round((new Date(qualifying[i]+'T12:00:00') - new Date(qualifying[i-1]+'T12:00:00')) / 86400000)
    if (diff === 7) { run++; record = Math.max(record, run) } else { run = 1 }
  }

  // Total PRs
  const sorted = [...workouts].filter(w => w.type === 'fuerza').sort((a,b) => a.date.localeCompare(b.date))
  const best = {}
  let totalPRs = 0
  sorted.forEach(w => {
    w.exercises?.forEach(e => {
      if (!e.exerciseId || !e.sets?.length) return
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (maxW > 0 && maxW > (best[e.exerciseId] ?? 0)) {
        if (best[e.exerciseId] != null) totalPRs++
        best[e.exerciseId] = maxW
      }
    })
  })

  // Mayor salto de peso
  const exFirst = {}, exCur = {}, exName = {}
  sorted.forEach(w => {
    w.exercises?.forEach(e => {
      if (!e.exerciseId || !e.sets?.length) return
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (!maxW) return
      if (exFirst[e.exerciseId] == null) exFirst[e.exerciseId] = maxW
      exCur[e.exerciseId]  = maxW
      exName[e.exerciseId] = e.name || e.exerciseId
    })
  })
  let maxJump = 0, maxJumpName = ''
  Object.keys(exFirst).forEach(id => {
    const j = (exCur[id] ?? 0) - exFirst[id]
    if (j > maxJump) { maxJump = j; maxJumpName = exName[id] }
  })
  const mayorSalto = maxJump > 0
    ? `${maxJumpName.split(' ').slice(0, 2).join(' ')} · +${maxJump}kg`
    : '—'

  // Ejercicio más trabajado
  const ses = {}
  workouts.filter(w => w.type === 'fuerza').forEach(w => {
    w.exercises?.forEach(e => {
      if (!e.exerciseId) return
      if (!ses[e.exerciseId]) ses[e.exerciseId] = { name: e.name || e.exerciseId, n: 0 }
      ses[e.exerciseId].n++
    })
  })
  let topEx = '—', topN = 0
  Object.values(ses).forEach(ex => { if (ex.n > topN) { topEx = ex.name; topN = ex.n } })
  const masEntrenado = topN > 0
    ? `${topEx.split(' ').slice(0, 2).join(' ')} · ${topN} ses.`
    : '—'

  return { totalWorkouts, uniqueDays, record, totalPRs, mayorSalto, masEntrenado }
}

// ─── SVG Components ───────────────────────────────────────────────────────────
function Sparkline({ values, color = '#9B7FD4', width = 60, height = 20 }) {
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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
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

function RingChart({ days, target }) {
  const R = 44, cx = 54, cy = 54, sw = 9
  const circ = 2 * Math.PI * R
  const pct   = target > 0 ? Math.min(days / target, 1) : 0
  const color  = pct >= 1 ? GREEN : '#9B7FD4'
  return (
    <div className="relative flex-shrink-0" style={{ width: 108, height: 108 }}>
      <svg width={108} height={108} viewBox="0 0 108 108">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1e1a2e" strokeWidth={sw} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-app-text font-bold text-2xl leading-none">{days}</p>
        <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>de {target}</p>
      </div>
    </div>
  )
}

function FatigueGauge({ value, generoLabel }) {
  const R = 30, cx = 40, cy = 38, sw = 6
  const arc  = Math.PI * R
  const pct  = value != null ? Math.min(Math.max(value, 0), 10) / 10 : 0
  const color = value == null ? '#1e1a2e' : value <= 5 ? GREEN : value <= 7 ? AMBER : RED
  const label = value == null ? 'sin datos'
    : value <= 5 ? generoLabel('¡Lista! 💪', '¡Listo! 💪')
    : value <= 7 ? 'Ritmo sostenido'
    : 'Considerá descansar'
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 80, height: 42 }}>
        <svg width={80} height={42} viewBox="0 0 80 42">
          <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`}
            fill="none" stroke="#1e1a2e" strokeWidth={sw} strokeLinecap="round" />
          <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`}
            fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={`${arc * pct} ${arc}`} />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center" style={{ paddingBottom: '4px' }}>
          <p className="font-bold text-sm leading-none" style={{ color: value != null ? 'white' : GRAY }}>
            {value != null ? value.toFixed(1) : '—'}
          </p>
        </div>
      </div>
      <p className="text-[8px] text-center leading-tight" style={{ color: value != null ? color : GRAY }}>{label}</p>
    </div>
  )
}

// ─── Mini card ────────────────────────────────────────────────────────────────
function MiniCard({ label, children }) {
  return (
    <div className="rounded-xl border border-white/[0.06] px-2.5 py-2.5 flex flex-col" style={{ backgroundColor: '#1a1625' }}>
      <p className="text-[8px] uppercase tracking-wider font-medium mb-1.5" style={{ color: GRAY }}>{label}</p>
      {children}
    </div>
  )
}

// ─── Bloque 5: semana con llamas ──────────────────────────────────────────────
const DAY_LABELS  = ['L','M','X','J','V','S','D']
const TYPE_SHORT  = { fuerza: 'Fza', cardio: 'Car', clase: 'Cla', tabata: 'Tab', descanso: 'Des' }

function flameSize(fatigue) {
  if (fatigue == null) return 'text-base'
  if (fatigue <= 4) return 'text-sm'
  if (fatigue <= 7) return 'text-base'
  return 'text-xl'
}

function WeekFlames({ workouts }) {
  const today   = getTodayLocal()
  const now     = new Date()
  const dayOfW  = now.getDay()
  const diff    = dayOfW === 0 ? -6 : 1 - dayOfW
  const monday  = new Date(now); monday.setDate(now.getDate() + diff); monday.setHours(0,0,0,0)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    return dateToLocal(d)
  })

  const byDate = {}
  workouts.forEach(w => { if (!byDate[w.date]) byDate[w.date] = w })

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((dateStr, i) => {
        const w       = byDate[dateStr]
        const isFuture = dateStr > today
        const isToday  = dateStr === today
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <p className="text-[9px]" style={{ color: isToday ? '#9B7FD4' : '#3a3550' }}>{DAY_LABELS[i]}</p>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${isToday ? 'border border-app-purple/30' : ''}`}
              style={{ backgroundColor: w && !isFuture ? 'rgba(124,92,191,0.1)' : 'transparent' }}
            >
              {w && !isFuture
                ? <span className={flameSize(w.fatigue)}>🔥</span>
                : <span className="text-sm" style={{ color: isFuture ? '#1e1a2e' : '#2a2440' }}>{isFuture ? '' : '+'}</span>
              }
            </div>
            <p className="text-[8px] text-center leading-none" style={{ color: '#3a3550' }}>
              {w && !isFuture ? (TYPE_SHORT[w.type] ?? '') : ''}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Bloque 3: Recomendaciones (placeholder) ──────────────────────────────────
function Recomendaciones({ recomendaciones = [] }) {
  if (recomendaciones.length > 0) {
    return (
      <div className="space-y-2">
        {recomendaciones.map((r, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] px-4 py-3" style={{ backgroundColor: '#1a1625' }}>
            <p className="text-app-text text-sm font-medium">{r.titulo}</p>
            <p className="text-app-muted text-xs mt-0.5">{r.descripcion}</p>
            {r.accion && <button className="text-xs mt-1.5 font-medium" style={{ color: '#9B7FD4' }}>{r.accion}</button>}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-white/[0.06] px-4 py-4" style={{ backgroundColor: '#1a1625' }}>
      <div className="flex items-center gap-2 mb-1">
        <Loader2 size={13} color={GRAY} />
        <p className="text-app-muted text-sm">Analizando tu historial...</p>
      </div>
      <p className="text-[10px]" style={{ color: '#4a4560' }}>Las recomendaciones personalizadas estarán disponibles pronto.</p>
    </div>
  )
}

// ─── Section title ────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#94A3B8' }}>
      {children}
    </p>
  )
}

// ─── ProgresoPage ─────────────────────────────────────────────────────────────
export default function ProgresoPage() {
  const { user, profile } = useAuthContext()
  const { workouts, loading } = useWorkouts(user?.uid)
  const [showAllExercises, setShowAllExercises] = useState(false)
  const [expandedEx, setExpandedEx]             = useState(null)
  const [showHistorial, setShowHistorial]        = useState(false)

  const weekData   = useMemo(() => computeWeekData(workouts),         [workouts])
  const topEx      = useMemo(() => computeTopExercises(workouts),      [workouts])
  const historical = useMemo(() => computeHistoricalMetrics(workouts), [workouts])

  const generoLabel = (fem, masc) => profile?.genero === 'masculino' ? masc : fem

  if (loading) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <p className="text-app-muted text-sm animate-pulse-slow">Cargando...</p>
    </div>
  )

  const {
    thisDays, lastDays, fuerzaSessions, thisFuerzaSets, lastFuerzaSets, weeklyVolumes,
    cardioSessions, cardioMinutes, avgFatigaThis, avgFatigaLast,
  } = weekData

  const diasObjetivo = profile?.diasSemana ?? 3
  const setsDelta    = thisFuerzaSets - lastFuerzaSets
  const cardioColor  = cardioSessions >= 2 ? GREEN : cardioSessions === 1 ? AMBER : RED

  const { totalWorkouts, uniqueDays, record, totalPRs, mayorSalto, masEntrenado } = historical

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-app-text text-xl font-bold">Progreso</h1>
      </div>

      <div className="px-4 space-y-5 pb-10">

        {/* ── Bloque 1: Tu semana ──────────────────────────────────────────── */}
        <div>
          <SectionTitle>Tu semana</SectionTitle>
          <div className="rounded-2xl border border-white/[0.06] p-3" style={{ backgroundColor: '#1a1625' }}>
            <div className="flex gap-2 items-stretch">

              {/* Left column */}
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {/* Volumen fuerza */}
                <MiniCard label="Volumen">
                  <div className="flex items-baseline gap-1">
                    <p className="text-app-text font-bold text-sm leading-none">{thisFuerzaSets}</p>
                    <p className="text-[10px] font-semibold" style={{ color: setsDelta >= 0 ? GREEN : RED }}>
                      {setsDelta > 0 ? `↑+${setsDelta}` : setsDelta < 0 ? `↓${setsDelta}` : '→'}
                    </p>
                  </div>
                  <p className="text-[8px] mb-1" style={{ color: '#4a4560' }}>series esta semana</p>
                  <Sparkline values={weeklyVolumes} color="#9B7FD4" width={72} height={20} />
                </MiniCard>

                {/* Fuerza sesiones */}
                <MiniCard label="Fuerza">
                  <p className="text-app-text font-bold text-sm leading-none">
                    {fuerzaSessions} ses.
                  </p>
                  <p className="text-[8px] mt-0.5" style={{ color: '#4a4560' }}>{thisFuerzaSets} series</p>
                </MiniCard>
              </div>

              {/* Center ring */}
              <RingChart days={thisDays} target={diasObjetivo} />

              {/* Right column */}
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {/* Cardio */}
                <MiniCard label="Cardio">
                  <div className="flex items-baseline gap-1">
                    <p className="text-app-text font-bold text-sm leading-none">{cardioSessions}/2</p>
                    <p className="text-[10px] font-semibold" style={{ color: cardioColor }}>
                      {cardioSessions >= 2 ? '✓' : cardioSessions === 0 ? '↓' : '→'}
                    </p>
                  </div>
                  <p className="text-[8px] mt-0.5" style={{ color: '#4a4560' }}>
                    {cardioMinutes > 0 ? `${cardioMinutes} min` : 'objetivo: 2'}
                  </p>
                </MiniCard>

                {/* Fatiga gauge */}
                <MiniCard label="Fatiga">
                  <FatigueGauge value={avgFatigaThis} generoLabel={generoLabel} />
                </MiniCard>
              </div>

            </div>
          </div>
        </div>

        {/* ── Bloque 2: Tus principales progresiones ───────────────────────── */}
        <div>
          <SectionTitle>Tus principales progresiones</SectionTitle>
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden" style={{ backgroundColor: '#1a1625' }}>
            {topEx.length === 0 ? (
              <p className="text-app-muted text-sm text-center py-6 px-4">Sin entrenamientos de fuerza en el último mes</p>
            ) : topEx.map((ex, i) => {
              const color = ex.delta > 0 ? GREEN : ex.delta < 0 ? RED : GRAY
              const isExpanded = expandedEx === i
              return (
                <div key={i} className={i < topEx.length - 1 ? 'border-b border-white/[0.06]' : ''}>
                  <button
                    onClick={() => setExpandedEx(isExpanded ? null : i)}
                    className="w-full px-4 py-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-app-text text-sm font-medium truncate">{ex.name}</p>
                          {ex.isPR
                            ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: GREEN }}>PR 🏆</span>
                            : <span className="text-[10px] font-semibold flex-shrink-0" style={{ color }}>
                                {ex.delta > 0 ? '+' : ''}{ex.delta}kg
                              </span>
                          }
                        </div>
                        <div className="flex items-center justify-between">
                          <Sparkline values={ex.sparkVals} color="#9B7FD4" width={72} height={22} />
                          <div className="text-right">
                            <p className="text-app-text font-bold text-lg leading-none">{ex.last}kg</p>
                            <p className="text-[9px] mt-0.5" style={{ color: '#4a4560' }}>{ex.sessions} ses.</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 mt-1">
                        {isExpanded ? <ChevronUp size={14} color={GRAY} /> : <ChevronDown size={14} color={GRAY} />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-white/[0.06] animate-fadeIn">
                      <p className="text-[9px] uppercase tracking-wider font-medium mb-2 mt-2.5" style={{ color: GRAY }}>
                        Peso por sesión este mes
                      </p>
                      {ex.history.map((s, j) => (
                        <div key={j} className="flex justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                          <p className="text-app-muted text-xs">{s.date}</p>
                          <p className="text-app-text text-xs font-semibold">{s.maxW} kg</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Ver todos */}
            <button
              onClick={() => setShowAllExercises(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-white/[0.06]"
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

        {/* ── Bloque 3: Recomendaciones ─────────────────────────────────────── */}
        <div>
          <SectionTitle>Recomendaciones</SectionTitle>
          <Recomendaciones />
        </div>

        {/* ── Bloque 4: Tu camino hasta acá ────────────────────────────────── */}
        <div>
          <SectionTitle>Tu camino hasta acá</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: totalWorkouts,      label: 'entrenamientos registrados' },
              { value: `${record} sem.`,   label: 'récord de racha semanal' },
              { value: totalPRs,           label: 'PRs históricos totales' },
              { value: uniqueDays,         label: 'días únicos entrenados' },
              { value: mayorSalto,         label: 'mayor salto de peso', small: true },
              { value: masEntrenado,       label: 'ejercicio más trabajado', small: true },
            ].map(({ value, label, small }, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.06] px-3 py-3" style={{ backgroundColor: '#1a1625' }}>
                <p className={`font-bold leading-tight mb-0.5 ${small ? 'text-sm' : 'text-2xl'}`}
                  style={{ color: '#9B7FD4' }}>
                  {value}
                </p>
                <p className="text-[9px] leading-tight" style={{ color: '#6B7280' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bloque 5: Historial ───────────────────────────────────────────── */}
        <div>
          <SectionTitle>Historial</SectionTitle>
          <div className="rounded-2xl border border-white/[0.06] px-4 py-4" style={{ backgroundColor: '#1a1625' }}>
            <WeekFlames workouts={workouts} />

            <button
              onClick={() => setShowHistorial(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-white/[0.06]"
              style={{ color: '#9B7FD4' }}
            >
              <span className="text-xs font-medium">
                {showHistorial ? 'Ocultar historial' : 'Ver historial completo'}
              </span>
              {showHistorial ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showHistorial && (
              <div className="mt-4 animate-fadeIn">
                <WorkoutHistorial workouts={workouts} />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
