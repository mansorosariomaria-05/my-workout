import { exercises } from '../data/exercises.js'
import { todayStr, parseLocalDate, dateToLocal } from './dates.js'

// Región corporal de cada patrón de movimiento — usada para la regla dura "no dos unilaterales
// de región inferior seguidos" (fatiga de estabilización unilateral) y para el tier de orden (core siempre al final).
export const PATTERN_REGION = {
  sentadilla: 'inferior', zancada: 'inferior', bisagra: 'inferior', empuje_cadera: 'inferior',
  extension_cadera: 'inferior', abduccion: 'inferior', curl_femoral: 'inferior', extension_rodilla: 'inferior', gemelos: 'inferior',
  traccion_vertical: 'superior', traccion_horizontal: 'superior', deltoides_posterior: 'superior',
  empuje_horizontal: 'superior', aperturas: 'superior', empuje_vertical: 'superior', elevacion_lateral: 'superior',
  triceps: 'superior', biceps: 'superior',
  core_flexion: 'core', core_antiextension: 'core', core_rotacion: 'core',
}

// Zona de fatiga de cada patrón — más fina que la región, usada solo como regla blanda de orden
// (preferir alternar zona entre ejercicios consecutivos del mismo tier, sin forzarlo).
export const PATTERN_ZONE = {
  sentadilla: 'rodilla', zancada: 'rodilla', extension_rodilla: 'rodilla',
  bisagra: 'posterior', empuje_cadera: 'posterior', extension_cadera: 'posterior', curl_femoral: 'posterior',
  abduccion: 'abductores',
  gemelos: 'gemelos',
  empuje_horizontal: 'empuje', aperturas: 'empuje', empuje_vertical: 'empuje', elevacion_lateral: 'empuje', triceps: 'empuje',
  traccion_vertical: 'traccion', traccion_horizontal: 'traccion', deltoides_posterior: 'traccion', biceps: 'traccion',
  core_flexion: 'core', core_antiextension: 'core', core_rotacion: 'core',
}

const ACCESORY_LEVEL_ORDER = ['B', 'C', 'A', 'D']

function equipFilter(e, equip) {
  if (equip !== 'Solo básico') return true
  return ['Sin equipamiento', 'Mancuernas', 'Banda elástica', 'Tobilleras'].some(
    eq => e.equip?.includes(eq.split(' ')[0])
  )
}

// Cantidad de sesiones de fuerza con este exerciseId en los últimos 56 días (fechas string locales).
export function historyScore(workouts, exerciseId) {
  const today = todayStr()
  const cutoffDate = parseLocalDate(today)
  cutoffDate.setDate(cutoffDate.getDate() - 56)
  const cutoff = dateToLocal(cutoffDate)
  return (workouts ?? []).filter(w =>
    w.type === 'fuerza' &&
    w.date >= cutoff && w.date <= today &&
    w.exercises?.some(e => e.exerciseId === exerciseId)
  ).length
}

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Elige por mayor historyScore, desempate al azar entre los que empatan en el máximo.
function pickByHistory(candidates, workouts) {
  const scored = candidates.map(e => ({ e, score: historyScore(workouts, e.id) }))
  const maxScore = Math.max(...scored.map(s => s.score))
  const best = scored.filter(s => s.score === maxScore).map(s => s.e)
  return pickRandom(best)
}

