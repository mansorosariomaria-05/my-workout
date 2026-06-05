import { nextWeight as nextW, prevWeight as prevW, nearestWeight, GYM_WEIGHTS } from './weights'

export { GYM_WEIGHTS }

export const OBJETIVO_PARAMS = {
  'Tonificar':           { sets: 3, repsMin: 12, repsMax: 15, restSec: 75 },
  'Ganar masa muscular': { sets: 4, repsMin: 8,  repsMax: 12, restSec: 105 },
  'Ganar fuerza':        { sets: 4, repsMin: 4,  repsMax: 6,  restSec: 210 },
  'Mejorar resistencia': { sets: 3, repsMin: 15, repsMax: 20, restSec: 52 },
  'Bienestar general':   { sets: 3, repsMin: 10, repsMax: 15, restSec: 75 },
}

// Map from objectives array keys to OBJETIVO_PARAMS keys
const OBJ_KEY_TO_PARAM = {
  'fuerza':      'Ganar fuerza',
  'masa':        'Ganar masa muscular',
  'tonificar':   'Tonificar',
  'resistencia': 'Mejorar resistencia',
  'bienestar':   'Bienestar general',
}
const OBJ_PRIORITY = ['fuerza', 'masa', 'tonificar', 'resistencia', 'bienestar']

// For levels A/B use highest priority objective; for C/D use second if available
export function getObjetivoForLevel(objectives, level) {
  if (!objectives?.length) return null
  const sorted = [...objectives].sort((a, b) => OBJ_PRIORITY.indexOf(a) - OBJ_PRIORITY.indexOf(b))
  const key = (['C', 'D'].includes(level) && sorted.length >= 2) ? sorted[1] : sorted[0]
  return OBJ_KEY_TO_PARAM[key] ?? null
}

export const getRestTimer = (objetivo) =>
  OBJETIVO_PARAMS[objetivo]?.restSec ?? 90

export const getSuggestedSetsReps = (objetivo) => {
  const p = OBJETIVO_PARAMS[objetivo] ?? OBJETIVO_PARAMS['Bienestar general']
  return { sets: p.sets, reps: p.repsMax }
}

// Intrasession pyramid: reps descend, weight increases per series
const PYRAMID = {
  'Tonificar':           { reps: [15, 13, 12],    delta: [0, 0, 1] },
  'Ganar masa muscular': { reps: [12, 10, 8, 6],  delta: [0, 1, 1, 1] },
  'Ganar fuerza':        { reps: [6, 5, 4, 3],    delta: [0, 1, 2, 2] },
  'Mejorar resistencia': { reps: [20, 18, 15],    delta: [0, 0, 0] },
  'Bienestar general':   { reps: [12, 12, 10],    delta: [0, 0, 1] },
}

export function getNextWeight(currentWeight, direction, steps = 1) {
  const idx = GYM_WEIGHTS.reduce((best, w, i) =>
    Math.abs(w - currentWeight) < Math.abs(GYM_WEIGHTS[best] - currentWeight) ? i : best, 0)
  if (direction === 'up') return GYM_WEIGHTS[Math.min(GYM_WEIGHTS.length - 1, idx + steps)]
  return GYM_WEIGHTS[Math.max(0, idx - steps)]
}

export function getWeightJump(exerciseLevel) {
  if (exerciseLevel === 'A') return 2
  return 1
}

