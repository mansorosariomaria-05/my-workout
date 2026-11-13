import { REAL_WORKOUT_TYPES } from './streak.js'
import { parseLocalDate, dateToLocal } from './dates.js'
import { builtinRoutines } from '../data/routines.js'
import { generateRoutine } from './routineGenerator.js'
import { buildReturnSuggestion } from './returnRoutine.js'
import { normalizeIdList } from './exerciseAliases.js'

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
//
// neverIds: lista "never" del usuario, solo la usa la rutina de regreso. skipReturn: true cuando el
// usuario tocó "Hoy no" en la tarjeta de regreso — muestra la sugerencia normal por el resto del día.
export function computeDailySuggestion({ workouts, profile, today, neverIds = [], skipReturn = false }) {
  const real = (workouts ?? []).filter(w => w.date && REAL_WORKOUT_TYPES.includes(w.type))
  const isFirstEver = real.length === 0

  // a) Ya entrenó hoy.
  if (real.some(w => w.date === today)) return { type: 'trained_today' }

  // a2) Rutina de regreso: 15+ días desde el último workout de FUERZA (cardio/clase/tabata no cuentan)
  // reemplaza a la sugerencia normal. Ver returnRoutine.js.
  if (!skipReturn) {
    const regreso = buildReturnSuggestion({ workouts, profile, today, neverIds })
    if (regreso) return regreso
  }

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

  // d–f) Músculos foco, prearmada o generada: ver pickStrengthSuggestion (compartida con computeStrengthAlternative).
  const pick = pickStrengthSuggestion({ real, workouts, today })
  if (!pick) return { type: 'descanso', sub: 'Tus músculos se están recuperando de los últimos días.' }
  return { ...pick, ...(isFirstEver ? { sub: '¡Tu primer entrenamiento! 💜' } : {}) }
}

// Cantidad mínima de ejercicios de una rutina de fuerza generada por la sugerencia diaria.
export const STRENGTH_MIN_EXERCISES = 5

// Pasos d), e) y f) de la sugerencia diaria, compartidos por computeDailySuggestion y computeStrengthAlternative.
//   d) Elegir músculos de fuerza foco (solo LOWER/UPPER — nunca gemelos/abductores/brazos/core): sin los entrenados
//      ayer o anteayer, ordenados por weekCount ascendente y daysSince descendente (tope 14).
//   e) Prearmada solo si encaja exactamente (contiene los 2 músculos elegidos y ninguno de sus músculos extra está en
//      `recent`) — entre varias, la de menos músculos extra.
//   f) Si ninguna prearmada encaja, se genera con el mismo algoritmo del generador de rutinas.
// Devuelve la rama 'fuerza' ({ type, routineId, routineName, muscles, reason } o { type, generatedIds, title, muscles,
// reason }) o null si no hay con qué armarla. No incluye ningún chequeo de días cumplidos, 3 días seguidos ni balance
// cardio/fuerza (eso es de computeDailySuggestion).
//   allowSingle: si queda UN solo músculo elegible, arma la rutina generada con ese músculo (la sugerencia normal
//     pide al menos dos y devuelve null).
function pickStrengthSuggestion({ real, workouts, today, allowSingle = false, minCount = STRENGTH_MIN_EXERCISES }) {
  const mondayStr  = mondayOf(today)
  const yesterday  = addDays(today, -1)
  const twoDaysAgo = addDays(today, -2)

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
  } else if (allowSingle && eligibleLower.length + eligibleUpper.length === 1) {
    chosenMuscles = [...eligibleLower, ...eligibleUpper]
  }

  if (!chosenMuscles) return null

  const [m1, m2] = chosenMuscles
  const reason = chosenMuscles.map(m => reasonFor(m, weekCount, daysSince)).join(' · ')

  // e) (solo con dos músculos: las prearmadas se definen por pares)
  if (m2) {
    const matching = builtinRoutines
      .filter(r => {
        const rm = r.muscles ?? []
        return rm.includes(m1) && rm.includes(m2) && !rm.some(m => recent.has(m))
      })
      .sort((a, b) => (a.muscles?.length ?? 0) - (b.muscles?.length ?? 0))

    if (matching.length) {
      const routine = matching[0]
      return { type: 'fuerza', routineId: routine.id, routineName: routine.name, muscles: chosenMuscles, reason }
    }
  }

  // f) Generada, con al menos STRENGTH_MIN_EXERCISES ejercicios.
  const generated = generateRoutine({ muscles: chosenMuscles, count: Math.max(STRENGTH_MIN_EXERCISES, minCount), equip: 'Gym completo', workouts })
  return {
    type: 'fuerza',
    generatedIds: generated.map(e => e.id),
    title: chosenMuscles.join(' + '),
    muscles: chosenMuscles,
    reason,
  }
}

