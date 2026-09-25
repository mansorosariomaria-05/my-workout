import { parseISO } from 'date-fns'
import { exercises } from '../data/exercises.js'
import { PATTERN_ZONE } from './routineGenerator.js'

// Escalones de reentrada: cuanto más grande el parate, mayor reducción de peso (R, en %) y más
// sesiones de reentrada (N). Motivo médico (enfermedad/lesión) suma un escalón extra de cuidado.
// Se usan cuando el músculo/zona NO se siguió entrenando con otros ejercicios (ver "vuelta técnica").
export function getReentrySteps(gapDays, motivo) {
  let R, N
  if (gapDays <= 20)      { R = 10; N = 2 }
  else if (gapDays <= 28) { R = 15; N = 2 }
  else if (gapDays <= 56) { R = 20; N = 3 }
  else                    { R = 25; N = 3 } // 57+

  if (motivo === 'enfermedad' || motivo === 'lesion') { R += 5; N += 1 }
  return { R, N }
}

// "Vuelta técnica": el ejercicio puntual no se hizo, pero el músculo (o la misma zona de fatiga,
// PATTERN_ZONE) siguió entrenándose con otros ejercicios — no hay desentrenamiento muscular real,
// solo se perdió la técnica/el peso específico de ESTE movimiento. Reducción mínima, una sola sesión.
function getTechnicalReentryStep(motivo) {
  let R = 5, N = 1
  if (motivo === 'enfermedad' || motivo === 'lesion') { R += 5; N += 1 }
  return { R, N }
}

// Días desde la última sesión de fuerza (cualquier ejercicio) que trabajó el mismo músculo
// (originalMuscle ?? muscle) o la misma PATTERN_ZONE que el ejercicio objetivo. El ejercicio
// objetivo mismo cuenta como candidato (así, si nada más lo reemplazó, el resultado coincide con
// el gap del propio ejercicio). Ejercicios sin pattern (personalizados) en el historial nunca
// matchean por zona, solo por músculo — igual que el ejercicio objetivo sin pattern.
function computeMuscleGap(allWorkouts, today, targetMuscle, targetZone) {
  let latest = null
  ;(allWorkouts ?? []).forEach(w => {
    if (w.type !== 'fuerza' || !w.date || w.date > today) return
    ;(w.exercises ?? []).forEach(e => {
      const muscle = e.originalMuscle ?? e.muscle
      let matches = muscle === targetMuscle
      if (!matches && targetZone) {
        const cat = exercises.find(x => x.id === e.exerciseId)
        matches = cat ? PATTERN_ZONE[cat.pattern] === targetZone : false
      }
      if (matches && (!latest || w.date > latest)) latest = w.date
    })
  })
  return latest ? daysBetween(latest, today) : null
}

// Reducción de la sesión j (1..N) dentro del plan de reentrada: decrece linealmente de R (sesión 1)
// a R/N (sesión N) — la última sesión de reentrada ya casi no reduce nada, preparando la vuelta a la
// carga normal.
export function getSessionReduction(R, N, sessionNumber) {
  return R * (N - sessionNumber + 1) / N
}

const daysBetween = (fromDateStr, toDateStr) => Math.round(
  (parseISO(toDateStr + 'T12:00:00') - parseISO(fromDateStr + 'T12:00:00')) / 86400000
)

const EMPTY_STATE = {
  inReentry: false, sessionNumber: null, totalSessions: null, reduction: null,
  baseline: null, gapDays: null, exerciseGap: null, muscleGap: null, isTechnical: false,
  motivo: null, reentrySessionDates: [],
}

// exerciseSessions: TODAS las sesiones de un ejercicio (no el slice de 5), forma { date, sets, fatigue }.
// today: 'YYYY-MM-DD'. inactividad: resultado de getInactivityInfo(profile) (o null).
// muscleContext: { muscle, pattern, allWorkouts } — muscle/pattern del ejercicio objetivo (para
// derivar la PATTERN_ZONE) y el array completo de workouts del usuario, para calcular muscleGap.
// No depende de ningún estado guardado — todo se deriva de las fechas del historial en cada llamada.
export function getReentryState(exerciseSessions, today, inactividad, muscleContext = {}) {
  const { muscle: targetMuscle, pattern: targetPattern, allWorkouts } = muscleContext
  const targetZone = targetPattern ? PATTERN_ZONE[targetPattern] : null

  // Point 7: nunca asumir orden — ordenar explícitamente por fecha descendente (estable ante empates).
  const s = [...(exerciseSessions ?? [])]
    .filter(w => w?.date)
    .sort((a, b) => b.date.localeCompare(a.date))

  if (!s.length) return EMPTY_STATE

  let k, baseline, exerciseGap, returnBoundary

  const gapToToday = daysBetween(s[0].date, today)
  if (gapToToday >= 14) {
    // Todavía no volvió: el parate va desde la última sesión real hasta hoy.
    k = 0
    baseline = s[0]
    exerciseGap = gapToToday
    returnBoundary = today
  } else {
    // Ya entrenó recientemente — buscar el gap de 14+ días más reciente dentro del historial cercano
    // (a lo sumo 4 sesiones atrás, que es el N máximo posible: 3 + 1 por motivo médico).
    let foundI = null
    for (let i = 0; i <= 3; i++) {
      if (!s[i + 1]) break
      if (daysBetween(s[i + 1].date, s[i].date) >= 14) { foundI = i; break }
    }
    if (foundI === null) return EMPTY_STATE
    k = foundI + 1
    baseline = s[foundI + 1]
    exerciseGap = daysBetween(baseline.date, s[foundI].date)
    returnBoundary = s[foundI].date // primera sesión posterior al gap
  }

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

  // muscleGap: días desde la última sesión de fuerza (cualquier ejercicio) que trabajó el mismo
  // músculo o zona. Nunca es mayor que exerciseGap (el propio ejercicio objetivo es un candidato).
  const muscleGap = computeMuscleGap(allWorkouts, today, targetMuscle, targetZone)
  const isTechnical = muscleGap !== null && muscleGap < 14

  // Vuelta técnica: el músculo/zona sigue entrenado por otro lado, solo se perdió la técnica de
  // ESTE ejercicio puntual — escalón mínimo fijo. Si no, tabla normal, pero por muscleGap (no por
  // exerciseGap): si otro ejercicio mantuvo el músculo más fresco de lo que sugiere este ejercicio
  // solo, el escalón debe reflejar esa frescura real.
  const { R, N } = isTechnical ? getTechnicalReentryStep(motivo) : getReentrySteps(muscleGap ?? exerciseGap, motivo)

  // Las sesiones de reentrada son las más cercanas al baseline entre las k hechas desde que volvió
  // (si k > N, las sesiones más nuevas ya son post-reentrada, a carga normal, y no se excluyen).
  const capped = Math.min(k, N)
  const reentrySessionDates = s.slice(k - capped, k).map(w => w.date)

  if (k >= N) {
    return { inReentry: false, sessionNumber: k + 1, totalSessions: N, reduction: null, baseline, gapDays: exerciseGap, exerciseGap, muscleGap, isTechnical, motivo, reentrySessionDates }
  }

  const sessionNumber = k + 1
  const reduction = getSessionReduction(R, N, sessionNumber)

  return { inReentry: true, sessionNumber, totalSessions: N, reduction, baseline, gapDays: exerciseGap, exerciseGap, muscleGap, isTechnical, motivo, reentrySessionDates }
}
