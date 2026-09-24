import { getNextWeight, getEquipCategory } from './weights'

export const OBJETIVO_PARAMS = {
  'Tonificar':           { sets: 3, repsMin: 12, repsMax: 15, restSec: 75 },
  'Ganar masa muscular': { sets: 4, repsMin: 8,  repsMax: 12, restSec: 105 },
  'Ganar fuerza':        { sets: 4, repsMin: 4,  repsMax: 6,  restSec: 210 },
  'Mejorar resistencia': { sets: 3, repsMin: 15, repsMax: 20, restSec: 52 },
  'Bienestar general':   { sets: 3, repsMin: 10, repsMax: 15, restSec: 75 },
}

export const getRestTimer = (objetivo) =>
  OBJETIVO_PARAMS[objetivo]?.restSec ?? 90

// ─── Doble progresión ─────────────────────────────────────────────────────────

// Rango de reps "realista" por nivel de ejercicio. repsThreshold (umbral para subir peso) = max de este rango.
export const REP_RANGES = {
  A: { min: 6,  max: 10 },
  B: { min: 6,  max: 10 },
  C: { min: 10, max: 15 },
  D: { min: 10, max: 15 },
}

export function detectPattern(sets) {
  if (!sets?.length || sets.length < 2) return 'fixed'
  const ws = sets.map(s => Number(s.weight) || 0)
  if (ws.every(w => w === ws[0])) return 'fixed'
  return ws.every((w, i) => i === 0 || w >= ws[i - 1]) ? 'pyramid' : 'fixed'
}

// Fórmula de Epley: estima cuántas reps rendirían a newWeight dado un desempeño previo (prevWeight, prevReps).
export function estimateRepsAtWeight(prevWeight, prevReps, newWeight) {
  if (!prevWeight || !newWeight) return prevReps
  const oneRM = prevWeight * (1 + prevReps / 30)
  // +1e-9: corrige el error de punto flotante de JS (ej. 24 puede representarse como 23.999999999999996)
  // que haría que Math.floor redondee un resultado matemáticamente entero hacia el entero anterior.
  return Math.floor(30 * (oneRM / newWeight - 1) + 1e-9)
}

// Reps extra exigidas antes de subir de peso cuando el próximo salto disponible es proporcionalmente grande
// (típico con mancuernas livianas: los escalones fijos de la sala pesan relativamente más cuanto menor es el peso actual).
export function getJumpRepBonus(currentWeight, nextWeight) {
  if (!currentWeight || !nextWeight) return 0
  const jump = (nextWeight - currentWeight) / currentWeight
  if (jump <= 0.15) return 0
  if (jump <= 0.25) return 2
  return 4
}

// sessionHistory: [{date, sets: [{reps, weight}], fatigue}, ...]
// learnedWeights: pesos distintos > 0 usados históricamente en este ejercicio (ver useWorkouts.getLearnedWeights)
// equip: campo `equip` del ejercicio (string crudo de exercises.js)
export function getProgressionAdvice(exerciseId, exerciseName, level, sessionHistory, learnedWeights = [], equip = '') {
  if (!sessionHistory?.length || !sessionHistory[0]?.sets?.length) {
    return { hasHistory: false, suggest: false }
  }

  const { min: repsMin, max: repsThreshold } = REP_RANGES[level] ?? REP_RANGES.D
  const pattern = detectPattern(sessionHistory[0].sets)
  const equipCategory = getEquipCategory(equip)

  const sets1 = sessionHistory[0].sets
  const avg = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0) / arr.length

  // currentWeight se deriva de la sesión más reciente sola: pyramid → peso máximo, fixed → promedio.
  // Se calcula acá (antes de saber si hay 2da sesión) porque effectiveThreshold lo necesita en ambos early-return.
  const currentWeight = pattern === 'pyramid'
    ? Math.max(0, ...sets1.map(s => Number(s.weight) || 0))
    : avg(sets1, s => Number(s.weight) || 0)

  const nextWeight = getNextWeight(currentWeight, learnedWeights, equipCategory)
  const jumpBonus = getJumpRepBonus(currentWeight, nextWeight)
  const effectiveThreshold = repsThreshold + jumpBonus

  if (sessionHistory.length < 2 || !sessionHistory[1]?.sets?.length) {
    return { hasHistory: true, suggest: false, pattern, repsThreshold, repsMin, effectiveThreshold, jumpBonus, nextWeight }
  }

  const sets2 = sessionHistory[1].sets
  let hitThreshold

  if (pattern === 'pyramid') {
    const maxW2     = Math.max(0, ...sets2.map(s => Number(s.weight) || 0))
    const lastReps1 = Number(sets1[sets1.length - 1]?.reps) || 0
    const lastReps2 = Number(sets2[sets2.length - 1]?.reps) || 0
    hitThreshold = currentWeight === maxW2 && lastReps1 >= effectiveThreshold && lastReps2 >= effectiveThreshold
  } else {
    const avgReps1 = avg(sets1, s => Number(s.reps) || 0)
    const avgReps2 = avg(sets2, s => Number(s.reps) || 0)
    const avgWt2   = avg(sets2, s => Number(s.weight) || 0)
    hitThreshold = Math.abs(currentWeight - avgWt2) < 0.5 && avgReps1 >= effectiveThreshold && avgReps2 >= effectiveThreshold
  }

  if (!hitThreshold) return { hasHistory: true, suggest: false, pattern, repsThreshold, repsMin, effectiveThreshold, jumpBonus, nextWeight }

  if (equipCategory === 'bodyweight' && currentWeight === 0) {
    return {
      hasHistory: true, suggest: true, pattern,
      suggestType: 'reps',
      currentWeight: 0,
      suggestedReps: repsThreshold + 2,
      repsThreshold, repsMin,
    }
  }

  if (currentWeight <= 0) return { hasHistory: true, suggest: false, pattern, repsThreshold, repsMin, effectiveThreshold, jumpBonus, nextWeight }

  return {
    hasHistory: true, suggest: true, pattern,
    suggestType: 'weight',
    currentWeight,
    newWeight: nextWeight,
    repsThreshold, repsMin, effectiveThreshold, jumpBonus,
  }
}
