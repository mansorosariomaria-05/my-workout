import { parseISO } from 'date-fns'
import { weekKey, dateToLocal, getTodayLocal } from './dates.js'
import { addDays, mondayOf, sundayOf } from './weeks.js'

// Únicos tipos de workout que cuentan como "entrenamiento real" para racha, logros y estadísticas.
export const REAL_WORKOUT_TYPES = ['fuerza', 'cardio', 'clase', 'tabata']

// Cantidad mínima de días distintos de entrenamiento real para que una semana cuente en la racha.
export const STREAK_MIN_DAYS = 3

// RACHA ESTRICTA (fuente única: la usan Inicio, Progreso, los logros y progressStats).
//   · Cuenta semanas CONSECUTIVAS (lunes a domingo) con `STREAK_MIN_DAYS` (3) o más días distintos de entrenamiento real.
//   · Una semana ya cerrada con menos de 3 días (incluidas las de 0) CORTA la racha.
//   · La semana en curso suma si ya tiene 3 días; si todavía no, no suma pero tampoco corta.
//   · Los workouts con fecha posterior a `today` no cuentan.
// Devuelve:
//   current / record        cantidad de semanas de la racha actual y de la mejor racha del historial
//   currentStart/currentEnd lunes de la primera semana y domingo de la última semana de la racha actual (null si es 0)
//   recordStart/recordEnd   lo mismo para el récord (ante un empate gana la racha más reciente)
//   last12                  las últimas 12 semanas (la más vieja primero, la última es la actual) con sus días
export function computeStreak(workouts, today = getTodayLocal()) {
  const realW = (workouts ?? []).filter(w => w && w.date && w.date <= today && REAL_WORKOUT_TYPES.includes(w.type))
  const weekMap = new Map()
  realW.forEach(w => {
    const mon = mondayOf(w.date)
    if (!weekMap.has(mon)) weekMap.set(mon, new Set())
    weekMap.get(mon).add(w.date)
  })

  const thisMonday = mondayOf(today)
  const last12 = Array.from({ length: 12 }, (_, i) => {
    const weekStart = addDays(thisMonday, -7 * (11 - i))
    const days = weekMap.get(weekStart)?.size ?? 0
    return { weekStart, weekEnd: sundayOf(weekStart), days, met: days >= STREAK_MIN_DAYS, isCurrent: weekStart === thisMonday }
  })
  const empty = { current: 0, record: 0, currentStart: null, currentEnd: null, recordStart: null, recordEnd: null, last12 }
  if (!realW.length) return empty

  let mon = mondayOf(realW.reduce((min, w) => (w.date < min ? w.date : min), realW[0].date))
  let run = 0, runStart = null, runEnd = null
  let record = 0, recordStart = null, recordEnd = null

  while (mon <= thisMonday) {
    const days = weekMap.get(mon)?.size ?? 0
    const isCurrentWeek = mon === thisMonday
    if (days >= STREAK_MIN_DAYS) {
      if (run === 0) runStart = mon
      run += 1
      runEnd = sundayOf(mon)
      if (run >= record) { record = run; recordStart = runStart; recordEnd = runEnd }
    } else if (!isCurrentWeek) {
      run = 0; runStart = null; runEnd = null
    }
    // semana en curso con menos de 3 días: no suma y no corta
    mon = addDays(mon, 7)
  }

  return {
    current: run, record,
    currentStart: run > 0 ? runStart : null, currentEnd: run > 0 ? runEnd : null,
    recordStart: record > 0 ? recordStart : null, recordEnd: record > 0 ? recordEnd : null,
    last12,
  }
}

const addDaysStr = (dateStr, n) => {
  const d = parseISO(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return dateToLocal(d)
}

const mondayOfStr = (dateStr) => weekKey(parseISO(dateStr + 'T12:00:00'))

const EMPTY_BUCKETS = { zero: 0, oneTwo: 0, threeFour: 0, fivePlus: 0 }

// Estadísticas del dorso de la tarjeta de racha — función pura, sin dependencias de React.
// Período: últimas 12 semanas COMPLETAS (lunes a domingo), sin incluir la semana en curso. Si el
// usuario tiene menos de 12 semanas de historial (primer entrenamiento real más reciente que el
// inicio nominal del período), el período se acorta a las semanas desde esa primera semana.
// buckets: cantidad de semanas del período con 0, 1-2, 3-4 o 5+ días únicos de entrenamiento real
// (a diferencia de la racha, acá las semanas de 0 días sí se cuentan, en su propio bucket).
export function computeStreakStats(workouts, today) {
  const record = computeStreak(workouts).record
  const real = (workouts ?? []).filter(w => w.date && REAL_WORKOUT_TYPES.includes(w.type))

  const emptyResult = { record, buckets: { ...EMPTY_BUCKETS }, weeksConsidered: 0, isEmpty: true }
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
  weekStarts.forEach(monday => {
    const sunday = addDaysStr(monday, 6)
    const days = new Set(periodReal.filter(w => w.date >= monday && w.date <= sunday).map(w => w.date)).size
    if (days === 0) buckets.zero++
    else if (days <= 2) buckets.oneTwo++
    else if (days <= 4) buckets.threeFour++
    else buckets.fivePlus++
  })

  return { record, buckets, weeksConsidered: weekStarts.length, isEmpty: !periodReal.length }
}
