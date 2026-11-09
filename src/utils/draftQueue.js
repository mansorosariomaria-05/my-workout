import { withTimeout } from './withTimeout.js'

// Cola de entrenamientos que no se pudieron subir a Firestore (sin conexión o escritura no confirmada).
// Cada borrador lleva el ID DEFINITIVO del workout en `_draftId` (se genera una sola vez, antes del primer
// intento de subida) y la hora de creación en `_draftCreatedAt`. Subirlo es un setDoc con ese ID, así que
// reintentar —o que una escritura anterior termine llegando tarde— sobrescribe el mismo documento y nunca
// lo duplica. Ver LOGICA_TECNICA.md sección 22.
const DRAFT_KEY_PREFIX = 'workout_draft_'
const SYNC_WRITE_TIMEOUT_MS = 15000

const newLocalId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

// Lanza un Error con code 'draft-storage-failed' si no se puede escribir en localStorage (lleno,
// bloqueado, modo privado): el llamador tiene que avisarle al usuario que NO se guardó.
export function saveDraft(uid, workout, { id = null, createdAtMs = null } = {}) {
  const draftWithMeta = {
    ...workout,
    _draftId: id ?? newLocalId(),
    _pendingSync: true,
    _draftCreatedAt: createdAtMs ?? Date.now(),
  }
  try {
    const drafts = getDrafts(uid).filter(d => d._draftId !== draftWithMeta._draftId)
    drafts.push(draftWithMeta)
    localStorage.setItem(DRAFT_KEY_PREFIX + uid, JSON.stringify(drafts))
  } catch (cause) {
    const err = new Error('No se pudo guardar el borrador en este dispositivo')
    err.code = 'draft-storage-failed'
    err.cause = cause
    throw err
  }
  return draftWithMeta
}

export function getDrafts(uid) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + uid)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function removeDraft(uid, draftId) {
  try {
    const drafts = getDrafts(uid).filter(d => d._draftId !== draftId)
    if (drafts.length) localStorage.setItem(DRAFT_KEY_PREFIX + uid, JSON.stringify(drafts))
    else localStorage.removeItem(DRAFT_KEY_PREFIX + uid)
  } catch { /* si no se puede reescribir, el borrador se reintenta y el setDoc con el mismo ID es idempotente */ }
}

// Un borrador como entrada de la lista de workouts: mismo ID que tendrá en Firestore.
export const draftToWorkout = (d) => ({ ...d, id: d._draftId })

// Candado por usuario: si ya hay una sincronización corriendo, quien llame recibe esa misma promesa
// en vez de empezar otra (evita subir dos veces el mismo borrador en paralelo).
const inFlight = new Map()

// saveFn(workoutData, { id, createdAtMs }) tiene que escribir con setDoc usando `id`. Cada subida tiene
// un tope de tiempo para que un borrador trabado no deje el candado tomado para siempre; si vence, el
// borrador queda en la cola y se reintenta en la próxima sincronización.
export function syncDrafts(uid, saveFn, { timeoutMs = SYNC_WRITE_TIMEOUT_MS } = {}) {
  if (inFlight.has(uid)) return inFlight.get(uid)

  const run = async () => {
    const drafts = getDrafts(uid)
    if (!drafts.length) return { synced: 0, failed: 0 }
    let synced = 0, failed = 0
    for (const draft of drafts) {
      const { _draftId, _pendingSync, _draftCreatedAt, id: _ignored, ...workoutData } = draft
      if (!_draftId) { failed++; continue }
      try {
        await withTimeout(saveFn(workoutData, { id: _draftId, createdAtMs: _draftCreatedAt ?? null }), timeoutMs)
        removeDraft(uid, _draftId)
        synced++
      } catch {
        failed++
      }
    }
    return { synced, failed }
  }

  const promise = run().finally(() => { inFlight.delete(uid) })
  inFlight.set(uid, promise)
  return promise
}