function pickForMuscle(muscle, target, equip, workouts, regenerate, globalUsed, usedPatterns) {
  if (target <= 0) return []
  const pool = exercises.filter(e => e.muscle === muscle && equipFilter(e, equip))
  const picked = []

  // Slot 1 — principal: nivel A (si no hay, B), siempre por historial (incluso con regenerate).
  const validFor = (levels, allowRepeatPattern) => pool.filter(e =>
    levels.includes(e.level) && !globalUsed.has(e.id) && (allowRepeatPattern || !usedPatterns.has(e.pattern))
  )
  let principalCandidates = validFor(['A'], false)
  if (!principalCandidates.length) principalCandidates = validFor(['B'], false)
  if (!principalCandidates.length) principalCandidates = validFor(['A', 'B'], true) // permite repetir pattern
  if (principalCandidates.length) {
    const principal = pickByHistory(principalCandidates, workouts)
    picked.push(principal)
    globalUsed.add(principal.id)
    usedPatterns.add(principal.pattern)
  }

  // Slots siguientes — accesorios: prioridad de nivel B → C → A → D.
  while (picked.length < target) {
    let found = null
    for (const level of ACCESORY_LEVEL_ORDER) {
      const candidates = validFor([level], false)
      if (candidates.length) {
        found = regenerate ? pickRandom(candidates) : pickByHistory(candidates, workouts)
        break
      }
    }
    if (!found) {
      // Ningún candidato con pattern nuevo: permitir repetir pattern (se separará al ordenar).
      for (const level of ACCESORY_LEVEL_ORDER) {
        const candidates = validFor([level], true)
        if (candidates.length) {
          found = regenerate ? pickRandom(candidates) : pickByHistory(candidates, workouts)
          break
        }
      }
    }
    if (!found) break // pool agotado para este músculo
    picked.push(found)
    globalUsed.add(found.id)
    usedPatterns.add(found.pattern)
  }

  return picked
}

function tierOf(e) {
  if (PATTERN_REGION[e.pattern] === 'core') return 3
  if (e.level === 'A') return 0
  if (e.level === 'B') return 1
  return 2 // C o D
}

// Reglas duras entre un ejercicio candidato y el anterior ya ubicado — compartida por el orden de
// generateRoutine y por suggestNextExercise (botón "Sugerencia" del modo libre).
export function hardRulesOk(candidate, prev) {
  if (candidate.pattern === prev.pattern) return false
  const bothUnilateralInferior =
    candidate.unilateral && prev.unilateral &&
    PATTERN_REGION[candidate.pattern] === 'inferior' && PATTERN_REGION[prev.pattern] === 'inferior'
  return !bothUnilateralInferior
}

// Prioridad de exploración en cada posición: tier ascendente (así el orden "natural" ya es
// compuestos → accesorios → core), y a igual tier, distinta PATTERN_ZONE que el anterior primero
// (regla blanda), y a igual zona, el orden de músculos elegido por el usuario (insertionIndex).
function candidatePriority(items, usedMask, prev) {
  const idxs = []
  for (let i = 0; i < items.length; i++) if (!usedMask[i]) idxs.push(i)
  idxs.sort((a, b) => {
    const ta = items[a].tier, tb = items[b].tier
    if (ta !== tb) return ta - tb
    if (prev) {
      const sameZoneA = PATTERN_ZONE[items[a].pattern] === PATTERN_ZONE[prev.pattern] ? 1 : 0
      const sameZoneB = PATTERN_ZONE[items[b].pattern] === PATTERN_ZONE[prev.pattern] ? 1 : 0
      if (sameZoneA !== sameZoneB) return sameZoneA - sameZoneB
    }
    return items[a].insertionIndex - items[b].insertionIndex
  })
  return idxs
}

// Ordena un segmento (no-core o core) intentando que TODOS los pares consecutivos cumplan las
// reglas duras (backtracking: si un camino se traba más adelante, se prueba la siguiente opción
// en vez de quedar atado a la primera elección greedy). Con ≤6 ejercicios por rutina esto es
// instantáneo. Solo si NINGÚN orden posible cumple las reglas duras para todos los pares (caso
// límite real, no solo un callejón sin salida de la búsqueda) se arma por prioridad simple.
function orderSegment(items) {
  if (items.length <= 1) return items.slice()
  const n = items.length
  const used = new Array(n).fill(false)

  function backtrack(order, prev) {
    if (order.length === n) return order.slice()
    for (const i of candidatePriority(items, used, prev)) {
      if (prev && !hardRulesOk(items[i], prev)) continue
      used[i] = true
      order.push(i)
      const solved = backtrack(order, items[i])
      if (solved) return solved
      order.pop()
      used[i] = false
    }
    return null
  }

  const solved = backtrack([], null)
  if (solved) return solved.map(i => items[i])

  // Caso límite: no existe ningún orden que respete las reglas duras para todos los pares —
  // se arma por la misma prioridad (tier, zona, orden de músculo) sin esa garantía.
  const fallbackUsed = new Array(n).fill(false)
  const fallback = []
  let prev = null
  for (let step = 0; step < n; step++) {
    const [pick] = candidatePriority(items, fallbackUsed, prev)
    fallbackUsed[pick] = true
    fallback.push(items[pick])
    prev = items[pick]
  }
  return fallback
}

