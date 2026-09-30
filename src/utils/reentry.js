import { parseISO } from 'date-fns'

const daysBetween = (fromDateStr, toDateStr) => Math.round(
  (parseISO(toDateStr + 'T12:00:00') - parseISO(fromDateStr + 'T12:00:00')) / 86400000
)

const INACTIVE_STATE = {
  active: false, preGapLevel: null, sessionsSinceReturn: null, gapDays: null, motivo: null, baseline: null,
}

// Modo regreso: reemplaza la vieja "vuelta suave" — ya no reduce peso/series en la precarga (eso
// ahora siempre es la última sesión real, ver FuerzaFlow.jsx). Solo detecta si el usuario volvió
// hace poco de un parate de 14+ días y todavía no alcanzó el peso que manejaba antes — mientras
// dure, getProgressionAdvice relaja el umbral para sugerir subir (ver progression.js).
//
// exerciseSessions: TODAS las sesiones de un ejercicio (no el slice de 5), forma { date, sets, fatigue }.
// today: 'YYYY-MM-DD'. inactividad: resultado de getInactivityInfo(profile) (o null).
export function getReturnState(exerciseSessions, today, inactividad) {
  // Nunca asumir orden — ordenar explícitamente por fecha descendente (estable ante empates).
  const s = [...(exerciseSessions ?? [])]
    .filter(w => w?.date)
    .sort((a, b) => b.date.localeCompare(a.date))

  if (s.length < 2) return INACTIVE_STATE

  // Busca el gap de 14+ días más reciente entre sesiones consecutivas — a diferencia del sistema
  // viejo, sin límite de "hasta 4 sesiones atrás": el modo regreso se autoexpira por peso alcanzado
  // (ver más abajo), no por cantidad de sesiones, así que no hace falta acotar la búsqueda.
  let foundI = null
  for (let i = 0; i < s.length - 1; i++) {
    if (daysBetween(s[i + 1].date, s[i].date) >= 14) { foundI = i; break }
  }
  if (foundI === null) return INACTIVE_STATE

  const k = foundI + 1 // sesiones hechas desde que volvió (>= 1, porque foundI viene de comparar sesiones ya existentes)
  const baseline = s[k]
  const gapDays = daysBetween(baseline.date, s[foundI].date)
  const returnBoundary = s[foundI].date // primera sesión posterior al gap

  // preGapLevel: mayor peso de la última serie (la más pesada en un esquema piramidal) entre el
  // baseline y hasta 2 sesiones anteriores a él.
  const preGapCandidates = s.slice(k, k + 3)
  const preGapLevel = Math.max(0, ...preGapCandidates.map(sess => {
    const last = sess.sets?.[sess.sets.length - 1]
    return Number(last?.weight) || 0
  }))

  const lastSets = s[0].sets ?? []
  const lastMaxWeight = Math.max(0, ...lastSets.map(x => Number(x.weight) || 0))

  const active = preGapLevel > 0 && lastMaxWeight < preGapLevel

  // El motivo guardado en profile.inactividad solo es válido para ESTE parate si su fecha cae
  // dentro de la ventana [baseline, returnBoundary) — si no, es de otro parate (u obsoleto).
  let motivo = null
  if (
    inactividad?.lastWorkoutDate &&
    inactividad.lastWorkoutDate >= baseline.date &&
    inactividad.lastWorkoutDate < returnBoundary
  ) {
    motivo = inactividad.motivo
  }

  return { active, preGapLevel, sessionsSinceReturn: k, gapDays, motivo, baseline }
}
