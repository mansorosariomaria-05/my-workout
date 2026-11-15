// Cálculos de la pantalla Progreso (estructura "Constancia · Más fuerte que antes · Cómo está tu cuerpo").
// Funciones PURAS: reciben workouts y devuelven datos listos para mostrar. Documentadas en LOGICA_TECNICA.md (sección 29).
//
// Convenciones (las mismas de progressStats.js):
//   · Solo cuentan los workouts REAL_WORKOUT_TYPES con fecha, y nunca los futuros.
//   · Semanas de lunes a domingo. Fechas 'YYYY-MM-DD' sin zona horaria.
//   · "Sin dato" (fatiga ausente, null o '') NUNCA cuenta como 0.

import { getExerciseUnit } from './exerciseUnit.js'
import { finiteFatigue, round1, percentagesSummingTo100 } from './progressStats.js'
import { diffKg, formatNumber, formatKm, formatScore } from './format.js'
import { addDays, daysBetween, mondayOf, monthOf } from './weeks.js'
import {
  MONTH_NAMES, MONTH_SHORT, realWorkouts, VIEW_PERIODS, DEFAULT_VIEW_PERIOD, normalizeViewPeriod, monthStretch,
  resolveViewPeriod, workoutsInRange, weekStartsOf,
} from './viewPeriod.js'
import { runsInWindow, paceOf, comparePace, firstLastPace, SUMMARY_MIN_RUNS, validRuns } from './running.js'

// El período seleccionado vive en viewPeriod.js; se reexporta desde acá para no cambiar a los consumidores.
export { VIEW_PERIODS, DEFAULT_VIEW_PERIOD, normalizeViewPeriod, monthStretch, resolveViewPeriod, workoutsInRange, MONTH_NAMES }

export const STABLE_AFTER_DAYS = 28      // más de 4 semanas sin mejorar el peso → "estable"
export const RANKING_LIMIT = 5
export const BODY_MIN_RECORDS = 3        // registros de esfuerzo mínimos en el período para mostrar el promedio
export const FATIGUE_LIGHT_BELOW = 5     // promedio < 5 → liviano
export const FATIGUE_HIGH_FROM = 7       // promedio ≥ 7 → alto (misma regla que getFatigueStatus)

const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length

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

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const distinctDayCount = (list) => new Set(list.map(w => w.date)).size

// Récords de peso de un tramo: ejercicios cuyo mejor peso DENTRO del tramo supera su máximo histórico ANTERIOR al tramo.
// Hace falta que existiera un máximo previo (> 0): la primera vez que se hace un ejercicio no es un récord.
function countWeightRecords(sessionsByExercise, range) {
  let n = 0
  for (const g of sessionsByExercise.values()) {
    let best = 0, prior = 0
    for (const s of g.sessions) {
      if (s.date < range.start) prior = Math.max(prior, s.weight)
      else if (s.date <= range.end) best = Math.max(best, s.weight)
    }
    if (best > 0 && prior > 0 && best > prior) n++
  }
  return n
}

// Una fila de la comparación. cur / prev: números (o null si no hay dato). fmt: formateador del valor.
//   diff = cur − prev (limpio de punto flotante); dir 'up' | 'down' | 'same' | null (falta un dato).
//   tone: 'better' (verde: mejora) · 'worse' (gris muted: empeora) · 'same' · 'neutral' (siempre muted, sin juicio).
//   Nunca hay un tono rojo.
function buildRow(key, label, cur, prev, fmt, { neutral = false } = {}) {
  const missing = cur == null || prev == null
  const diff = missing ? null : round1(cur - prev)
  const dir = diff == null ? null : diff > 0 ? 'up' : diff < 0 ? 'down' : 'same'
  const tone = neutral || dir == null ? 'neutral' : dir === 'up' ? 'better' : dir === 'down' ? 'worse' : 'same'
  const diffText = dir === 'up' ? `↑ ${fmt(diff)}` : dir === 'down' ? `↓ ${fmt(-diff)}` : dir === 'same' ? '= igual' : ''
  return {
    key, label, current: cur, previous: prev, diff, dir, tone, diffText,
    currentText: cur == null ? '—' : fmt(cur), previousText: prev == null ? '—' : fmt(prev),
  }
}