function orderRoutine(picked) {
  const withMeta = picked.map((e, i) => ({ ...e, tier: tierOf(e), insertionIndex: i }))
  // Los ejercicios de core van siempre al final: se ordenan como dos segmentos independientes
  // (no-core y core) y se concatenan, en vez de dejar que emerja de las reglas duras/blandas.
  const nonCore = withMeta.filter(e => PATTERN_REGION[e.pattern] !== 'core')
  const core    = withMeta.filter(e => PATTERN_REGION[e.pattern] === 'core')
  return [...orderSegment(nonCore), ...orderSegment(core)]
}

// Algoritmo único de generación de rutinas — reemplaza generate() (GeneradorTab.jsx) y
// generateForFlow() (FuerzaFlow.jsx). Devuelve la lista ORDENADA de ejercicios (objetos completos
// del catálogo de exercises.js, con pattern/unilateral incluidos).
//
// muscles: string[] en el orden en que el usuario los eligió.
// count: cantidad total de ejercicios.
// equip: 'Gym completo' | 'Solo básico'.
// workouts: array de sesiones (para historyScore).
// regenerate: si true, los slots accesorios se eligen al azar en vez de por historial (el principal
// de cada músculo siempre sigue el historial, con o sin regenerate).
export function generateRoutine({ muscles, count, equip, workouts, regenerate = false }) {
  if (!muscles?.length) return []

  const perGroup  = Math.floor(count / muscles.length)
  const remainder = count % muscles.length
  const globalUsed = new Set()
  const usedPatterns = new Set()
  const allPicked = []

  muscles.forEach((muscle, idx) => {
    const target = perGroup + (idx < remainder ? 1 : 0)
    const picked = pickForMuscle(muscle, target, equip, workouts, regenerate, globalUsed, usedPatterns)
    allPicked.push(...picked)
  })

  return orderRoutine(allPicked)
}

const CORE_MUSCLES = ['Abdominales', 'Core & Estabilidad']

// Nivel-priority scan compartido por el principal y el accesorio de suggestNextExercise: dentro de
// `pool`, devuelve los candidatos del primer nivel (en `levelOrder`) que tenga al menos uno.
function firstNonEmptyLevel(pool, levelOrder) {
  for (const level of levelOrder) {
    const candidates = pool.filter(e => e.level === level)
    if (candidates.length) return candidates
  }
  return []
}

