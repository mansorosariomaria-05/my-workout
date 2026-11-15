// Período seleccionado en Progreso ("Este mes" · "3 meses" · "Todo") y ventanas de fechas. Funciones PURAS.
// Lo comparten progressView.js (Constancia, fuerza, cuerpo) y running.js. Documentado en LOGICA_TECNICA.md (sección 29).
//
// Convenciones: solo cuentan los workouts REAL_WORKOUT_TYPES con fecha, nunca los futuros; semanas de lunes a domingo;
// fechas 'YYYY-MM-DD' sin zona horaria.

import { REAL_WORKOUT_TYPES } from './streak.js'
import { addDays, daysBetween, mondayOf, monthOf } from './weeks.js'

const REAL = new Set(REAL_WORKOUT_TYPES)

export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export const realWorkouts = (workouts, today) =>
  (workouts ?? []).filter(w => w && w.date && REAL.has(w.type) && w.date <= today)

export const VIEW_PERIODS = [
  { key: 'month', label: 'Este mes', weeks: null },
  { key: '13w',   label: '3 meses',  weeks: 13 },
  { key: 'all',   label: 'Todo',     weeks: null },
]

export const DEFAULT_VIEW_PERIOD = 'month'

// Una clave de período válida o el valor por defecto ("Este mes"): protege contra estados viejos (p. ej. '4w').
export const normalizeViewPeriod = (key) => (VIEW_PERIODS.some(p => p.key === key) ? key : DEFAULT_VIEW_PERIOD)

const pad2 = (n) => String(n).padStart(2, '0')
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate() // m = 1..12

// "Este mes": del día 1 del mes en curso hasta hoy, contra el MISMO tramo del mes anterior (del 1 al mismo día; si el
// mes anterior tiene menos días, hasta su último día).
// { month, prevMonth ('YYYY-MM'), monthIndex, prevMonthIndex (1..12), monthName, prevMonthName, day (hoy), cutoff (último
//   día del tramo anterior), prevLength (días del mes anterior), start, end,
//   previous: { start, end } (tramo equivalente), prevFull: { start, end } (mes anterior completo), prevIsFull }
export function monthStretch(today) {
  const [y, m, day] = today.split('-').map(Number)
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  const start = `${y}-${pad2(m)}-01`
  const prevStart = `${py}-${pad2(pm)}-01`
  const prevLength = daysInMonth(py, pm)
  const cutoff = Math.min(day, prevLength)
  return {
    month: monthOf(today), prevMonth: `${py}-${pad2(pm)}`, monthIndex: m, prevMonthIndex: pm,
    monthName: MONTH_NAMES[m - 1], prevMonthName: MONTH_NAMES[pm - 1],
    day, cutoff, prevLength, start, end: today,
    previous: { start: prevStart, end: addDays(prevStart, cutoff - 1) },
    prevFull: { start: prevStart, end: addDays(prevStart, prevLength - 1) },
    prevIsFull: cutoff === prevLength,
  }
}

// 'month': ver monthStretch (el período anterior es el mismo tramo del mes anterior).
// '13w': las 13 semanas que terminan en la semana en curso (la última es parcial, llega hasta hoy); el período anterior
// termina el día anterior al inicio y dura LO MISMO en días (comparación pareja aunque la semana en curso esté a medias).
// 'all': desde el lunes del primer entrenamiento hasta hoy, sin comparación.
export function resolveViewPeriod(key, today, workouts = []) {
  if (key === 'month') {
    const st = monthStretch(today)
    return { key: 'month', weeks: null, start: st.start, end: st.end, previous: st.previous, prevFull: st.prevFull }
  }
  const n = VIEW_PERIODS.find(p => p.key === key)?.weeks
  if (!n) {
    const real = realWorkouts(workouts, today)
    const first = real.length ? real.reduce((min, w) => (w.date < min ? w.date : min), real[0].date) : today
    return { key: 'all', weeks: null, start: mondayOf(first), end: today, previous: null }
  }
  const start = addDays(mondayOf(today), -7 * (n - 1))
  const length = daysBetween(start, today) + 1
  const prevStart = addDays(start, -7 * n)
  return { key, weeks: n, start, end: today, previous: { start: prevStart, end: addDays(prevStart, length - 1) } }
}

// Filtra los entrenamientos reales de una ventana [start, end].
export const workoutsInRange = (workouts, range, today) =>
  realWorkouts(workouts, today).filter(w => w.date >= range.start && w.date <= range.end)

// Semanas (lunes) que toca la ventana, en orden cronológico.
export function weekStartsOf(range) {
  const out = []
  for (let ws = mondayOf(range.start); ws <= range.end; ws = addDays(ws, 7)) out.push(ws)
  return out
}
