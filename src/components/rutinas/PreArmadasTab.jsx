import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { builtinRoutines } from '../../data/routines'
import { exercises } from '../../data/exercises'
import { useExercises } from '../../hooks/useExercises'
import { useAuthContext } from '../../context/AuthContext'
import { getCustomRoutines, saveCustomRoutine, updateCustomRoutine, deleteCustomRoutine } from '../../services/db'
import Button from '../ui/Button'
import Card from '../ui/Card'

function RoutineCard({ routine, lastDate, onUse, onDelete, onEdit, onDuplicate }) {
  const [expanded, setExpanded] = useState(false)
  const exEntries = (routine.exercises ?? []).map(e => {
    const id = e.id ?? e.exerciseId
    const ref = exercises.find(ex => ex.id === id)
    return { id, name: ref?.name ?? id, muscle: e.muscle ?? ref?.muscle ?? '', alt: e.alt ?? ref?.alt ?? '', nota: e.nota ?? '' }
  })

  return (
    <Card className="mb-3">
      <div className="flex items-start justify-between" onClick={() => setExpanded(e => !e)}>
        <div>
          <p className="text-app-text font-semibold text-sm">{routine.name}</p>
          {routine.subtitle && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{routine.subtitle}</p>}
          {lastDate && <p className="text-app-muted text-xs mt-0.5">Última vez: {lastDate}</p>}
          <p className="text-app-muted text-xs mt-0.5">{routine.exercises?.length ?? 0} ejercicios</p>
        </div>
        <span className="text-app-muted text-sm">{expanded ? '↑' : '↓'}</span>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="space-y-2.5 mb-3">
            {exEntries.map((ex, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-app-purple-light/60 text-xs w-4 pt-0.5">{i + 1}</span>
                <div>
                  <p className="text-app-text text-xs font-medium">{ex.name}</p>
                  {ex.muscle && <p className="text-xs" style={{ color: '#94A3B8' }}>{ex.muscle}</p>}
                  {ex.alt && <p className="text-xs" style={{ color: '#6B7280' }}>Alt: {ex.alt}</p>}
                  {ex.nota && <p className="text-xs mt-0.5" style={{ color: '#D49A3A' }}>{ex.nota}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => onUse(routine)} className="flex-1">
              Usar esta rutina
            </Button>
            {onDuplicate && (
              <Button size="sm" variant="ghost" onClick={onDuplicate}>
                Duplicar y editar
              </Button>
            )}
            {onEdit && (
              <Button size="sm" variant="ghost" onClick={onEdit}>
                Editar
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="danger" onClick={() => onDelete(routine.id)}>
                Eliminar
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

function RoutineEditor({ routine, onSave, onCancel, uid }) {
  const allExercises = useExercises(uid)
  const [name, setName]         = useState(routine.name)
  const [exList, setExList]     = useState(
    (routine.exercises ?? []).map(e => {
      const id  = e.id ?? e.exerciseId
      const ref = exercises.find(ex => ex.id === id)
      return {
        id,
        suggestedSets: e.suggestedSets ?? 3,
        alt:   e.alt   ?? ref?.alt   ?? '',
        level: e.level ?? ref?.level ?? 'B',
      }
    })
  )
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch]         = useState('')
  const [saving, setSaving]         = useState(false)

  const moveUp = (i) => {
    if (i === 0) return
    const l = [...exList]
    ;[l[i - 1], l[i]] = [l[i], l[i - 1]]
    setExList(l)
  }
  const moveDown = (i) => {
    if (i === exList.length - 1) return
    const l = [...exList]
    ;[l[i], l[i + 1]] = [l[i + 1], l[i]]
    setExList(l)
  }
  const removeEx  = (i) => setExList(l => l.filter((_, idx) => idx !== i))
  const updateEx  = (i, field, val) =>
    setExList(l => l.map((e, idx) => idx === i ? { ...e, [field]: val } : e))

  const addExercise = (ex) => {
    if (exList.some(e => e.id === ex.id)) return
    setExList(l => [...l, { id: ex.id, suggestedSets: 3, alt: ex.alt ?? '', level: ex.level ?? 'B' }])
    setSearch('')
    setShowSearch(false)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ ...routine, name: name.trim(), exercises: exList })
    setSaving(false)
  }

  const filtered = search.trim()
    ? allExercises
        .filter(e =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          (e.muscle ?? '').toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 12)
    : []

  return (
    <Card className="mb-3">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nombre de la rutina"
        className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none focus:border-app-purple/50 mb-4"
      />

      {exList.length > 0 && (
        <div className="space-y-2 mb-3">
          {exList.map((entry, i) => {
            const ref = allExercises.find(e => e.id === entry.id)
            return (
              <div key={i} className="bg-app-bg rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-app-text text-xs font-medium flex-1 truncate">
                    {ref?.name ?? entry.id}
                  </span>
                  <button
                    onClick={() => moveUp(i)} disabled={i === 0}
                    className={`w-7 h-7 flex items-center justify-center text-sm rounded-lg ${
                      i === 0 ? 'text-app-muted/20' : 'text-app-muted bg-app-elevated'
                    }`}
                  >↑</button>
                  <button
                    onClick={() => moveDown(i)} disabled={i === exList.length - 1}
                    className={`w-7 h-7 flex items-center justify-center text-sm rounded-lg ${
                      i === exList.length - 1 ? 'text-app-muted/20' : 'text-app-muted bg-app-elevated'
                    }`}
                  >↓</button>
                  <button
                    onClick={() => removeEx(i)}
                    className="w-7 h-7 flex items-center justify-center text-xs text-app-coral/70 bg-app-coral/10 rounded-lg"
                  >✕</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-app-muted text-[9px] mb-1">Series</p>
                    <input
                      type="number" min="1" max="10"
                      value={entry.suggestedSets}
                      onChange={e => updateEx(i, 'suggestedSets', Math.max(1, Number(e.target.value)))}
                      className="w-full bg-app-elevated border border-white/8 rounded-lg px-2 py-1.5 text-app-text text-xs text-center focus:outline-none"
                    />
                  </div>
                  <div>
                    <p className="text-app-muted text-[9px] mb-1">Nivel</p>
                    <select
                      value={entry.level}
                      onChange={e => updateEx(i, 'level', e.target.value)}
                      className="w-full bg-app-elevated border border-white/8 rounded-lg px-1 py-1.5 text-app-text text-xs focus:outline-none"
                    >
                      {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-app-muted text-[9px] mb-1">Alt sin equipo</p>
                    <input
                      value={entry.alt}
                      onChange={e => updateEx(i, 'alt', e.target.value)}
                      placeholder="—"
                      className="w-full bg-app-elevated border border-white/8 rounded-lg px-2 py-1.5 text-app-text text-[10px] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showSearch ? (
        <div className="mb-3 bg-app-bg rounded-xl p-3 border border-white/8">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ejercicio..."
            className="w-full bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none mb-2"
          />
          {filtered.length > 0 ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filtered.map(ex => {
                const added = exList.some(e => e.id === ex.id)
                return (
                  <button
                    key={ex.id}
                    onClick={() => !added && addExercise(ex)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between ${
                      added
                        ? 'bg-app-purple/10 text-app-purple-light border border-app-purple/20'
                        : 'bg-app-elevated border border-white/5 text-app-text'
                    }`}
                  >
                    <span className="font-medium">{ex.name}</span>
                    <span className="text-app-muted/60 text-[10px]">{ex.muscle}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-app-muted/50 text-xs text-center py-2">
              {search ? 'Sin resultados' : 'Escribí para buscar...'}
            </p>
          )}
          <button
            onClick={() => { setShowSearch(false); setSearch('') }}
            className="w-full mt-2 text-app-muted text-xs py-1 text-center"
          >
            Cancelar búsqueda
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-white/15 text-app-muted text-sm mb-3"
        >
          + Agregar ejercicio
        </button>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="flex-1">
          {saving ? 'Guardando...' : 'Guardar rutina'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </Card>
  )
}

export default function PreArmadasTab({ workouts }) {
  const { user }   = useAuthContext()
  const navigate   = useNavigate()
  const [customRoutines, setCustomRoutines] = useState([])
  const [creating, setCreating]             = useState(false)
  const [newName, setNewName]               = useState('')
  const [editingRoutine, setEditingRoutine] = useState(null)

  useEffect(() => {
    if (user) getCustomRoutines(user.uid).then(setCustomRoutines)
  }, [user])

  const getLastDate = (routineId) => {
    const w = workouts.find(w => w.selectedRoutine === routineId || w.routineId === routineId)
    return w?.date ?? null
  }

  const useRoutine = (routine) => {
    navigate('/registro', { state: { type: 'fuerza', routineId: routine.id, routineName: routine.name } })
  }

  const deleteCustom = async (id) => {
    await deleteCustomRoutine(user.uid, id)
    setCustomRoutines(r => r.filter(x => x.id !== id))
  }

  const duplicateBuiltin = (routine) => {
    setEditingRoutine({
      id: null,
      name: routine.name + ' (copia)',
      exercises: (routine.exercises ?? []).map(e => {
        const id  = e.id ?? e.exerciseId
        const ref = exercises.find(ex => ex.id === id)
        return { id, suggestedSets: e.suggestedSets ?? 3, alt: e.alt ?? ref?.alt ?? '', level: e.level ?? ref?.level ?? 'B' }
      }),
    })
    setCreating(false)
  }

  const editCustom = (routine) => {
    setEditingRoutine({
      ...routine,
      exercises: (routine.exercises ?? []).map(e => {
        const id  = e.id ?? e.exerciseId
        const ref = exercises.find(ex => ex.id === id)
        return { id, suggestedSets: e.suggestedSets ?? 3, alt: e.alt ?? '', level: e.level ?? ref?.level ?? 'B' }
      }),
    })
    setCreating(false)
  }

  const saveRoutine = async (updated) => {
    const { id, ...data } = updated
    if (!id) {
      await saveCustomRoutine(user.uid, { name: data.name, exercises: data.exercises })
    } else {
      await updateCustomRoutine(user.uid, id, { name: data.name, exercises: data.exercises })
    }
    const refreshed = await getCustomRoutines(user.uid)
    setCustomRoutines(refreshed)
    setEditingRoutine(null)
  }

  const createRoutine = async () => {
    if (!newName.trim()) return
    await saveCustomRoutine(user.uid, { name: newName.trim(), exercises: [] })
    const updated = await getCustomRoutines(user.uid)
    setCustomRoutines(updated)
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="space-y-2">
      <p className="text-app-muted text-xs px-1 pb-1">Rutinas del programa</p>
      {builtinRoutines.map(r => (
        <RoutineCard
          key={r.id}
          routine={r}
          lastDate={getLastDate(r.id)}
          onUse={useRoutine}
          onDuplicate={() => duplicateBuiltin(r)}
        />
      ))}

      {(customRoutines.length > 0 || editingRoutine) && (
        <p className="text-app-muted text-xs px-1 pt-2 pb-1">Mis rutinas</p>
      )}

      {customRoutines.map(r => (
        editingRoutine?.id === r.id ? (
          <RoutineEditor
            key={r.id}
            routine={editingRoutine}
            onSave={saveRoutine}
            onCancel={() => setEditingRoutine(null)}
            uid={user.uid}
          />
        ) : (
          <RoutineCard
            key={r.id}
            routine={r}
            lastDate={getLastDate(r.id)}
            onUse={useRoutine}
            onEdit={() => editCustom(r)}
            onDelete={deleteCustom}
          />
        )
      ))}

      {editingRoutine && !editingRoutine.id && (
        <RoutineEditor
          routine={editingRoutine}
          onSave={saveRoutine}
          onCancel={() => setEditingRoutine(null)}
          uid={user.uid}
        />
      )}

      {creating ? (
        <Card>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nombre de la rutina"
            className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none mb-3"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={createRoutine} className="flex-1">Crear</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => { setCreating(true); setEditingRoutine(null) }}
          className="w-full py-3 rounded-xl border border-dashed border-white/15 text-app-muted text-sm"
        >
          + Crear rutina personalizada
        </button>
      )}
    </div>
  )
}
