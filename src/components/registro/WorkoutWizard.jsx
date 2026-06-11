import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkouts } from '../../hooks/useWorkouts'
import { useDeload } from '../../hooks/useDeload'
import { useWorkoutDraft } from '../../context/WorkoutDraftContext'
import FuerzaFlow from './FuerzaFlow'
import CardioFlow from './CardioFlow'
import ClaseFlow from './ClaseFlow'
import WorkoutSummary from './WorkoutSummary'
import Button from '../ui/Button'
import { todayStr } from '../../utils/dates'
import { runAchievementCheck, ACHIEVEMENTS_META } from '../../utils/achievements'

const SESSION_TIMER_KEY = 'workout_start_ts'

function SessionTimer({ startTs }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startTs) / 1000))
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTs) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [startTs])
  const h = Math.floor(elapsed / 3600)
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
  const s = String(elapsed % 60).padStart(2, '0')
  return (
    <span className="text-app-muted text-xs tabular-nums font-medium">
      {h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`}
    </span>
  )
}

const TYPE_CARDS = [
  { type: 'fuerza', icon: '🏋️', label: 'Fuerza', sub: 'Pesas, rutinas, series y reps',   color: 'border-app-purple/50 bg-app-purple/10 text-app-purple-light' },
  { type: 'cardio', icon: '🏃', label: 'Cardio', sub: 'Running, bici, rollers...',         color: 'border-app-green-light/50 bg-app-green/10 text-app-green-light' },
  { type: 'clase',  icon: '🥊', label: 'Clase',  sub: 'Strong, HIIT, Funcional...',        color: 'border-app-blue-light/50 bg-app-blue/10 text-app-blue-light' },
  { type: 'pausa',  icon: '⏸',  label: 'Semana de pausa', sub: 'Enfermedad, lesión o descanso', color: 'border-white/20 bg-white/5 text-app-muted' },
]

const PAUSA_MOTIVOS = [
  { key: 'enfermedad', icon: '🤒', label: 'Enfermedad' },
  { key: 'lesion',     icon: '🤕', label: 'Lesión' },
  { key: 'descanso',   icon: '🧘', label: 'Descanso intencional' },
]

const STEPS = ['tipo', 'detalle', 'sensacion']

function PausaFlow({ pausaMotivo, setPausaMotivo, pausaInicio, setPausaInicio, pausaFin, setPausaFin, notes, setNotes, onSave, saving, saveError }) {
  const handleFinChange = (val) => {
    if (val < pausaInicio) return
    setPausaFin(val)
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-app-muted text-sm mb-3">Motivo</p>
        <div className="space-y-2">
          {PAUSA_MOTIVOS.map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => setPausaMotivo(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                pausaMotivo === key
                  ? 'border-app-purple/60 bg-app-purple/10'
                  : 'border-white/10 bg-app-surface'
              }`}
            >
              <span className="text-2xl">{icon}</span>
              <span className={`font-medium text-sm ${pausaMotivo === key ? 'text-app-purple-light' : 'text-app-text'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-app-muted text-xs block mb-1.5">Desde</label>
          <input
            type="date"
            value={pausaInicio}
            onChange={e => { setPausaInicio(e.target.value); if (pausaFin < e.target.value) setPausaFin(e.target.value) }}
            className="w-full bg-app-surface border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none focus:border-app-purple/50"
          />
        </div>
        <div>
          <label className="text-app-muted text-xs block mb-1.5">Hasta</label>
          <input
            type="date"
            value={pausaFin}
            min={pausaInicio}
            onChange={e => handleFinChange(e.target.value)}
            className="w-full bg-app-surface border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none focus:border-app-purple/50"
          />
        </div>
      </div>

      <div>
        <label className="text-app-muted text-sm block mb-2">¿Querés agregar algún detalle? (opcional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej: gripe, fiebre 3 días"
          rows={3}
          className="w-full bg-app-surface border border-white/10 rounded-xl px-4 py-3 text-app-text text-sm placeholder-app-muted/40 focus:outline-none focus:border-app-purple/50 resize-none"
        />
      </div>

      {saveError && (
        <div className="bg-app-coral/10 border border-app-coral/30 rounded-xl px-4 py-3 text-app-coral text-sm text-center">
          {saveError}
        </div>
      )}

      <Button size="xl" onClick={onSave} disabled={!pausaMotivo || saving}>
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Guardando...
          </span>
        ) : 'Guardar pausa'}
      </Button>
    </div>
  )
}

export default function WorkoutWizard({ initialType }) {
  const { user, profile, settings } = useAuthContext()
  const workoutsHook = useWorkouts(user?.uid)
  const deloadHook   = useDeload(settings, workoutsHook.workouts)
  const { draft: savedDraft, setDraft, clearDraft } = useWorkoutDraft()
  const navigate = useNavigate()
  const location = useLocation()
  const initialRoutineId = location.state?.routineId ?? null

  const [step, setStep]         = useState(savedDraft ? (savedDraft.step ?? 1) : (initialType ? 1 : 0))
  const [type, setType]         = useState(savedDraft?.type ?? initialType ?? '')
  const [detail, setDetail]     = useState(savedDraft?.detail ?? { exercises: [], mode: 'libre', selectedMuscles: [] })
  const [fatigue, setFatigue]   = useState(savedDraft?.fatigue ?? 5)
  const [notes, setNotes]       = useState(savedDraft?.notes ?? '')
  const [date, setDate]         = useState(savedDraft?.date ?? todayStr())
  const [pausaMotivo, setPausaMotivo] = useState(savedDraft?.pausaMotivo ?? '')
  const [pausaInicio, setPausaInicio] = useState(savedDraft?.pausaInicio ?? todayStr())
  const [pausaFin, setPausaFin]       = useState(savedDraft?.pausaFin ?? todayStr())
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved]       = useState(null)
  const [newAchievements, setNewAchievements] = useState([])
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [startTime, setStartTime] = useState(() => {
    const stored = localStorage.getItem(SESSION_TIMER_KEY)
    if (!stored) return null
    const ts = Number(stored)
    return new Date(ts).toDateString() === new Date().toDateString() ? ts : null
  })

  useEffect(() => {
    if (step === 0) {
      clearDraft()
      localStorage.removeItem(SESSION_TIMER_KEY)
      setStartTime(null)
      return
    }
    setDraft({ step, type, detail, fatigue, notes, date, pausaMotivo, pausaInicio, pausaFin })
  }, [step, type, detail, fatigue, notes, date, pausaMotivo, pausaInicio, pausaFin]) // eslint-disable-line react-hooks/exhaustive-deps

  const startTimer = () => {
    if (startTime) return
    const ts = Date.now()
    setStartTime(ts)
    localStorage.setItem(SESSION_TIMER_KEY, String(ts))
  }

  const avgFatigue = type === 'fuerza' && detail.exercises?.length
    ? Math.round(detail.exercises.reduce((a, e) => a + (e.fatigue ?? fatigue), 0) / detail.exercises.length)
    : fatigue

  const getMuscleGroups = () => {
    if (type !== 'fuerza') return []
    const muscles = new Set()
    detail.exercises?.forEach(e => { if (e.muscle) muscles.add(e.muscle) })
    return Array.from(muscles)
  }

  const sanitizeWorkout = (w) => {
    const clean = {}
    for (const [k, v] of Object.entries(w)) {
      if (v === undefined) clean[k] = null
      else if (v !== null && typeof v === 'object' && !Array.isArray(v)) clean[k] = sanitizeWorkout(v)
      else clean[k] = v
    }
    return clean
  }

  const handleSavePausa = async () => {
    setSaving(true)
    setSaveError(null)
    const workout = sanitizeWorkout({
      type: 'pausa',
      pausaMotivo,
      pausaInicio,
      pausaFin,
      date: pausaInicio,
      notes: notes || '',
    })
    try {
      await workoutsHook.saveWorkout(workout)
      clearDraft()
      setSaved(workout)
    } catch {
      setSaveError('No se pudo guardar. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const workout = sanitizeWorkout({
      type,
      date,
      fatigue:      Number(fatigue) || 5,
      notes:        notes || '',
      deload:       settings?.deloadActive ?? false,
      muscleGroups: getMuscleGroups(),
      ...(type === 'fuerza' ? {
        exercises: detail.exercises,
        cinta: detail.cintas ? {
          tipo:        detail.cintaTipo || null,
          min:         detail.cintaMin        ? Number(detail.cintaMin)        : null,
          kmh:         detail.cintaKmh        ? Number(detail.cintaKmh)        : null,
          inclinacion: detail.cintaConInclinacion && detail.cintaInclinacion
                         ? Number(detail.cintaInclinacion) : null,
        } : null,
      } : {}),
      ...(type === 'cardio' ? {
        activity:  detail.activity === 'otra' ? (detail.otra || '') : (detail.activity || ''),
        tiempo:    detail.tiempo    ? Number(detail.tiempo)    : null,
        distancia: detail.distancia ? Number(detail.distancia) : null,
        ritmo:     detail.ritmo     || null,
      } : {}),
      ...(type === 'clase' ? {
        clase:    detail.clase === 'otra' ? (detail.otra || '') : (detail.clase || ''),
        duracion: detail.duracion ? Number(detail.duracion) : 60,
      } : {}),
    })
    try {
      await workoutsHook.saveWorkout(workout)
      clearDraft()
      localStorage.removeItem(SESSION_TIMER_KEY)
      setSaved(workout)
      runAchievementCheck(user.uid, [workout, ...workoutsHook.workouts], profile, settings)
        .then(keys => setNewAchievements(ACHIEVEMENTS_META.filter(a => keys.includes(a.key))))
        .catch(() => {})
    } catch (error) {
      setSaveError('No se pudo guardar. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) return <WorkoutSummary workout={saved} onDone={() => setSaved(null)} workouts={workoutsHook.workouts} newAchievements={newAchievements} />

  return (
    <div className="min-h-screen bg-app-bg flex flex-col">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {type !== 'pausa' && (
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-app-surface border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none"
            />
          )}
          {settings?.deloadActive && (
            <span className="text-xs bg-app-gold/20 text-app-gold px-2.5 py-1 rounded-full border border-app-gold/30">
              🔄 Descarga
            </span>
          )}
        </div>
        {step >= 1 && startTime && type !== 'pausa' && <SessionTimer startTs={startTime} />}
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="text-app-muted/60 text-xs px-3 py-1.5 rounded-xl border border-white/10"
        >
          Cancelar
        </button>
      </div>

      <div className="flex px-4 gap-1 mb-1">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-app-purple' : 'bg-app-surface'}`} />
        ))}
      </div>

      <div className="flex-1 px-4 py-4 overflow-y-auto">
        {step === 0 && (
          <div className="animate-fadeIn">
            <h2 className="text-app-text font-bold text-lg mb-1">¿Qué registrás?</h2>
            <p className="text-app-muted text-sm mb-6">Elegí el tipo de registro</p>
            <div className="grid gap-4">
              {TYPE_CARDS.map(({ type: t, icon, label, sub, color }) => (
                <button
                  key={t}
                  onClick={() => { setType(t); setStep(1) }}
                  className={`flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                    type === t ? color : 'border-white/10 bg-app-surface'
                  }`}
                >
                  <span className="text-4xl">{icon}</span>
                  <div>
                    <p className={`font-bold text-lg ${type === t ? '' : 'text-app-text'}`}>{label}</p>
                    <p className="text-app-muted text-xs mt-0.5">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setStep(0)} className="text-app-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-app-text font-bold text-base">
                {type === 'pausa' ? 'Registrar pausa' : 'Detalle del entrenamiento'}
              </h2>
            </div>
            {type === 'fuerza' && (
              <FuerzaFlow
                data={detail}
                onChange={setDetail}
                profile={profile}
                workoutsHook={workoutsHook}
                deloadHook={deloadHook}
                initialRoutineId={initialRoutineId}
                onTimerStart={startTimer}
              />
            )}
            {type === 'cardio' && <CardioFlow data={detail} onChange={setDetail} />}
            {type === 'clase'  && <ClaseFlow data={detail} onChange={setDetail} deloadActive={settings?.deloadActive} />}
            {type === 'pausa'  && (
              <PausaFlow
                pausaMotivo={pausaMotivo} setPausaMotivo={setPausaMotivo}
                pausaInicio={pausaInicio} setPausaInicio={setPausaInicio}
                pausaFin={pausaFin}       setPausaFin={setPausaFin}
                notes={notes}             setNotes={setNotes}
                onSave={handleSavePausa}  saving={saving}
                saveError={saveError}
              />
            )}
            {type !== 'pausa' && (
              <div className="pt-4">
                <Button size="lg" onClick={() => { startTimer(); setStep(2) }}>Continuar</Button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="animate-fadeIn">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setStep(1)} className="text-app-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-app-text font-bold text-base">¿Cómo te sentiste?</h2>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-app-muted text-sm">Cansancio general</label>
                  <span className={`font-bold text-lg ${
                    fatigue <= 4 ? 'text-app-green-light' : fatigue <= 7 ? 'text-app-amber' : 'text-app-coral'
                  }`}>{fatigue}/10</span>
                </div>
                <input
                  type="range" min="1" max="10" step="1"
                  value={fatigue}
                  onChange={e => setFatigue(Number(e.target.value))}
                  className="w-full accent-app-purple"
                />
                <div className="flex justify-between text-app-muted text-xs mt-1">
                  <span>Bajo (1-4)</span>
                  <span>Intermedio (5-7)</span>
                  <span>Alto (8-10)</span>
                </div>
                <div className="mt-2 text-center">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    fatigue <= 4 ? 'bg-app-green/20 text-app-green-light' :
                    fatigue <= 7 ? 'bg-app-amber/20 text-app-amber' :
                    'bg-app-coral/20 text-app-coral'
                  }`}>
                    {fatigue <= 4 ? 'Nivel Bajo' : fatigue <= 7 ? 'Nivel Intermedio' : 'Nivel Alto'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-app-muted text-sm block mb-2">¿Cómo te sentiste hoy? (opcional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ej: Estaba cansada pero vine igual. Me sentí fuerte en el Hip Thrust."
                  rows={3}
                  className="w-full bg-app-surface border border-white/10 rounded-xl px-4 py-3 text-app-text text-sm placeholder-app-muted/40 focus:outline-none focus:border-app-purple/50 resize-none"
                />
              </div>

              {settings?.deloadActive && (
                <div className="bg-app-gold/10 border border-app-gold/30 rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="text-app-gold text-sm font-medium">🔄 Semana de descarga</span>
                </div>
              )}

              {saveError && (
                <div className="bg-app-coral/10 border border-app-coral/30 rounded-xl px-4 py-3 text-app-coral text-sm text-center">
                  {saveError}
                </div>
              )}
              <Button size="xl" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Guardando...
                  </span>
                ) : saveError ? 'Reintentar' : 'Guardar entrenamiento 💪'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div className="bg-app-elevated rounded-2xl p-6 w-full max-w-xs border border-white/10">
            <p className="text-app-text font-semibold text-base mb-1">¿Cancelar el registro?</p>
            <p className="text-app-muted text-sm mb-5">Perderás lo registrado hasta ahora.</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { localStorage.removeItem(SESSION_TIMER_KEY); clearDraft(); navigate('/') }}
                className="py-3 rounded-xl bg-app-coral text-white font-medium"
              >
                Sí, cancelar
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="py-3 rounded-xl bg-app-bg text-app-muted border border-white/10"
              >
                No, continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