// Double progression: up only when ALL sets hit repsMax in BOTH last 2 sessions
function determineAction(exerciseId, objetivo, lastSessions) {
  if (!lastSessions?.length) return 'first'
  const relevant = lastSessions
    .filter(s => s.exercises?.some(e => e.exerciseId === exerciseId))
    .slice(0, 2)
  if (!relevant.length) return 'first'

  const params = OBJETIVO_PARAMS[objetivo] ?? OBJETIVO_PARAMS['Bienestar general']
  const latest = relevant[0]
  const latestEx = latest.exercises?.find(e => e.exerciseId === exerciseId)

  if (!latestEx) return 'first'

  const failedSets = latestEx.sets?.filter(s => (s.reps ?? 0) < params.repsMin).length ?? 0
  if (failedSets >= 2) return 'down'

  if (relevant.length < 2) return 'maintain'

  const prev   = relevant[1]
  const prevEx = prev.exercises?.find(e => e.exerciseId === exerciseId)

  const latestAllMax  = latestEx.sets?.every(s => (s.reps ?? 0) >= params.repsMax) ?? false
  const prevAllMax    = prevEx?.sets?.every(s => (s.reps ?? 0) >= params.repsMax) ?? false
  const latestFatigue = latest.fatigue ?? 5

  if (latestAllMax && prevAllMax && latestFatigue <= 7) return 'up'
  return 'maintain'
}

export function getSeriesSuggestion(exerciseId, seriesIndex, userProfile, lastSessions, exerciseLevel) {
  // Resolve objective: prefer objectives array, fall back to single objetivo string
  let objetivo
  if (userProfile?.objectives?.length) {
    objetivo = getObjetivoForLevel(userProfile.objectives, exerciseLevel) ?? userProfile?.objetivo ?? 'Bienestar general'
  } else {
    objetivo = userProfile?.objetivo ?? 'Bienestar general'
  }

  const params  = OBJETIVO_PARAMS[objetivo] ?? OBJETIVO_PARAMS['Bienestar general']
  const pyramid = PYRAMID[objetivo] ?? PYRAMID['Bienestar general']
  const idx     = Math.min(seriesIndex, pyramid.reps.length - 1)
  const weightDelta = pyramid.delta[idx] ?? 0

  let baseWeight = 0
  if (lastSessions?.length > 0) {
    const lastEx = lastSessions[0]?.exercises?.find(e => e.exerciseId === exerciseId)
    if (lastEx?.sets?.length) {
      baseWeight = Math.max(0, ...lastEx.sets.map(s => Number(s.weight) || 0))
    }
  }

  const action = determineAction(exerciseId, objetivo, lastSessions)

  let suggestedWeight = baseWeight
  let suggestedReps   = pyramid.reps[idx]

  if (action === 'up') {
    const jump = getWeightJump(exerciseLevel ?? 'C')
    suggestedWeight = getNextWeight(baseWeight, 'up', jump + weightDelta)
    suggestedReps   = params.repsMin
  } else if (action === 'down') {
    suggestedWeight = getNextWeight(baseWeight, 'down', 1)
    suggestedReps   = pyramid.reps[idx]
  } else if (action === 'first') {
    suggestedWeight = 0
    suggestedReps   = params.repsMin
  } else {
    if (baseWeight > 0 && weightDelta > 0) {
      suggestedWeight = getNextWeight(baseWeight, 'up', weightDelta)
    }
    suggestedReps = pyramid.reps[idx]
  }

  return { suggestedWeight, suggestedReps, unit: 'kg', reason: action }
}

export function getProgressionMessage(suggestion, genero) {
  const adj = genero === 'masculino' ? 'listo' : genero === 'femenino' ? 'lista' : 'liste'
  switch (suggestion?.reason) {
    case 'up':
      return suggestion.suggestedWeight > 0
        ? `💪 ¡Subí el peso! Estás ${adj} para más. Pasá a ${suggestion.suggestedWeight}kg`
        : `💪 ¡Subí el peso! Estás ${adj} para más.`
    case 'down':    return '🎯 Bajá un poco y enfocate en la técnica.'
    case 'maintain':return '✓ Mantené este peso, vas bien.'
    case 'first':   return '🌟 Primera vez — elegí un peso cómodo.'
    default:        return null
  }
}

// ─── Smart progression advice ─────────────────────────────────────────────────

const LOWER_BODY_KW = [
  'hip thrust', 'prensa', 'sentadilla', 'búlgara', 'bulgara', 'peso muerto',
  'hack squat', 'step-up', 'step up', 'estocada', 'zancada',
  'elevación de talones', 'elevacion de talones',
]
const UPPER_BIG_KW = [
  'press de banca', 'remo con barra', 'remo en polea', 'jalón al pecho',
  'jalon al pecho', 'press de hombros', 'press hombros', 'arnold press',
]

