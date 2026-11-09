import { exercises } from '../data/exercises.js'
import { generateRoutine, historyScore } from './routineGenerator.js'
import { floorWeight } from './weights.js'
import { parseLocalDate } from './dates.js'

// Rutina de regreso: un full body de 5 ejercicios que se SUGIERE (nunca se aplica sola) cuando pasaron
// 15 o más días desde el último workout de type === 'fuerza' (cardio, clase y tabata no cuentan). Si el
// usuario toca "Empezar", los pesos de la precarga de esa sesión se reducen según los días de parate;
// ver FuerzaFlow.jsx (buildEntry con reductionPct). Es independiente del aviso de inactividad de 14 días
// (Inicio.jsx) y del modo regreso (reentry.js / progression.js), que no se tocan.

export const RETURN_MIN_DAYS = 15

const daysBetween = (fromStr, toStr) =>
  Math.round((parseLocalDate(toStr) - parseLocalDate(fromStr)) / 86400000)

// Último workout de fuerza (fecha) y días desde entonces, o null si no hay ninguno / no llega al umbral.
export function getReturnTrigger(workouts, today) {
  let lastStrengthDate = null
  ;(workouts ?? []).forEach(w => {
    if (w.type !== 'fuerza' || !w.date || w.date > today) return
    if (!lastStrengthDate || w.date > lastStrengthDate) lastStrengthDate = w.date
  })
  if (!lastStrengthDate) return null // nunca hizo fuerza: no hay "regreso" posible
  const days = daysBetween(lastStrengthDate, today)
  if (days < RETURN_MIN_DAYS) return null
  return { lastStrengthDate, days }
}

// Reducción base (en %) según los días desde el último workout de fuerza.
export function getBaseReductionPct(days) {
  if (days <= 28) return 10   // 15 a 28
  if (days <= 56) return 15   // 29 a 56
  return 20                   // 57+
}

// Acepta tanto 'principiante' (onboarding) como 'Principiante (<1 año)' (ConfigPage).
const isBeginner = (nivel) => String(nivel ?? '').toLowerCase().startsWith('principiante')

// Reducción total en %: base + 5 si es principiante + 5 si el motivo guardado del parate es
// enfermedad/lesión Y corresponde a este mismo parate. profile.inactividad.lastWorkoutDate es la fecha
// del último workout real (de cualquier tipo) cuando se respondió el aviso; pertenece a este parate
// si es igual o posterior al último workout de fuerza (si es anterior, es de un parate viejo).
export function getReturnReductionPct({ days, lastStrengthDate, profile }) {
  let pct = getBaseReductionPct(days)
  if (isBeginner(profile?.nivel)) pct += 5
  const inact = profile?.inactividad
  if (
    (inact?.motivo === 'enfermedad' || inact?.motivo === 'lesion') &&
    inact?.lastWorkoutDate && inact.lastWorkoutDate >= lastStrengthDate
  ) {
    pct += 5
  }
  return pct
}

// Peso reducido y redondeado hacia abajo al pool de pesos reales (floorWeight). Sin peso (vacío, 0,
// solo cuerpo) se devuelve tal cual. Nunca devuelve más que el original.
export function reduceWeight(weight, pct, learnedWeights = []) {
  const w = Number(weight)
  if (!weight && weight !== 0) return weight
  if (!(w > 0) || !pct) return weight
  return Math.min(w, floorWeight(w * (1 - pct / 100), learnedWeights))
}

// Slots del full body. Cada slot admite músculos alternativos (se elige el que tenga más historial
// conocido en los 56 días previos al último workout de fuerza) y restringe los patrones de movimiento.
// Solo cuentan ejercicios de nivel A/B, que son los que generateRoutine elige como principal de un músculo.
const CORE_PATTERNS = ['core_flexion', 'core_antiextension', 'core_rotacion']
const BODY_SLOTS = [
  { key: 'rodilla',   options: [{ muscle: 'Cuádriceps', patterns: ['sentadilla', 'zancada'] }] },
  { key: 'posterior', options: [
    { muscle: 'Isquios',  patterns: ['bisagra', 'empuje_cadera'] },
    { muscle: 'Glúteos',  patterns: ['bisagra', 'empuje_cadera'] },
  ] },
  { key: 'empuje',    options: [
    { muscle: 'Pecho',    patterns: ['empuje_horizontal', 'empuje_vertical'] },
    { muscle: 'Hombros',  patterns: ['empuje_vertical'] },
  ] },
  { key: 'traccion',  options: [{ muscle: 'Espalda', patterns: ['traccion_vertical', 'traccion_horizontal'] }] },
  { key: 'core',      options: [
    { muscle: 'Abdominales',        patterns: CORE_PATTERNS },
    { muscle: 'Core & Estabilidad', patterns: CORE_PATTERNS },
  ] },
]

function pickSlotMuscles(workouts, refDate, neverSet) {
  const muscles = []
  const patternsByMuscle = {}
  BODY_SLOTS.forEach(slot => {
    let best = null
    slot.options.forEach(opt => {
      const pool = exercises.filter(e =>
        e.muscle === opt.muscle && opt.patterns.includes(e.pattern) &&
        (e.level === 'A' || e.level === 'B') && !neverSet.has(e.id)
      )
      if (!pool.length) return
      const score = Math.max(...pool.map(e => historyScore(workouts, e.id, refDate)))
      if (!best || score > best.score) best = { opt, score }
    })
    if (best) {
      muscles.push(best.opt.muscle)
      patternsByMuscle[best.opt.muscle] = best.opt.patterns
    }
  })
  return { muscles, patternsByMuscle }
}

// Sugerencia de rutina de regreso, o null si no corresponde (menos de 15 días, sin fuerza previa, o no
// se pudo armar ningún ejercicio). Función pura sobre el historial ya cargado.
// neverIds: lista "never" del usuario (data/never en Firestore) — esos ejercicios se excluyen.
export function buildReturnSuggestion({ workouts, profile, today, neverIds = [] }) {
  const trigger = getReturnTrigger(workouts, today)
  if (!trigger) return null
  const { lastStrengthDate, days } = trigger

  const neverSet = new Set(neverIds ?? [])
  const { muscles, patternsByMuscle } = pickSlotMuscles(workouts, lastStrengthDate, neverSet)
  if (!muscles.length) return null

  // El orden de generateRoutine (orderRoutine) se usa tal cual.
  const generated = generateRoutine({
    muscles, count: muscles.length, equip: 'Gym completo', workouts,
    neverIds: [...neverSet], patternsByMuscle, referenceDate: lastStrengthDate,
  })
  if (!generated.length) return null

  return {
    type: 'regreso',
    daysSince: days,
    lastStrengthDate,
    reductionPct: getReturnReductionPct({ days, lastStrengthDate, profile }),
    generatedIds: generated.map(e => e.id),
    muscles,
  }
}
