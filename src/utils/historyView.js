// Lógica pura de la pestaña Historial: lista de sesiones agrupada por mes. Sin React ni Firestore.
//
// Solo cuentan los workouts REAL_WORKOUT_TYPES con fecha (incluido 'tabata': los históricos se siguen viendo).
// Orden: del más reciente al más antiguo (a igual fecha se respeta el orden de entrada).

import { REAL_WORKOUT_TYPES } from './streak.js'
import { MONTH_NAMES } from './progressView.js'

const REAL = new Set(REAL_WORKOUT_TYPES)

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Pesos máximos por ejercicio de una sesión de fuerza: Map exerciseId → peso máximo (> 0).
function maxWeights(workout) {
  const out = new Map()
  for (const ex of workout.exercises ?? []) {
    if (!ex.exerciseId || !ex.sets?.length) continue
    const max = Math.max(0, ...ex.sets.map(s => Number(s.weight) || 0))
    if (max > 0) out.set(ex.exerciseId, Math.max(out.get(ex.exerciseId) ?? 0, max))
  }
  return out
}

// Ids (índices de `workouts`) de las sesiones de fuerza que superaron su máximo anterior en algún ejercicio.
// Misma regla que detectPRs (prUtils.js): el máximo previo es el de las sesiones de fuerza con fecha ESTRICTAMENTE
// anterior, y solo es récord si había un máximo previo > 0 (la primera vez que se hace un ejercicio no es PR).
// Se calcula en una sola pasada cronológica (O(n)) en vez de re-filtrar todo el historial por cada sesión.
export function findPRWorkouts(workouts) {
  const fuerza = workouts
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.type === 'fuerza' && w.date)
    .sort((a, b) => a.w.date.localeCompare(b.w.date))

  const prevMax = new Map() // exerciseId → máximo de las fechas anteriores
  const prs = new Set()
  for (let start = 0; start < fuerza.length;) {
    let end = start
    while (end < fuerza.length && fuerza[end].w.date === fuerza[start].w.date) end++
    const day = fuerza.slice(start, end)
    // Primero se evalúa todo el día contra el pasado; recién después se actualiza el máximo.
    const dayMaxes = day.map(({ w }) => maxWeights(w))
    day.forEach(({ i }, k) => {
      for (const [id, max] of dayMaxes[k]) {
        const prev = prevMax.get(id) ?? 0
        if (prev > 0 && max > prev) { prs.add(i); break }
      }
    })
    for (const m of dayMaxes) for (const [id, max] of m) prevMax.set(id, Math.max(prevMax.get(id) ?? 0, max))
    start = end
  }
  return prs
}

// Sesiones reales, más recientes primero: [{ workout, hasPR }].
export function computeSessionList(workouts) {
  const prs = findPRWorkouts(workouts)
  return workouts
    .map((workout, i) => ({ workout, i }))
    .filter(({ workout }) => REAL.has(workout.type) && workout.date)
    .sort((a, b) => b.workout.date.localeCompare(a.workout.date) || a.i - b.i)
    .map(({ workout, i }) => ({ workout, hasPR: prs.has(i) }))
}

// Agrupa por mes calendario, del más reciente al más antiguo:
// [{ key: '2026-11', label: 'Noviembre 2026', count, sessions: [{ workout, hasPR }] }]
export function groupSessionsByMonth(workouts) {
  const groups = []
  const byKey = new Map()
  for (const s of computeSessionList(workouts)) {
    const key = s.workout.date.slice(0, 7)
    let g = byKey.get(key)
    if (!g) {
      const month = MONTH_NAMES[Number(key.slice(5, 7)) - 1]
      g = { key, label: `${capitalize(month ?? key)} ${key.slice(0, 4)}`, count: 0, sessions: [] }
      byKey.set(key, g)
      groups.push(g)
    }
    g.sessions.push(s)
    g.count++
  }
  return groups
}