export function detectPattern(sets) {
  if (!sets?.length || sets.length < 2) return 'fixed'
  const ws = sets.map(s => Number(s.weight) || 0)
  if (ws.every(w => w === ws[0])) return 'fixed'
  return ws.every((w, i) => i === 0 || w >= ws[i - 1]) ? 'pyramid' : 'fixed'
}

export function getWeightIncrement(exerciseName) {
  const name = (exerciseName ?? '').toLowerCase()
  if (LOWER_BODY_KW.some(k => name.includes(k))) return 5
  if (UPPER_BIG_KW.some(k => name.includes(k))) return 2.5
  return 2
}

// sessionHistory: [{date, sets: [{reps, weight}], fatigue}, ...]
export function getProgressionAdvice(exerciseId, exerciseName, level, sessionHistory) {
  if (!sessionHistory?.length || !sessionHistory[0]?.sets?.length) {
    return { hasHistory: false, suggest: false }
  }

  const repsThreshold = ['A', 'B'].includes(level) ? 10 : 15
  const pattern = detectPattern(sessionHistory[0].sets)

  if (sessionHistory.length < 2 || !sessionHistory[1]?.sets?.length) {
    return { hasHistory: true, suggest: false, pattern }
  }

  const sets1 = sessionHistory[0].sets
  const sets2 = sessionHistory[1].sets
  const avg = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0) / arr.length

  if (pattern === 'pyramid') {
    const maxW1    = Math.max(0, ...sets1.map(s => Number(s.weight) || 0))
    const maxW2    = Math.max(0, ...sets2.map(s => Number(s.weight) || 0))
    const lastReps1 = Number(sets1[sets1.length - 1]?.reps) || 0
    const lastReps2 = Number(sets2[sets2.length - 1]?.reps) || 0

    if (maxW1 > 0 && maxW1 === maxW2 && lastReps1 >= repsThreshold && lastReps2 >= repsThreshold) {
      return {
        hasHistory: true, suggest: true, pattern,
        currentWeight: maxW1,
        newWeight: maxW1 + getWeightIncrement(exerciseName),
        repsThreshold,
      }
    }
  } else {
    const avgReps1 = avg(sets1, s => Number(s.reps) || 0)
    const avgReps2 = avg(sets2, s => Number(s.reps) || 0)
    const avgWt1   = avg(sets1, s => Number(s.weight) || 0)
    const avgWt2   = avg(sets2, s => Number(s.weight) || 0)

    if (avgWt1 > 0 && Math.abs(avgWt1 - avgWt2) < 0.5 && avgReps1 >= repsThreshold && avgReps2 >= repsThreshold) {
      return {
        hasHistory: true, suggest: true, pattern,
        currentWeight: avgWt1,
        newWeight: avgWt1 + getWeightIncrement(exerciseName),
        repsThreshold,
      }
    }
  }

  return { hasHistory: true, suggest: false, pattern }
}

// Legacy — kept for backwards compat
export const getProgressionSuggestion = (lastTwoFatigue, currentWeight) => {
  if (!lastTwoFatigue || lastTwoFatigue.length < 2) return { action: 'none', weight: currentWeight }
  const [f1, f2] = lastTwoFatigue
  if (f1 <= 4 && f2 <= 4) return { action: 'up', weight: nextW(currentWeight) }
  if (f1 >= 8 || f2 >= 8) return { action: 'down', weight: prevW(currentWeight) }
  return { action: 'maintain', weight: currentWeight }
}

export const getPauseSeriesReduction = (pausa) => {
  const reductions = {
    'Estoy activo/a': 0, '1-2 semanas': 0, '2-4 semanas': -1, '1-3 meses': -1, 'Más de 3 meses': -2,
  }
  return reductions[pausa] ?? 0
}
