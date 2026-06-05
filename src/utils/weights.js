export const GYM_WEIGHTS = [2, 4, 5, 6, 7.5, 8, 9, 10, 12, 12.5, 14, 15, 17.5, 20, 25]

export const nextWeight = (current) => {
  const idx = GYM_WEIGHTS.indexOf(current)
  if (idx === -1) {
    const above = GYM_WEIGHTS.find(w => w > current)
    return above ?? current
  }
  return idx < GYM_WEIGHTS.length - 1 ? GYM_WEIGHTS[idx + 1] : current
}

export const prevWeight = (current) => {
  const idx = GYM_WEIGHTS.indexOf(current)
  if (idx === -1) {
    const below = [...GYM_WEIGHTS].reverse().find(w => w < current)
    return below ?? current
  }
  return idx > 0 ? GYM_WEIGHTS[idx - 1] : current
}

export const nearestWeight = (value) => {
  return GYM_WEIGHTS.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  )
}

export const applyPauseMultiplier = (weight, pausa) => {
  const multipliers = {
    'Estoy activo/a': 1.0,
    '1-2 semanas': 0.9,
    '2-4 semanas': 0.8,
    '1-3 meses': 0.7,
    'Más de 3 meses': 0.6,
  }
  const mult = multipliers[pausa] ?? 1.0
  return nearestWeight(weight * mult)
}

export const applyDeloadMultiplier = (weight) => nearestWeight(weight * 0.65)