// Vista "Este mes" de Constancia: del día 1 al día de hoy contra el MISMO tramo del mes anterior (del 1 al mismo día;
// si el mes anterior tiene menos días, hasta su último día).
// {
//   month, monthName, prevMonthName, monthShort, prevMonthShort, day, cutoff,
//   label        "noviembre vs octubre · del 1 al 15" (en mayúsculas se muestra con CSS)
//   days         { current, previous } días DISTINTOS entrenados (REAL_WORKOUT_TYPES): el número protagonista
//   rows         filas visibles de la comparación (ver buildRow): días entrenados · km corridos · récords de peso · esfuerzo promedio
//   fullPrev     { days, km, text } del mes anterior COMPLETO ("Octubre completo: 12 días · 25,3 km"), o null
// }
// Reglas de las filas: días = días distintos; km = suma de las carreras válidas de utils/running.js; récords de peso = ejercicios
// cuyo mejor peso del tramo supera su máximo histórico anterior al tramo; esfuerzo = promedio del campo fatigue (1 decimal,
// siempre neutral). Mejor = más (verde), menos = gris. Una fila se oculta si vale 0 en ambos meses (esfuerzo: si falta en ambos).
export function computeMonthReport(workouts, today) {
  const st = monthStretch(today)
  const real = realWorkouts(workouts, today)
  const within = (list, r) => list.filter(w => w.date >= r.start && w.date <= r.end)
  const curRange = { start: st.start, end: st.end }
  const cur = within(real, curRange)
  const prev = within(real, st.previous)

  const runs = validRuns(workouts, today)
  const kmIn = (r) => sum(runsInWindow(runs, r.start, r.end).map(x => x.km))
  const sessions = strengthSessions(workouts, today)
  const effortOf = (list) => { const v = fatigueValues(list); return v.length ? round1(mean(v)) : null }

  const days = { current: distinctDayCount(cur), previous: distinctDayCount(prev) }
  const all = [
    buildRow('days', 'Días entrenados', days.current, days.previous, formatNumber),
    buildRow('km', 'Km corridos', kmIn(curRange), kmIn(st.previous), formatKm),
    buildRow('records', 'Récords de peso', countWeightRecords(sessions, curRange), countWeightRecords(sessions, st.previous), formatNumber),
    buildRow('effort', 'Esfuerzo promedio', effortOf(cur), effortOf(prev), formatScore, { neutral: true }),
  ]
  const rows = all.filter(r => !(r.current == null && r.previous == null) && !(r.current === 0 && r.previous === 0))

  const fullDays = distinctDayCount(within(real, st.prevFull))
  const fullKm = kmIn(st.prevFull)
  const fullPrev = st.prevIsFull || fullDays === 0 ? null : {
    days: fullDays, km: fullKm,
    text: `${capitalize(st.prevMonthName)} completo: ${formatNumber(fullDays)} ${fullDays === 1 ? 'día' : 'días'}${fullKm > 0 ? ` · ${formatKm(fullKm)}` : ''}`,
  }

  const label = `${st.monthName} vs ${st.prevMonthName} · del 1 al ${st.day}` + (st.cutoff < st.day ? ` (${st.prevMonthName}: del 1 al ${st.cutoff})` : '')
  return {
    month: st.month, monthName: st.monthName, prevMonthName: st.prevMonthName,
    monthShort: MONTH_SHORT[st.monthIndex - 1], prevMonthShort: MONTH_SHORT[st.prevMonthIndex - 1],
    day: st.day, cutoff: st.cutoff, label, days, rows, fullPrev,
  }
}

const BAR_TYPES = ['fuerza', 'cardio', 'clase', 'tabata']
const emptyCounts = () => ({ total: 0, fuerza: 0, cardio: 0, clase: 0, tabata: 0 })
const addTo = (bar, type) => { bar.total += 1; if (BAR_TYPES.includes(type)) bar[type] += 1 }

