// Cálculos de la pantalla Progreso (estructura "Constancia · Más fuerte que antes · Cómo está tu cuerpo").
// Funciones PURAS: reciben workouts y devuelven datos listos para mostrar. Documentadas en LOGICA_TECNICA.md (sección 29).
//
// Convenciones (las mismas de progressStats.js):
//   · Solo cuentan los workouts REAL_WORKOUT_TYPES con fecha, y nunca los futuros.
//   · Semanas de lunes a domingo. Fechas 'YYYY-MM-DD' sin zona horaria.
//   · "Sin dato" (fatiga ausente, null o '') NUNCA cuenta como 0.

import { REAL_WORKOUT_TYPES } from './streak.js'
import { getExerciseUnit } from './exerciseUnit.js'
import { finiteFatigue, round1 } from './progressStats.js'
import { diffKg } from './format.js'
import { addDays, daysBetween, mondayOf, monthOf } from './weeks.js'

const REAL = new Set(REAL_WORKOUT_TYPES)

export const STABLE_AFTER_DAYS = 28      // más de 4 semanas sin mejorar el peso → "estable"
export const RANKING_LIMIT = 5
export const BODY_MIN_RECORDS = 3        // registros de esfuerzo mínimos en el período para mostrar el promedio
export const FATIGUE_LIGHT_BELOW = 5     // promedio < 5 → liviano
export const FATIGUE_HIGH_FROM = 7       // promedio ≥ 7 → alto (misma regla que getFatigueStatus)

export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const realWorkouts = (workouts, today) =>
  (workouts ?? []).filter(w => w && w.date && REAL.has(w.type) && w.date <= today)

const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length

// ─── Período seleccionado ────────────────────────────────────────────────────

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
function weekStartsOf(range) {
  const out = []
  for (let ws = mondayOf(range.start); ws <= range.end; ws = addDays(ws, 7)) out.push(ws)
  return out
}

// ─── Encabezado: histórico ───────────────────────────────────────────────────

// { total, months }: entrenamientos reales de todo el historial y meses calendario desde el primero (mínimo 1).
export function computeHistorySummary(workouts, today) {
  const real = realWorkouts(workouts, today)
  if (!real.length) return { total: 0, months: 0 }
  const first = real.reduce((min, w) => (w.date < min ? w.date : min), real[0].date)
  const [fy, fm] = first.split('-').map(Number)
  const [ty, tm] = today.split('-').map(Number)
  return { total: real.length, months: Math.max(1, (ty - fy) * 12 + (tm - fm)) }
}

// ─── Constancia ──────────────────────────────────────────────────────────────

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate() // m = 1..12

// Entrenamientos del mes en curso vs. el mes anterior A LA MISMA ALTURA del mes (hasta el mismo día; si el mes
// anterior es más corto, hasta su último día). Un entrenamiento = un workout real.
//   tone: 'up' (más) · 'same' (igual) · 'down' (menos)
export function computeMonthComparison(workouts, today) {
  const [y, m, day] = today.split('-').map(Number)
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  const month = monthOf(today)
  const prevMonth = `${py}-${String(pm).padStart(2, '0')}`
  const cutoff = Math.min(day, daysInMonth(py, pm))

  const real = realWorkouts(workouts, today)
  const current = real.filter(w => monthOf(w.date) === month).length
  const previous = real.filter(w => monthOf(w.date) === prevMonth && Number(w.date.slice(8, 10)) <= cutoff).length
  const diff = current - previous
  const monthName = MONTH_NAMES[m - 1]
  const prevMonthName = MONTH_NAMES[pm - 1]
  const tone = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same'
  const text = diff > 0 ? `${diff} más que en ${prevMonthName}`
    : diff < 0 ? `${-diff} menos que en ${prevMonthName}`
    : `igual que en ${prevMonthName}`
  return { month, monthName, prevMonth, prevMonthName, day, cutoff, current, previous, diff, tone, text }
}

const BAR_TYPES = ['fuerza', 'cardio', 'clase', 'tabata']
const emptyCounts = () => ({ total: 0, fuerza: 0, cardio: 0, clase: 0, tabata: 0 })
const addTo = (bar, type) => { bar.total += 1; if (BAR_TYPES.includes(type)) bar[type] += 1 }

