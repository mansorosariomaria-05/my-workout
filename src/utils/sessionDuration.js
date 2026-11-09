// Duración real de una sesión de fuerza (campo `durationSeconds` del workout). Helpers puros, sin React.
//
// Reglas (ver LOGICA_TECNICA.md, sección 25):
//   · El cronómetro de la sesión (`workout_start_ts`, WorkoutWizard) precarga el campo "Duración (min)" del
//     paso de guardado, redondeado a minutos. El usuario puede corregirlo o dejarlo vacío (→ null).
//   · No se precarga si el cronómetro marcó menos de 5 minutos o más de 4 horas, si no hay cronómetro, o si
//     el workout es de otra fecha que hoy (el cronómetro es de la sesión de hoy).
//   · Ausente, null, 0 o no numérico = "sin dato" — nunca 0.

export const MIN_PRELOAD_SECONDS = 5 * 60
export const MAX_PRELOAD_SECONDS = 4 * 3600
export const MAX_DURATION_MIN    = 24 * 60   // tope de lo que se acepta al cargarlo a mano

// Segundos transcurridos desde `startTs` (ms). null si no hay un inicio válido o está en el futuro.
export function elapsedSecondsSince(startTs, nowMs = Date.now()) {
  const ts = Number(startTs)
  if (!startTs || !Number.isFinite(ts)) return null
  const sec = Math.floor((nowMs - ts) / 1000)
  return sec >= 0 ? sec : null
}

// Valor a precargar en el campo "Duración (min)". Devuelve { value, reason }:
//   value  → string de minutos enteros ('' si no se precarga)
//   reason → 'timer' | 'no-timer' | 'other-date' | 'too-short' | 'too-long'
export function getDurationPreload({ startTs, nowMs = Date.now(), date, today }) {
  if (date && today && date !== today) return { value: '', reason: 'other-date' }
  const sec = elapsedSecondsSince(startTs, nowMs)
  if (sec == null) return { value: '', reason: 'no-timer' }
  if (sec < MIN_PRELOAD_SECONDS) return { value: '', reason: 'too-short' }
  if (sec > MAX_PRELOAD_SECONDS) return { value: '', reason: 'too-long' }
  return { value: String(Math.round(sec / 60)), reason: 'timer' }
}

// Minutos escritos en el campo → durationSeconds. Vacío, no numérico, ≤ 0 o más de 24 h → null.
export function durationSecondsFromMinutes(value) {
  if (value === '' || value == null) return null
  const min = Number(value)
  if (!Number.isFinite(min) || min <= 0 || min > MAX_DURATION_MIN) return null
  return Math.round(min * 60)
}

// Lectura segura de la duración de un workout: número > 0 o null (ausente, null, 0 o no numérico).
export function getSessionDurationSeconds(workout) {
  const raw = workout?.durationSeconds
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}
