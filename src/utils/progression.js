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

export function detectPattern(sets) {
  if (!sets?.length || sets.length < 2) return 'fixed'
  const ws = sets.map(s => Number(s.weight) || 0)
  if (ws.every(w => w === ws[0])) return 'fixed'
  return ws.every((w, i) => i === 0 || w >= ws[i - 1]) ? 'pyramid' : 'fixed'
}

// sessionHistory: [{date, sets: [{reps, weight}], fatigue}, ...]
// learnedWeights: pesos distintos > 0 usados históricamente en este ejercicio (ver useWorkouts.getLearnedWeights)
// equip: campo `equip` del ejercicio (string crudo de exercises.js)
export function getProgressionAdvice(exerciseId, exerciseName, level, sessionHistory, learnedWeights = [], equip = '') {
  if (!sessionHistory?.length || !sessionHistory[0]?.sets?.length) {
    return { hasHistory: false, suggest: false }
  }

  const repsThreshold = ['A', 'B'].includes(level) ? 10 : 15
  const pattern = detectPattern(sessionHistory[0].sets)
  const equipCategory = getEquipCategory(equip)

  if (sessionHistory.length < 2 || !sessionHistory[1]?.sets?.length) {
    return { hasHistory: true, suggest: false, pattern }
  }

  const sets1 = sessionHistory[0].sets
  const sets2 = sessionHistory[1].sets
  const avg = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0) / arr.length

  let currentWeight, hitThreshold

  if (pattern === 'pyramid') {
    const maxW1     = Math.max(0, ...sets1.map(s => Number(s.weight) || 0))
    const maxW2     = Math.max(0, ...sets2.map(s => Number(s.weight) || 0))
    const lastReps1 = Number(sets1[sets1.length - 1]?.reps) || 0
    const lastReps2 = Number(sets2[sets2.length - 1]?.reps) || 0
    currentWeight = maxW1
    hitThreshold  = maxW1 === maxW2 && lastReps1 >= repsThreshold && lastReps2 >= repsThreshold
  } else {
    const avgReps1 = avg(sets1, s => Number(s.reps) || 0)
    const avgReps2 = avg(sets2, s => Number(s.reps) || 0)
    const avgWt1   = avg(sets1, s => Number(s.weight) || 0)
    const avgWt2   = avg(sets2, s => Number(s.weight) || 0)
    currentWeight = avgWt1
    hitThreshold  = Math.abs(avgWt1 - avgWt2) < 0.5 && avgReps1 >= repsThreshold && avgReps2 >= repsThreshold
  }

  if (!hitThreshold) return { hasHistory: true, suggest: false, pattern }

  if (equipCategory === 'bodyweight' && currentWeight === 0) {
    return {
      hasHistory: true, suggest: true, pattern,
      suggestType: 'reps',
      currentWeight: 0,
      suggestedReps: repsThreshold + 2,
      repsThreshold,
    }
  }

  if (currentWeight <= 0) return { hasHistory: true, suggest: false, pattern }

  return {
    hasHistory: true, suggest: true, pattern,
    suggestType: 'weight',
    currentWeight,
    newWeight: getNextWeight(currentWeight, learnedWeights, equipCategory),
    repsThreshold,
  }
}
