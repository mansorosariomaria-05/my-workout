import { getDrafts, saveDraft, removeDraft, syncDrafts, draftToWorkout } from './draftQueue.js'
import { withTimeout } from './withTimeout.js'

// Guardado y listado fiable de workouts (sin React, para poder probarlo con scripts).
// Ver LOGICA_TECNICA.md sección 22.

export const SAVE_TIMEOUT_MS = 8000

const byDateDesc = (a, b) => (b.date ?? '').localeCompare(a.date ?? '')

// Guarda un workout nuevo con ID definitivo desde el principio.
//  - newId(uid): genera el ID de Firestore (local, no necesita red).
//  - write(workout, { id, createdAtMs }): setDoc con ese ID.
// Con conexión intenta subirlo hasta `timeoutMs` (8 s); si falla, vence el tiempo o no hay conexión, lo
// deja como borrador (_pendingSync) con el MISMO ID y devuelve pending: true — nunca queda colgado. Si la
// escritura original termina llegando después, el borrador la repite sobre el mismo documento (no duplica).
// Lanza un error con code 'draft-storage-failed' solo si ni siquiera el borrador local se pudo guardar.
export async function saveWorkoutWithFallback({
  uid, workout, newId, write,
  isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  timeoutMs = SAVE_TIMEOUT_MS,
}) {
  const id = newId(uid)
  const createdAtMs = Date.now()

  if (isOnline()) {
    try {
      await withTimeout(write(workout, { id, createdAtMs }), timeoutMs)
      return { id, pending: false, workout: { ...workout, id } }
    } catch (err) {
      console.warn('No se confirmó el guardado, queda como borrador local:', err?.code ?? err)
    }
  }

  const draft = saveDraft(uid, workout, { id, createdAtMs })
  return { id, pending: true, workout: draftToWorkout(draft) }
}

// Arma la lista que ve la app: lo que devolvió el servidor + lo que el servidor todavía no muestra.
//  - recent: Map(id → workout) de los workouts subidos en esta sesión (guardados o sincronizados). Se
//    anteponen mientras la lectura del servidor no los incluya, así una lectura lenta que empezó antes
//    del guardado no los hace desaparecer.
//  - drafts: borradores pendientes, siempre visibles; si el servidor ya tiene ese ID se descartan.
// Orden: por fecha descendente (estable: a igual fecha quedan primero borradores, luego recientes).
export function composeWorkoutList(uid, serverList, recent = new Map()) {
  const server = serverList ?? []
  const serverIds = new Set(server.map(w => w.id))
  const extras = [...recent.values()].filter(w => !serverIds.has(w.id))
  const extraIds = new Set(extras.map(w => w.id))
  const pending = getDrafts(uid)
    .filter(d => d._draftId && !serverIds.has(d._draftId) && !extraIds.has(d._draftId))
    .map(draftToWorkout)
  return [...pending, ...extras, ...server].sort(byDateDesc)
}

// Los IDs que el servidor ya tiene dejan de ser "recientes" y sus borradores ya no hacen falta
// (la escritura original terminó llegando después del timeout).
export function reconcileWithServer(uid, serverList, recent) {
  const serverIds = new Set((serverList ?? []).map(w => w.id))
  for (const id of [...recent.keys()]) if (serverIds.has(id)) recent.delete(id)
  getDrafts(uid).forEach(d => { if (d._draftId && serverIds.has(d._draftId)) removeDraft(uid, d._draftId) })
}

// Lectura segura del historial. Devuelve { ok: true, list } (y actualiza el caché), { ok: false, error }
// (NO toca el caché: el llamador conserva el estado actual) o { stale: true } si mientras tanto empezó una
// lectura más nueva (isStale() → true) y esta respuesta hay que ignorarla.
export async function loadWorkoutsSafely({ uid, fetchSnapshot, readCache, writeCache, recent, isStale = () => false, timeoutMs = 15000 }) {
  try {
    const { workouts: server, fromCache } = await withTimeout(fetchSnapshot(), timeoutMs)
    if (isStale()) return { stale: true }
    // Caché de Firestore vacío con un historial local conocido: no es "no hay workouts", es que no hay
    // datos para leer — se conserva lo que ya hay.
    if (fromCache && !server.length && readCache()?.length) {
      throw new Error('Lectura vacía desde el caché de Firestore; se conserva el historial local')
    }
    reconcileWithServer(uid, server, recent)
    const list = composeWorkoutList(uid, server, recent)
    writeCache(list.filter(w => !w._pendingSync))
    return { ok: true, list }
  } catch (error) {
    if (isStale()) return { stale: true }
    return { ok: false, error }
  }
}

// Sube los borradores pendientes (con candado: ver draftQueue.syncDrafts). onSynced recibe cada workout
// ya subido, para que la UI lo mantenga visible hasta que el servidor lo devuelva.
export function syncPendingDrafts(uid, write, onSynced) {
  return syncDrafts(uid, async (data, meta) => {
    await write(data, meta)
    onSynced?.({ ...data, id: meta.id })
  })
}
