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

const addDaysStr = (dateStr, n) => {
  const d = parseISO(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return dateToLocal(d)
}

const mondayOfStr = (dateStr) => weekKey(parseISO(dateStr + 'T12:00:00'))

const EMPTY_BUCKETS = { 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 }

// Estadísticas del dorso de la tarjeta de racha — función pura, sin dependencias de React.
// Período: últimas 12 semanas COMPLETAS (lunes a domingo), sin incluir la semana en curso. Si el
// usuario tiene menos de 12 semanas de historial (primer entrenamiento real más reciente que el
// inicio nominal del período), el período se acorta a las semanas desde esa primera semana.
export function computeStreakStats(workouts, today) {
  const record = computeStreak(workouts).record
  const real = (workouts ?? []).filter(w => w.date && REAL_WORKOUT_TYPES.includes(w.type))

  const emptyResult = { record, average: 0, buckets: { ...EMPTY_BUCKETS }, typePercents: {}, weeksConsidered: 0, isEmpty: true }
  if (!real.length) return emptyResult

  const currentMonday = mondayOfStr(today)
  const lastCompleteMonday = addDaysStr(currentMonday, -7) // última semana YA cerrada (no la actual)

  const firstDate = real.reduce((min, w) => (w.date < min ? w.date : min), real[0].date)
  const firstMonday = mondayOfStr(firstDate)
  const nominalStartMonday = addDaysStr(lastCompleteMonday, -11 * 7) // 12 semanas terminando en lastCompleteMonday
  const startMonday = firstMonday > nominalStartMonday ? firstMonday : nominalStartMonday

  if (startMonday > lastCompleteMonday) return emptyResult // todavía no hay ninguna semana completa

  const weekStarts = []
  for (let mon = startMonday; mon <= lastCompleteMonday; mon = addDaysStr(mon, 7)) weekStarts.push(mon)

  const periodEnd = addDaysStr(lastCompleteMonday, 6)
  const periodReal = real.filter(w => w.date >= startMonday && w.date <= periodEnd)

  const buckets = { ...EMPTY_BUCKETS }
  let totalDays = 0
  weekStarts.forEach(monday => {
    const sunday = addDaysStr(monday, 6)
    const days = new Set(periodReal.filter(w => w.date >= monday && w.date <= sunday).map(w => w.date)).size
    totalDays += days
    if (days === 1) buckets[1]++
    else if (days === 2) buckets[2]++
    else if (days === 3) buckets[3]++
    else if (days === 4) buckets[4]++
    else if (days >= 5) buckets['5+']++
  })

  const average = Math.round((totalDays / weekStarts.length) * 10) / 10

  if (!periodReal.length) {
    return { record, average, buckets, typePercents: {}, weeksConsidered: weekStarts.length, isEmpty: true }
  }

  // Porcentaje de sesiones por tipo — método de restos mayores para que sume exactamente 100,
  // con empates de resto desempatados por el orden fijo de REAL_WORKOUT_TYPES (determinístico).
  const typeCounts = {}
  periodReal.forEach(w => { typeCounts[w.type] = (typeCounts[w.type] ?? 0) + 1 })
  const total = periodReal.length
  const parts = REAL_WORKOUT_TYPES.filter(t => typeCounts[t] > 0).map(type => {
    const exact = (typeCounts[type] / total) * 100
    return { type, floor: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  const typePercents = {}
  parts.forEach(p => { typePercents[p.type] = p.floor })
  let remaining = 100 - parts.reduce((s, p) => s + p.floor, 0)
  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < remaining; i++) typePercents[byRemainder[i].type] += 1

  return { record, average, buckets, typePercents, weeksConsidered: weekStarts.length, isEmpty: false }
}
