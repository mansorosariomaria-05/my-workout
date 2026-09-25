import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isToday, isYesterday, differenceInDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Lightbulb, ChevronRight, CloudUpload } from 'lucide-react'
import { useAuthContext } from '../context/AuthContext'
import { useWorkouts } from '../hooks/useWorkouts'
import { getWorkouts } from '../services/db'
import { dateToLocal, getTodayLocal, getWeekStartLocal } from '../utils/dates'
import { REAL_WORKOUT_TYPES } from '../utils/streak'
import { FRASES_PRE, FRASES_POST } from '../data/frases'
import { builtinRoutines } from '../data/routines'
import HeroPortada from '../components/inicio/HeroPortada'
import Logros from '../components/inicio/Logros'
import WeekCalendar from '../components/inicio/WeekCalendar'
import Modal from '../components/ui/Modal'

const WEEKLY_SUMMARY_KEY = 'weekly_summary_'
const TYPE_LABELS = { fuerza: 'Fuerza', cardio: 'Cardio', clase: 'Clase', tabata: 'Tabata' }

// ─── Date helpers ─────────────────────────────────────────────────────────────
function fechaRelativa(dateStr) {
  if (!dateStr) return ''
  const d = parseISO(dateStr + 'T12:00:00')
  if (isToday(d)) return 'hoy'
  if (isYesterday(d)) return 'ayer'
  const dias = differenceInDays(new Date(), d)
  if (dias < 7) return `hace ${dias} días`
  return format(d, "eee d 'de' MMM", { locale: es })
}

// ─── Week stats ───────────────────────────────────────────────────────────────
function getThisWeekCount(workouts) {
  const mondayStr = getWeekStartLocal()
  const dates = new Set(
    workouts.filter(w => w.date >= mondayStr && REAL_WORKOUT_TYPES.includes(w.type)).map(w => w.date)
  )
  return dates.size
}

// ─── Weekly summary modal ─────────────────────────────────────────────────────
function getLastWeekBounds() {
  const now = new Date()
  const day  = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const currMonday = new Date(now)
  currMonday.setDate(now.getDate() + diff)
  currMonday.setHours(0, 0, 0, 0)
  const lastMonday = new Date(currMonday)
  lastMonday.setDate(currMonday.getDate() - 7)
  const sundayD = new Date(currMonday)
  sundayD.setDate(currMonday.getDate() - 1)
  return { start: dateToLocal(lastMonday), end: dateToLocal(sundayD) }
}

function computeWeeklyStats(workouts) {
  const { start, end } = getLastWeekBounds()
  const lastWeek = workouts.filter(w => w.date >= start && w.date <= end && REAL_WORKOUT_TYPES.includes(w.type))
  if (!lastWeek.length) return null

  const daysTrained = new Set(lastWeek.map(w => w.date)).size
  const fuerza = lastWeek.filter(w => w.type === 'fuerza').length
  const cardio = lastWeek.filter(w => w.type === 'cardio').length
  const clase  = lastWeek.filter(w => w.type === 'clase').length
  const muscles = new Set()
  lastWeek.filter(w => w.type === 'fuerza').forEach(w => {
    ;(w.muscleGroups ?? []).forEach(m => muscles.add(m))
    ;(w.exercises ?? []).forEach(e => e.muscle && muscles.add(e.muscle))
  })
  const priorBest = {}
  workouts.filter(w => w.date < start && w.type === 'fuerza').forEach(w => {
    ;(w.exercises ?? []).forEach(e => {
      if (!e.exerciseId || !e.sets?.length) return
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (maxW > (priorBest[e.exerciseId] ?? 0)) priorBest[e.exerciseId] = maxW
    })
  })
  const prsMap = {}
  lastWeek.filter(w => w.type === 'fuerza').forEach(w => {
    ;(w.exercises ?? []).forEach(e => {
      if (!e.exerciseId || !e.sets?.length) return
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (maxW > (priorBest[e.exerciseId] ?? 0) && (!prsMap[e.name] || maxW > prsMap[e.name].to))
        prsMap[e.name] = { from: priorBest[e.exerciseId] ?? 0, to: maxW }
    })
  })
  const fatigues = lastWeek.filter(w => w.fatigue != null).map(w => w.fatigue)
  const avgFatigue = fatigues.length ? fatigues.reduce((a, b) => a + b, 0) / fatigues.length : null
  return { daysTrained, fuerza, cardio, clase, muscles: [...muscles].slice(0, 5), prs: Object.entries(prsMap), avgFatigue }
}

