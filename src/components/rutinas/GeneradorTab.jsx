import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MUSCLE_GROUPS } from '../../data/exercises'
import { getExerciseUnit } from '../../utils/exerciseUnit'
import {
  generateRoutine, MUSCLE_BLOCKS, blockedMuscles, toggleGeneratorBlock, generatorCountOptions,
  generatorRoutineName, generatedRoutineMuscles,
} from '../../utils/routineGenerator'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkoutDraft } from '../../context/WorkoutDraftContext'
import { saveCustomRoutine } from '../../services/db'
import Button from '../ui/Button'
import Card from '../ui/Card'

const EQUIP_OPTIONS = ['Gym completo', 'Solo básico']

export default function GeneradorTab({ workouts }) {
  const { user } = useAuthContext()
  const { setDraft } = useWorkoutDraft()
  const navigate = useNavigate()
  const [selectedMuscles, setSelectedMuscles] = useState([])
  const [selectedBlocks, setSelectedBlocks]   = useState([])
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

  // Los chips de los músculos que incluye un grupo elegido quedan deshabilitados (y se quitan si estaban elegidos).
  const blocked = blockedMuscles(selectedBlocks)
  const countOptions = generatorCountOptions(selectedBlocks)

  const toggleMuscle = (m) => {
    if (blocked.has(m)) return
    setSelectedMuscles(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])
    setGenerated(null)
    setSaved(false)
  }

  const toggleBlock = (id) => {
    const next = toggleGeneratorBlock({ blocks: selectedBlocks, muscles: selectedMuscles, count }, id)
    setSelectedBlocks(next.blocks)
    setSelectedMuscles(next.muscles)
    setCount(next.count)
    setGenerated(null)
    setSaved(false)
  }

  const generate = (regenerate = false) => {
    if (!selectedMuscles.length && !selectedBlocks.length) return

    const ordered = generateRoutine({ muscles: selectedMuscles, blocks: selectedBlocks, count, equip, workouts, regenerate })

    const routine = {
      name: generatorRoutineName(selectedBlocks, selectedMuscles),
      exercises: ordered.map(e => ({
        id: e.id, exerciseId: e.id, name: e.name, level: e.level,
        muscle: e.muscle, sets: 3, repsScheme: getExerciseUnit(e) === 'secs' ? '30 seg' : '12', alt: e.alt,
      })),
      muscles: generatedRoutineMuscles(selectedMuscles, ordered),
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

  // La precarga real (última sesión real de cada ejercicio) la arma FuerzaFlow con
  // buildEntry al montar — acá solo se pasan los ids elegidos, no sets ya construidos.
  const useRoutine = () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setDraft({
      step: 1,
      type: 'fuerza',
      detail: {
        exercises: [],
        mode: 'libre',
        selectedMuscles: generated.muscles ?? [],
        selectedRoutine: '',
        pendingGeneratedIds: generated.exercises.map(e => e.id),
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
        <p className="text-app-muted text-xs mb-2">Grupos</p>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_BLOCKS.map(b => (
            <button
              key={b.id}
              onClick={() => toggleBlock(b.id)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                selectedBlocks.includes(b.id)
                  ? 'border-app-purple bg-app-purple/20 text-app-purple-light font-semibold'
                  : 'border-white/10 text-app-muted'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-app-muted text-xs mb-2">Músculos a trabajar</p>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map(m => {
            const recent = recentMuscles.has(m)
            const isBlocked = blocked.has(m)
            return (
              <button
                key={m}
                onClick={() => toggleMuscle(m)}
                disabled={isBlocked}
                className={`px-2.5 py-1.5 rounded-full text-xs border transition-all relative ${
                  isBlocked
                    ? 'border-white/5 text-app-muted/30 opacity-50 cursor-not-allowed'
                    : selectedMuscles.includes(m)
                    ? 'border-app-purple bg-app-purple/20 text-app-purple-light'
                    : recent
                      ? 'border-app-amber/30 text-app-amber/60'
                      : 'border-white/10 text-app-muted'
                }`}
              >
                {m}
                {recent && !isBlocked && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-app-amber" />}
              </button>
            )
          })}
        </div>
        <p className="text-app-muted text-[10px] mt-2">Punto ámbar = entrenado en últimas 72h</p>
      </div>

      <div>
        <p className="text-app-muted text-xs mb-2">Cantidad de ejercicios</p>
        <div className="flex gap-2">
          {countOptions.map(n => (
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

      <Button size="lg" onClick={() => generate(false)} disabled={selectedMuscles.length === 0 && selectedBlocks.length === 0}>
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
            <Button size="sm" variant="secondary" onClick={() => generate(true)}>
              Regenerar
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
