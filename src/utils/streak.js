import { parseISO } from 'date-fns'
import { weekKey, getWeekStartLocal, dateToLocal } from './dates.js'

// Únicos tipos de workout que cuentan como "entrenamiento real" para racha, logros y estadísticas.
export const REAL_WORKOUT_TYPES = ['fuerza', 'cardio', 'clase', 'tabata']

const nextMonday = (mondayStr) => {
  const d = parseISO(mondayStr + 'T12:00:00')
  d.setDate(d.getDate() + 7)
  return dateToLocal(d)
}

// Racha por semanas: cada semana (lunes a domingo) con 3+ días únicos de entrenamiento real suma +1.
// Semanas con 1-2 días no suman ni cortan. La racha vuelve a 0 solo tras 4 semanas calendario
// COMPLETAS seguidas con 0 días — la semana en curso nunca cuenta como una de esas 4 (aunque
// tenga 0 días hasta el momento). record = la racha más alta alcanzada en todo el historial.
export function computeStreak(workouts) {
  const realW = (workouts ?? []).filter(w => w.date && REAL_WORKOUT_TYPES.includes(w.type))
  if (!realW.length) return { current: 0, record: 0 }

  const weekMap = {}
  realW.forEach(w => {
    const mon = weekKey(parseISO(w.date + 'T12:00:00'))
    if (!weekMap[mon]) weekMap[mon] = new Set()
    weekMap[mon].add(w.date)
  })

  const thisWeekMonday = getWeekStartLocal()
  const earliestMonday = Object.keys(weekMap).sort()[0]

  let current = 0
  let record = 0
  let consecutiveEmpty = 0
  let mon = earliestMonday

  while (mon <= thisWeekMonday) {
    const days = weekMap[mon]?.size ?? 0
    const isCurrentWeek = mon === thisWeekMonday

    if (days >= 3) {
      current += 1
      consecutiveEmpty = 0
      record = Math.max(record, current)
    } else if (days >= 1) {
      consecutiveEmpty = 0
    } else if (!isCurrentWeek) {
      consecutiveEmpty += 1
      if (consecutiveEmpty >= 4) {
        current = 0
        consecutiveEmpty = 0
      }
    }
    // isCurrentWeek && days === 0: la semana en curso nunca cuenta como vacía — no se toca nada.

    mon = nextMonday(mon)
  }

  return { current, record }
}
