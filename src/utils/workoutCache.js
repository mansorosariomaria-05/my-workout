// Caché local del historial de workouts (localStorage) — se muestra al instante al abrir la app y se
// actualiza en segundo plano con la lectura de Firestore. Ver LOGICA_TECNICA.md sección 22.
const CACHE_KEY = (uid) => `workouts_cache_${uid}`

// Si el historial completo no entra en localStorage (cuota ~5 MB) se guardan solo los más recientes
// (la lista viene ordenada por fecha descendente). El caché es solo una aceleración: el historial
// completo siempre se vuelve a leer de Firestore, así que un caché recortado no cambia ningún cálculo.
const FALLBACK_SIZES = [300, 100]

export function readWorkoutCache(uid) {
  try {
    const raw = localStorage.getItem(CACHE_KEY(uid))
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

// Nunca lanza. Devuelve true si guardó algo (completo o recortado).
export function writeWorkoutCache(uid, list) {
  const attempts = [list, ...FALLBACK_SIZES.filter(n => n < list.length).map(n => list.slice(0, n))]
  for (const subset of attempts) {
    try {
      localStorage.setItem(CACHE_KEY(uid), JSON.stringify(subset))
      return true
    } catch { /* cuota llena o almacenamiento bloqueado: prueba con menos */ }
  }
  try { localStorage.removeItem(CACHE_KEY(uid)) } catch {}
  return false
}