// Alternativa de fuerza para los días en que la sugerencia es cardio o descanso (botón "Rutina de Fuerza" de la
// tarjeta de Inicio). Función pura. Reutiliza los pasos d), e) y f) de computeDailySuggestion y se saltea los
// chequeos de días cumplidos, 3 días seguidos y balance cardio/fuerza. La rutina generada tiene mínimo 5 ejercicios.
//   · Dos o más músculos elegibles → igual que la sugerencia normal (prearmada que encaje, o generada).
//   · Un solo músculo elegible → rutina generada con ese músculo.
//   · Ninguno (todos los grupos foco entrenados ayer o anteayer) → { type: 'none', reason }.
// profile no se usa hoy; queda en la firma por simetría con computeDailySuggestion.
export function computeStrengthAlternative({ workouts, profile, today }) { // eslint-disable-line no-unused-vars
  const real = (workouts ?? []).filter(w => w.date && REAL_WORKOUT_TYPES.includes(w.type))
  const pick = pickStrengthSuggestion({ real, workouts, today, allowSingle: true, minCount: STRENGTH_MIN_EXERCISES })
  return pick ?? { type: 'none', reason: 'Entrenaste todos los grupos en los últimos 2 días. Hoy conviene recuperar.' }
}

// Caché diario de la alternativa de fuerza (localStorage, clave daily_strength_alt_{uid}): { date, realCount, suggestion }.
// La rutina propuesta se calcula la primera vez que se pide en el día y después se reusa mientras sea el mismo día y no
// cambie la cantidad de workouts reales, para que sea estable. Es independiente de daily_suggestion_{uid}. Toda lectura
// y escritura va en try/catch (localStorage puede tirar en modo privado o bloqueado): sin caché, se calcula igual.
export const STRENGTH_ALT_KEY = (uid) => `daily_strength_alt_${uid}`

export function getCachedStrengthAlternative({ uid, workouts, profile, today, storage = (typeof localStorage !== 'undefined' ? localStorage : null) }) {
  const realCount = (workouts ?? []).filter(w => REAL_WORKOUT_TYPES.includes(w.type)).length
  if (uid && storage) {
    try {
      const raw = storage.getItem(STRENGTH_ALT_KEY(uid))
      const cached = raw ? JSON.parse(raw) : null
      if (cached && cached.date === today && cached.realCount === realCount && cached.suggestion?.type) {
        const sug = cached.suggestion
        return sug.generatedIds ? { ...sug, generatedIds: normalizeIdList(sug.generatedIds) } : sug
      }
    } catch { /* caché ilegible: se recalcula */ }
  }
  const suggestion = computeStrengthAlternative({ workouts, profile, today })
  if (uid && storage) {
    try { storage.setItem(STRENGTH_ALT_KEY(uid), JSON.stringify({ date: today, realCount, suggestion })) } catch { /* sin caché */ }
  }
  return suggestion
}

// ¿La tarjeta ofrece el botón "Rutina de Fuerza"? Solo cuando la sugerencia es cardio o descanso (no con fuerza,
// ya entrenó hoy ni rutina de regreso).
export const canOfferStrengthAlternative = (suggestion) => suggestion?.type === 'cardio' || suggestion?.type === 'descanso'