// Prioridad para asignar el tipo de un día con más de un workout (primero = gana).
export const DAY_TYPE_PRIORITY = ['fuerza', 'clase', 'tabata', 'cardio']

// Un día distinto = una entrada: [fecha, tipo]. Si el día tiene varios workouts, gana el tipo de mayor prioridad.
function distinctDays(real) {
  const byDate = new Map()
  for (const w of real) {
    const cur = byDate.get(w.date)
    if (cur == null || DAY_TYPE_PRIORITY.indexOf(w.type) < DAY_TYPE_PRIORITY.indexOf(cur)) byDate.set(w.date, w.type)
  }
  return [...byDate.entries()]
}

// Barras de la vista "Este mes": semanas que tocan el mes anterior y el actual, agrupadas por mes.
function computeMonthBars(workouts, today, goal) {
  const st = monthStretch(today)
  const first = mondayOf(st.prevFull.start)
  const thisMonday = mondayOf(today)
  const real = realWorkouts(workouts, today).filter(w => w.date >= first)
  const groupOf = (ws) => {
    if (ws === thisMonday) return st.month
    const g = monthOf(addDays(ws, 3))                 // el mes donde cae el jueves
    return g < st.prevMonth ? st.prevMonth : g > st.month ? st.month : g
  }
  const bars = []
  for (let ws = first; ws <= thisMonday; ws = addDays(ws, 7)) {
    const [, mm, dd] = ws.split('-')
    bars.push({ key: ws, label: String(Number(dd)), title: `Semana del ${Number(dd)}/${Number(mm)}`, ...emptyCounts(), current: ws === thisMonday, group: groupOf(ws) })
  }
  const byKey = new Map(bars.map(b => [b.key, b]))
  distinctDays(real).forEach(([date, type]) => { const b = byKey.get(mondayOf(date)); if (b) addTo(b, type) })
  const groups = []
  bars.forEach((b, i) => {
    const last = groups[groups.length - 1]
    if (last && last.key === b.group) last.count += 1
    else groups.push({ key: b.group, label: capitalize(MONTH_NAMES[Number(b.group.slice(5, 7)) - 1]), start: i, count: 1 })
  })
  return { kind: 'week', bars, goal, groups }
}

// Barras de "días entrenados" según el período (días DISTINTOS, no workouts: misma unidad que el objetivo semanal y la racha).
//   'month'      → una barra por semana (lunes a domingo) de TODAS las semanas que tocan el mes anterior y el actual
//                  (hasta 12), con `group` (mes al que se asigna cada semana) y `groups` para rotular cada mes. Cada semana va al
//                  mes donde cae su jueves (la mayoría de sus días); la primera queda en el mes anterior y la semana en
//                  curso, siempre en el actual. `current` marca la semana en curso.
//   '13w'        → una barra por semana, `current` marca la semana en curso.
//   'all'        → una barra por mes calendario, desde el primer entrenamiento hasta el mes en curso (meses sin
//                  entrenar incluidos, en cero); `current` marca el mes en curso. Sin línea de objetivo.
// Cada día cuenta una sola vez y se pinta con un único tipo (DAY_TYPE_PRIORITY: fuerza > clase > tabata > cardio).
// Cada barra: { key, label, title, total (días), fuerza, cardio, clase, tabata, current }. `goal` solo en vista semanal.
export function computeConstanciaBars(workouts, periodKey, today, goal = null) {
  if (periodKey === 'month') return computeMonthBars(workouts, today, goal)
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
    distinctDays(real).forEach(([date, type]) => { const b = byKey.get(monthOf(date)); if (b) addTo(b, type) })
    return { kind: 'month', bars, goal: null }
  }

  const starts = weekStartsOf(range)
  const thisMonday = mondayOf(today)
  const bars = starts.map(ws => {
    const [, mm, dd] = ws.split('-')
    return { key: ws, label: `${Number(dd)}/${Number(mm)}`, title: `Semana del ${Number(dd)}/${Number(mm)}`, ...emptyCounts(), current: ws === thisMonday }
  })
  const byKey = new Map(bars.map(b => [b.key, b]))
  distinctDays(real).forEach(([date, type]) => { const b = byKey.get(mondayOf(date)); if (b) addTo(b, type) })
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

