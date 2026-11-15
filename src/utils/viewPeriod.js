// Período seleccionado en Progreso ("4 semanas" · "3 meses" · "Todo") y ventanas de fechas. Funciones PURAS.
// Lo comparten progressView.js (Constancia, fuerza, cuerpo) y running.js. Documentado en LOGICA_TECNICA.md (sección 29).
//
// Convenciones: solo cuentan los workouts REAL_WORKOUT_TYPES con fecha, nunca los futuros; semanas de lunes a domingo;
// fechas 'YYYY-MM-DD' sin zona horaria.

import { REAL_WORKOUT_TYPES } from './streak.js'
import { addDays, daysBetween, mondayOf } from './weeks.js'

const REAL = new Set(REAL_WORKOUT_TYPES)

export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export const realWorkouts = (workouts, today) =>
  (workouts ?? []).filter(w => w && w.date && REAL.has(w.type) && w.date <= today)

export const VIEW_PERIODS = [
  { key: '4w',  label: '4 semanas', weeks: 4 },
  { key: '13w', label: '3 meses',   weeks: 13 },
  { key: 'all', label: 'Todo',      weeks: null },
]

// '4w' / '13w': las N semanas que terminan en la semana en curso (la última es parcial, llega hasta hoy).
// El período anterior termina el día anterior al inicio y dura LO MISMO en días (comparación pareja aunque
// la semana en curso esté a medias). 'all': desde el lunes del primer entrenamiento hasta hoy, sin comparación.
export function resolveViewPeriod(key, today, workouts = []) {
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