// Barras de "entrenamientos por semana" según el período.
//   '4w' / '13w' → una barra por semana (lunes a domingo), `current` marca la semana en curso.
//   'all'        → una barra por mes calendario, desde el primer entrenamiento hasta el mes en curso (meses sin
//                  entrenar incluidos, en cero); `current` marca el mes en curso. Sin línea de objetivo.
// Cada barra: { key, label, title, total, fuerza, cardio, clase, tabata, current }. `goal` solo en vista semanal.
export function computeConstanciaBars(workouts, periodKey, today, goal = null) {
  const range = resolveViewPeriod(periodKey, today, workouts)
  const real = workoutsInRange(workouts, range, today)

  if (periodKey === 'all') {
    if (!real.length) return { kind: 'month', bars: [], goal: null }
    const first = monthOf(real.reduce((min, w) => (w.date < min ? w.date : min), real[0].date))
    const last = monthOf(today)
    const bars = []
    let [y, m] = first.split('-').map(Number)
    for (;;) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      bars.push({ key, label: MONTH_SHORT[m - 1], title: `${MONTH_NAMES[m - 1]} ${y}`, ...emptyCounts(), current: key === last })
      if (key === last) break
      if (++m > 12) { m = 1; y += 1 }
    }
    const byKey = new Map(bars.map(b => [b.key, b]))
    real.forEach(w => { const b = byKey.get(monthOf(w.date)); if (b) addTo(b, w.type) })
    return { kind: 'month', bars, goal: null }
  }

  const starts = weekStartsOf(range)
  const thisMonday = mondayOf(today)
  const bars = starts.map(ws => {
    const [, mm, dd] = ws.split('-')
    return { key: ws, label: `${Number(dd)}/${Number(mm)}`, title: `Semana del ${Number(dd)}/${Number(mm)}`, ...emptyCounts(), current: ws === thisMonday }
  })
  const byKey = new Map(bars.map(b => [b.key, b]))
  real.forEach(w => { const b = byKey.get(mondayOf(w.date)); if (b) addTo(b, w.type) })
  return { kind: 'week', bars, goal }
}

// ─── Más fuerte que antes ────────────────────────────────────────────────────

// Texto relativo corto para fechas pasadas: "hoy" · "hace 3 días" · "hace 5 sem." · "hace 4 meses".
export function timeAgoText(dateStr, today) {
  const days = Math.max(0, daysBetween(dateStr, today))
  if (days === 0) return 'hoy'
  if (days === 1) return 'hace 1 día'
  if (days < 7) return `hace ${days} días`
  if (days >= 90) return `hace ${Math.round(days / 30)} meses`
  const weeks = Math.round(days / 7)
  return weeks === 1 ? 'hace 1 sem.' : `hace ${weeks} sem.`
}

// Sesiones de fuerza por ejercicio (clave = exerciseId, la misma que usa ExerciseProgress), en orden cronológico.
// Cada sesión: { date, weight (máximo de la sesión), reps (máximo de repeticiones con ese peso) }.
// Los ejercicios sin peso (> 0) en una sesión no generan sesión.
function strengthSessions(workouts, today) {
  const list = []
  ;(workouts ?? []).forEach((w, i) => { if (w && w.type === 'fuerza' && w.date && w.date <= today && Array.isArray(w.exercises)) list.push({ w, i }) })
  // Orden cronológico; ante empate de fecha se asume la lista en orden descendente (como la entrega el proveedor).
  list.sort((a, b) => a.w.date.localeCompare(b.w.date) || b.i - a.i)

  const byEx = new Map()
  for (const { w } of list) {
    const inWorkout = new Map()
    for (const e of w.exercises) {
      if (!e?.exerciseId || !Array.isArray(e.sets)) continue
      for (const s of e.sets) {
        const kg = Number(s?.weight) || 0
        if (!(kg > 0)) continue
        const reps = Number(s?.reps) || 0
        let cur = inWorkout.get(e.exerciseId)
        if (!cur) {
          cur = { date: w.date, weight: 0, reps: 0 }
          inWorkout.set(e.exerciseId, cur)
          let g = byEx.get(e.exerciseId)
          if (!g) { g = { id: e.exerciseId, name: e.name || e.exerciseId, unit: 'reps', sessions: [] }; byEx.set(e.exerciseId, g) }
          g.name = e.name || g.name
          g.unit = getExerciseUnit(e)
          g.sessions.push(cur)
        }
        if (kg > cur.weight) { cur.weight = kg; cur.reps = reps }
        else if (kg === cur.weight && reps > cur.reps) cur.reps = reps
      }
    }
  }
  return byEx
}

