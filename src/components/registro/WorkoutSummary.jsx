import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import { FRASES_POST } from '../../data/frases'

const CONFETTI_COLORS = ['#7C5CBF', '#40916C', '#4A9EDB', '#F59E0B', '#E57373', '#9B7FD4']
const ICE_BLUE = '#38bdf8'
const PURPLE   = '#9B7FD4'

function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: `${Math.random() * 0.6}s`,
    duration: `${1.5 + Math.random()}s`,
    size: `${6 + Math.random() * 8}px`,
  }))
  return (
    <>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left, top: '-10px', background: p.color,
            width: p.size, height: p.size,
            animationDuration: p.duration, animationDelay: p.delay,
          }}
        />
      ))}
    </>
  )
}

function getMondayStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function getSundayStr(mondayStr) {
  const d = new Date(mondayStr + 'T12:00:00')
  d.setDate(d.getDate() + 6)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function getDayAchievement(workout, workouts) {
  const workoutMonday = getMondayStr(workout.date)
  const workoutSunday = getSundayStr(workoutMonday)
  const today = new Date()
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
  const currentMonday = getMondayStr(todayStr)
  if (workoutMonday !== currentMonday) {
    return { text: '¡Entrenamiento guardado! 💪', color: 'text-app-purple-light', bg: 'bg-app-purple/10 border-app-purple/20' }
  }
  const thisWeekDates = new Set(
    workouts.filter(w => w.date >= workoutMonday && w.date <= workoutSunday).map(w => w.date)
  )
  thisWeekDates.add(workout.date)
  const count = thisWeekDates.size
  if (count >= 5) return { text: '¡Semana Ideal! ⭐', color: 'text-app-amber', bg: 'bg-app-amber/10 border-app-amber/20' }
  if (count === 4) return { text: '¡Óptimo conseguido! 🌟', color: 'text-app-green-light', bg: 'bg-app-green/10 border-app-green-light/20' }
  if (count === 3) return { text: '¡Ya entrenaste 3 días esta semana! 💪', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' }
  if (count === 2) return { text: `Ya van ${count} días esta semana 💪`, color: 'text-app-purple-light', bg: 'bg-app-purple/10 border-app-purple/20' }
  return { text: 'Empezaste la semana 💪', color: 'text-app-purple-light', bg: 'bg-app-purple/10 border-app-purple/20' }
}

function detectPRs(workout, workouts) {
  if (!workout.exercises?.length) return []
  const prs = []
  for (const ex of workout.exercises) {
    if (!ex.exerciseId || !ex.sets?.length) continue
    const maxThisSession = Math.max(0, ...ex.sets.map(s => Number(s.weight) || 0))
    if (!maxThisSession) continue
    const prevMax = workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === ex.exerciseId))
      .flatMap(w => w.exercises.filter(e => e.exerciseId === ex.exerciseId))
      .flatMap(e => e.sets || [])
      .reduce((max, s) => Math.max(max, Number(s.weight) || 0), 0)
    if (maxThisSession > prevMax && prevMax > 0) {
      prs.push({ name: ex.name, weight: maxThisSession })
    }
  }
  return prs
}

