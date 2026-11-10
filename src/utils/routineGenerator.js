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

// Grupos generales de músculos ("Piernas", "Tracción", "Empuje", "Brazos"): cada uno es una plantilla
// ORDENADA de huecos por prioridad. Cada hueco define el/los patrones permitidos (si son varios, el
// hueco acepta cualquiera de ellos) y, opcionalmente, los músculos permitidos (sin `muscles` = cualquier
// músculo del catálogo con ese patrón). `muscles` del grupo = los chips que la UI deshabilita al elegirlo.
// No existe un campo compuesto/aislado: la preferencia compuesto → aislado se deduce del `level` (A > B > C).
export const MUSCLE_BLOCKS = [
  {
    id: 'piernas', label: 'Piernas',
    muscles: ['Glúteos', 'Isquios', 'Cuádriceps', 'Abductores', 'Gemelos'],
    slots: [
      { patterns: ['sentadilla'], muscles: ['Cuádriceps'] },
      { patterns: ['bisagra'], muscles: ['Isquios', 'Glúteos'] },
      { patterns: ['empuje_cadera'], muscles: ['Glúteos'] },
      { patterns: ['zancada'] },
      { patterns: ['curl_femoral', 'extension_rodilla'] },
      { patterns: ['abduccion', 'gemelos'] },
    ],
  },
  {
    id: 'traccion', label: 'Tracción',
    muscles: ['Espalda', 'Bíceps'],
    slots: [
      { patterns: ['traccion_vertical'] },
      { patterns: ['traccion_horizontal'] },
      { patterns: ['biceps'] },
      { patterns: ['traccion_horizontal'] }, // otro ejercicio distinto al del hueco 2 (nunca se repite un id)
      { patterns: ['deltoides_posterior'] },
      { patterns: ['biceps'] },
    ],
  },
  {
    id: 'empuje', label: 'Empuje',
    muscles: ['Pecho', 'Hombros', 'Tríceps'],
    slots: [
      { patterns: ['empuje_horizontal'] },
      { patterns: ['empuje_vertical'] },
      { patterns: ['triceps'] },
      { patterns: ['aperturas'] },
      { patterns: ['elevacion_lateral'] },
      { patterns: ['triceps'] },
    ],
  },
  {
    id: 'brazos', label: 'Brazos',
    muscles: ['Bíceps', 'Tríceps', 'Hombros'],
    slots: [
      { patterns: ['empuje_vertical'] },
      { patterns: ['biceps'] },
      { patterns: ['triceps'] },
      { patterns: ['elevacion_lateral'] },
      { patterns: ['biceps'] },
      { patterns: ['triceps'] },
    ],
  },
]

const BLOCK_LEVEL_ORDER = ['A', 'B', 'C', 'D']
// Los dos primeros huecos de cada grupo son sus "principales": siguen el historial incluso al regenerar.
export const BLOCK_PRINCIPAL_SLOTS = 2

// Cantidad de ejercicios del generador (UI): 3–6 con músculos sueltos, 3–8 si hay al menos un grupo.
export const GENERATOR_MAX_COUNT = 6
export const GENERATOR_MAX_COUNT_WITH_BLOCKS = 8
export const generatorMaxCount = (blockIds) => (blockIds?.length ? GENERATOR_MAX_COUNT_WITH_BLOCKS : GENERATOR_MAX_COUNT)
export const generatorCountOptions = (blockIds) =>
  Array.from({ length: generatorMaxCount(blockIds) - 2 }, (_, i) => i + 3)
export const clampGeneratorCount = (count, blockIds) => Math.min(count, generatorMaxCount(blockIds))

// Músculos que un conjunto de grupos incluye (chips que la UI deshabilita).
export function blockedMuscles(blockIds) {
  const set = new Set()
  ;(blockIds ?? []).forEach(id => MUSCLE_BLOCKS.find(b => b.id === id)?.muscles.forEach(m => set.add(m)))
  return set
}

