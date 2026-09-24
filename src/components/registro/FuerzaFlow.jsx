import { useState, useEffect, useRef } from 'react'
import { exercises, MUSCLE_GROUPS } from '../../data/exercises'
import { builtinRoutines } from '../../data/routines'
import { getRestTimer, getProgressionAdvice, estimateRepsAtWeight } from '../../utils/progression'
import { useAuthContext } from '../../context/AuthContext'
import { getCustomExercises, saveCustomExercise, deleteCustomExercise, getCustomRoutines } from '../../services/db'
import { Plus } from 'lucide-react'
import Modal from '../ui/Modal'

const TIME_EXERCISES = ['Plancha', 'Sentadilla isométrica', 'Bird Dog', 'Hollow Body Hold', 'Dead Bug', 'Press Pallof']
const REST_OPTIONS   = [30, 45, 60, 75, 90, 120, 150, 180]
const LEVEL_ORDER    = ['A', 'B', 'C', 'D']
const exDisplayName  = (e) => e.zone ? `${e.name} (${e.zone})` : e.name
const TREN_INFERIOR  = ['Glúteos', 'Isquios', 'Cuádriceps', 'Abductores', 'Gemelos']
const TREN_SUPERIOR  = ['Espalda', 'Pecho', 'Hombros', 'Bíceps', 'Tríceps']
const CORE           = ['Abdominales', 'Core & Estabilidad']

function intercalateExercises(exList) {
  const byLevel = arr => [...arr].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
  const inferior = byLevel(exList.filter(e => TREN_INFERIOR.includes(e.muscle)))
  const superior = byLevel(exList.filter(e => TREN_SUPERIOR.includes(e.muscle)))
  const core     = byLevel(exList.filter(e => CORE.includes(e.muscle)))
  const other    = byLevel(exList.filter(e =>
    !TREN_INFERIOR.includes(e.muscle) && !TREN_SUPERIOR.includes(e.muscle) && !CORE.includes(e.muscle)
  ))
  let main = []
  if (inferior.length > 0 && superior.length > 0) {
    const maxLen = Math.max(inferior.length, superior.length)
    for (let i = 0; i < maxLen; i++) {
      if (i < inferior.length) main.push(inferior[i])
      if (i < superior.length) main.push(superior[i])
    }
  } else {
    main = byLevel([...inferior, ...superior, ...other])
  }
  return [...main, ...core]
}

function playBeep(freq = 880, dur = 0.12) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.4, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start(); osc.stop(ctx.currentTime + dur)
  } catch (_) {}
}
function doVibrate(ms = 200) { try { navigator.vibrate?.(ms) } catch (_) {} }

