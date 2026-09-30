// Helpers puros de tiempo/ritmo para el registro de cardio — sin dependencias de React ni Firestore.

export function toSeconds(h, m, s) {
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0)
}

// h:mm:ss si hay horas, mm:ss si no (minutos siempre con 2 dígitos, horas nunca rellenadas).
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const h  = Math.floor(total / 3600)
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// Segundos por km. null si falta tiempo o distancia.
export function computePace(seconds, km) {
  const t = Number(seconds) || 0
  const d = Number(km) || 0
  if (t <= 0 || d <= 0) return null
  return t / d
}

// "m:ss /km" (minutos sin rellenar, segundos con 2 dígitos) — "—" si no hay pace o es > 60 min/km.
export function formatPace(secPerKm) {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm <= 0) return '—'
  const rounded = Math.round(secPerKm)
  if (rounded > 3600) return '—'
  const m = Math.floor(rounded / 60)
  const s = String(rounded % 60).padStart(2, '0')
  return `${m}:${s} /km`
}

// "xx,x" (string, coma decimal) — "—" si falta tiempo o distancia.
export function computeSpeedKmh(seconds, km) {
  const t = Number(seconds) || 0
  const d = Number(km) || 0
  if (t <= 0 || d <= 0) return '—'
  const kmh = d / (t / 3600)
  return kmh.toFixed(1).replace('.', ',')
}

// Duración efectiva de un workout de cardio guardado: usa durationSeconds si existe (workouts
// nuevos); si no, la deriva del campo viejo `tiempo` (minutos) para workouts anteriores a este cambio.
export function getEffectiveDurationSeconds(workout) {
  if (workout?.durationSeconds != null) return workout.durationSeconds
  if (workout?.tiempo != null) return Number(workout.tiempo) * 60
  return null
}

// Pace efectivo (seg/km) de un workout guardado: usa paceSecondsPerKm si existe; si no, lo deriva
// de la duración efectiva y la distancia (cubre workouts viejos, que nunca tuvieron este campo).
export function getEffectivePaceSecondsPerKm(workout) {
  if (workout?.paceSecondsPerKm != null) return workout.paceSecondsPerKm
  return computePace(getEffectiveDurationSeconds(workout), workout?.distancia)
}
