// Unión de los pesos disponibles en dos gimnasios distintos — única fuente de verdad de pesos "de placa/mancuerna".
export const STANDARD_WEIGHTS = [1, 2, 2.5, 3, 4, 5, 6, 7, 7.5, 8, 9, 10, 12, 12.5, 14, 15, 16, 17.5, 18, 20, 22, 24, 25]

const round2 = (n) => Math.round(n * 100) / 100

const EQUIP_CATEGORY = {
  'Sin equipamiento':             'bodyweight',
  'Sin equipamiento / Banda':     'bodyweight',
  'Sin equipamiento/Pesa':        'bodyweight',
  'Barra dominadas':              'bodyweight',
  'Cajón':                        'bodyweight',
  'Fitball':                      'bodyweight',
  'Banco':                        'bodyweight',
  'Banco Romano':                 'bodyweight',
  'Disco':                        'bodyweight',
  'Pared':                        'bodyweight',
  'Soga para saltar':             'bodyweight',
  'Rueda abdominal':              'bodyweight',

  'Barra':                        'barra',
  'Barra + soporte landmine':     'barra',
  'Banco + Barra':                'barra',
  'Barra Z':                      'barra',

  'Máquina':                      'maquina',
  'Máquina de prensa':            'maquina',
  'Polea':                        'maquina',
  'Polea/Banda':                  'maquina',
  'Polea/Banda elástica':         'maquina',
  'Banda/Polea':                  'maquina',

  'Mancuernas':                   'libre',
  'Mancuerna':                    'libre',
  'Kettlebell':                   'libre',
  'Barra/Mancuerna':              'libre',
  'Mancuernas/Barra':             'libre',
  'Barra EZ / Mancuernas':        'libre',
  'Cajón + Mancuernas':           'libre',
  'Banco + Mancuernas':           'libre',
  'Banco inclinado + Mancuernas': 'libre',
  'Escalón/Mancuerna':            'libre',
  'Mancuerna en rodillas':        'libre',
  'Banda elástica':               'libre',
  'Tobilleras':                   'libre',
  'Tobilleras/Polea/Banda':       'libre',
}

// equip: string tal cual viene de exercises.js (campo `equip`). 'bodyweight' | 'barra' | 'maquina' | 'libre'
export function getEquipCategory(equip) {
  if (!equip) return 'libre'
  if (EQUIP_CATEGORY[equip]) return EQUIP_CATEGORY[equip]
  const lower = equip.toLowerCase()
  if (lower.includes('máquina') || lower.includes('maquina') || lower.includes('polea')) return 'maquina'
  if (lower.includes('sin equipamiento')) return 'bodyweight'
  if (lower === 'barra') return 'barra'
  return 'libre'
}

// Moda de las diferencias entre pesos distintos consecutivos (>= refWeight*0.5). Necesita >=3 pesos distintos, si no: null.
export function getTypicalStep(learnedWeights, refWeight) {
  const distinct = [...new Set(learnedWeights)]
    .filter(w => w >= refWeight * 0.5)
    .sort((a, b) => a - b)
  if (distinct.length < 3) return null

  const diffCounts = new Map()
  for (let i = 1; i < distinct.length; i++) {
    const diff = round2(distinct[i] - distinct[i - 1])
    diffCounts.set(diff, (diffCounts.get(diff) ?? 0) + 1)
  }

  let bestDiff = null, bestCount = 0
  for (const [diff, count] of diffCounts) {
    if (count > bestCount || (count === bestCount && diff < bestDiff)) {
      bestDiff = diff
      bestCount = count
    }
  }
  return bestDiff
}

// Próximo peso a sugerir: prioriza el salto más chico disponible en el pool (aprendido + estándar) dentro de un
// tope de +25% (o +2.5kg si es mayor); si no hay ninguno en ese rango, usa el salto típico del usuario o un
// default por tipo de equipamiento.
export function getNextWeight(current, learnedWeights = [], equipCategory) {
  const pool = new Set(learnedWeights)
  if (current <= 25) STANDARD_WEIGHTS.forEach(w => pool.add(w))

  const cap = Math.max(current * 1.25, current + 2.5)
  const candidates = [...pool].filter(w => w > current && w <= cap + 1e-9)
  if (candidates.length) return Math.min(...candidates)

  const step = getTypicalStep(learnedWeights, current) ?? (equipCategory === 'maquina' ? 5 : 2.5)
  return round2(current + step)
}

// Peso a la baja (ej. deload): el mayor peso del pool (aprendido + estándar) que sea <= target y no menor al
// 85% del target. Si ninguno cumple, redondea target hacia abajo al múltiplo de 2.5 más cercano. Mínimo 1.
export function floorWeight(target, learnedWeights = []) {
  const t = round2(target)
  const pool = new Set(learnedWeights)
  STANDARD_WEIGHTS.forEach(w => pool.add(w))

  const below = [...pool].filter(w => w <= t + 1e-9)
  if (below.length) {
    const candidate = Math.max(...below)
    if (candidate >= t * 0.85 - 1e-9) return candidate
  }

  const rounded = Math.floor(t / 2.5) * 2.5
  return Math.max(1, round2(rounded))
}

export function applyDeloadMultiplier(weight, learnedWeights = []) {
  return floorWeight(weight * 0.65, learnedWeights)
}