function InlineTimer({ workSecs, restSecs, onDone, onCancel }) {
  const [phase, setPhase] = useState('work')
  const [count, setCount] = useState(workSecs)
  const ref   = useRef({ phase: 'work', count: workSecs })
  const ivRef = useRef(null)

  useEffect(() => {
    ref.current = { phase: 'work', count: workSecs }
    ivRef.current = setInterval(() => {
      ref.current.count -= 1
      if (ref.current.count <= 0) {
        playBeep(); doVibrate()
        if (ref.current.phase === 'work') {
          ref.current = { phase: 'rest', count: restSecs }
          setPhase('rest'); setCount(restSecs)
        } else {
          clearInterval(ivRef.current)
          ref.current.phase = 'done'
          setPhase('done'); onDone?.()
        }
      } else {
        setCount(ref.current.count)
      }
    }, 1000)
    return () => clearInterval(ivRef.current)
  }, [])

  if (ref.current.phase === 'done') return null
  const isWork = phase === 'work'
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-xl my-1 border ${
      isWork ? 'bg-green-600/20 border-green-600/30' : 'bg-red-600/20 border-red-600/30'
    }`}>
      <span className={`text-xs font-medium ${isWork ? 'text-green-400' : 'text-red-400'}`}>
        {isWork ? 'Trabajo' : 'Descanso'}
      </span>
      <span className={`text-2xl font-bold ${isWork ? 'text-green-400' : 'text-red-400'}`}>{count}s</span>
      <button onClick={onCancel} className="text-app-muted/60 text-xs bg-white/5 px-2 py-1 rounded-lg">✕</button>
    </div>
  )
}

function InlineRestTimer({ totalSec, onDone, onSkip }) {
  const [sec, setSec] = useState(totalSec)
  const ivRef = useRef(null)

  useEffect(() => {
    ivRef.current = setInterval(() => {
      setSec(s => {
        if (s <= 1) { clearInterval(ivRef.current); playBeep(); doVibrate(300); onDone?.(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(ivRef.current)
  }, [])

  const pct    = ((totalSec - sec) / totalSec) * 100
  const radius = 26
  const circ   = 2 * Math.PI * radius
  const dash   = circ - (pct / 100) * circ
  const color  = sec <= 10 ? '#E05252' : '#40916C'
  const min    = Math.floor(sec / 60)
  const s      = String(sec % 60).padStart(2, '0')

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-app-bg rounded-xl my-2 border border-white/8">
      <div className="relative w-12 h-12 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={radius} fill="none" stroke="#1A1A26" strokeWidth="5" />
          <circle cx="30" cy="30" r={radius} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold" style={{ color }}>{min}:{s}</span>
        </div>
      </div>
      <span className="flex-1 text-app-muted text-xs">Descansando...</span>
      <button onClick={onSkip} className="py-1.5 px-3 rounded-xl bg-app-elevated text-app-muted text-xs border border-white/8">
        Saltar
      </button>
    </div>
  )
}

function ExerciseHistoryModal({ sessions }) {
  if (!sessions?.length) {
    return <p className="text-app-muted/50 text-sm text-center py-4">Sin historial aún</p>
  }
  const globalMax = Math.max(
    0, ...sessions.flatMap(s => s.sets?.map(st => Number(st.weight) || 0) ?? [])
  )
  return (
    <div className="space-y-3">
      {sessions.slice(0, 5).map((s, i) => (
        <div key={i} className="bg-app-bg rounded-xl px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-app-muted text-xs">{s.date}</span>
            {i === 0 && <span className="text-app-gold text-[10px] font-medium">Más reciente</span>}
          </div>
          <div className="space-y-0.5">
            {s.sets?.map((set, j) => {
              const w = Number(set.weight) || 0
              return (
                <div key={j} className="flex items-center gap-2">
                  <span className="text-app-muted/50 text-[10px] w-5">S{j + 1}</span>
                  <span className="text-app-text text-xs">{set.reps ?? 0} × {set.weight ?? 0}kg</span>
                  {w > 0 && w === globalMax && <span className="text-[9px] bg-app-gold/20 text-app-gold px-1.5 py-0.5 rounded-full">PR</span>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

// Decide qué campos precargar como sugerencia a partir del advice de progresión y las series de la última sesión.
// pyramid: solo la última serie recibe la sugerencia. fixed: todas las series la reciben.
function computeSuggestionPlan(advice, lastSets) {
  if (!advice?.hasHistory || !lastSets?.length) return null
  const pyramid = advice.pattern === 'pyramid'

  if (advice.suggest && advice.suggestType === 'weight') {
    // Series donde se aplica newWeight: pyramid → solo la última, fixed → todas.
    // Sus reps bajan a un valor realista (Epley), acotado entre repsMin del nivel y las reps que hizo esa serie la última vez.
    const idxList = pyramid ? [lastSets.length - 1] : lastSets.map((_, i) => i)
    const reps = {}
    idxList.forEach(i => {
      const prevWeight = Number(lastSets[i]?.weight) || 0
      const prevReps   = Number(lastSets[i]?.reps) || 0
      reps[i] = clamp(estimateRepsAtWeight(prevWeight, prevReps, advice.newWeight), advice.repsMin, prevReps)
    })
    return { type: 'weight', pyramid, value: advice.newWeight, reps }
  }
  if (advice.suggest && advice.suggestType === 'reps') {
    return { type: 'reps-target', pyramid, value: advice.suggestedReps }
  }
  if (!advice.suggest && advice.repsThreshold != null) {
    const threshold = advice.repsThreshold
    const under = (s) => (Number(s.reps) || 0) < threshold
    const applies = pyramid ? under(lastSets[lastSets.length - 1]) : lastSets.some(under)
    if (applies) return { type: 'reps-bump', pyramid, threshold }
  }
  return null
}

// Muta setsArr in-place aplicando el plan, marcando cada campo tocado con _suggested (solo UI, se limpia antes de guardar).
function applySuggestionPlan(setsArr, plan) {
  if (!plan) return
  const lastIdx = setsArr.length - 1
  const mark = (idx, fields) => {
    setsArr[idx] = { ...setsArr[idx], ...fields, _suggested: Object.fromEntries(Object.keys(fields).map(f => [f, true])) }
  }
  if (plan.type === 'weight') {
    // Las series donde no cambia el peso no se tocan.
    const applyIdx = (idx) => mark(idx, { weight: plan.value, reps: plan.reps[idx] })
    if (plan.pyramid) applyIdx(lastIdx)
    else setsArr.forEach((_, i) => applyIdx(i))
  } else if (plan.type === 'reps-target') {
    if (plan.pyramid) mark(lastIdx, { reps: plan.value })
    else setsArr.forEach((_, i) => mark(i, { reps: plan.value }))
  } else if (plan.type === 'reps-bump') {
    if (plan.pyramid) {
      const reps = Number(setsArr[lastIdx].reps) || 0
      if (reps < plan.threshold) mark(lastIdx, { reps: reps + 1 })
    } else {
      setsArr.forEach((s, i) => {
        const reps = Number(s.reps) || 0
        if (reps < plan.threshold) mark(i, { reps: reps + 1 })
      })
    }
  }
}

function ExerciseCard({ ex, exData, onChange, onRemove, onSwapToAlt, onReplace, origExName, pr, lastSession, progressionAdvice, restSec, lesiones, deloadActive, allSessions }) {
  const lastSets    = lastSession?.sets
  const defaultSecs = TIME_EXERCISES.some(n => ex.name.includes(n))
  const [useSeconds, setUseSeconds]         = useState(defaultSecs)
  const [activeTimerIdx, setActiveTimerIdx] = useState(-1)
  const [showPicker, setShowPicker]         = useState(false)
  const [restRunning, setRestRunning]       = useState(false)
  const [showHistory, setShowHistory]       = useState(false)
  const { sets } = exData
  const currentRestSecs = exData.restSecs ?? restSec
  const plan = deloadActive ? null : computeSuggestionPlan(progressionAdvice, lastSets)

  let weightMsg = null
  if (plan?.type === 'weight') {
    const repsValues = Object.values(plan.reps)
    const uniform = repsValues.every(r => r === repsValues[0])
    if (plan.pyramid) {
      weightMsg = `📈 Hoy: ${plan.value}kg × ${plan.reps[lastSets.length - 1]} en la última serie`
    } else if (uniform) {
      weightMsg = `📈 Hoy: ${plan.value}kg × ${repsValues[0]}`
    } else {
      weightMsg = `📈 Hoy: ${plan.value}kg`
    }
  }

  const updateSet = (i, field, val) => {
    const updated = sets.map((s, idx) => {
      if (idx !== i) return s
      const next = { ...s, [field]: val === '' ? '' : Number(val) }
      if (next._suggested?.[field]) {
        const { [field]: _cleared, ...restFlags } = next._suggested
        if (Object.keys(restFlags).length) next._suggested = restFlags
        else delete next._suggested
      }
      return next
    })
    onChange({ ...exData, sets: updated })
  }
  const addSet    = () => onChange({ ...exData, sets: [...sets, { reps: sets[0]?.reps ?? 10, weight: sets[0]?.weight ?? 0 }] })
  const removeSet = (i) => sets.length > 1 && onChange({ ...exData, sets: sets.filter((_, idx) => idx !== i) })
  const maxWeight = Math.max(0, ...sets.map(s => s.weight ?? 0))

  const setRestSecs = (secs) => { onChange({ ...exData, restSecs: secs }); setShowPicker(false) }

  return (
    <div className="bg-app-elevated rounded-xl p-4 mb-3 animate-fadeIn">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-app-text font-semibold text-sm">{ex.name}</p>
            <button
              onClick={() => setUseSeconds(u => !u)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                useSeconds ? 'border-app-amber text-app-amber bg-app-amber/10' : 'border-white/15 text-app-muted'
              }`}
            >
              {useSeconds ? 'Segs' : 'Reps'}
            </button>
          </div>
          <div className="flex gap-2 mt-0.5 flex-wrap">
            <span className="text-app-muted text-xs">{ex.muscle}</span>
            <span className="text-app-muted/40 text-xs">·</span>
            <span className="text-app-purple-light/70 text-xs">{ex.level}</span>
            <button onClick={() => setShowHistory(true)} className="text-[10px] text-app-muted/60 underline underline-offset-2">
              📊 Historial
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReplace}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-app-purple/20 border border-app-purple/30 text-app-purple-light text-xs font-medium active:opacity-70 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Cambiar
          </button>
          <button onClick={onRemove} className="text-app-muted/40 p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {lesiones && lesiones !== 'Ninguna' && (
        <div className="bg-app-amber/10 border border-app-amber/20 rounded-lg px-3 py-1.5 mb-3 flex items-center gap-2">
          <span className="text-app-amber text-xs">⚠️ Lesión: {lesiones}</span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {pr > 0 && <span className="text-app-gold text-xs font-medium">PR: {pr}kg</span>}
        {pr > 0 && maxWeight > 0 && maxWeight >= pr && (
          <span className="text-xs bg-app-gold/20 text-app-gold px-2 py-0.5 rounded-full font-medium">¡Nuevo récord! 🏆</span>
        )}
        {plan && (
          <span className="text-xs bg-app-green/20 text-app-green-light px-2 py-0.5 rounded-full font-medium border border-app-green-light/20">
            {plan.type === 'weight' ? '📈 Subí el peso' : plan.type === 'reps-bump' ? '📈 +1 rep' : '📈 Sumá reps'}
          </span>
        )}
      </div>

      {!progressionAdvice?.hasHistory ? (
        <div className="bg-app-purple/10 border border-app-purple/20 rounded-lg px-3 py-1.5 mb-2">
          <p className="text-app-purple-light text-xs">
            💡 Primera vez con este ejercicio. Empezá con las reps sugeridas y elegí un peso con el que puedas completarlas con buena forma.
          </p>
        </div>
      ) : plan?.type === 'weight' ? (
        <div className="bg-app-green/10 border border-app-green-light/20 rounded-lg px-3 py-1.5 mb-2">
          <p className="text-app-green-light text-xs font-medium">{weightMsg}</p>
        </div>
      ) : plan?.type === 'reps-target' ? (
        <div className="bg-app-green/10 border border-app-green-light/20 rounded-lg px-3 py-1.5 mb-2">
          <p className="text-app-green-light text-xs font-medium">
            📈 Sumá reps (objetivo {plan.value})
          </p>
        </div>
      ) : plan?.type === 'reps-bump' ? (
        <div className="bg-app-green/10 border border-app-green-light/20 rounded-lg px-3 py-1.5 mb-2">
          <p className="text-app-green-light text-xs font-medium">📈 Hoy: +1 rep</p>
        </div>
      ) : (
        <p className="text-app-purple-light/60 text-xs mb-2">✓ Mantené el peso, vas bien.</p>
      )}

      {deloadActive && (
        <div className="bg-app-purple/10 border border-app-purple/20 rounded-lg px-3 py-1.5 mb-2">
          <p className="text-app-purple-light text-xs">🔄 Descarga: peso reducido al 65%</p>
        </div>
      )}

      <div className="space-y-1">
        <div className={`grid gap-1 text-app-muted text-[10px] font-medium px-1 ${useSeconds ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <span>Serie</span>
          <span className="text-center">{useSeconds ? 'Segs' : 'Reps'}</span>
          <span className="text-center">Peso (kg)</span>
          {useSeconds && <span className="text-center">Timer</span>}
        </div>
        {sets.map((s, i) => (
          <div key={i}>
            <div className={`grid gap-1 items-center ${useSeconds ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <button onClick={() => removeSet(i)} className="bg-app-bg rounded-lg py-2 text-xs text-app-muted font-medium">{i + 1}</button>
              <input type="number" value={s.reps ?? ''} onChange={e => updateSet(i, 'reps', e.target.value)}
                className={`bg-app-bg border border-white/8 rounded-lg py-2 text-app-text text-sm text-center focus:outline-none focus:border-app-purple/50 ${s._suggested?.reps ? 'input-suggested' : ''}`}
              />
              <input type="number" step="0.5" value={s.weight ?? ''} onChange={e => updateSet(i, 'weight', e.target.value)}
                placeholder={lastSets?.[0]?.weight ?? '0'}
                className={`bg-app-bg border border-white/8 rounded-lg py-2 text-app-text text-sm text-center focus:outline-none focus:border-app-purple/50 ${s._suggested?.weight ? 'input-suggested' : ''}`}
              />
              {useSeconds && (
                <button
                  onClick={() => setActiveTimerIdx(activeTimerIdx === i ? -1 : i)}
                  className={`rounded-lg py-2 text-xs font-medium ${activeTimerIdx === i ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}
                >
                  {activeTimerIdx === i ? '⏹' : '▶'}
                </button>
              )}
            </div>
            {useSeconds && activeTimerIdx === i && (
              <InlineTimer workSecs={Number(s.reps) || 30} restSecs={currentRestSecs}
                onDone={() => setActiveTimerIdx(-1)} onCancel={() => setActiveTimerIdx(-1)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <button onClick={addSet} className="flex-1 py-2 rounded-xl bg-app-bg text-app-muted text-xs border border-white/8">
          + Serie
        </button>
        <div className="flex-1 flex gap-1">
          <button
            onClick={() => { if (!restRunning) { setRestRunning(true); setShowPicker(false) } }}
            className={`flex-1 py-2 rounded-xl text-xs border transition-all ${
              restRunning ? 'bg-app-bg border-white/5 text-app-muted/40 cursor-default' : 'bg-app-purple/20 text-app-purple-light border-app-purple/20'
            }`}
          >
            ⏱ {Math.floor(currentRestSecs / 60)}:{String(currentRestSecs % 60).padStart(2, '0')}
          </button>
          <button onClick={() => { setShowPicker(p => !p); setRestRunning(false) }}
            className="px-2.5 py-2 rounded-xl bg-app-bg border border-white/8 text-app-muted text-xs"
          >✏️</button>
        </div>
      </div>

      {showPicker && (
        <div className="mt-2 grid grid-cols-4 gap-1">
          {REST_OPTIONS.map(s => (
            <button key={s} onClick={() => setRestSecs(s)}
              className={`py-1.5 rounded-lg text-xs ${currentRestSecs === s ? 'bg-app-purple text-white' : 'bg-app-bg border border-white/8 text-app-muted'}`}
            >
              {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
            </button>
          ))}
        </div>
      )}

      {restRunning && (
        <InlineRestTimer totalSec={currentRestSecs} onDone={() => setRestRunning(false)} onSkip={() => setRestRunning(false)} />
      )}

      {origExName ? (
        <button
          onClick={onSwapToAlt}
          className="w-full mt-2 py-2 px-3 rounded-lg border border-app-purple/30 bg-app-purple/10 text-app-purple-light text-xs font-medium text-left active:opacity-70 transition-opacity"
        >
          ↩ Volver: {origExName}
        </button>
      ) : ex.alt && ex.alt !== ex.name ? (
        <button
          onClick={onSwapToAlt}
          className="w-full mt-2 py-2 px-3 rounded-lg border border-app-purple/30 bg-app-purple/10 text-app-purple-light text-xs font-medium text-left active:opacity-70 transition-opacity"
        >
          Alternativa: {ex.alt}
        </button>
      ) : null}

      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)} title={`Historial · ${ex.name}`}>
        <ExerciseHistoryModal sessions={allSessions} />
      </Modal>
    </div>
  )
}

export default function FuerzaFlow({ data, onChange, profile, workoutsHook, deloadHook, initialRoutineId, onTimerStart }) {
  const { user } = useAuthContext()
  const [mode, setMode]               = useState(data.mode ?? 'libre')
  const [selectedMuscles, setSelectedMuscles] = useState(data.selectedMuscles ?? [])
  const [selectedRoutine, setSelectedRoutine] = useState(data.selectedRoutine ?? '')
  const [expandedRoutine, setExpandedRoutine] = useState(null)
  const [replacingIndex, setReplacingIndex] = useState(-1)
  const [replaceSearch, setReplaceSearch]   = useState('')
  const [showAddPanel, setShowAddPanel]     = useState(false)
  const [addMuscles, setAddMuscles]         = useState([])
  const [cintas, setCintas]           = useState(data.cintas ?? false)
  const [genMuscles, setGenMuscles]     = useState([])
  const [genCount, setGenCount]         = useState(4)
  const [genEquip, setGenEquip]         = useState('Gym completo')
  const [genGenerated, setGenGenerated] = useState(null)
  const [customExercises, setCustomExercises] = useState([])
  const [newExFormContext, setNewExFormContext] = useState(null) // null | 'libre' | 'panel'
  const [newExFormName, setNewExFormName]     = useState('')
  const [newExFormMuscle, setNewExFormMuscle] = useState('')
  const [routineLoading, setRoutineLoading]   = useState(false)
  const [routineLoadError, setRoutineLoadError] = useState(null)
  const { getLastWeightsForExercise, getPRForExercise, getLearnedWeights, workouts } = workoutsHook
  const { getDeloadWeight, getDeloadSets, isActive: deloadActive } = deloadHook

  useEffect(() => {
    if (!user?.uid) return
    const uid = user.uid
    const DEPRECATED = ['Reverse Frog', 'Abducción con pausa']
    getCustomExercises(uid).then(customs => {
      setCustomExercises(customs.filter(ex => !DEPRECATED.includes(ex.name)))
      customs.filter(ex => DEPRECATED.includes(ex.name)).forEach(ex => {
        deleteCustomExercise(uid, ex.id).catch(() => {})
      })
    })
  }, [user?.uid])

  const objetivo = profile?.objetivo ?? 'Bienestar general'
  const restSec  = getRestTimer(objetivo)
  const lesiones = profile?.lesionesYes ? profile.lesiones : null

  const exerciseList = data.exercises ?? []

  // Recently trained muscles (48h)
  const recentMuscles = new Set()
  const cutoff48 = new Date(Date.now() - 48 * 60 * 60 * 1000)
  workouts?.forEach(w => {
    if (new Date(w.date + 'T12:00:00') >= cutoff48) {
      ;(w.muscleGroups ?? []).forEach(m => recentMuscles.add(m))
      ;(w.exercises ?? []).forEach(e => e.muscle && recentMuscles.add(e.muscle))
    }
  })

  const allExercises = [
    ...exercises.map(e => ({ ...e, custom: false })),
    ...customExercises.map(e => ({ ...e, custom: true })),
  ]

  const filteredByMuscle = selectedMuscles.length
    ? intercalateExercises(allExercises.filter(e => selectedMuscles.includes(e.muscle)))
    : []

  const handleSaveNewExercise = async () => {
    const name = newExFormName.trim()
    if (!name) return
    const muscle = newExFormMuscle || MUSCLE_GROUPS[0]
    const ex = { id: `custom_${Date.now()}`, name, muscle, group: muscle, level: 'C', equip: '', alt: '', custom: true }
    try { await saveCustomExercise(user.uid, ex) } catch (_) {}
    setCustomExercises(prev => [...prev, ex])
    addExercise(ex)
    setNewExFormContext(null)
    setNewExFormName('')
    setShowAddPanel(false)
    setAddMuscles([])
  }

  const buildEntry = (ex) => {
    const history = getLastWeightsForExercise(ex.id)
    const learned = getLearnedWeights(ex.id)
    const defaultReps = ['A', 'B'].includes(ex.level) ? 10 : 12

    if (!history.length || !history[0]?.sets?.length) {
      const setsArr = Array.from({ length: 3 }, () => ({ reps: defaultReps, weight: '' }))
      return { exerciseId: ex.id, name: ex.name, muscle: ex.muscle, originalMuscle: ex.muscle, sets: setsArr }
    }

    const lastSets = history[0].sets
    const setsArr  = lastSets.map(s => ({
      reps:   s.reps ?? '',
      weight: deloadActive ? getDeloadWeight(Number(s.weight) || 0, learned) : (s.weight ?? ''),
    }))

    if (!deloadActive) {
      const advice = getProgressionAdvice(ex.id, ex.name, ex.level, history, learned, ex.equip)
      applySuggestionPlan(setsArr, computeSuggestionPlan(advice, lastSets))
    }

    return { exerciseId: ex.id, name: ex.name, muscle: ex.muscle, originalMuscle: ex.muscle, sets: setsArr.length ? setsArr : [{ reps: defaultReps, weight: '' }] }
  }

  const addExercise = (ex) => {
    const entry = buildEntry(ex)
    if (exerciseList.length === 0) onTimerStart?.()
    onChange({ ...data, exercises: [...exerciseList, entry], mode, selectedMuscles, selectedRoutine })
  }

  const removeExercise = (i) => onChange({ ...data, exercises: exerciseList.filter((_, idx) => idx !== i) })

  const updateExercise = (i, updated) => onChange({ ...data, exercises: exerciseList.map((e, idx) => idx === i ? updated : e) })

  const swapToAlt = (i) => {
    const entry = exerciseList[i]
    const originalMuscle = entry.originalMuscle ?? entry.muscle

    // If already on the alt, toggle back to the original exercise
    if (entry.originalExerciseId) {
      const origEx = allExercises.find(e => e.id === entry.originalExerciseId)
      if (origEx) updateExercise(i, { ...buildEntry(origEx), originalMuscle })
      return
    }

    // Go forward to the alt
    const currentEx = allExercises.find(e => e.id === entry.exerciseId)
    const altName = currentEx?.alt ?? ''
    if (!altName || altName === (currentEx?.name ?? '')) return
    const altEx = allExercises.find(e => e.name.toLowerCase() === altName.toLowerCase())
    const newEntry = altEx
      ? { ...buildEntry(altEx), originalMuscle, originalExerciseId: entry.exerciseId }
      : { exerciseId: `alt-${i}-${Date.now()}`, name: altName, muscle: originalMuscle, originalMuscle, originalExerciseId: entry.exerciseId, sets: [{ reps: 12, weight: '' }, { reps: 12, weight: '' }, { reps: 12, weight: '' }] }
    updateExercise(i, newEntry)
  }

  const replaceWithExercise = (i, newEx) => {
    const entry = exerciseList[i]
    const newEntry = { ...buildEntry(newEx), originalMuscle: entry.originalMuscle ?? entry.muscle }
    updateExercise(i, newEntry)
    setReplacingIndex(-1)
    setReplaceSearch('')
  }

  const loadRoutine = async (routineId) => {
    setRoutineLoadError(null)
    const builtin = builtinRoutines.find(r => r.id === routineId)
    if (builtin) {
      const exs = builtin.exercises.map(re => exercises.find(e => e.id === re.id)).filter(Boolean).map(buildEntry)
      onChange({ ...data, exercises: exs, mode: 'prearmada', selectedRoutine: routineId })
      setExpandedRoutine(null)
      onTimerStart?.()
      return
    }
    if (!user?.uid) { setRoutineLoadError('No se pudo cargar la rutina.'); return }
    setRoutineLoading(true)
    try {
      const [customs, customExs] = await Promise.all([
        getCustomRoutines(user.uid),
        getCustomExercises(user.uid),
      ])
      const custom = customs.find(r => r.id === routineId)
      if (!custom) {
        setRoutineLoadError('No se encontró la rutina. Puede haber sido eliminada.')
        return
      }
      const allExs = [...exercises, ...customExs]
      const exs = (custom.exercises ?? [])
        .map(re => allExs.find(e => e.id === (re.id ?? re.exerciseId)))
        .filter(Boolean)
        .map(buildEntry)
      onChange({ ...data, exercises: exs, mode: 'prearmada', selectedRoutine: routineId })
      setExpandedRoutine(null)
      onTimerStart?.()
    } catch {
      setRoutineLoadError('No se pudo cargar la rutina. Intentá de nuevo.')
    } finally {
      setRoutineLoading(false)
    }
  }

  useEffect(() => {
    if (initialRoutineId && !data.exercises?.length) {
      loadRoutine(initialRoutineId)
      setMode('prearmada')
    }
  }, [initialRoutineId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMuscle = (m) => {
    const updated = selectedMuscles.includes(m)
      ? selectedMuscles.filter(x => x !== m)
      : [...selectedMuscles, m]
    setSelectedMuscles(updated)
    onChange({ ...data, selectedMuscles: updated })
  }

  const generateForFlow = () => {
    if (!genMuscles.length) return
    const equipFilter = (e) => {
      if (genEquip !== 'Solo básico') return true
      return ['Sin equipamiento', 'Mancuernas', 'Banda elástica', 'Tobilleras'].some(
        eq => e.equip?.includes(eq.split(' ')[0])
      )
    }
    const perGroup   = Math.floor(genCount / genMuscles.length)
    const remainder  = genCount % genMuscles.length
    const allPicked  = []
    const globalUsed = new Set()

    genMuscles.forEach((muscle, idx) => {
      const target = perGroup + (idx < remainder ? 1 : 0)
      const pool   = allExercises.filter(e => e.muscle === muscle && equipFilter(e))
      const picked = []
      for (const level of LEVEL_ORDER) {
        if (picked.length >= target) break
        const candidates = pool.filter(e => !globalUsed.has(e.id) && e.level === level)
        if (!candidates.length) continue
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        picked.push(pick); globalUsed.add(pick.id)
      }
      while (picked.length < target) {
        let found = null
        for (const level of LEVEL_ORDER) {
          const c = pool.filter(e => !globalUsed.has(e.id) && e.level === level)
          if (c.length) { found = c[Math.floor(Math.random() * c.length)]; break }
        }
        if (!found) break
        picked.push(found); globalUsed.add(found.id)
      }
      allPicked.push(...picked)
    })

    const ordered = intercalateExercises(allPicked)
    setGenGenerated({
      name: `Generada: ${genMuscles.slice(0, 2).join(' + ')}`,
      exercises: ordered.map(e => ({
        id: e.id, exerciseId: e.id, name: e.name, level: e.level,
        muscle: e.muscle, sets: 3, repsScheme: '12',
      })),
      muscles: genMuscles,
    })
  }

  const useGeneratedRoutine = () => {
    if (!genGenerated) return
    const exs = genGenerated.exercises
      .map(ge => allExercises.find(e => e.id === ge.id) ?? ge)
      .map(buildEntry)
    setMode('libre')
    setGenMuscles([])
    setGenGenerated(null)
    onChange({ ...data, exercises: exs, mode: 'libre', selectedMuscles: genGenerated.muscles ?? [] })
    onTimerStart?.()
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex bg-app-bg rounded-xl p-1 gap-1">
        {[
          { key: 'prearmada', label: 'Pre-armada' },
          { key: 'libre',     label: 'Libre'      },
          { key: 'generador', label: 'Generador'  },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setMode(key); onChange({ ...data, mode: key }) }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              mode === key ? 'bg-app-purple text-white' : 'text-app-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'prearmada' && exerciseList.length > 0 && (
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-app-text text-sm font-medium">
            {builtinRoutines.find(r => r.id === data.selectedRoutine)?.name ?? 'Rutina cargada'}
          </p>
          <button
            onClick={() => { onChange({ ...data, exercises: [], selectedRoutine: '' }); setExpandedRoutine(null) }}
            className="text-app-muted text-xs underline underline-offset-2"
          >
            Cambiar
          </button>
        </div>
      )}

      {mode === 'prearmada' && exerciseList.length === 0 && routineLoading && (
        <p className="text-app-muted text-sm text-center py-8 animate-pulse">Cargando rutina...</p>
      )}

      {mode === 'prearmada' && exerciseList.length === 0 && routineLoadError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-4 space-y-3">
          <p className="text-red-400 text-sm">{routineLoadError}</p>
          <button
            onClick={() => setRoutineLoadError(null)}
            className="text-app-muted text-xs underline underline-offset-2"
          >
            Elegir otra rutina
          </button>
        </div>
      )}

      {mode === 'prearmada' && exerciseList.length === 0 && !routineLoading && !routineLoadError && (
        <div>
          <p className="text-app-muted text-xs mb-3">Elegí una rutina</p>
          <div className="space-y-2">
            {builtinRoutines.map(r => {
              const isExpanded = expandedRoutine === r.id
              return (
                <div
                  key={r.id}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isExpanded
                      ? 'border-[#9B7FD4] bg-[rgba(124,92,191,0.2)]'
                      : 'border-white/10 bg-app-bg'
                  }`}
                  style={isExpanded ? { boxShadow: '0 0 0 1px rgba(155,127,212,0.5)' } : {}}
                >
                  <button
                    className="w-full text-left px-4 py-3"
                    onClick={() => setExpandedRoutine(isExpanded ? null : r.id)}
                  >
                    <p className={`font-medium text-sm ${isExpanded ? 'text-white' : 'text-app-muted'}`}>
                      {r.name}
                    </p>
                    {r.subtitle && (
                      <p className={`text-xs mt-0.5 ${isExpanded ? 'text-app-purple-light' : 'text-app-muted/50'}`}>
                        {r.subtitle}
                      </p>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="space-y-1.5 mb-4">
                        {r.exercises.map((re, i) => {
                          const exName = exercises.find(e => e.id === re.id)?.name ?? re.id
                          return (
                            <div key={re.id} className="flex items-start gap-2">
                              <span className="text-[10px] text-app-purple/60 font-medium w-4 shrink-0 mt-0.5">{i + 1}</span>
                              <div>
                                <span className="text-white text-xs font-medium">{exName}</span>
                                <span className="text-xs ml-2" style={{ color: '#94A3B8' }}>{re.muscle}</span>
                                {re.alt && (
                                  <p className="text-[10px] mt-0.5" style={{ color: '#6B7280' }}>Alt: {re.alt}</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <button
                        onClick={() => loadRoutine(r.id)}
                        className="w-full py-2.5 rounded-xl bg-app-purple text-white text-sm font-medium"
                      >
                        Usar esta rutina
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {mode === 'libre' && (
        <div>
          <p className="text-app-muted text-xs mb-2">Músculos a trabajar</p>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map(m => {
              const recent   = recentMuscles.has(m)
              const selected = selectedMuscles.includes(m)
              return (
                <button
                  key={m}
                  onClick={() => toggleMuscle(m)}
                  className={`px-2.5 py-1.5 rounded-full text-xs border transition-all relative ${
                    selected
                      ? 'border-app-purple bg-app-purple/20 text-app-purple-light'
                      : recent
                        ? 'border-app-amber/40 text-app-amber/70 bg-app-amber/5'
                        : 'border-white/10 text-app-muted'
                  }`}
                >
                  {m}
                  {recent && !selected && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-app-amber" />
                  )}
                </button>
              )
            })}
          </div>

          {filteredByMuscle.length > 0 && (
            <div className="mt-3">
              <p className="text-app-muted text-xs mb-2">Tocá para agregar</p>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {filteredByMuscle.map(ex => {
                  const added = exerciseList.some(e => e.exerciseId === ex.id)
                  return (
                    <button
                      key={ex.id}
                      onClick={() => !added && addExercise(ex)}
                      disabled={added}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                        added
                          ? 'bg-app-purple/10 text-app-purple-light border border-app-purple/20'
                          : 'bg-app-bg border border-white/8 text-app-muted active:bg-white/5'
                      }`}
                    >
                      <span>
                        <span className="text-app-text font-medium">{exDisplayName(ex)}</span>
                        {ex.custom && (
                          <span className="ml-1.5 text-[9px] text-app-purple-light/60 bg-app-purple/10 px-1.5 py-0.5 rounded-full">Mío</span>
                        )}
                      </span>
                      <span className={`text-[10px] ${added ? 'text-app-purple-light' : 'text-app-muted/60'}`}>
                        {added ? '✓' : ex.level}
                      </span>
                    </button>
                  )
                })}
              </div>
              {newExFormContext === 'libre' ? (
                <div className="mt-2 bg-app-elevated rounded-xl p-3 space-y-2 border border-app-purple/20 animate-fadeIn">
                  <input
                    autoFocus
                    value={newExFormName}
                    onChange={e => setNewExFormName(e.target.value)}
                    placeholder="Nombre del ejercicio"
                    className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-xs focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {MUSCLE_GROUPS.map(m => (
                      <button
                        key={m}
                        onClick={() => setNewExFormMuscle(m)}
                        className={`px-2 py-1 rounded-full text-[10px] border transition-all ${
                          newExFormMuscle === m
                            ? 'border-app-purple bg-app-purple/20 text-app-purple-light'
                            : 'border-white/10 text-app-muted'
                        }`}
                      >{m}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setNewExFormContext(null); setNewExFormName('') }}
                      className="flex-1 py-2 rounded-xl text-xs text-app-muted border border-white/10"
                    >Cancelar</button>
                    <button
                      onClick={handleSaveNewExercise}
                      disabled={!newExFormName.trim()}
                      className="flex-1 py-2 rounded-xl text-xs text-white bg-app-purple disabled:opacity-50"
                    >Guardar y agregar</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setNewExFormContext('libre'); setNewExFormMuscle(selectedMuscles[0] ?? MUSCLE_GROUPS[0]) }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2 border border-dashed border-app-purple/40 text-app-purple-light mt-1"
                >
                  <Plus size={14} />
                  Ejercicio nuevo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'generador' && (
        <div className="space-y-3">
          <div>
            <p className="text-app-muted text-xs mb-2">Músculos a trabajar</p>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map(m => {
                const recent = recentMuscles.has(m)
                return (
                  <button
                    key={m}
                    onClick={() => {
                      const updated = genMuscles.includes(m) ? genMuscles.filter(x => x !== m) : [...genMuscles, m]
                      setGenMuscles(updated)
                      setGenGenerated(null)
                    }}
                    className={`px-2.5 py-1.5 rounded-full text-xs border transition-all relative ${
                      genMuscles.includes(m)
                        ? 'border-app-purple bg-app-purple/20 text-app-purple-light'
                        : recent
                          ? 'border-app-amber/40 text-app-amber/70 bg-app-amber/5'
                          : 'border-white/10 text-app-muted'
                    }`}
                  >
                    {m}
                    {recent && !genMuscles.includes(m) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-app-amber" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-app-muted text-xs mb-2">Cantidad de ejercicios</p>
            <div className="flex gap-2">
              {[3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => { setGenCount(n); setGenGenerated(null) }}
                  className={`flex-1 py-2 rounded-xl text-sm border transition-all ${
                    genCount === n ? 'border-app-purple bg-app-purple/20 text-app-purple-light font-semibold' : 'border-white/10 text-app-muted'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-app-muted text-xs mb-2">Equipamiento</p>
            <div className="flex gap-2">
              {['Gym completo', 'Solo básico'].map(e => (
                <button
                  key={e}
                  onClick={() => setGenEquip(e)}
                  className={`flex-1 py-2.5 rounded-xl text-xs border transition-all ${
                    genEquip === e ? 'border-app-purple bg-app-purple/20 text-app-purple-light' : 'border-white/10 text-app-muted'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generateForFlow}
            disabled={genMuscles.length === 0}
            className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
              genMuscles.length === 0
                ? 'bg-app-surface text-app-muted/50 cursor-not-allowed'
                : 'bg-app-purple text-white'
            }`}
          >
            Generar rutina
          </button>

          {genGenerated && (
            <div className="bg-app-bg rounded-xl border border-white/5 p-3 animate-fadeIn">
              <p className="text-app-text font-semibold text-xs mb-2">{genGenerated.name}</p>
              <div className="space-y-1.5 mb-3">
                {genGenerated.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <span className="text-app-purple-light/70 text-xs mr-1.5">{ex.level}</span>
                      <span className="text-app-text text-xs">{ex.name}</span>
                      <span className="text-app-muted/50 text-[10px] ml-1.5">{ex.muscle}</span>
                    </div>
                    <span className="text-app-muted text-[10px]">{ex.sets}×{ex.repsScheme}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={useGeneratedRoutine}
                  className="flex-1 py-2.5 rounded-xl bg-app-purple text-white text-sm font-medium"
                >
                  Usar ahora
                </button>
                <button
                  onClick={generateForFlow}
                  className="py-2.5 px-3 rounded-xl bg-app-elevated border border-white/10 text-app-muted text-xs"
                >
                  Regenerar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {exerciseList.length > 0 && (
        <div>
          <p className="text-app-muted text-xs mb-3">Ejercicios de la sesión</p>
          {exerciseList.map((entry, i) => {
            const ex = exercises.find(e => e.id === entry.exerciseId)
              ?? { id: entry.exerciseId, name: entry.name, muscle: entry.muscle, level: 'C', custom: true }
            const lastSetsHistory = getLastWeightsForExercise(entry.exerciseId)
            const pr      = getPRForExercise(entry.exerciseId)
            const learned = getLearnedWeights(entry.exerciseId)
            const advice  = getProgressionAdvice(entry.exerciseId, ex.name, ex.level, lastSetsHistory, learned, ex.equip)
            const origExName = entry.originalExerciseId
              ? (allExercises.find(e => e.id === entry.originalExerciseId)?.name ?? null)
              : null

            return (
              <ExerciseCard
                key={i}
                ex={ex}
                exData={entry}
                onChange={(u) => updateExercise(i, u)}
                onRemove={() => removeExercise(i)}
                onSwapToAlt={() => swapToAlt(i)}
                onReplace={() => setReplacingIndex(i)}
                origExName={origExName}
                pr={pr}
                lastSession={lastSetsHistory[0]}
                progressionAdvice={advice}
                restSec={restSec}
                lesiones={lesiones}
                deloadActive={deloadActive}
                allSessions={lastSetsHistory}
              />
            )
          })}

          {!showAddPanel ? (
            <button
              onClick={() => setShowAddPanel(true)}
              className="w-full py-3 rounded-xl border border-dashed border-white/15 text-app-muted text-sm"
            >
              + Agregar ejercicio
            </button>
          ) : (
            <div className="bg-app-elevated rounded-xl p-4 animate-fadeIn">
              <div className="flex items-center justify-between mb-3">
                <p className="text-app-text text-sm font-medium">Agregar ejercicio</p>
                <button onClick={() => { setShowAddPanel(false); setAddMuscles([]) }} className="text-app-muted text-xs">✕ Cerrar</button>
              </div>
              <p className="text-app-muted text-xs mb-2">Grupo muscular</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {MUSCLE_GROUPS.map(m => (
                  <button key={m}
                    onClick={() => setAddMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                    className={`px-2.5 py-1.5 rounded-full text-xs border transition-all ${
                      addMuscles.includes(m) ? 'border-app-purple bg-app-purple/20 text-app-purple-light' : 'border-white/10 text-app-muted'
                    }`}
                  >{m}</button>
                ))}
              </div>
              {addMuscles.length > 0 && (
                <>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {allExercises.filter(e => addMuscles.includes(e.muscle)).map(e => {
                      const alreadyAdded = exerciseList.some(ex => ex.exerciseId === e.id)
                      return (
                        <button key={e.id}
                          onClick={() => { if (alreadyAdded) return; addExercise(e); setShowAddPanel(false); setAddMuscles([]) }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                            alreadyAdded ? 'bg-app-purple/10 text-app-purple-light border border-app-purple/20 cursor-default' : 'bg-app-bg border border-white/8 text-app-text active:opacity-70'
                          }`}
                        >
                          <span>
                            <span className="font-medium">{exDisplayName(e)}</span>
                          </span>
                          <span className={alreadyAdded ? 'text-app-purple-light text-[10px]' : 'text-app-muted/60 text-[10px]'}>
                            {alreadyAdded ? '✓' : e.level}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {newExFormContext === 'panel' ? (
                    <div className="mt-2 bg-app-bg rounded-xl p-3 space-y-2 border border-app-purple/20 animate-fadeIn">
                      <input
                        autoFocus
                        value={newExFormName}
                        onChange={e => setNewExFormName(e.target.value)}
                        placeholder="Nombre del ejercicio"
                        className="w-full bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-app-text text-xs focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {MUSCLE_GROUPS.map(m => (
                          <button
                            key={m}
                            onClick={() => setNewExFormMuscle(m)}
                            className={`px-2 py-1 rounded-full text-[10px] border transition-all ${
                              newExFormMuscle === m
                                ? 'border-app-purple bg-app-purple/20 text-app-purple-light'
                                : 'border-white/10 text-app-muted'
                            }`}
                          >{m}</button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setNewExFormContext(null); setNewExFormName('') }}
                          className="flex-1 py-2 rounded-xl text-xs text-app-muted border border-white/10"
                        >Cancelar</button>
                        <button
                          onClick={handleSaveNewExercise}
                          disabled={!newExFormName.trim()}
                          className="flex-1 py-2 rounded-xl text-xs text-white bg-app-purple disabled:opacity-50"
                        >Guardar y agregar</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setNewExFormContext('panel'); setNewExFormMuscle(addMuscles[0] ?? MUSCLE_GROUPS[0]) }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2 border border-dashed border-app-purple/40 text-app-purple-light mt-1"
                    >
                      <Plus size={14} />
                      Ejercicio nuevo
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {replacingIndex >= 0 && (
        <Modal isOpen onClose={() => { setReplacingIndex(-1); setReplaceSearch('') }} title="Reemplazar ejercicio">
          <div className="space-y-3">
            <input
              autoFocus
              value={replaceSearch}
              onChange={e => setReplaceSearch(e.target.value)}
              placeholder="Buscar ejercicio..."
              className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none"
            />
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {allExercises
                .filter(e => {
                  const muscle = exerciseList[replacingIndex]?.originalMuscle ?? exerciseList[replacingIndex]?.muscle
                  return e.muscle === muscle && (replaceSearch === '' || e.name.toLowerCase().includes(replaceSearch.toLowerCase()))
                })
                .map(e => (
                  <button key={e.id} onClick={() => replaceWithExercise(replacingIndex, e)}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between bg-app-bg border border-white/5 text-app-text active:bg-white/5"
                  >
                    <span className="font-medium">{exDisplayName(e)}</span>
                    <span className="text-app-muted/60">{e.level}</span>
                  </button>
                ))
              }
            </div>
          </div>
        </Modal>
      )}

      <div className="bg-app-elevated rounded-xl p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setCintas(!cintas)}
            className={`w-10 h-6 rounded-full transition-all relative ${cintas ? 'bg-app-green-light' : 'bg-app-bg'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${cintas ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-app-text text-sm">Cinta al final</span>
        </label>
        {cintas && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {['Caminata', 'Trote', 'Carrera'].map(t => (
                <button
                  key={t}
                  onClick={() => onChange({ ...data, cintaTipo: t })}
                  className={`py-2 rounded-xl text-xs border ${
                    data.cintaTipo === t ? 'border-app-green-light text-app-green-light bg-app-green/10' : 'border-white/10 text-app-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
              <input type="number" placeholder="Min" value={data.cintaMin ?? ''}
                onChange={e => onChange({ ...data, cintaMin: e.target.value })}
                className="bg-app-bg border border-white/10 rounded-xl px-2 py-2 text-xs text-app-text text-center focus:outline-none"
              />
              <input type="number" placeholder="km/h" value={data.cintaKmh ?? ''}
                onChange={e => onChange({ ...data, cintaKmh: e.target.value })}
                className="bg-app-bg border border-white/10 rounded-xl px-2 py-2 text-xs text-app-text text-center focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer mt-1">
              <div
                onClick={() => onChange({ ...data, cintaConInclinacion: !data.cintaConInclinacion })}
                className={`w-8 h-5 rounded-full transition-all relative shrink-0 ${data.cintaConInclinacion ? 'bg-app-green-light' : 'bg-app-bg border border-white/15'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${data.cintaConInclinacion ? 'left-3.5' : 'left-0.5'}`} />
              </div>
              <span className="text-app-muted text-xs">Con inclinación</span>
            </label>
            {data.cintaConInclinacion && (
              <div className="flex items-center gap-2">
                <span className="text-app-muted text-xs">Inclinación</span>
                <input type="number" placeholder="0" min="0" max="30" step="0.5"
                  value={data.cintaInclinacion ?? ''}
                  onChange={e => onChange({ ...data, cintaInclinacion: e.target.value })}
                  className="w-20 bg-app-bg border border-white/10 rounded-xl px-2 py-1.5 text-xs text-app-text text-center focus:outline-none"
                />
                <span className="text-app-muted text-xs">%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
