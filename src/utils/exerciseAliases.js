import { exercises, canonicalExerciseId } from '../data/exercises.js'

// Traducción de ids de ejercicios fusionados (EXERCISE_ALIASES, en data/exercises.js) AL LEER.
// Funciones puras, sin React ni Firestore: nunca modifican el objeto recibido (devuelven una copia solo si
// algo cambió, y el mismo objeto si no) y nunca escriben nada. Los datos guardados en Firestore o en el
// almacenamiento local quedan con el id viejo; lo que ve el resto de la app ya viene con el id canónico.
// Ver LOGICA_TECNICA.md, sección "Alias de ejercicios".

const nameById = new Map(exercises.map(e => [e.id, e.name]))

// Un ejercicio dentro de un workout o del entrenamiento en curso: { exerciseId, originalExerciseId?, name, … }.
// Si cambia el exerciseId, el name pasa a ser el del catálogo; originalExerciseId (ejercicio reemplazado por
// su alternativa) solo se traduce.
export function normalizeExerciseEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry
  const { exerciseId, originalExerciseId } = entry
  const cid = exerciseId != null ? canonicalExerciseId(exerciseId) : exerciseId
  const coid = originalExerciseId != null ? canonicalExerciseId(originalExerciseId) : originalExerciseId
  if (cid === exerciseId && coid === originalExerciseId) return entry
  const out = { ...entry }
  if (cid !== exerciseId) {
    out.exerciseId = cid
    const name = nameById.get(cid)
    if (name) out.name = name
  }
  if (coid !== originalExerciseId) out.originalExerciseId = coid
  return out
}

// Workout: normaliza workout.exercises[]. Si una sesión vieja tiene los dos ejercicios del par, quedan DOS
// entradas con el mismo id canónico (no se fusionan las series).
export function normalizeWorkoutExercises(workout) {
  if (!workout || !Array.isArray(workout.exercises)) return workout
  let changed = false
  const exs = workout.exercises.map(e => {
    const n = normalizeExerciseEntry(e)
    if (n !== e) changed = true
    return n
  })
  return changed ? { ...workout, exercises: exs } : workout
}

// Lista de workouts: devuelve la MISMA lista (misma referencia) si ningún workout cambia.
export function normalizeWorkouts(list) {
  if (!Array.isArray(list)) return list
  let changed = false
  const out = list.map(w => {
    const n = normalizeWorkoutExercises(w)
    if (n !== w) changed = true
    return n
  })
  return changed ? out : list
}

// Lista de ids (favoritos, "never", ids pendientes): ids canónicos y sin duplicados, en el mismo orden.
export function normalizeIdList(ids) {
  if (!Array.isArray(ids)) return ids
  const seen = new Set()
  const out = []
  for (const id of ids) {
    const c = canonicalExerciseId(id)
    if (seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  return out
}

// Rutina personalizada: sus ejercicios guardan el id en `id` y/o `exerciseId`.
export function normalizeRoutine(routine) {
  if (!routine || !Array.isArray(routine.exercises)) return routine
  let changed = false
  const exs = routine.exercises.map(e => {
    if (!e || typeof e !== 'object') return e
    const id = e.id != null ? canonicalExerciseId(e.id) : e.id
    const exId = e.exerciseId != null ? canonicalExerciseId(e.exerciseId) : e.exerciseId
    if (id === e.id && exId === e.exerciseId) return e
    changed = true
    const out = { ...e }
    if (id !== e.id) out.id = id
    if (exId !== e.exerciseId) out.exerciseId = exId
    const name = nameById.get(exId ?? id)
    if (name && e.name != null) out.name = name
    return out
  })
  if (!changed) return routine
  // Una rutina que tenía los dos ejercicios del par queda con el canónico una sola vez.
  const seen = new Set()
  const unique = exs.filter(e => {
    const id = e && typeof e === 'object' ? (e.id ?? e.exerciseId) : null
    if (id == null) return true
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  return { ...routine, exercises: unique }
}

export const normalizeRoutines = (list) => (Array.isArray(list) ? list.map(normalizeRoutine) : list)

// Entrenamiento en curso ({ type, detail: { exercises, pendingGeneratedIds, … }, … }).
export function normalizeInProgress(draft) {
  if (!draft || typeof draft !== 'object' || !draft.detail) return draft
  const det = draft.detail
  let nextDet = det
  if (Array.isArray(det.exercises)) {
    let changed = false
    const exs = det.exercises.map(e => {
      const n = normalizeExerciseEntry(e)
      if (n !== e) changed = true
      return n
    })
    if (changed) nextDet = { ...nextDet, exercises: exs }
  }
  if (Array.isArray(det.pendingGeneratedIds)) {
    const ids = normalizeIdList(det.pendingGeneratedIds)
    if (ids.length !== det.pendingGeneratedIds.length || ids.some((id, i) => id !== det.pendingGeneratedIds[i])) {
      nextDet = { ...nextDet, pendingGeneratedIds: ids }
    }
  }
  return nextDet === det ? draft : { ...draft, detail: nextDet }
}