// Sugiere el próximo ejercicio para el modo libre de FuerzaFlow.jsx, a partir de lo que ya está
// cargado en la sesión — reutiliza historyScore/PATTERN_REGION/PATTERN_ZONE/hardRulesOk, misma
// lógica que generateRoutine pero evaluada contra una sola sesión en construcción en vez de armar
// una rutina completa de una vez.
//
// muscles: músculos elegidos en el selector del modo libre (selectedMuscles de FuerzaFlow.jsx). Si
// está vacío, se derivan de los músculos de currentExercises en orden de aparición.
// currentExercises: exData.sets-shaped entries de la sesión en curso ({ exerciseId, muscle,
// originalMuscle? }), tal como están en data.exercises.
// excludeIds: ids ya mostrados en la ronda actual de "Otra", para no repetirlos.
export function suggestNextExercise({ muscles, currentExercises, workouts, excludeIds = [] }) {
  const current = currentExercises ?? []

  let targetMuscles = muscles?.length ? [...muscles] : []
  if (!targetMuscles.length) {
    const seen = new Set()
    for (const entry of current) {
      const m = entry.originalMuscle ?? entry.muscle
      if (m && !seen.has(m)) { seen.add(m); targetMuscles.push(m) }
    }
  }
  if (!targetMuscles.length) return null

  const countByMuscle = {}
  targetMuscles.forEach(m => { countByMuscle[m] = 0 })
  current.forEach(entry => {
    const m = entry.originalMuscle ?? entry.muscle
    if (m in countByMuscle) countByMuscle[m]++
  })

  const nonCoreMuscles = targetMuscles.filter(m => !CORE_MUSCLES.includes(m))
  const coreEligible = nonCoreMuscles.length === 0 || nonCoreMuscles.every(m => countByMuscle[m] >= 2)
  const eligibleMuscles = targetMuscles.filter(m => coreEligible || !CORE_MUSCLES.includes(m))

  const orderedMuscles = [...eligibleMuscles].sort((a, b) => {
    const diff = countByMuscle[a] - countByMuscle[b]
    return diff !== 0 ? diff : targetMuscles.indexOf(a) - targetMuscles.indexOf(b)
  })

  const currentIds = new Set(current.map(e => e.exerciseId))
  const excluded = new Set(excludeIds)
  const usedPatterns = new Set(
    current.map(e => exercises.find(x => x.id === e.exerciseId)?.pattern).filter(Boolean)
  )
  const lastEntry = current[current.length - 1]
  const lastExercise = lastEntry ? exercises.find(x => x.id === lastEntry.exerciseId) : null

  for (const muscle of orderedMuscles) {
    const pool = exercises.filter(e => e.muscle === muscle && !currentIds.has(e.id) && !excluded.has(e.id))
    if (!pool.length) continue

    const hasMainAlready = current.some(entry => {
      if ((entry.originalMuscle ?? entry.muscle) !== muscle) return false
      const ex = exercises.find(x => x.id === entry.exerciseId)
      return ex?.level === 'A' || ex?.level === 'B'
    })

    let candidates, isPrincipal
    if (!hasMainAlready) {
      isPrincipal = true
      candidates = firstNonEmptyLevel(pool, ['A', 'B'])
      if (!candidates.length) candidates = pool
    } else {
      isPrincipal = false
      const fresh = pool.filter(e => !usedPatterns.has(e.pattern))
      const searchIn = fresh.length ? fresh : pool
      candidates = firstNonEmptyLevel(searchIn, ACCESORY_LEVEL_ORDER)
      if (!candidates.length) candidates = searchIn
    }
    if (!candidates.length) continue

    // Orden de preferencia: reglas duras > pattern nuevo en la sesión > distinta zona > historial > azar.
    const scored = candidates.map(e => ({
      e,
      hard: lastExercise?.pattern ? hardRulesOk(e, lastExercise) : true,
      newPattern: !usedPatterns.has(e.pattern),
      diffZone: lastExercise?.pattern ? PATTERN_ZONE[e.pattern] !== PATTERN_ZONE[lastExercise.pattern] : true,
      score: historyScore(workouts, e.id),
    }))
    scored.sort((a, b) =>
      (b.hard - a.hard) || (b.newPattern - a.newPattern) || (b.diffZone - a.diffZone) || (b.score - a.score)
    )
    const top = scored[0]
    const tied = scored.filter(s => s.hard === top.hard && s.newPattern === top.newPattern && s.diffZone === top.diffZone && s.score === top.score)
    const chosen = pickRandom(tied).e

    const reason = isPrincipal
      ? `principal de ${muscle}`
      : (!usedPatterns.has(chosen.pattern) ? `accesorio de ${muscle} · patrón nuevo` : `accesorio de ${muscle}`)

    return { exercise: chosen, reason }
  }

  return null
}