// Ranking de progreso de peso del período: por ejercicio, delta = mejor peso − primer peso registrado DENTRO del
// período (se necesitan al menos 2 sesiones con peso en el período y delta > 0). Orden: mayor delta en kg, luego
// mayor % y luego nombre. Hasta `limit` filas. Cada fila:
//   { id, name, unit, firstWeight, bestWeight, bestReps, delta, pct, lastImprovementDate, stable }
//   · bestReps = máximo de repeticiones (o segundos) hechas con el mejor peso en el período
//   · lastImprovementDate = fecha de la última sesión del período que superó el máximo anterior del período
//   · stable = esa fecha quedó a más de STABLE_AFTER_DAYS (28) días de hoy → chip neutral "estable"
export function computeStrengthRanking(workouts, periodKey, today, { limit = RANKING_LIMIT } = {}) {
  const range = resolveViewPeriod(periodKey, today, workouts)
  const rows = []
  for (const g of strengthSessions(workouts, today).values()) {
    const inPeriod = g.sessions.filter(s => s.date >= range.start && s.date <= range.end)
    if (inPeriod.length < 2) continue
    const first = inPeriod[0]
    let best = first.weight, bestReps = first.reps, lastImprovementDate = null
    for (const s of inPeriod.slice(1)) {
      if (s.weight > best) { best = s.weight; bestReps = s.reps; lastImprovementDate = s.date }
      else if (s.weight === best && s.reps > bestReps) bestReps = s.reps
    }
    const delta = diffKg(best, first.weight)
    if (!(delta > 0)) continue
    rows.push({
      id: g.id, name: g.name, unit: g.unit,
      firstWeight: first.weight, bestWeight: best, bestReps, delta,
      pct: Math.round((delta / first.weight) * 100),
      lastImprovementDate,
      stable: daysBetween(lastImprovementDate, today) > STABLE_AFTER_DAYS,
    })
  }
  rows.sort((a, b) => b.delta - a.delta || b.pct - a.pct || a.name.localeCompare(b.name))
  return { rows: rows.slice(0, limit), total: rows.length }
}

// ─── Cómo está tu cuerpo (esfuerzo percibido) ────────────────────────────────

// Nivel según el promedio (1 decimal): < 5 liviano · 5 a < 7 moderado · ≥ 7 alto. null sin promedio.
export function getFatigueLevel(avg) {
  if (avg == null || !Number.isFinite(avg)) return null
  if (avg < FATIGUE_LIGHT_BELOW) return 'liviano'
  if (avg < FATIGUE_HIGH_FROM) return 'moderado'
  return 'alto'
}

const fatigueValues = (list) => list.map(finiteFatigue).filter(v => v != null)
const avgOrNull = (values) => (values.length >= BODY_MIN_RECORDS ? round1(mean(values)) : null)

// Resumen del esfuerzo percibido (campo `fatigue`, 1-10) del período:
//   avg      promedio (1 decimal) o null si hay menos de BODY_MIN_RECORDS registros
//   level    'liviano' | 'moderado' | 'alto' | null
//   previous promedio del período anterior equivalente (null si 'all' o con pocos registros)
//   trend    'up' | 'down' | 'same' | null — compara los promedios redondeados a 1 decimal
//   weekly   [{ weekStart, label, avg, count }] promedio por semana del período (avg null si la semana no tiene registros)
export function computeBodySummary(workouts, periodKey, today) {
  const range = resolveViewPeriod(periodKey, today, workouts)
  const inRange = workoutsInRange(workouts, range, today)
  const values = fatigueValues(inRange)
  const avg = avgOrNull(values)
  const previous = range.previous ? avgOrNull(fatigueValues(workoutsInRange(workouts, range.previous, today))) : null
  const trend = avg == null || previous == null ? null : avg > previous ? 'up' : avg < previous ? 'down' : 'same'

  const weekly = weekStartsOf(range).map(ws => {
    const vals = fatigueValues(inRange.filter(w => mondayOf(w.date) === ws))
    const [, mm, dd] = ws.split('-')
    return { weekStart: ws, label: `${Number(dd)}/${Number(mm)}`, avg: vals.length ? round1(mean(vals)) : null, count: vals.length }
  })
  return { avg, count: values.length, level: getFatigueLevel(avg), previous, trend, weekly }
}
