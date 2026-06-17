export function detectPRs(workout, workoutsHistory) {
  if (!workout.exercises?.length) return []
  const prs = []
  for (const ex of workout.exercises) {
    if (!ex.exerciseId || !ex.sets?.length) continue
    const maxThisSession = Math.max(0, ...ex.sets.map(s => Number(s.weight) || 0))
    if (!maxThisSession) continue
    const prevMax = workoutsHistory
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === ex.exerciseId))
      .flatMap(w => w.exercises.filter(e => e.exerciseId === ex.exerciseId))
      .flatMap(e => e.sets || [])
      .reduce((max, s) => Math.max(max, Number(s.weight) || 0), 0)
    if (maxThisSession > prevMax && prevMax > 0) {
      prs.push({ name: ex.name, weight: maxThisSession })
    }
  }
  return prs
}

export function detectImprovements(workout, workoutsHistory) {
  if (!workout.exercises?.length) return []
  const improvements = []
  for (const ex of workout.exercises) {
    if (!ex.exerciseId || !ex.sets?.length) continue
    const lastSession = workoutsHistory
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === ex.exerciseId))
      [0]
    if (!lastSession) continue
    const lastSets = lastSession.exercises.find(e => e.exerciseId === ex.exerciseId)?.sets || []
    if (!lastSets.length) continue

    const maxWeightNow  = Math.max(0, ...ex.sets.map(s => Number(s.weight) || 0))
    const maxWeightLast = Math.max(0, ...lastSets.map(s => Number(s.weight) || 0))
    const maxRepsNowAtSameWeight  = Math.max(0, ...ex.sets.filter(s => Number(s.weight) === maxWeightLast).map(s => Number(s.reps) || 0))
    const maxRepsLastAtSameWeight = Math.max(0, ...lastSets.filter(s => Number(s.weight) === maxWeightLast).map(s => Number(s.reps) || 0))

    if (maxWeightNow > maxWeightLast) {
      improvements.push({ name: ex.name, type: 'weight', deltaW: maxWeightNow - maxWeightLast, weight: maxWeightNow })
    } else if (maxWeightNow === maxWeightLast && maxRepsNowAtSameWeight > maxRepsLastAtSameWeight) {
      improvements.push({ name: ex.name, type: 'reps', deltaR: maxRepsNowAtSameWeight - maxRepsLastAtSameWeight, reps: maxRepsNowAtSameWeight })
    }
  }
  return improvements
}
