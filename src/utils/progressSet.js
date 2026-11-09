// Serie de progreso del registro de fuerza (reemplaza a la tarjeta "¡Podés superarte!"): funciones puras.
//
// REGLA NO NEGOCIABLE: la app nunca sugiere un peso menor al de la última serie cargada. Toda sugerencia es
// "más peso con reps iguales o menores" o "mismo peso con más reps".
//
// Una fila de progreso (verde) tiene dos opciones, calculadas SIEMPRE a partir de la serie anterior de la tabla:
//   · '+ peso': peso = getNextWeight(peso de esa serie) (en modo regreso, topado en el nivel previo al parate);
//               reps = Epley, acotadas entre repsMin y las reps de esa serie (nunca más reps que ella).
//   · '+ reps': EXACTAMENTE el mismo peso, reps + 2 (en segundos: + 5 seg). Con tope REPS_CAP (25) en repeticiones.
// Guardas: '+ peso' solo si el peso calculado es estrictamente mayor que el de la serie; ejercicios de peso corporal
// (sin peso cargado) ofrecen solo '+ reps'; si ninguna opción es válida, no hay fila.

import { getNextWeight, getEquipCategory, floorWeight } from './weights.js'
import { REP_RANGES, estimateRepsAtWeight, SECS_STEP, SECS_RESET } from './progression.js'

export const REPS_CAP = 25
export const REPS_STEP = 2

const round2 = (n) => Math.round(n * 100) / 100
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

// buildProgressOptions({ lastSet, level, equip, learnedWeights, unit, advice })
//   lastSet: serie anterior { reps, weight } · level/equip: del ejercicio · unit: 'reps' | 'secs'
//   advice: resultado de getProgressionAdvice (opcional; aporta el modo regreso y el tipo de sugerencia por defecto)
// → { weight: { weight, reps } | null, reps: { weight, reps } | null, defaultKey: 'weight' | 'reps' | null }
export function buildProgressOptions({ lastSet, level, equip, learnedWeights = [], unit = 'reps', advice = null } = {}) {
  const none = { weight: null, reps: null, defaultKey: null }
  const lastWeight = Number(lastSet?.weight) || 0
  const lastReps = Number(lastSet?.reps) || 0
  if (!(lastReps > 0)) return none

  // + peso
  let weightOpt = null
  if (lastWeight > 0) {
    let next = getNextWeight(lastWeight, learnedWeights, getEquipCategory(equip))
    if (advice?.suggest && advice.useReturnRule && advice.preGapLevel != null) {
      // Modo regreso: sube hacia el nivel previo al parate, sin pasarlo
      next = Math.min(advice.preGapLevel, Math.max(next, floorWeight(lastWeight * 1.10, learnedWeights)))
    }
    next = round2(next)
    if (next > lastWeight + 1e-9) {
      const reps = unit === 'secs'
        ? Math.min(advice?.resetSecs ?? SECS_RESET, lastReps)
        : clamp(estimateRepsAtWeight(lastWeight, lastReps, next), (REP_RANGES[level] ?? REP_RANGES.D).min, lastReps)
      weightOpt = { weight: next, reps }
    }
  }

  // + reps (mismo peso exacto)
  let repsOpt = null
  const nextReps = lastReps + (unit === 'secs' ? SECS_STEP : REPS_STEP)
  if (unit === 'secs' || nextReps <= REPS_CAP) repsOpt = { weight: lastSet.weight ?? '', reps: nextReps }

  const prefersWeight = !!(advice?.suggest && (advice.suggestType === 'weight' || advice.suggestType === 'weight_secs'))
  const defaultKey = prefersWeight && weightOpt ? 'weight' : repsOpt ? 'reps' : weightOpt ? 'weight' : null
  return { weight: weightOpt, reps: repsOpt, defaultKey }
}

// Valores { weight, reps } de la opción `key` (o la de por defecto si `key` no es válida); null si no hay opciones.
export function resolveProgressValues(options, key) {
  const k = key && options?.[key] ? key : options?.defaultKey
  return k ? { key: k, ...options[k] } : null
}

// Precarga: cantidad base de series = total − series marcadas isExtra de la última sesión. Se descartan las
// series MÁS LIVIANAS (desempate: menos reps, luego la más temprana) y se conserva el orden original de las que
// quedan. Sesiones sin isExtra se devuelven tal cual. Las series devueltas NO llevan isExtra.
export function selectPreloadSets(lastSets) {
  const sets = Array.isArray(lastSets) ? lastSets : []
  const extras = sets.filter(s => s?.isExtra).length
  const clean = sets.map(({ isExtra, ...rest }) => rest) // eslint-disable-line no-unused-vars
  const base = sets.length - extras
  if (!extras || base < 1) return clean
  const drop = new Set(
    sets.map((s, i) => ({ i, w: Number(s?.weight) || 0, r: Number(s?.reps) || 0 }))
      .sort((a, b) => a.w - b.w || a.r - b.r || a.i - b.i)
      .slice(0, extras)
      .map(x => x.i)
  )
  return clean.filter((_, i) => !drop.has(i))
}

// Series para guardar: se descartan las de progreso todavía pendientes (sin tocar) y los flags de interfaz
// (_suggested, _pending, _opt). `isExtra` SÍ se conserva.
export function cleanSetsForSave(sets) {
  return (sets ?? []).filter(s => !s?._pending).map(({ _suggested, _pending, _opt, ...rest }) => rest) // eslint-disable-line no-unused-vars
}
