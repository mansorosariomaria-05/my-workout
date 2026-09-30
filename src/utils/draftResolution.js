// Lógica pura de "entrenamiento en curso": selección local-vs-nube, expiración y detección de
// contenido real. Extraída de WorkoutDraftContext.jsx para poder testearla de forma aislada con
// un script de Node (ver verify_draft_resolution_tmp.mjs) sin depender de React/Firebase.
export const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000

// "Contenido real" para decidir si vale la pena ofrecer continuar: al menos un ejercicio
// cargado (fuerza) o algún dato de cardio/clase cargado — no solo el paso 1 vacío.
export function draftHasRealContent(d) {
  if (!d?.type) return false
  if (d.type === 'fuerza') return (d.detail?.exercises?.length ?? 0) > 0
  if (d.type === 'cardio') {
    const det = d.detail ?? {}
    return !!(det.activity || det.distancia || det.horas || det.minutos || det.segundos)
  }
  if (d.type === 'clase') {
    const det = d.detail ?? {}
    return !!(det.clase || det.duracion)
  }
  return false
}

export function isDraftExpired(d, now = Date.now()) {
  if (!d?.updatedAt) return false
  return now - d.updatedAt >= MAX_DRAFT_AGE_MS
}

// Usa el más nuevo por updatedAt; si solo hay uno de los dos, usa ese.
export function pickNewerDraft(local, cloud) {
  if (!local) return cloud ?? null
  if (!cloud) return local
  return (cloud.updatedAt ?? 0) > (local.updatedAt ?? 0) ? cloud : local
}
