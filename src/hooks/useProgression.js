import { getProgressionSuggestion } from '../utils/progression'

export function useProgression(getLastFatigueForExercise, getPRForExercise) {
  const getSuggestion = (exerciseId, currentWeight) => {
    const fatigue = getLastFatigueForExercise(exerciseId)
    return getProgressionSuggestion(fatigue, currentWeight)
  }

  return { getSuggestion, getPR: getPRForExercise }
}
