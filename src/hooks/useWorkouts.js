import { useContext, useMemo } from 'react'
import { parseISO } from 'date-fns'
import { WorkoutsContext } from '../context/WorkoutsContext'
import { dateToLocal, getTodayLocal } from '../utils/dates'
import { computeWeeklyStreak3Plus, computeMonthSummary } from '../utils/progressStats'

// Lee el historial COMPLETO de workouts del estado compartido (WorkoutsProvider, src/context/
// WorkoutsContext.jsx): una sola carga, una sola sincronización de borradores y un solo conjunto de
// listeners para toda la app. Acá solo viven los cálculos derivados. `workouts` viene siempre ordenado
// por fecha descendente (varios cálculos, como los logros, dependen de que el último sea el más viejo).
// Ver LOGICA_TECNICA.md sección 22.
export function useWorkouts() {
  const ctx = useContext(WorkoutsContext)
  if (!ctx) throw new Error('useWorkouts debe usarse dentro de WorkoutsProvider')
  const { workouts, loading, loadError, saveWorkout, refresh, forceReload } = ctx

  const getLastWeightsForExercise = (exerciseId) => {
    // No asumir orden: los drafts offline pendientes de sync pueden anteponerse sin garantía de fecha.
    const relevant = workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === exerciseId))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
    return relevant.map(w => {
      const ex = w.exercises.find(e => e.exerciseId === exerciseId)
      return { date: w.date, sets: ex?.sets ?? [], fatigue: w.fatigue }
    })
  }

  // Historial completo (sin slice) de un ejercicio, ordenado por fecha descendente — usado por
  // el modo regreso (src/utils/reentry.js), que necesita ver más allá de las últimas 5 sesiones.
  const getExerciseSessions = (exerciseId) => {
    const relevant = workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === exerciseId))
      .sort((a, b) => b.date.localeCompare(a.date))
    return relevant.map(w => {
      const ex = w.exercises.find(e => e.exerciseId === exerciseId)
      return { date: w.date, sets: ex?.sets ?? [], fatigue: w.fatigue }
    })
  }

  const getPRForExercise = (exerciseId) => {
    let pr = 0
    workouts.forEach(w => {
      if (w.type !== 'fuerza') return
      w.exercises?.forEach(e => {
        if (e.exerciseId !== exerciseId) return
        e.sets?.forEach(s => {
          if ((s.weight ?? 0) > pr) pr = s.weight
        })
      })
    })
    return pr
  }

  const getLearnedWeights = (exerciseId) => {
    const weights = new Set()
    // No asumir orden (ver getLastWeightsForExercise) — acá no cambia el resultado (es una unión de
    // pesos, sin importar orden), pero se ordena explícitamente por consistencia con el resto.
    workouts
      .filter(w => w.type === 'fuerza')
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(w => {
        w.exercises?.forEach(e => {
          if (e.exerciseId !== exerciseId) return
          e.sets?.forEach(s => {
            const n = Number(s.weight) || 0
            if (n > 0) weights.add(n)
          })
        })
      })
    return [...weights].sort((a, b) => a - b)
  }

  const getLastFatigueForExercise = (exerciseId) => {
    const relevant = workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === exerciseId))
      .slice(0, 2)
    return relevant.map(w => w.fatigue ?? 5)
  }

  const getTrainedMusclesRecovery = (profile) => {
    const hours = profile?.tipoRutina === 'fullbody' ? 48 : 72
    const cutoff = new Date()
    cutoff.setHours(cutoff.getHours() - hours)
    const cutoffStr = dateToLocal(cutoff)
    const muscles = new Set()
    workouts.forEach(w => {
      if (w.date >= cutoffStr) {
        w.muscleGroups?.forEach(m => muscles.add(m))
      }
    })
    return Array.from(muscles)
  }

  const getWeekWorkouts = (weekStartStr) => {
    const start = parseISO(weekStartStr + 'T12:00:00')
    const end   = new Date(start.getTime() + 6 * 86400000)
    const endStr = dateToLocal(end)
    return workouts.filter(w => w.date >= weekStartStr && w.date <= endStr)
  }

  // Returns { current, record } — ver src/utils/streak.js para la regla completa.
  // "Racha semanal 3+" (total de semanas con 3+ días) y resumen del mes en curso (dorso de la tarjeta): la misma
  // fuente para Inicio y Progreso (utils/progressStats.js). Se memoizan por workouts y por día.
  const today = getTodayLocal()
  const weeklyStreak = useMemo(() => computeWeeklyStreak3Plus(workouts, today), [workouts, today])
  const monthSummary = useMemo(() => computeMonthSummary(workouts, today), [workouts, today])
  const getWeeklyStreak3Plus = () => weeklyStreak
  const getMonthSummary = () => monthSummary

  return {
    workouts, loading, loadError, saveWorkout,
    getLastWeightsForExercise, getExerciseSessions, getPRForExercise, getLearnedWeights,
    getLastFatigueForExercise, getTrainedMusclesRecovery,
    getWeekWorkouts, getWeeklyStreak3Plus, getMonthSummary, reload: refresh, forceReload,
  }
}