export default function WorkoutSummary({ workout, onDone, workouts = [], newAchievements = [] }) {
  // All hooks must be called unconditionally
  const [visible, setVisible]         = useState(true)
  const [secondsLeft, setSecondsLeft] = useState(5)
  const navigate   = useNavigate()
  const countdownRef  = useRef(null)
  const autoCloseRef  = useRef(null)
  const [postFrase] = useState(() => {
    const today = new Date()
    const key = `post_frase_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    try {
      const saved = localStorage.getItem(key)
      if (saved) return JSON.parse(saved)
    } catch {}
    const frase = FRASES_POST[Math.floor(Math.random() * FRASES_POST.length)]
    try { localStorage.setItem(key, JSON.stringify(frase)) } catch {}
    return frase
  })

  const goHome = () => { setVisible(false); onDone?.(); navigate('/') }

  useEffect(() => {
    if (workout.type === 'pausa') return
    countdownRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(countdownRef.current); return 0 }
        return s - 1
      })
    }, 1000)
    autoCloseRef.current = setTimeout(goHome, 8000)
    return () => {
      clearInterval(countdownRef.current)
      clearTimeout(autoCloseRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Pausa: pantalla simple sin confetti ni cuenta regresiva ─────────────────
  if (workout.type === 'pausa') {
    const isFrozen = workout.pausaMotivo === 'enfermedad' || workout.pausaMotivo === 'lesion'
    const color    = isFrozen ? ICE_BLUE : PURPLE
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-bg/95">
        <div className="text-center px-8 py-10 w-full max-w-sm animate-scaleIn">
          <div className="text-6xl mb-5">{isFrozen ? '🧊' : '⏸'}</div>
          <p className="text-xl font-bold mb-3" style={{ color }}>
            Registrado {isFrozen ? '🧊' : '⏸'}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
            {isFrozen
              ? 'Que te mejores pronto. Tu racha está a salvo.'
              : 'Descanso registrado. Volvés más fuerte.'}
          </p>
          <button
            onClick={goHome}
            className="mt-10 w-full py-3.5 rounded-2xl font-semibold text-white text-base"
            style={{ backgroundColor: color }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  // ─── Regular workout summary ──────────────────────────────────────────────────
  const totalSets      = workout.exercises?.reduce((a, e) => a + (e.sets?.length ?? 0), 0) ?? 0
  const fatigue        = workout.fatigue ?? 5
  const total          = workouts.length + 1
  const milestone      = [10, 20, 30, 50].find(m => total === m)
  const prs            = detectPRs(workout, workouts)
  const dayAchievement = getDayAchievement(workout, workouts)
  const canClose       = secondsLeft === 0

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-bg/95 overflow-y-auto">
      <Confetti />
      <div className="text-center px-6 py-6 w-full max-w-sm animate-scaleIn">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-app-text text-xl font-bold mb-0.5">¡Entrenamiento completado!</h2>
        <p className="text-app-muted text-xs mb-4">Guardado correctamente</p>

        <div className="bg-app-surface rounded-2xl p-4 mb-3 text-left space-y-2">
          {workout.type === 'fuerza' && (
            <>
              <div className="flex justify-between">
                <span className="text-app-muted text-sm">Ejercicios</span>
                <span className="text-app-text font-semibold">{workout.exercises?.length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-muted text-sm">Series totales</span>
                <span className="text-app-text font-semibold">{totalSets}</span>
              </div>
            </>
          )}
          {workout.type === 'cardio' && (
            <div className="flex justify-between">
              <span className="text-app-muted text-sm">Actividad</span>
              <span className="text-app-text font-semibold">{workout.activity}</span>
            </div>
          )}
          {workout.type === 'clase' && (
            <div className="flex justify-between">
              <span className="text-app-muted text-sm">Clase</span>
              <span className="text-app-text font-semibold">{workout.clase}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-app-muted text-sm">Cansancio</span>
            <span className={`font-semibold ${
              fatigue <= 4 ? 'text-app-green-light' : fatigue <= 7 ? 'text-app-amber' : 'text-app-coral'
            }`}>{fatigue}/10</span>
          </div>
        </div>

        <div className={`rounded-xl px-4 py-3 mb-3 border ${dayAchievement.bg}`}>
          <p className={`text-sm font-medium ${dayAchievement.color}`}>{dayAchievement.text}</p>
        </div>

        {prs.length > 0 && (
          <div className="bg-app-gold/10 border border-app-gold/20 rounded-xl px-4 py-3 mb-3">
            {prs.map((pr, i) => (
              <p key={i} className="text-app-gold text-sm font-medium">
                ¡Nuevo récord en {pr.name}! 🏆 {pr.weight} kg
              </p>
            ))}
          </div>
        )}

        {milestone && (
          <div className="bg-app-purple/10 border border-app-purple/20 rounded-xl px-4 py-3 mb-3">
            <p className="text-app-purple-light text-sm font-medium">
              ¡{milestone} entrenamientos completados! 💎
            </p>
          </div>
        )}

        {newAchievements.length > 0 && (
          <div className="bg-app-purple/10 border border-app-purple/20 rounded-xl px-4 py-3 mb-3">
            <p className="text-app-purple-light text-xs font-semibold uppercase tracking-wide mb-2">
              ¡Logros desbloqueados! 🏅
            </p>
            {newAchievements.map(a => (
              <p key={a.key} className="text-app-text text-sm font-medium">{a.label}</p>
            ))}
          </div>
        )}

        <div
          className="rounded-xl px-4 pt-3 pb-4 mb-3 border border-app-purple/15 text-left animate-fadeIn"
          style={{ backgroundColor: '#13131F' }}
        >
          <p className="text-white leading-relaxed" style={{ fontSize: '13px' }}>{postFrase.frase}</p>
          {postFrase.autor && (
            <p className="text-[10px] mt-1.5" style={{ color: '#9B7FD4' }}>— {postFrase.autor}</p>
          )}
        </div>

        <Button variant="secondary" size="lg" onClick={goHome} disabled={!canClose}
          className={!canClose ? 'opacity-50' : ''}
        >
          {!canClose ? `Ver inicio (${secondsLeft}s)` : 'Ver inicio'}
        </Button>
      </div>
    </div>
  )
}