// Alterna un grupo en la selección del generador. Al agregarlo, quita de `muscles` los músculos que el
// grupo ya incluye; al quitarlo, ajusta la cantidad al máximo que quede habilitado. Devuelve el estado nuevo.
export function toggleGeneratorBlock({ blocks, muscles, count }, blockId) {
  const had = blocks.includes(blockId)
  const nextBlocks = had ? blocks.filter(id => id !== blockId) : [...blocks, blockId]
  const blocked = blockedMuscles(nextBlocks)
  return {
    blocks: nextBlocks,
    muscles: muscles.filter(m => !blocked.has(m)),
    count: clampGeneratorCount(count, nextBlocks),
  }
}

// Nombre de la rutina generada: los dos primeros bloques elegidos (grupos primero, después músculos).
export function generatorRoutineName(blockIds, muscles) {
  const labels = (blockIds ?? []).map(id => MUSCLE_BLOCKS.find(b => b.id === id)?.label).filter(Boolean)
  return `Generada: ${[...labels, ...(muscles ?? [])].slice(0, 2).join(' + ')}`
}

// Músculos de la rutina generada: los elegidos sueltos, más los de los ejercicios que pusieron los grupos.
export function generatedRoutineMuscles(muscles, ordered) {
  const out = [...(muscles ?? [])]
  ;(ordered ?? []).forEach(e => { if (!out.includes(e.muscle)) out.push(e.muscle) })
  return out
}

function equipFilter(e, equip) {
  if (equip !== 'Solo básico') return true
  return ['Sin equipamiento', 'Mancuernas', 'Banda elástica', 'Tobilleras'].some(
    eq => e.equip?.includes(eq.split(' ')[0])
  )
}