// ─── Resumen de cierre por período (tarjeta de Constancia en "3 meses" y "Todo") ──

const sum = (arr) => arr.reduce((a, b) => a + b, 0)
const monthLabel = (key) => MONTH_NAMES[Number(key.slice(5, 7)) - 1]
const plural = (n, one, many) => `${formatNumber(n)} ${n === 1 ? one : many}`

export const HEADLINE_STRENGTH_MIN = 3   // "Subiste peso en N ejercicios" desde 3 ejercicios

// Cardio del período (solo carreras válidas, reglas de utils/running.js): null con menos de 2 carreras.
//   km = suma de TODAS las carreras válidas; avgPace = tiempo total / km totales de las carreras con ritmo entre 3:00 y 12:00
//   (null si ninguna lo tiene). La comparación necesita ≥ 3 carreras con ritmo válido en cada lado:
//   '13w': contra los 3 meses anteriores (mode 'previous'). 'all': primeras 3 vs. últimas 3, con ≥ 6 carreras (mode 'firstLast').
//   Sin comparación: mode null y solo el promedio.
// `improvement` = ritmo anterior − ritmo actual, en segundos redondeados (positivo = mejoró: el ritmo bajó).
function summarizeCardio(workouts, periodKey, range, today) {
  const all = validRuns(workouts, today)
  const runs = runsInWindow(all, range.start, range.end)
  if (runs.length < SUMMARY_MIN_RUNS) return null
  const pace = paceOf(runs)
  const out = { sessions: runs.length, km: sum(runs.map(r => r.km)), avgPace: pace == null ? null : Math.round(pace), mode: null, from: null, to: null, improvement: null, direction: null }
  const cmp = periodKey === 'all'
    ? firstLastPace(runs)
    : comparePace(runs, runsInWindow(all, range.previous.start, range.previous.end))
  if (cmp) Object.assign(out, { mode: periodKey === 'all' ? 'firstLast' : 'previous', from: cmp.from, to: cmp.to, improvement: cmp.improvement, direction: cmp.direction })
  return out
}

// Titular generado por reglas (no IA), el primero que se cumple. Tono siempre positivo o neutral.
//   a) promedio de días/semana (a 1 decimal, como se muestra) ≥ objetivo → "Sostuviste tu objetivo de N días por semana"
//   b) subió peso en 3+ ejercicios → "Subiste peso en N ejercicios: tu fuerza está creciendo"
//   c) el ritmo de running mejoró → "Corrés más rápido: tu ritmo mejoró N s/km"
//   d) por defecto → "Mantuviste el hábito: N semanas activas" (semanas completas con al menos un día entrenado)
// Si todavía no hay ninguna semana completa con entrenamientos: "Estás arrancando: cada entrenamiento suma".
export function pickPeriodHeadline({ weeks, strengthImproved, cardio }, goal) {
  if (weeks.avgDays != null && weeks.avgDays >= goal) {
    return { rule: 'goal', text: `Sostuviste tu objetivo de ${plural(goal, 'día', 'días')} por semana` }
  }
  if (strengthImproved >= HEADLINE_STRENGTH_MIN) {
    return { rule: 'strength', text: `Subiste peso en ${formatNumber(strengthImproved)} ejercicios: tu fuerza está creciendo` }
  }
  if (cardio?.direction === 'better') {
    return { rule: 'cardio', text: `Corrés más rápido: tu ritmo mejoró ${formatNumber(cardio.improvement)} s/km` }
  }
  if (weeks.activeWeeks >= 1) {
    return { rule: 'habit', text: `Mantuviste el hábito: ${plural(weeks.activeWeeks, 'semana activa', 'semanas activas')}` }
  }
  return { rule: 'start', text: 'Estás arrancando: cada entrenamiento suma' }
}

