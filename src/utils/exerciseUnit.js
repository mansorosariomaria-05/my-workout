import { exercises } from '../data/exercises.js'

// Unidad en la que se mide un ejercicio: 'reps' (repeticiones) o 'secs' (segundos de mantenimiento).
// Los segundos se guardan en el campo `reps` de cada serie (compatibilidad con el historial); la unidad
// vive aparte, en el catálogo (`unit`) y, desde noviembre 2026, en cada ejercicio guardado dentro del workout.
export const UNITS = ['reps', 'secs']

const byId   = new Map(exercises.map(e => [e.id, e]))
const byName = new Map(exercises.map(e => [e.name, e]))

const isUnit = (u) => u === 'reps' || u === 'secs'

// getExerciseUnit(exercise) → 'reps' | 'secs'. `exercise` puede ser un ejercicio del catálogo, uno
// guardado dentro de un workout ({ exerciseId, name, unit, sets… }) o un ejercicio propio del usuario.
// Orden de búsqueda:
//   1. `unit` guardada en el propio registro
//   2. catálogo por id (`exerciseId` o `id`)
//   3. catálogo por nombre EXACTO (ids `alt-…` y alternativas que existen en el catálogo)
//   4. 'reps'
// Nunca se deduce por substring del nombre.
export function getExerciseUnit(exercise) {
  if (!exercise) return 'reps'
  if (isUnit(exercise.unit)) return exercise.unit
  const id = exercise.exerciseId ?? exercise.id
  const byIdEntry = id != null ? byId.get(id) : null
  if (byIdEntry) return isUnit(byIdEntry.unit) ? byIdEntry.unit : 'reps'
  const byNameEntry = exercise.name != null ? byName.get(exercise.name) : null
  if (byNameEntry) return isUnit(byNameEntry.unit) ? byNameEntry.unit : 'reps'
  return 'reps'
}

export const isSecs = (exercise) => getExerciseUnit(exercise) === 'secs'

// Segundos que se precargan en un ejercicio en 'secs' que no tiene historial.
export const DEFAULT_SECS = 30

// Texto de una serie para historiales y resúmenes. Si el peso es 0, vacío, "" o no numérico, NO se muestra
// ("· 0 kg" / "· kg"). Estilos:
//   'times' (compacto, por defecto): "12×20 kg" · "12 reps" · "45 seg × 10 kg" · "45 seg"
//   'dot'   (listado largo):         "12 reps · 20 kg" · "12 reps" · "45 seg · 10 kg" · "45 seg"
export function formatSetText(set, unit = 'reps', style = 'times') {
  const value  = set?.reps ?? 0
  const weight = Number(set?.weight) || 0
  const base   = unit === 'secs' ? `${value} seg` : `${value} reps`
  if (!(weight > 0)) return base
  if (style === 'dot') return `${base} · ${weight} kg`
  return unit === 'secs' ? `${base} × ${weight} kg` : `${value}×${weight} kg`
}