function WeeklySummaryModal({ stats, onClose, onViewProgress }) {
  const { daysTrained, fuerza, cardio, clase, muscles, prs, avgFatigue } = stats
  const quality = daysTrained >= 5 ? { label: 'Ideal ⭐', color: '#D49A3A' }
    : daysTrained >= 4 ? { label: 'Óptimo ✓', color: '#40916C' }
    : daysTrained >= 3 ? { label: 'Aceptable ✓', color: '#4A9EDB' }
    : { label: 'Seguí sumando', color: '#9090A8' }
  const typeStr = [fuerza ? `${fuerza} Fuerza` : '', cardio ? `${cardio} Cardio` : '', clase ? `${clase} Clase` : ''].filter(Boolean).join(' · ')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-app-bg rounded-xl px-4 py-3">
        <div>
          <p className="text-app-text font-bold text-2xl leading-none">{daysTrained}</p>
          <p className="text-app-muted text-xs mt-0.5">días entrenados</p>
        </div>
        <span className="text-sm font-medium" style={{ color: quality.color }}>{quality.label}</span>
      </div>
      {typeStr && <div className="bg-app-bg rounded-xl px-4 py-2.5"><p className="text-app-muted text-[10px] mb-1">Sesiones</p><p className="text-app-text text-sm">{typeStr}</p></div>}
      {muscles.length > 0 && (
        <div className="bg-app-bg rounded-xl px-4 py-2.5">
          <p className="text-app-muted text-[10px] mb-1.5">Músculos trabajados</p>
          <div className="flex flex-wrap gap-1.5">
            {muscles.map(m => <span key={m} className="text-[10px] bg-app-purple/20 text-app-purple-light px-2 py-0.5 rounded-full">{m}</span>)}
          </div>
        </div>
      )}
      {prs.length > 0 && (
        <div className="bg-app-gold/10 border border-app-gold/20 rounded-xl px-4 py-2.5">
          <p className="text-app-gold text-xs font-medium mb-1.5">Superaste {prs.length} récord{prs.length > 1 ? 's' : ''} 🏆</p>
          {prs.map(([name, { from, to }]) => <p key={name} className="text-app-muted text-xs">{name}: {from}kg → {to}kg</p>)}
        </div>
      )}
      {avgFatigue != null && (
        <div className="bg-app-bg rounded-xl px-4 py-2.5 flex items-center justify-between">
          <p className="text-app-muted text-xs">Cansancio promedio</p>
          <span className={`text-sm font-semibold ${avgFatigue <= 4 ? 'text-app-green-light' : avgFatigue <= 7 ? 'text-app-amber' : 'text-app-coral'}`}>{avgFatigue.toFixed(1)}/10</span>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onViewProgress} className="flex-1 py-2.5 rounded-xl bg-app-purple text-white text-sm font-medium">Ver en Progreso</button>
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-app-elevated text-app-muted text-sm border border-white/8">Cerrar</button>
      </div>
    </div>
  )
}