// Resumen del período para las vistas "3 meses" ('13w') y "Todo" ('all'); null en 'month' ("Este mes" es la vista "en vivo").
// {
//   periodKey, label ("Últimos 3 meses" / "Desde abril"), empty,
//   weeks:  { evaluated, met, avgDays, activeWeeks, goal }   solo semanas COMPLETAS (la semana en curso no cuenta)
//   mix:    [{ type, count, pct }]                           % por tipo sobre workouts, suman 100, solo tipos con valor
//   strengthImproved: N                                      ejercicios cuyo mejor peso del período supera su primer registro
//   cardio: ver summarizeCardio (o null)
//   bestMonth: { month, monthName, year, days } | null       solo en 'all'
//   headline: { rule, text }
// }
export function computePeriodSummary(workouts, periodKey, today, goal) {
  if (periodKey !== '13w' && periodKey !== 'all') return null
  const range = resolveViewPeriod(periodKey, today, workouts)
  const real = workoutsInRange(workouts, range, today)
  const thisYear = Number(today.slice(0, 4))

  let label = 'Últimos 3 meses'
  if (periodKey === 'all') {
    if (real.length) {
      const first = real.reduce((min, w) => (w.date < min ? w.date : min), real[0].date)
      const y = Number(first.slice(0, 4))
      label = `Desde ${monthLabel(first)}${y !== thisYear ? ` de ${y}` : ''}`
    } else label = 'Todo el historial'
  }

  const emptyWeeks = { evaluated: 0, met: 0, avgDays: null, activeWeeks: 0, goal }
  if (!real.length) {
    return {
      periodKey, label, empty: true, weeks: emptyWeeks, mix: [], strengthImproved: 0, cardio: null, bestMonth: null,
      headline: { rule: 'empty', text: 'Todavía no hay entrenamientos en este período. ¡Cuando entrenes, acá vas a ver tu resumen!' },
    }
  }

  // Semanas completas: lunes a domingo que terminaron antes de la semana en curso. Días DISTINTOS por semana.
  const daysByWeek = new Map()
  real.forEach(w => {
    const ws = mondayOf(w.date)
    if (!daysByWeek.has(ws)) daysByWeek.set(ws, new Set())
    daysByWeek.get(ws).add(w.date)
  })
  const done = weekStartsOf(range).filter(ws => ws < mondayOf(today))
  const counts = done.map(ws => daysByWeek.get(ws)?.size ?? 0)
  const weeks = {
    evaluated: done.length,
    met: counts.filter(n => n >= goal).length,
    avgDays: done.length ? round1(sum(counts) / done.length) : null,
    activeWeeks: counts.filter(n => n > 0).length,
    goal,
  }

  // Qué entrenaste: % por tipo sobre la cantidad de workouts, sumando exactamente 100.
  const entries = BAR_TYPES.map(type => ({ key: type, count: real.filter(w => w.type === type).length })).filter(e => e.count > 0)
  const pcts = percentagesSummingTo100(entries)
  const mix = entries.map(e => ({ type: e.key, count: e.count, pct: pcts[e.key] })).sort((a, b) => b.count - a.count)

  const strengthImproved = computeStrengthRanking(workouts, periodKey, today).total
  const cardio = summarizeCardio(workouts, periodKey, range, today)

  // Mejor mes (solo "Todo"): el mes con más días distintos entrenados; ante empate, el más reciente.
  let bestMonth = null
  if (periodKey === 'all') {
    const byMonth = new Map()
    real.forEach(w => {
      const m = monthOf(w.date)
      if (!byMonth.has(m)) byMonth.set(m, new Set())
      byMonth.get(m).add(w.date)
    })
    for (const [m, set] of byMonth) {
      if (!bestMonth || set.size > bestMonth.days || (set.size === bestMonth.days && m > bestMonth.month)) {
        bestMonth = { month: m, monthName: monthLabel(m), year: Number(m.slice(0, 4)), showYear: Number(m.slice(0, 4)) !== thisYear, days: set.size }
      }
    }
  }

  const summary = { periodKey, label, empty: false, weeks, mix, strengthImproved, cardio, bestMonth }
  return { ...summary, headline: pickPeriodHeadline(summary, goal) }
}
