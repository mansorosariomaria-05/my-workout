import { REAL_WORKOUT_TYPES } from './streak.js'
import { parseLocalDate, dateToLocal } from './dates.js'
import { builtinRoutines } from '../data/routines.js'
import { generateRoutine } from './routineGenerator.js'

const LOWER = ['Glúteos', 'Isquios', 'Cuádriceps']
const UPPER = ['Espalda', 'Pecho', 'Hombros']
const FOCUS_MUSCLES = [...LOWER, ...UPPER]
const MAX_DAYS_SINCE = 14

const addDays = (dateStr, n) => {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + n)
  return dateToLocal(d)
}

const mondayOf = (dateStr) => {
  const d = parseLocalDate(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return dateToLocal(d)
}

// Músculos de un workout de fuerza: originalMuscle (si se hizo swap a alt) o muscle de cada
// ejercicio, más muscleGroups (redundante con lo anterior pero cubre workouts viejos sin exercises).
const musclesOfWorkout = (w) => [
  ...(w.exercises ?? []).map(e => e.originalMuscle ?? e.muscle).filter(Boolean),
  ...(w.muscleGroups ?? []),
]

const daysBetween = (fromStr, toStr) =>
  Math.round((parseLocalDate(toStr) - parseLocalDate(fromStr)) / 86400000)

function reasonFor(muscle, weekCount, daysSince) {
  if (weekCount[muscle] === 0) return `${muscle}: 0 veces esta semana`
  return `${muscle}: ${daysSince[muscle]} días sin entrenar`
}

// Sugerencia diaria — función pura, sin fetch, evaluada contra el historial ya cargado en memoria
// (workouts de useWorkouts) en vez de pedirle su propio fetch a Firestore. Fechas siempre como
// strings 'YYYY-MM-DD' locales.
//
// workouts: array completo del usuario (todos los tipos). profile: perfil de AuthContext (o null).
// today: 'YYYY-MM-DD' — inyectado en vez de calculado adentro, para que sea testeable con fechas fijas.
export function computeDailySuggestion({ workouts, profile, today }) {
  const real = (workouts ?? []).filter(w => w.date && REAL_WORKOUT_TYPES.includes(w.type))
  const isFirstEver = real.length === 0

  // a) Ya entrenó hoy.
  if (real.some(w => w.date === today)) return { type: 'trained_today' }

  const mondayStr  = mondayOf(today)
  const yesterday  = addDays(today, -1)
  const twoDaysAgo = addDays(today, -2)
  const threeDaysAgo = addDays(today, -3)
  const dayOfWeek = parseLocalDate(today).getDay()

  // b) Descanso inteligente (reemplaza el domingo fijo).
  const weekDatesSoFar = new Set(
    real.filter(w => w.date >= mondayStr && w.date <= yesterday).map(w => w.date)
  )
  const diasObjetivo = profile?.diasSemana ?? 3
  if (weekDatesSoFar.size >= diasObjetivo) {
    return { type: 'descanso', sub: `Ya cumpliste tus ${diasObjetivo} días de la semana 💜` }
  }

  const trainedOn = (dateStr) => real.some(w => w.date === dateStr)
  if (trainedOn(yesterday) && trainedOn(twoDaysAgo) && trainedOn(threeDaysAgo)) {
    return { type: 'descanso', sub: 'Llevás 3 días seguidos. Tu cuerpo se recupera descansando.' }
  }

  // c) Balance cardio/fuerza de la semana — misma regla que el PASO 1 anterior, sin cambios.
  const thisWeek = real.filter(w => w.date >= mondayStr && w.date < today)
  const cardioCount = thisWeek.filter(w => w.type === 'cardio' || w.type === 'clase').length
  const fuerzaCount = thisWeek.filter(w => w.type === 'fuerza').length
  const remainingWorkingDays = 7 - dayOfWeek

  let suggestCardio = false
  if (cardioCount === 0 && fuerzaCount >= 2) suggestCardio = true
  else if (cardioCount === 1 && remainingWorkingDays <= 2) suggestCardio = true
  if (suggestCardio) return { type: 'cardio' }

  // d) Elegir músculos de fuerza foco (solo LOWER/UPPER — nunca gemelos/abductores/brazos/core).
  const fuerzaReal = real.filter(w => w.type === 'fuerza')

  const recent = new Set()
  fuerzaReal
    .filter(w => w.date === yesterday || w.date === twoDaysAgo)
    .forEach(w => musclesOfWorkout(w).forEach(m => recent.add(m)))

  const weekCount = {}
  const daysSince = {}
  FOCUS_MUSCLES.forEach(m => {
    const weekDates = new Set(
      fuerzaReal
        .filter(w => w.date >= mondayStr && w.date <= yesterday && musclesOfWorkout(w).includes(m))
        .map(w => w.date)
    )
    weekCount[m] = weekDates.size

    let latest = null
    fuerzaReal.forEach(w => {
      if (musclesOfWorkout(w).includes(m) && (!latest || w.date > latest)) latest = w.date
    })
    daysSince[m] = latest ? Math.min(MAX_DAYS_SINCE, daysBetween(latest, today)) : MAX_DAYS_SINCE
  })

  const byPriority = (muscles) => [...muscles].sort((a, b) =>
    (weekCount[a] - weekCount[b]) || (daysSince[b] - daysSince[a]) || (FOCUS_MUSCLES.indexOf(a) - FOCUS_MUSCLES.indexOf(b))
  )
  const eligibleLower = byPriority(LOWER.filter(m => !recent.has(m)))
  const eligibleUpper = byPriority(UPPER.filter(m => !recent.has(m)))

  let chosenMuscles = null
  if (eligibleLower.length && eligibleUpper.length) {
    chosenMuscles = [eligibleLower[0], eligibleUpper[0]]
  } else if (!eligibleLower.length && eligibleUpper.length >= 2) {
    chosenMuscles = eligibleUpper.slice(0, 2)
  } else if (!eligibleUpper.length && eligibleLower.length >= 2) {
    chosenMuscles = eligibleLower.slice(0, 2)
  }

  if (!chosenMuscles) {
    return { type: 'descanso', sub: 'Tus músculos se están recuperando de los últimos días.' }
  }

  const [m1, m2] = chosenMuscles
  const reason = chosenMuscles.map(m => reasonFor(m, weekCount, daysSince)).join(' · ')
  const firstEverSub = isFirstEver ? { sub: '¡Tu primer entrenamiento! 💜' } : {}

  // e) Prearmada solo si encaja exactamente (contiene los 2 músculos elegidos y ninguno de sus
  // músculos extra está en `recent`) — entre varias, la de menos músculos extra.
  const matching = builtinRoutines
    .filter(r => {
      const rm = r.muscles ?? []
      return rm.includes(m1) && rm.includes(m2) && !rm.some(m => recent.has(m))
    })
    .sort((a, b) => (a.muscles?.length ?? 0) - (b.muscles?.length ?? 0))

  if (matching.length) {
    const routine = matching[0]
    return { type: 'fuerza', routineId: routine.id, routineName: routine.name, muscles: chosenMuscles, reason, ...firstEverSub }
  }

  // f) Si ninguna prearmada encaja, se genera con el mismo algoritmo del generador de rutinas.
  const generated = generateRoutine({ muscles: chosenMuscles, count: 5, equip: 'Gym completo', workouts })
  return {
    type: 'fuerza',
    generatedIds: generated.map(e => e.id),
    title: `${m1} + ${m2}`,
    muscles: chosenMuscles,
    reason,
    ...firstEverSub,
  }
}