// Cantidad de sesiones de fuerza con este exerciseId en los 56 días previos a refDate (fechas string
// locales). refDate es hoy por defecto; la rutina de regreso (returnRoutine.js) pasa la fecha del
// último workout de fuerza, para elegir ejercicios que el usuario conoce aunque el parate sea largo.
export function historyScore(workouts, exerciseId, refDate = null) {
  const today = refDate ?? todayStr()
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
function pickByHistory(candidates, workouts, refDate = null) {
  const scored = candidates.map(e => ({ e, score: historyScore(workouts, e.id, refDate) }))
  const maxScore = Math.max(...scored.map(s => s.score))
  const best = scored.filter(s => s.score === maxScore).map(s => s.e)
  return pickRandom(best)
}

// opts (todo opcional — sin opts el comportamiento es el de siempre):
//   neverIds: Set de exerciseId excluidos (lista "never" del usuario).
//   patterns: array de patrones permitidos para este músculo (el resto se descarta del pool).
//   refDate: fecha de referencia del historyScore (por defecto hoy).
function pickForMuscle(muscle, target, equip, workouts, regenerate, globalUsed, usedPatterns, opts = {}) {
  if (target <= 0) return []
  const { neverIds = null, patterns = null, refDate = null } = opts
  const byHistory = (candidates) => pickByHistory(candidates, workouts, refDate)
  const pool = exercises.filter(e =>
    e.muscle === muscle && equipFilter(e, equip) &&
    !(neverIds && neverIds.has(e.id)) &&
    (!patterns || patterns.includes(e.pattern))
  )
  const picked = []

  // Slot 1 — principal: nivel A (si no hay, B), siempre por historial (incluso con regenerate).
  const validFor = (levels, allowRepeatPattern) => pool.filter(e =>
    levels.includes(e.level) && !globalUsed.has(e.id) && (allowRepeatPattern || !usedPatterns.has(e.pattern))
  )
  let principalCandidates = validFor(['A'], false)
  if (!principalCandidates.length) principalCandidates = validFor(['B'], false)
  if (!principalCandidates.length) principalCandidates = validFor(['A', 'B'], true) // permite repetir pattern
  if (principalCandidates.length) {
    const principal = byHistory(principalCandidates)
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
        found = regenerate ? pickRandom(candidates) : byHistory(candidates)
        break
      }
    }
    if (!found) {
      // Ningún candidato con pattern nuevo: permitir repetir pattern (se separará al ordenar).
      for (const level of ACCESORY_LEVEL_ORDER) {
        const candidates = validFor([level], true)
        if (candidates.length) {
          found = regenerate ? pickRandom(candidates) : byHistory(candidates)
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

// Arma `target` ejercicios de un grupo (MUSCLE_BLOCKS): recorre los huecos de la plantilla en orden.
// En cada hueco elige el primer nivel con candidatos (A → B → C → D) y, dentro de él, el de mayor
// historyScore (empate al azar) — igual que el principal de pickForMuscle. Un hueco sin candidatos (equipo,
// lista "never" o pool agotado) se salta y se pasa al siguiente. Si el grupo necesita más ejercicios que
// huecos (ej. 7–8 con un solo grupo), vuelve a recorrer la plantilla desde el hueco 1. Nunca repite un id
// (globalUsed compartido con el resto de la rutina).
//
// Con regenerate, los huecos principales (los dos primeros de la primera vuelta) siguen el historial; el resto
// se sortea: primero un patrón al azar entre los del hueco que tengan candidatos y después un ejercicio al
// azar del mejor nivel de ese patrón.
function blockSlotPool(slot, equip, neverIds, globalUsed) {
  return exercises.filter(e =>
    slot.patterns.includes(e.pattern) &&
    (!slot.muscles || slot.muscles.includes(e.muscle)) &&
    equipFilter(e, equip) &&
    !(neverIds && neverIds.has(e.id)) &&
    !globalUsed.has(e.id)
  )
}

// opts.meta (opcional): Map exerciseId → { slot, principal } donde pickForBlock anota de qué hueco salió
// cada ejercicio, para que repairBlockPicks pueda cambiar uno por otro del mismo hueco.
function pickForBlock(block, target, equip, workouts, regenerate, globalUsed, usedPatterns, opts = {}) {
  if (target <= 0) return []
  const { neverIds = null, refDate = null, meta = null } = opts
  const picked = []

  for (let pass = 0; picked.length < target; pass++) {
    const before = picked.length
    for (let i = 0; i < block.slots.length && picked.length < target; i++) {
      const slot = block.slots[i]
      const pool = blockSlotPool(slot, equip, neverIds, globalUsed)
      if (!pool.length) continue

      const isPrincipal = pass === 0 && i < BLOCK_PRINCIPAL_SLOTS
      let chosen
      if (regenerate && !isPrincipal) {
        const available = slot.patterns.filter(p => pool.some(e => e.pattern === p))
        const pattern = pickRandom(available)
        chosen = pickRandom(firstNonEmptyLevel(pool.filter(e => e.pattern === pattern), BLOCK_LEVEL_ORDER))
      } else {
        chosen = pickByHistory(firstNonEmptyLevel(pool, BLOCK_LEVEL_ORDER), workouts, refDate)
      }
      picked.push(chosen)
      globalUsed.add(chosen.id)
      usedPatterns.add(chosen.pattern)
      meta?.set(chosen.id, { slot, principal: isPrincipal })
    }
    if (picked.length === before) break // ningún hueco pudo aportar nada: pool agotado
  }

  return picked
}

// ¿Existe un orden de `items` donde todos los pares consecutivos cumplan hardRulesOk? (≤ 8 ejercicios.)
function hasValidOrder(items) {
  const used = new Array(items.length).fill(false)
  const go = (n, prev) => {
    if (n === items.length) return true
    for (let i = 0; i < items.length; i++) {
      if (used[i] || (prev && !hardRulesOk(items[i], prev))) continue
      used[i] = true
      const ok = go(n + 1, items[i])
      used[i] = false
      if (ok) return true
    }
    return false
  }
  return go(0, null)
}

// La selección por huecos no mira el orden: puede juntar, por ejemplo, tres unilaterales de tren inferior en
// 4 ejercicios (zancada + Hip Thrust a una pierna + Peso muerto B-stance), y ningún orden evitaría que dos
// queden seguidos. Si el conjunto elegido no tiene ningún orden válido, se cambia UN ejercicio de grupo por
// otro del mismo hueco (primero los accesorios, de atrás para adelante; los principales solo si hace falta;
// prefiriendo el mismo nivel y el de más historial) y se repite hasta que exista un orden válido. Si ningún
// cambio lo logra, el conjunto queda como estaba (caso inevitable). Los ejercicios de músculos sueltos no se tocan.
function repairBlockPicks(allPicked, meta, equip, neverSet, globalUsed, workouts, refDate) {
  const feasible = (list) => hasValidOrder(list.filter(e => PATTERN_REGION[e.pattern] !== 'core'))
  let list = allPicked
  for (let guard = 0; guard < list.length && !feasible(list); guard++) {
    const idxs = list.map((_, i) => i).filter(i => meta.has(list[i].id))
    const byTurn = [
      ...idxs.filter(i => !meta.get(list[i].id).principal).reverse(),
      ...idxs.filter(i => meta.get(list[i].id).principal).reverse(),
    ]
    let swapped = false
    for (const i of byTurn) {
      const cur = list[i]
      const info = meta.get(cur.id)
      // Mismo nivel que el reemplazado primero, después A → B → C → D; a igual nivel, mayor historial.
      const rank = (e) => (e.level === cur.level ? 0 : 1 + BLOCK_LEVEL_ORDER.indexOf(e.level))
      const alts = blockSlotPool(info.slot, equip, neverSet, globalUsed)
        .sort((a, b) => (rank(a) - rank(b)) || (historyScore(workouts, b.id, refDate) - historyScore(workouts, a.id, refDate)))
      const alt = alts.find(a => feasible(list.map((e, k) => (k === i ? a : e))))
      if (!alt) continue
      list = list.map((e, k) => (k === i ? alt : e))
      globalUsed.delete(cur.id); globalUsed.add(alt.id)
      meta.delete(cur.id); meta.set(alt.id, info)
      swapped = true
      break
    }
    if (!swapped) break
  }
  return list
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
//
// Opcionales (los usa la rutina de regreso, utils/returnRoutine.js; sin ellos nada cambia):
// neverIds: exerciseIds a excluir. patternsByMuscle: { [músculo]: patrones permitidos }.
// referenceDate: 'YYYY-MM-DD' desde la que se cuentan los 56 días del historyScore (por defecto hoy).
//
// blocks (opcional): ids de grupos de MUSCLE_BLOCKS ('piernas' | 'traccion' | 'empuje' | 'brazos'). Sin
// `blocks` el comportamiento es exactamente el de siempre (lo usan dailySuggestion y returnRoutine). Con
// `blocks`, cada grupo y cada músculo suelto es un bloque; `count` se reparte entre todos los bloques con la
// misma regla (floor + el resto a los primeros) y el orden de bloques es: grupos (en el orden recibido) y
// después los músculos sueltos (en el orden recibido). Un grupo toma los primeros k huecos de su plantilla
// (pickForBlock); un músculo suelto usa pickForMuscle. neverIds aplica a los dos; patternsByMuscle solo a los
// músculos sueltos.
export function generateRoutine({ muscles, blocks = null, count, equip, workouts, regenerate = false, neverIds = null, patternsByMuscle = null, referenceDate = null }) {
  const blockDefs = [...new Set(blocks ?? [])].map(id => MUSCLE_BLOCKS.find(b => b.id === id)).filter(Boolean)
  const entries = [
    ...blockDefs.map(block => ({ block })),
    ...(muscles ?? []).map(muscle => ({ muscle })),
  ]
  if (!entries.length) return []

  const perGroup  = Math.floor(count / entries.length)
  const remainder = count % entries.length
  const globalUsed = new Set()
  const usedPatterns = new Set()
  let allPicked = []
  const neverSet = neverIds?.length ? new Set(neverIds) : null
  const blockMeta = new Map()

  entries.forEach((entry, idx) => {
    const target = perGroup + (idx < remainder ? 1 : 0)
    const picked = entry.block
      ? pickForBlock(entry.block, target, equip, workouts, regenerate, globalUsed, usedPatterns, {
          neverIds: neverSet, refDate: referenceDate, meta: blockMeta,
        })
      : pickForMuscle(entry.muscle, target, equip, workouts, regenerate, globalUsed, usedPatterns, {
          neverIds: neverSet, patterns: patternsByMuscle?.[entry.muscle] ?? null, refDate: referenceDate,
        })
    allPicked.push(...picked)
  })

  // Solo con grupos: si lo elegido no tiene ningún orden válido, se cambia un ejercicio de grupo (ver repairBlockPicks).
  if (blockMeta.size) allPicked = repairBlockPicks(allPicked, blockMeta, equip, neverSet, globalUsed, workouts, referenceDate)

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
