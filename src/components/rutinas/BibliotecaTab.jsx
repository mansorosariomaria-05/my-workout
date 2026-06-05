import { useState, useEffect } from 'react'
import { exercises, MUSCLE_GROUPS } from '../../data/exercises'
import { useAuthContext } from '../../context/AuthContext'
import { saveCustomExercise, getCustomExercises, deleteCustomExercise } from '../../services/db'
import Card from '../ui/Card'
import Button from '../ui/Button'

const GROUP_COLORS = {
  'Glúteos':            '#9B7FD4',
  'Isquios':            '#4A9EDB',
  'Cuádriceps':         '#40916C',
  'Abductores':         '#52B788',
  'Gemelos':            '#74B3CE',
  'Espalda':            '#7C5CBF',
  'Pecho':              '#C0533A',
  'Hombros':            '#D49A3A',
  'Tríceps':            '#1A4A7A',
  'Bíceps':             '#2D6A4F',
  'Abdominales':        '#534AB7',
  'Core & Estabilidad': '#1B4332',
}

const LEVEL_OPTIONS = [
  { value: 'A', label: 'A – Compuesto pesado' },
  { value: 'B', label: 'B – Compuesto secundario' },
  { value: 'C', label: 'C – Aislado' },
  { value: 'D', label: 'D – Core y estabilización' },
]

