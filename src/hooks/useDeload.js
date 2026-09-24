import { applyDeloadMultiplier } from '../utils/weights'

export function useDeload(settings, workouts) {
  const isActive = settings?.deloadActive ?? false

  const shouldSuggestDeload = () => {
    if (!workouts || workouts.length < 4) return false
    const last8Weeks = workouts.slice(0, 40)
    const fatigues = last8Weeks.map(w => w.fatigue ?? 5).filter(Boolean)
    if (fatigues.length < 8) return false
    const avg = fatigues.reduce((a, b) => a + b, 0) / fatigues.length
    return avg >= 7
  }

  const getDeloadWeight = (weight, learnedWeights = []) => isActive ? applyDeloadMultiplier(weight, learnedWeights) : weight
  const getDeloadSets = (sets) => isActive ? Math.max(2, sets - 1) : sets

  return { isActive, shouldSuggestDeload, getDeloadWeight, getDeloadSets }
}