// ─── Frase del día / post-entreno ────────────────────────────────────────────
function FraseDiariaCard({ workouts }) {
  const today = getTodayLocal()
  const trainedToday = workouts.some(w => w.date === today && REAL_WORKOUT_TYPES.includes(w.type))

  let fraseObj
  if (trainedToday) {
    const cacheKey = `post_frase_${today}`
    try {
      const cached = localStorage.getItem(cacheKey)
      fraseObj = cached ? JSON.parse(cached) : null
    } catch { fraseObj = null }
    if (!fraseObj) {
      fraseObj = FRASES_POST[Math.floor(Math.random() * FRASES_POST.length)]
      try { localStorage.setItem(cacheKey, JSON.stringify(fraseObj)) } catch {}
    }
  } else {
    const dayOfYear = Math.round((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
    fraseObj = FRASES_PRE[dayOfYear % FRASES_PRE.length]
  }

  const { frase, autor } = fraseObj
  return (
    <div className="mx-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#94A3B8' }}>
        {trainedToday ? 'Así fue hoy' : 'Frase del día'}
      </p>
      <div style={{ backgroundColor: '#1a1625', borderRadius: '16px', padding: '10px 14px 10px 18px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', borderRadius: '16px 0 0 16px', background: 'linear-gradient(to bottom, #7C5CBF 0%, transparent 65%)' }} />
        <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#e8e4f5', lineHeight: 1.4, marginBottom: 0 }}>{frase}</p>
        {autor && <p style={{ fontSize: '10px', color: '#94A3B8', fontStyle: 'normal', marginTop: '4px' }}>— {autor}</p>}
      </div>
    </div>
  )
}

// ─── Último entrenamiento ─────────────────────────────────────────────────────
function formatLastWorkout(w) {
  if (!w) return null
  if (w.type === 'fuerza') {
    const muscles = [...new Set([...(w.muscleGroups ?? []), ...(w.exercises?.map(e => e.muscle).filter(Boolean) ?? [])])].slice(0, 2)
    return 'Fuerza' + (muscles.length ? ' · ' + muscles.join(' + ') : '')
  }
  if (w.type === 'cardio') {
    const parts = [w.activity].filter(Boolean)
    if (w.distancia) parts.push(w.distancia + 'km')
    return 'Cardio · ' + parts.join(' · ')
  }
  if (w.type === 'clase') {
    const parts = [w.clase].filter(Boolean)
    if (w.duracion) parts.push(w.duracion + 'min')
    return 'Clase · ' + parts.join(' · ')
  }
  if (w.type === 'tabata') return 'Tabata · ' + (w.tabataName ?? '')
  return null
}

function LastAndSuggestion({ workouts }) {
  const today = getTodayLocal()
  const [showNote, setShowNote] = useState(false)

  const real = workouts.filter(w => REAL_WORKOUT_TYPES.includes(w.type) && w.date)
  if (!real.length) return null

  // workouts from db are ordered by date desc — first date is the most recent
  const mostRecentDate = real[0].date
  const recentWorkouts = real.filter(w => w.date === mostRecentDate)
  const isTodayDate = mostRecentDate === today
  const multi = recentWorkouts.length > 1

  const title = isTodayDate
    ? (multi ? 'Entrenamientos de hoy' : 'Último entrenamiento')
    : (multi ? 'Últimos entrenamientos' : 'Último entrenamiento')

  const fuerzaW  = recentWorkouts.find(w => w.type === 'fuerza')
  const otherW   = recentWorkouts.find(w => w.type === 'cardio' || w.type === 'clase')

  return (
    <div className="mx-4 rounded-xl border border-white/[0.06] overflow-hidden" style={{ backgroundColor: '#1a1625' }}>
      <div className="px-3 py-2.5">
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            {title}
          </p>
          {!isTodayDate && (
            <>
              <span className="text-[9px]" style={{ color: '#4B5563' }}>—</span>
              <span className="text-[9px] font-normal normal-case tracking-normal" style={{ color: '#6B7280' }}>
                {fechaRelativa(mostRecentDate)}
              </span>
            </>
          )}
        </div>

        {multi && fuerzaW && otherW ? (
          <div className="grid grid-cols-2 gap-2">
            {[fuerzaW, otherW].map((w, i) => {
              const str = formatLastWorkout(w)
              return (
                <div key={i} className="bg-black/20 rounded-lg px-2.5 py-2">
                  <div className="flex items-center gap-1">
                    {str && <p className="text-app-text text-xs font-medium leading-snug flex-1">{str}</p>}
                    {w._pendingSync && <CloudUpload size={12} color="#94A3B8" title="Pendiente de sincronizar" />}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          recentWorkouts.map((w, i) => {
            const str = formatLastWorkout(w)
            return (
              <div key={i} className={i > 0 ? 'mt-1.5 pt-1.5 border-t border-white/5' : ''}>
                <div className="flex items-center gap-1">
                  {str && <p className="text-app-text text-xs font-medium flex-1">{str}</p>}
                  {w._pendingSync && <CloudUpload size={12} color="#94A3B8" title="Pendiente de sincronizar" />}
                </div>
              </div>
            )
          })
        )}

        <div className="flex items-center justify-end mt-1">
          {!multi && recentWorkouts[0]?.notes && (
            <button
              onClick={() => setShowNote(n => !n)}
              className="flex items-center gap-0.5"
              style={{ color: '#6B7280', fontSize: '10px', fontStyle: 'italic' }}
            >
              {showNote ? 'ocultar ↑' : 'ver nota ↓'}
            </button>
          )}
        </div>
        {showNote && !multi && recentWorkouts[0]?.notes && (
          <p className="text-[10px] mt-1 leading-snug" style={{ color: '#94A3B8' }}>{recentWorkouts[0].notes}</p>
        )}
      </div>
    </div>
  )
}

// ─── Sugerencia del día ───────────────────────────────────────────────────────
function getMusclesFromWorkout(w) {
  return [...(w.muscleGroups ?? []), ...(w.exercises?.map(e => e.muscle).filter(Boolean) ?? [])]
}

async function getDailySuggestion(userId) {
  const workouts = await getWorkouts(userId, 500)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const today = getTodayLocal()
  const mondayStr = getWeekStartLocal()

  // Domingo = descanso
  if (dayOfWeek === 0) {
    return { type: 'descanso', title: 'Descanso 💤', sub: 'Hoy es día de descanso. Recuperate para la semana que viene.' }
  }

  const real = (workouts ?? []).filter(w => REAL_WORKOUT_TYPES.includes(w.type) && w.date)

  // Ya entrenó hoy
  if (real.some(w => w.date === today)) return { type: 'trained_today' }

  // Sin historial → primera rutina
  if (!real.length) {
    const first = builtinRoutines[0]
    return { type: 'fuerza', emoji: '💪', title: first.name, routineId: first.id, sub: 'Es tu primer entrenamiento — empezá por acá.' }
  }

  // ── PASO 1: balance cardio / fuerza de la semana ───────────────────────────
  const thisWeek = real.filter(w => w.date >= mondayStr && w.date < today)
  const cardioCount = thisWeek.filter(w => w.type === 'cardio' || w.type === 'clase').length
  const fuerzaCount = thisWeek.filter(w => w.type === 'fuerza').length
  // Días hábiles restantes incluyendo hoy (lun=6, mar=5, ... sáb=1)
  const remainingWorkingDays = 7 - dayOfWeek

  let suggestCardio = false
  let cardioReason = ''
  if (cardioCount === 0 && fuerzaCount >= 2) {
    suggestCardio = true
    cardioReason = 'Todavía no hiciste cardio esta semana.'
  } else if (cardioCount === 1 && remainingWorkingDays <= 2) {
    suggestCardio = true
    cardioReason = 'Solo hiciste 1 sesión de resistencia y quedan pocos días para completar la semana.'
  }

  if (suggestCardio) {
    return { type: 'cardio', emoji: '🏃', title: 'Cardio o Clase', sub: cardioReason }
  }

  // ── PASO 2: elegir rutina de fuerza ───────────────────────────────────────
  const d1 = new Date(); d1.setDate(d1.getDate() - 1)
  const d2 = new Date(); d2.setDate(d2.getDate() - 2)
  const yesterday  = dateToLocal(d1)
  const twoDaysAgo = dateToLocal(d2)

  const recentMuscles = new Set()
  real
    .filter(w => w.date === yesterday || w.date === twoDaysAgo)
    .forEach(w => getMusclesFromWorkout(w).forEach(m => recentMuscles.add(m)))

  const fuerzaWorkouts = real.filter(w => w.type === 'fuerza')

  const lastTrainedDate = (muscleSet) => {
    let latest = null
    fuerzaWorkouts.forEach(w => {
      if (getMusclesFromWorkout(w).some(m => muscleSet.has(m))) {
        if (!latest || w.date > latest) latest = w.date
      }
    })
    return latest
  }

  // Excluir rutinas con músculos trabajados en las últimas 48h
  const available = builtinRoutines.filter(r =>
    !(r.muscles ?? []).some(m => recentMuscles.has(m))
  )
  const pool = available.length > 0 ? available : builtinRoutines

  // Puntuar por días sin trabajar (mayor = más descansada)
  const scored = pool.map(r => {
    const lastDate = lastTrainedDate(new Set(r.muscles ?? []))
    const days = lastDate
      ? Math.round((new Date(today + 'T12:00:00') - new Date(lastDate + 'T12:00:00')) / 86400000)
      : 999
    return { routine: r, days }
  })
  scored.sort((a, b) => b.days - a.days)

  const { routine, days } = scored[0]
  const muscles = routine.muscles ?? []
  const muscleList = muscles.slice(0, 2).join(' + ')
  const sub = days >= 999
    ? 'Es tu primera vez con esta rutina — ¡dale para adelante!'
    : `${muscleList} lleva${muscles.length > 1 ? 'n' : ''} ${days} día${days === 1 ? '' : 's'} sin trabajar.`

  return { type: 'fuerza', emoji: '💪', title: routine.name, routineId: routine.id, sub }
}

function DailySuggestionCard({ suggestion }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  if (!suggestion) return null

  if (suggestion.type === 'trained_today') {
    return (
      <p className="mx-4 text-center text-app-text text-sm font-semibold py-2">
        ¡Ya entrenaste! 💪 Descansá el resto del día 🤍
      </p>
    )
  }

  if (suggestion.type === 'descanso') {
    return (
      <div className="mx-4 rounded-xl border border-white/[0.06] px-3 py-2.5" style={{ backgroundColor: '#1a1625' }}>
        <p className="text-app-text text-xs font-semibold">{suggestion.title}</p>
        <p className="text-[10px] mt-1 leading-snug" style={{ color: '#94A3B8' }}>{suggestion.sub}</p>
      </div>
    )
  }

  const label = `Hoy te sugerimos: ${suggestion.title} ${suggestion.emoji ?? ''}`.trim()

  const handleStart = () => {
    if (suggestion.type === 'fuerza') {
      navigate('/registro', { state: { type: 'fuerza', routineId: suggestion.routineId ?? null } })
    } else if (suggestion.type === 'cardio') {
      navigate('/registro', { state: { type: 'cardio' } })
    } else if (suggestion.type === 'clase') {
      navigate('/registro', { state: { type: 'clase' } })
    }
  }

  return (
    <div className="mx-4">
      <div
        className="rounded-xl border border-white/[0.06] px-3 py-2.5"
        style={{ backgroundColor: '#1a1625' }}
      >
        <div className="flex items-center gap-2 w-full">
          <div className="flex-shrink-0"><Lightbulb size={14} color="#9b7fd4" /></div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex-1 min-w-0 text-left"
          >
            <p className="text-app-text text-xs font-medium truncate">{label}</p>
          </button>
          <button
            onClick={handleStart}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-app-purple text-white text-xs font-semibold active:opacity-70 transition-opacity"
          >
            Empezar
          </button>
        </div>
        {expanded && suggestion.sub && (
          <p className="text-[10px] mt-1.5 leading-snug" style={{ color: '#94A3B8' }}>{suggestion.sub}</p>
        )}
      </div>
    </div>
  )
}

// ─── Last workout modal ───────────────────────────────────────────────────────
function LastWorkoutModal({ workout }) {
  if (!workout) return null
  const fatigue = workout.fatigue ?? null
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-app-muted text-xs">{workout.date}</span>
        <span className="text-app-purple-light text-xs font-medium">{TYPE_LABELS[workout.type] ?? workout.type}</span>
      </div>
      {workout.type === 'fuerza' && workout.exercises?.length > 0 && (
        <div className="space-y-2">
          {workout.exercises.map((ex, i) => (
            <div key={i} className="border-b border-white/5 pb-2 last:border-0">
              <p className="text-app-text text-sm font-medium">{ex.name}</p>
              {ex.sets?.length > 0 && <p className="text-app-muted text-xs mt-0.5">{ex.sets.map(s => `${s.reps ?? 0}×${s.weight ?? 0}kg`).join(', ')}</p>}
            </div>
          ))}
        </div>
      )}
      {workout.type === 'cardio' && <div><p className="text-app-text text-sm">{workout.activity}</p>{workout.tiempo && <p className="text-app-muted text-xs">{workout.tiempo} min{workout.distancia ? ` · ${workout.distancia} km` : ''}</p>}</div>}
      {workout.type === 'clase' && <div><p className="text-app-text text-sm">{workout.clase}</p>{workout.duracion && <p className="text-app-muted text-xs">{workout.duracion} min</p>}</div>}
      {fatigue != null && (
        <div className="flex items-center justify-between py-1.5 border-t border-white/5">
          <span className="text-app-muted text-xs">Cansancio</span>
          <span className={`text-sm font-semibold ${fatigue <= 4 ? 'text-app-green-light' : fatigue <= 7 ? 'text-app-amber' : 'text-app-coral'}`}>{fatigue}/10</span>
        </div>
      )}
      {workout.notes && <div className="bg-app-bg rounded-xl px-3 py-2.5"><p className="text-app-muted text-[10px] mb-1">Nota</p><p className="text-app-text text-xs">{workout.notes}</p></div>}
    </div>
  )
}

// ─── Stats cards ─────────────────────────────────────────────────────────────
function StatsCards({ diasSemana, semanasRacha, rachaRecord }) {
  const clampedDays = Math.min(diasSemana, 4)
  const maxDays = 4
  const radius = 30
  const circ = 2 * Math.PI * radius
  const progress = clampedDays / maxDays
  const dash = circ - progress * circ

  const ringColor = diasSemana === 0 ? 'rgba(255,255,255,0.1)'
    : diasSemana === 1 ? '#E05252'
    : diasSemana === 2 ? '#D49A3A'
    : diasSemana === 3 ? '#4A9EDB'
    : diasSemana === 4 ? '#40916C'
    : '#F5C842'

  const dayMessage = diasSemana >= 5 ? '¡Esta semana fue ideal! ⭐'
    : diasSemana === 4 ? '¡Semana óptima! ✅'
    : null

  const rachaSub = semanasRacha === 0 && rachaRecord === 0
    ? 'Empezá tu racha'
    : `Récord: ${rachaRecord} sem.`

  return (
    <div className="flex gap-3 mx-4">

      {/* Card izquierda — días */}
      <div className="flex-1 py-3 px-3 rounded-2xl border border-white/[0.06] flex flex-col items-center justify-center" style={{ backgroundColor: '#1a1625' }}>
        <div className="relative w-20 h-20 mb-1">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            <circle
              cx="36" cy="36" r={radius} fill="none"
              stroke={ringColor} strokeWidth="5"
              strokeDasharray={circ}
              strokeDashoffset={diasSemana === 0 ? circ : dash}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold leading-none" style={{ color: ringColor }}>{diasSemana}</span>
            <span className="text-[9px] text-app-muted mt-0.5">días</span>
          </div>
        </div>
        {dayMessage && (
          <p className="text-[10px] font-medium text-center leading-tight" style={{ color: ringColor }}>{dayMessage}</p>
        )}
      </div>

      {/* Card derecha — racha */}
      <div className="flex-1 py-3 px-3 rounded-2xl border border-white/[0.06] flex flex-col items-center justify-center" style={{ backgroundColor: '#1a1625' }}>
        <span className="text-2xl font-bold leading-none text-center" style={{ color: '#9B7FD4' }}>
          🔥 {semanasRacha} {semanasRacha === 1 ? 'semana' : 'semanas'}
        </span>
        <p className="text-[10px] text-app-muted text-center mt-1 px-1 leading-tight">{rachaSub}</p>
      </div>

    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Inicio() {
  const { user, settings } = useAuthContext()
  const navigate = useNavigate()
  const { workouts, loading, reload, getCurrentStreak } = useWorkouts(user?.uid)
  const [showWeeklySummary, setShowWeeklySummary] = useState(false)
  const [weeklySummaryStats, setWeeklySummaryStats] = useState(null)
  const [suggestion, setSuggestion] = useState(null)
  const [showSatBanner, setShowSatBanner] = useState(false)

  const diasSemana = getThisWeekCount(workouts)
  const { current: semanasRacha, record: rachaRecord } = getCurrentStreak()

  useEffect(() => {
    if (loading || !workouts.length) return
    if (new Date().getDay() !== 1) return
    const key = WEEKLY_SUMMARY_KEY + getWeekStartLocal()
    if (localStorage.getItem(key)) return
    const stats = computeWeeklyStats(workouts)
    if (!stats) return
    setWeeklySummaryStats(stats)
    setShowWeeklySummary(true)
    localStorage.setItem(key, '1')
  }, [workouts, loading])

  useEffect(() => {
    let lastDate = getTodayLocal()
    const timer = setInterval(() => {
      const now = getTodayLocal()
      if (now !== lastDate) { lastDate = now; reload() }
    }, 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [reload])

  useEffect(() => {
    if (!user?.uid) return
    getDailySuggestion(user.uid).then(setSuggestion).catch(err => console.error('Error sugerencia:', err))
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading) return
    if (new Date().getDay() !== 1) return
    const key = `saturday_banner_${getWeekStartLocal()}`
    if (localStorage.getItem(key)) return
    const lastSat = new Date()
    lastSat.setDate(lastSat.getDate() - 2)
    const satStr = dateToLocal(lastSat)
    const REAL = ['fuerza', 'cardio', 'clase', 'tabata']
    if (workouts.some(w => w.date === satStr && REAL.includes(w.type))) {
      setShowSatBanner(true)
      localStorage.setItem(key, '1')
    }
  }, [workouts, loading])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-app-muted text-sm animate-pulse-slow">Cargando...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-app-bg animate-fadeIn flex flex-col">
      <HeroPortada />

      {settings?.deloadActive && (
        <div className="mx-4 mt-2 bg-app-gold/10 border border-app-gold/30 rounded-xl px-3 py-1.5 flex items-center gap-2">
          <span className="text-app-gold text-xs font-medium">🔄 Semana de descarga activa</span>
        </div>
      )}

      <div className="flex-1 flex flex-col mt-2 pb-2 overflow-x-hidden">
        <div className="mb-2"><StatsCards diasSemana={diasSemana} semanasRacha={semanasRacha} rachaRecord={rachaRecord} /></div>
        {showSatBanner && (
          <div className="mb-2 mx-4">
            <div className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ backgroundColor: 'rgba(124,92,191,0.12)', border: '1px solid rgba(124,92,191,0.25)' }}>
              <span className="text-lg shrink-0">💪</span>
              <p className="text-sm leading-snug" style={{ color: '#9B7FD4' }}>
                Entrenaste el sábado. Hoy podés elegir descansar o hacer algo suave.
              </p>
            </div>
          </div>
        )}
        <div className="mb-2"><FraseDiariaCard workouts={workouts} /></div>
        <div className="mb-3"><WeekCalendar workouts={workouts} /></div>
        <div className="mb-2"><LastAndSuggestion workouts={workouts} /></div>
        <div className="mb-2"><DailySuggestionCard suggestion={suggestion} /></div>
        <div className="mb-2"><Logros workouts={workouts} compact /></div>
      </div>

      <Modal isOpen={showWeeklySummary} onClose={() => setShowWeeklySummary(false)} title="Resumen de la semana 📊">
        {weeklySummaryStats && (
          <WeeklySummaryModal
            stats={weeklySummaryStats}
            onClose={() => setShowWeeklySummary(false)}
            onViewProgress={() => { setShowWeeklySummary(false); navigate('/progreso') }}
          />
        )}
      </Modal>
    </div>
  )
}