function ExerciseRow({ ex, isCustom, onDelete, history }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-white/5 last:border-0">
      <div
        className="flex items-center justify-between py-2.5 px-1 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-app-text text-sm truncate">{ex.zone ? `${ex.name} (${ex.zone})` : ex.name}</p>
            {isCustom && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-app-amber/20 text-app-amber border border-app-amber/30 flex-shrink-0">
                Personalizado
              </span>
            )}
          </div>
          <p className="text-app-muted text-xs">{ex.group ?? ex.muscle} · {ex.level}</p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {isCustom && (
            <button
              onClick={e => { e.stopPropagation(); onDelete?.() }}
              className="text-app-coral/60 text-xs p-1"
            >
              ✕
            </button>
          )}
          <span className="text-app-muted/50 text-xs">{expanded ? '↑' : '↓'}</span>
        </div>
      </div>
      {expanded && (
        <div className="pb-3 px-1 space-y-1.5 animate-fadeIn">
          {ex.equip && <p className="text-app-muted text-xs">Equipo: <span className="text-app-text">{ex.equip}</span></p>}
          {ex.alt && <p className="text-app-muted text-xs">Alternativa: <span className="text-app-text">{ex.alt}</span></p>}
          {ex.secondary && ex.secondary !== '—' && (
            <p className="text-app-muted text-xs">Secundario: <span className="text-app-text">{ex.secondary}</span></p>
          )}
          {history?.length > 0 && (
            <div>
              <p className="text-app-muted text-xs mb-1">Últimas sesiones:</p>
              {history.slice(0, 3).map((h, i) => (
                <p key={i} className="text-xs text-app-muted/70">
                  {h.date}: {h.sets?.map(s => `${s.reps}×${s.weight}kg`).join(', ')}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BibliotecaTab({ workouts }) {
  const { user } = useAuthContext()
  const [search, setSearch]             = useState('')
  const [openGroups, setOpenGroups]     = useState({})
  const [customExercises, setCustomEx]  = useState([])
  const [adding, setAdding]             = useState(false)
  const [newEx, setNewEx]               = useState({ name: '', muscle: MUSCLE_GROUPS[0], level: 'C', equip: '', alt: '' })

  useEffect(() => {
    if (!user) return
    getCustomExercises(user.uid).then(setCustomEx)
  }, [user])

  const getHistory = (exerciseId) =>
    workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === exerciseId))
      .slice(0, 3)
      .map(w => {
        const e = w.exercises.find(ex => ex.exerciseId === exerciseId)
        return { date: w.date, sets: e?.sets }
      })

  const addCustomEx = async () => {
    if (!newEx.name.trim()) return
    const ex = { ...newEx, id: `custom_${Date.now()}`, group: newEx.muscle }
    await saveCustomExercise(user.uid, ex)
    setCustomEx(p => [...p, ex])
    setNewEx({ name: '', muscle: MUSCLE_GROUPS[0], level: 'C', equip: '', alt: '' })
    setAdding(false)
  }

  const handleDeleteCustom = async (ex) => {
    if (!ex.id) return
    await deleteCustomExercise(user.uid, ex.id)
    setCustomEx(p => p.filter(x => x.id !== ex.id))
  }

  const allExercises = [...exercises, ...customExercises]
  const customIds = new Set(customExercises.map(e => e.id))

  const filtered = search
    ? allExercises.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.muscle ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : allExercises

  const toggleGroup = (g) => setOpenGroups(o => ({ ...o, [g]: !o[g] }))

  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar ejercicio..."
        className="w-full bg-app-surface border border-white/10 rounded-xl px-4 py-2.5 text-app-text text-sm placeholder-app-muted/40 focus:outline-none"
      />

      {search ? (
        <Card>
          {filtered.map(ex => (
            <ExerciseRow
              key={ex.id}
              ex={ex}
              isCustom={customIds.has(ex.id)}
              onDelete={() => handleDeleteCustom(ex)}
              history={getHistory(ex.id)}
            />
          ))}
          {filtered.length === 0 && <p className="text-app-muted text-sm text-center py-4">Sin resultados</p>}
        </Card>
      ) : (
        MUSCLE_GROUPS.map(group => {
          const groupEx = filtered.filter(e => (e.muscle ?? e.group) === group)
          if (!groupEx.length) return null
          const color = GROUP_COLORS[group] ?? '#9B7FD4'
          return (
            <Card key={group} className="p-0 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3"
                onClick={() => toggleGroup(group)}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-app-text text-sm font-medium">{group}</span>
                  <span className="text-app-muted text-xs">{groupEx.length}</span>
                </div>
                <span className="text-app-muted text-sm">{openGroups[group] ? '↑' : '↓'}</span>
              </button>
              {openGroups[group] && (
                <div className="px-4 pb-3 animate-fadeIn">
                  {groupEx.map(ex => (
                    <ExerciseRow
                      key={ex.id}
                      ex={ex}
                      isCustom={customIds.has(ex.id)}
                      onDelete={() => handleDeleteCustom(ex)}
                      history={getHistory(ex.id)}
                    />
                  ))}
                </div>
              )}
            </Card>
          )
        })
      )}

      {adding ? (
        <Card>
          <p className="text-app-text text-sm font-medium mb-3">Nuevo ejercicio</p>
          <div className="space-y-3">
            <div>
              <label className="text-app-muted text-xs mb-1 block">Nombre *</label>
              <input
                autoFocus
                value={newEx.name}
                onChange={e => setNewEx(n => ({ ...n, name: e.target.value }))}
                placeholder="Hip Thrust"
                className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-app-muted text-xs mb-1 block">Grupo muscular</label>
              <select
                value={newEx.muscle}
                onChange={e => setNewEx(n => ({ ...n, muscle: e.target.value }))}
                className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none"
              >
                {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-app-muted text-xs mb-1 block">Nivel</label>
              <select
                value={newEx.level}
                onChange={e => setNewEx(n => ({ ...n, level: e.target.value }))}
                className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none"
              >
                {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-app-muted text-xs mb-1 block">Equipamiento</label>
              <input
                value={newEx.equip}
                onChange={e => setNewEx(n => ({ ...n, equip: e.target.value }))}
                placeholder="Barra"
                className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-app-muted text-xs mb-1 block">Alternativa sin equipo</label>
              <input
                value={newEx.alt}
                onChange={e => setNewEx(n => ({ ...n, alt: e.target.value }))}
                placeholder="Puente de Glúteo"
                className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={addCustomEx} className="flex-1">Guardar</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 rounded-xl border border-dashed border-white/15 text-app-muted text-sm"
        >
          + Agregar ejercicio propio
        </button>
      )}
    </div>
  )
}
