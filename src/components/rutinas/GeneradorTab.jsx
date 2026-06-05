import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exercises, MUSCLE_GROUPS } from '../../data/exercises'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkoutDraft } from '../../context/WorkoutDraftContext'
import { saveCustomRoutine } from '../../services/db'
import Button from '../ui/Button'
import Card from '../ui/Card'

const COUNT_OPTIONS = [3, 4, 5, 6]
const EQUIP_OPTIONS = ['Gym completo', 'Solo básico']
const LEVEL_ORDER   = ['A', 'B', 'C', 'D']

const TREN_INFERIOR = ['Glúteos', 'Isquios', 'Cuádriceps', 'Abductores', 'Gemelos']
const TREN_SUPERIOR = ['Espalda', 'Pecho', 'Hombros', 'Bíceps', 'Tríceps']
const CORE          = ['Abdominales', 'Core & Estabilidad']

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

export default function GeneradorTab({ workouts }) {
  const { user } = useAuthContext()
  const { setDraft } = useWorkoutDraft()
  const navigate = useNavigate()
  const [selectedMuscles, setSelectedMuscles] = useState([])
  const [count, setCount]   = useState(4)
  const [equip, setEquip]   = useState('Gym completo')
  const [generated, setGenerated] = useState(null)
  const [saved, setSaved]   = useState(false)

  const recentMuscles = new Set()
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - 72)
  workouts.forEach(w => {
    if (new Date(w.date + 'T12:00:00') >= cutoff) {
      w.muscleGroups?.forEach(m => recentMuscles.add(m))
      w.exercises?.forEach(e => { if (e.muscle) recentMuscles.add(e.muscle) })
    }
  })

  const toggleMuscle = (m) => {
    setSelectedMuscles(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])
    setGenerated(null)
    setSaved(false)
  }

  const generate = () => {
    if (!selectedMuscles.length) return

    const equipFilter = (e) => {
      if (equip !== 'Solo básico') return true
      return ['Sin equipamiento', 'Mancuernas', 'Banda elástica', 'Tobilleras'].some(
        eq => e.equip?.includes(eq.split(' ')[0])
      )
    }

    const perGroup  = Math.floor(count / selectedMuscles.length)
    const remainder = count % selectedMuscles.length
    const allPicked = []
    const globalUsed = new Set()

    selectedMuscles.forEach((muscle, idx) => {
      const target = perGroup + (idx < remainder ? 1 : 0)
      const pool   = exercises.filter(e => e.muscle === muscle && equipFilter(e))
      const picked = []

      for (const level of LEVEL_ORDER) {
        if (picked.length >= target) break
        const candidates = pool.filter(e => !globalUsed.has(e.id) && e.level === level)
        if (!candidates.length) continue
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        picked.push(pick)
        globalUsed.add(pick.id)
      }

      while (picked.length < target) {
        let found = null
        for (const level of LEVEL_ORDER) {
          const c = pool.filter(e => !globalUsed.has(e.id) && e.level === level)
          if (c.length) { found = c[Math.floor(Math.random() * c.length)]; break }
        }
        if (!found) break
        picked.push(found)
        globalUsed.add(found.id)
      }

      allPicked.push(...picked)
    })

    const ordered = intercalateExercises(allPicked)

    const routine = {
      name: `Generada: ${selectedMuscles.slice(0, 2).join(' + ')}`,
      exercises: ordered.map(e => ({
        id: e.id, exerciseId: e.id, name: e.name, level: e.level,
        muscle: e.muscle, sets: 3, repsScheme: '12', alt: e.alt,
      })),
      muscles: selectedMuscles,
      tipo: 'Fuerza',
    }
    setGenerated(routine)
    setSaved(false)
  }

  const saveAsPrearmada = async () => {
    if (!user || !generated) return
    await saveCustomRoutine(user.uid, generated)
    setSaved(true)
  }

  const useRoutine = () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const builtExercises = generated.exercises.map(e => ({
      exerciseId: e.id,
      name: e.name,
      muscle: e.muscle ?? '',
      sets: Array.from({ length: e.sets }, () => ({ reps: Number(e.repsScheme) || 12, weight: 0 })),
    }))
    setDraft({
      step: 1,
      type: 'fuerza',
      detail: {
        exercises: builtExercises,
        mode: 'prearmada',
        selectedMuscles: generated.muscles ?? [],
        selectedRoutine: '',
      },
      fatigue: 5,
      notes: '',
      date: dateStr,
    })
    navigate('/registro')
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-app-muted text-xs mb-2">Músculos a trabajar</p>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map(m => {
            const recent = recentMuscles.has(m)
            return (
              <button
                key={m}
                onClick={() => toggleMuscle(m)}
                className={`px-2.5 py-1.5 rounded-full text-xs border transition-all relative ${
                  selectedMuscles.includes(m)
                    ? 'border-app-purple bg-app-purple/20 text-app-purple-light'
                    : recent
                      ? 'border-app-amber/30 text-app-amber/60'
                      : 'border-white/10 text-app-muted'
                }`}
              >
                {m}
                {recent && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-app-amber" />}
              </button>
            )
          })}
        </div>
        <p className="text-app-muted text-[10px] mt-2">Punto ámbar = entrenado en últimas 72h</p>
      </div>

      <div>
        <p className="text-app-muted text-xs mb-2">Cantidad de ejercicios</p>
        <div className="flex gap-2">
          {COUNT_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => { setCount(n); setGenerated(null); setSaved(false) }}
              className={`flex-1 py-2 rounded-xl text-sm border transition-all ${
                count === n ? 'border-app-purple bg-app-purple/20 text-app-purple-light font-semibold' : 'border-white/10 text-app-muted'
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
          {EQUIP_OPTIONS.map(e => (
            <button
              key={e}
              onClick={() => setEquip(e)}
              className={`flex-1 py-2.5 rounded-xl text-xs border transition-all ${
                equip === e ? 'border-app-purple bg-app-purple/20 text-app-purple-light' : 'border-white/10 text-app-muted'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <Button size="lg" onClick={generate} disabled={selectedMuscles.length === 0}>
        Generar rutina
      </Button>

      {generated && (
        <Card className="animate-fadeIn">
          <p className="text-app-text font-semibold text-sm mb-3">{generated.name}</p>
          <div className="space-y-2 mb-4">
            {generated.exercises.map((ex, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <div>
                  <span className="text-app-purple-light/70 text-xs mr-2">{ex.level}</span>
                  <span className="text-app-text text-sm">{ex.name}</span>
                  <span className="text-app-muted/50 text-xs ml-2">{ex.muscle}</span>
                </div>
                <span className="text-app-muted text-xs">{ex.sets}×{ex.repsScheme}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={useRoutine} className="flex-1">
              Usar ahora
            </Button>
            <Button size="sm" variant="secondary" onClick={saveAsPrearmada} disabled={saved}>
              {saved ? 'Guardada ✓' : 'Guardar'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
