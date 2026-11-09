// Módulo único de cálculos de la sección Progreso. Funciones PURAS (sin React ni Firestore): reciben
// workouts, el catálogo de ejercicios y el perfil, y devuelven datos listos para mostrar.
// Cada métrica, con su fórmula exacta, está documentada en LOGICA_TECNICA.md (sección 26).
//
// Convenciones:
//   · Solo cuentan los workouts REAL_WORKOUT_TYPES (fuerza, cardio, clase, tabata) con fecha.
//   · Semanas de lunes a domingo. Todas las fechas son 'YYYY-MM-DD' (sin zona horaria).
//   · "Sin dato" (ausente, null, '' o 0 en duraciones) NUNCA cuenta como 0.
//   · Los ejercicios se agrupan por id del catálogo; si el id no está en el catálogo, por nombre
//     normalizado (así las alternativas alt-… no fragmentan el historial).

import { exercises as DEFAULT_CATALOG } from '../data/exercises.js'
import { REAL_WORKOUT_TYPES, STREAK_MIN_DAYS } from './streak.js'
import { getExerciseUnit } from './exerciseUnit.js'
import { getSessionDurationSeconds } from './sessionDuration.js'
import { getEffectiveDurationSeconds } from './cardio.js'
import { getTodayLocal } from './dates.js'
import { addDays, daysBetween, mondayOf, sundayOf, monthOf } from './weeks.js'

const REAL = new Set(REAL_WORKOUT_TYPES)

export const PERIODS = ['4w', '12w', 'all']
const PERIOD_WEEKS = { '4w': 4, '12w': 12 }

export const MIN_SESSIONS_DURATION = 3        // menos sesiones con dato → duración promedio null
export const MIN_SESSIONS_MAYOR_PROGRESO = 3  // un ejercicio necesita al menos 3 sesiones con dato
export const FATIGUE_HIGH_THRESHOLD = 7       // promedio de las últimas 2 semanas ≥ 7 → "alto"
export const FATIGUE_MIN_RECORDS = 3          // mínimo de registros en esas 2 semanas
export const FATIGUE_WEEKS = 2
export const DEFAULT_WEEKLY_GOAL = 3          // respaldo si el perfil no tiene diasSemana

// ─── Utilidades ──────────────────────────────────────────────────────────────

export const round1 = (x) => Math.round(x * 10) / 10
const round2 = (x) => Math.round(x * 100) / 100
const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length

// Variación % = (actual − anterior) / anterior × 100, redondeada. null si falta alguno o el anterior es 0.
export function pctChange(current, previous) {
  if (current == null || previous == null || !(previous > 0)) return null
  return Math.round(((current - previous) / previous) * 100)
}

// Número con coma decimal (es-AR), hasta 2 decimales, sin ceros de más.
export const fmtNum = (n) => String(round2(n)).replace('.', ',')

// Objetivo semanal (días): profile.diasSemana, o 3 si no existe.
export function getWeeklyGoal(profile) {
  const n = Number(profile?.diasSemana)
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_WEEKLY_GOAL
}

export const normalizeName = (name) =>
  String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const realWorkouts = (workouts, today) =>
  (workouts ?? []).filter(w => w && w.date && REAL.has(w.type) && (!today || w.date <= today))

// ─── Períodos ────────────────────────────────────────────────────────────────

// Resuelve el período. '4w'/'12w': las N semanas que terminan en la semana en curso (la última es parcial,
// llega hasta hoy). El período anterior empieza N semanas antes y dura LO MISMO en días (así la comparación
// es pareja aunque la semana en curso esté a medias). 'all': desde el lunes del primer entrenamiento hasta
// hoy, sin comparación.
export function resolvePeriod(period, today = getTodayLocal(), workouts = []) {
  const n = PERIOD_WEEKS[period]
  if (!n) {
    const real = realWorkouts(workouts, today)
    const first = real.length ? real.reduce((min, w) => (w.date < min ? w.date : min), real[0].date) : today
    return { key: 'all', weeks: null, start: mondayOf(first), end: today, previous: null }
  }
  const start = addDays(mondayOf(today), -7 * (n - 1))
  const length = daysBetween(start, today) + 1
  const prevStart = addDays(start, -7 * n)
  return { key: period, weeks: n, start, end: today, previous: { start: prevStart, end: addDays(prevStart, length - 1) } }
}

// Semanas (lunes a domingo) que toca una ventana [start, end]. La última es parcial si su domingo supera `end`.
function weeksOf(start, end) {
  const out = []
  for (let ws = mondayOf(start); ws <= end; ws = addDays(ws, 7)) {
    out.push({ weekStart: ws, weekEnd: sundayOf(ws), partial: sundayOf(ws) > end })
  }
  return out
}

// ─── Catálogo y agrupación de ejercicios ─────────────────────────────────────

const catalogIndexCache = new WeakMap()
function getCatalogIndex(catalog) {
  let idx = catalogIndexCache.get(catalog)
  if (!idx) {
    idx = { byId: new Map(), byName: new Map() }
    catalog.forEach(e => { idx.byId.set(e.id, e); if (!idx.byName.has(normalizeName(e.name))) idx.byName.set(normalizeName(e.name), e) })
    catalogIndexCache.set(catalog, idx)
  }
  return idx
}

// Clave de agrupación: id del catálogo; si no, nombre normalizado (y si el nombre coincide con un ejercicio
// del catálogo, ese id); si no hay ni nombre, el id crudo; si no hay nada, null.
function groupRef(entry, idx) {
  const id = entry.exerciseId
  if (id != null && idx.byId.has(id)) return { key: id, cat: idx.byId.get(id) }
  const n = normalizeName(entry.name)
  if (n) {
    const cat = idx.byName.get(n)
    return cat ? { key: cat.id, cat } : { key: 'name:' + n, cat: null }
  }
  return id != null ? { key: 'id:' + id, cat: null } : null
}

const validUnit = (u) => (u === 'secs' ? 'secs' : 'reps')

// Agrupa el historial de fuerza por ejercicio. Cada grupo tiene sus sesiones en orden cronológico
// (fecha ascendente; ante empate de fecha se asume la lista en orden descendente, como la entrega el
// proveedor, así que el elemento de más abajo es el más viejo). Una sesión = un workout (si el mismo
// ejercicio aparece dos veces en un workout se fusiona).
export function groupExercises(workouts, catalog = DEFAULT_CATALOG) {
  const idx = getCatalogIndex(catalog)
  const fuerza = []
  ;(workouts ?? []).forEach((w, i) => { if (w && w.type === 'fuerza' && w.date && Array.isArray(w.exercises)) fuerza.push({ w, i }) })
  fuerza.sort((a, b) => a.w.date.localeCompare(b.w.date) || b.i - a.i)

  const groups = new Map()
  for (const { w } of fuerza) {
    const inWorkout = new Map()
    for (const e of w.exercises) {
      if (!e) continue
      const ref = groupRef(e, idx)
      if (!ref) continue
      let g = groups.get(ref.key)
      if (!g) { g = { key: ref.key, catalogId: ref.cat?.id ?? null, name: ref.cat?.name ?? e.name ?? ref.key, unit: 'reps', lastEntry: e, sessions: [] }; groups.set(ref.key, g) }
      if (!ref.cat && e.name) g.name = e.name
      g.lastEntry = e
      let s = inWorkout.get(ref.key)
      if (!s) { s = { date: w.date, maxWeight: 0, maxReps: 0, validSets: 0, secsByWeight: new Map() }; inWorkout.set(ref.key, s); g.sessions.push(s) }
      for (const set of Array.isArray(e.sets) ? e.sets : []) {
        const kg = Number(set?.weight) || 0
        const reps = Number(set?.reps) || 0
        if (kg > s.maxWeight) s.maxWeight = kg
        if (reps > s.maxReps) s.maxReps = reps
        if (reps > 0) {
          s.validSets += 1
          if (reps > (s.secsByWeight.get(kg) ?? 0)) s.secsByWeight.set(kg, reps)
        }
      }
    }
  }
  for (const g of groups.values()) {
    const cat = g.catalogId ? idx.byId.get(g.catalogId) : null
    g.unit = cat ? validUnit(cat.unit) : getExerciseUnit(g.lastEntry)
  }
  return groups
}

const sessionHasData = (s) => s.maxWeight > 0 || s.validSets > 0

// Métrica principal de un ejercicio: kg si alguna vez tuvo peso > 0; si no, segundos si su unit es 'secs';
// si no, repeticiones. Devuelve { metric, unit, valueOf(sesión) }.
function mainMetric(g) {
  if (g.sessions.some(s => s.maxWeight > 0)) return { metric: 'kg', unit: 'kg', valueOf: (s) => s.maxWeight }
  if (g.unit === 'secs') return { metric: 'secs', unit: 'seg', valueOf: (s) => s.maxReps }
  return { metric: 'reps', unit: 'reps', valueOf: (s) => s.maxReps }
}

// ─── Récords (fuente única) ──────────────────────────────────────────────────

// Récord = la mejor marca de una sesión (en la métrica principal del ejercicio) que SUPERA estrictamente la
// mejor marca previa de ese ejercicio. La primera sesión con valor > 0 es la base y no cuenta.
// Devuelve { events, total, last, mostRecords, distinctExercises, byExercise }.
export function computeRecords(workouts, catalog = DEFAULT_CATALOG) {
  const groups = groupExercises(workouts, catalog)
  const events = []
  for (const g of groups.values()) {
    const { unit, valueOf } = mainMetric(g)
    let best = null
    for (const s of g.sessions) {
      const v = valueOf(s)
      if (!(v > 0)) continue
      if (best == null) { best = v; continue }
      if (v > best) {
        events.push({ exerciseKey: g.key, exerciseId: g.catalogId, name: g.name, date: s.date, previous: best, value: v, unit })
        best = v
      }
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date))

  const counts = new Map()
  events.forEach(e => {
    const c = counts.get(e.exerciseKey) ?? { exerciseKey: e.exerciseKey, name: e.name, count: 0, lastDate: e.date }
    c.count += 1; c.lastDate = e.date
    counts.set(e.exerciseKey, c)
  })
  const byExercise = [...counts.values()].sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name))
  return {
    events,
    total: events.length,
    last: events.length ? events[events.length - 1] : null,
    mostRecords: byExercise[0] ?? null,
    distinctExercises: byExercise.length,
    byExercise,
  }
}

// ─── Mayor progreso ──────────────────────────────────────────────────────────

// Primera marca contra la MEJOR marca (misma métrica principal), solo ejercicios con al menos 3 sesiones con
// dato. % = (mejor − primera) / primera × 100, redondeado. Ranking por % (empate: más sesiones, luego nombre).
// `top` = el primero del ranking con % > 0 (o null).
export function computeMayorProgreso(workouts, catalog = DEFAULT_CATALOG) {
  const groups = groupExercises(workouts, catalog)
  const ranking = []
  for (const g of groups.values()) {
    const { unit, valueOf } = mainMetric(g)
    const withValue = g.sessions.filter(s => valueOf(s) > 0)
    if (withValue.length < MIN_SESSIONS_MAYOR_PROGRESO) continue
    const first = withValue[0]
    let best = first
    for (const s of withValue) if (valueOf(s) > valueOf(best)) best = s
    const firstValue = valueOf(first), bestValue = valueOf(best)
    ranking.push({
      exerciseKey: g.key, exerciseId: g.catalogId, name: g.name, unit,
      firstValue, firstDate: first.date, bestValue, bestDate: best.date,
      pct: Math.round(((bestValue - firstValue) / firstValue) * 100),
      sessions: withValue.length,
    })
  }
  ranking.sort((a, b) => b.pct - a.pct || b.sessions - a.sessions || a.name.localeCompare(b.name))
  return { ranking, top: ranking.find(r => r.pct > 0) ?? null }
}

// ─── Más trabajado ───────────────────────────────────────────────────────────

// Sesiones por ejercicio (todos, incluidos los sin peso y en segundos), con primera y última fecha y total de
// series (series con repeticiones o segundos > 0). Ranking: más sesiones, luego más series, luego nombre.
export function computeMasTrabajado(workouts, catalog = DEFAULT_CATALOG) {
  const groups = groupExercises(workouts, catalog)
  const ranking = []
  for (const g of groups.values()) {
    const sessions = g.sessions.filter(sessionHasData)
    if (!sessions.length) continue
    ranking.push({
      exerciseKey: g.key, exerciseId: g.catalogId, name: g.name, unit: g.unit === 'secs' ? 'seg' : 'reps',
      sessions: sessions.length, firstDate: sessions[0].date, lastDate: sessions[sessions.length - 1].date,
      totalSets: sessions.reduce((a, s) => a + s.validSets, 0),
    })
  }
  ranking.sort((a, b) => b.sessions - a.sessions || b.totalSets - a.totalSets || a.name.localeCompare(b.name))
  return { ranking, top: ranking[0] ?? null }
}

// ─── Entrenamientos totales (todo el historial) ──────────────────────────────

export function computeTotals(workouts, today = getTodayLocal()) {
  const real = realWorkouts(workouts, today)
  const byType = { fuerza: 0, cardio: 0, clase: 0, tabata: 0 }
  real.forEach(w => { byType[w.type] += 1 })
  const dates = new Set(real.map(w => w.date))
  const perMonth = new Map()
  dates.forEach(d => perMonth.set(monthOf(d), (perMonth.get(monthOf(d)) ?? 0) + 1))
  const months = [...perMonth.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))
  return {
    total: real.length,
    uniqueDays: dates.size,
    byType,
    firstDate: real.length ? real.reduce((min, w) => (w.date < min ? w.date : min), real[0].date) : null,
    monthMostDays: months.length ? { month: months[0][0], days: months[0][1] } : null,
  }
}

// ─── Racha semanal 3+ ────────────────────────────────────────────────────────

// "Racha semanal 3+": cantidad TOTAL de semanas (lunes a domingo) de todo el historial con 3 o más días
// DISTINTOS de entrenamiento real. No exige semanas consecutivas y nunca baja (un parate largo no la reinicia).
// La semana en curso suma apenas alcanza 3 días. Reemplaza a la racha de semanas consecutivas.
export function computeWeeklyStreak3Plus(workouts, today = getTodayLocal()) {
  const weeks = new Map()
  realWorkouts(workouts, today).forEach(w => {
    const mon = mondayOf(w.date)
    if (!weeks.has(mon)) weeks.set(mon, new Set())
    weeks.get(mon).add(w.date)
  })
  let total = 0
  weeks.forEach(days => { if (days.size >= STREAK_MIN_DAYS) total += 1 })
  const currentWeekStart = mondayOf(today)
  const currentWeekDays = weeks.get(currentWeekStart)?.size ?? 0
  return { total, minDays: STREAK_MIN_DAYS, currentWeekStart, currentWeekDays, currentWeekCounts: currentWeekDays >= STREAK_MIN_DAYS }
}

// Reparte 100 entre las categorías con el método del resto mayor (los porcentajes enteros suman exactamente
// 100). Desempate: mayor resto, luego mayor cantidad, luego el orden recibido.
function percentagesSummingTo100(entries) {
  const total = entries.reduce((a, e) => a + e.count, 0)
  const rows = entries.map((e, i) => {
    const exact = (e.count * 100) / total
    return { ...e, i, floor: Math.floor(exact), rest: exact - Math.floor(exact) }
  })
  let left = 100 - rows.reduce((a, r) => a + r.floor, 0)
  const order = [...rows].sort((a, b) => b.rest - a.rest || b.count - a.count || a.i - b.i)
  for (const r of order) { if (left <= 0) break; if (r.count > 0 || r.rest > 0) { r.floor += 1; left -= 1 } }
  return Object.fromEntries(rows.map(r => [r.key, r.floor]))
}

// Un decimal con coma: 3.5 → "3,5"; 4 → "4,0".
export const formatDaysPerWeek = (n) => (n == null ? '—' : n.toFixed(1).replace('.', ','))

// Dorso de la tarjeta: resumen del MES CALENDARIO en curso (del día 1 hasta hoy).
//   avgDaysPerWeek = días distintos entrenados en el mes / (días transcurridos del mes / 7), con un decimal
//   percentages    = % de fuerza, cardio y clase sobre la cantidad de entrenamientos reales del mes (workouts,
//                    no días), redondeados para que sumen 100; "otros" (p. ej. tabata) solo si existen
// Sin entrenamientos en el mes → { empty: true, ... }.
export function computeMonthSummary(workouts, today = getTodayLocal()) {
  const month = monthOf(today)
  const daysElapsed = Number(today.slice(8, 10))
  const real = realWorkouts(workouts, today).filter(w => w.date >= month + '-01')
  if (!real.length) return { empty: true, month, daysElapsed, trainedDays: 0, workouts: 0, avgDaysPerWeek: null, counts: null, percentages: null }

  const count = (t) => real.filter(w => w.type === t).length
  const counts = { fuerza: count('fuerza'), cardio: count('cardio'), clase: count('clase') }
  const otros = real.length - counts.fuerza - counts.cardio - counts.clase
  if (otros > 0) counts.otros = otros
  const entries = Object.entries(counts).map(([key, c]) => ({ key, count: c }))
  const trainedDays = new Set(real.map(w => w.date)).size
  return {
    empty: false, month, daysElapsed, trainedDays, workouts: real.length,
    avgDaysPerWeek: Math.round((trainedDays / (daysElapsed / 7)) * 10) / 10,
    counts,
    percentages: percentagesSummingTo100(entries),
  }
}

// ─── Cansancio (fuente única del estado) ─────────────────────────────────────

const finiteFatigue = (w) => {
  if (w.fatigue == null || w.fatigue === '') return null
  const n = Number(w.fatigue)
  return Number.isFinite(n) ? n : null
}

// Estado del cansancio: promedio de las últimas 2 semanas COMPLETAS (lunes a domingo, sin la semana en curso)
// con al menos 3 registros. 'alto' si el promedio (redondeado a 1 decimal, como se muestra) es ≥ 7;
// 'sin-datos' si hay menos de 3 registros; 'normal' en el resto. Escala 1-10.
// La usan Progreso (dato clave) y la sugerencia de descarga (Configuración, useDeload).
export function getFatigueStatus(workouts, today = getTodayLocal()) {
  const thisMonday = mondayOf(today)
  const start = addDays(thisMonday, -7 * FATIGUE_WEEKS)
  const end = addDays(thisMonday, -1)
  const values = realWorkouts(workouts, today).filter(w => w.date >= start && w.date <= end).map(finiteFatigue).filter(v => v != null)
  const count = values.length
  const avg = count ? round1(mean(values)) : null
  const status = count < FATIGUE_MIN_RECORDS ? 'sin-datos' : avg >= FATIGUE_HIGH_THRESHOLD ? 'alto' : 'normal'
  return { status, high: status === 'alto', avg, count, start, end, threshold: FATIGUE_HIGH_THRESHOLD, minRecords: FATIGUE_MIN_RECORDS }
}

// ─── Indicadores por período ─────────────────────────────────────────────────

function workoutVolume(w) {
  if (w.type !== 'fuerza') return 0
  let v = 0
  for (const e of w.exercises ?? []) {
    if (!e || getExerciseUnit(e) !== 'reps') continue
    for (const s of e.sets ?? []) {
      const kg = Number(s?.weight) || 0
      if (kg > 0) v += kg * (Number(s?.reps) || 0)
    }
  }
  return round2(v)
}

// Minutos de una sesión o null si no hay dato (nunca 0).
function durationMinutes(w) {
  let sec = null
  if (w.type === 'fuerza') sec = getSessionDurationSeconds(w)
  else if (w.type === 'cardio') { const s = getEffectiveDurationSeconds(w); sec = s != null && Number(s) > 0 ? Number(s) : null }
  else if (w.type === 'clase') { const m = Number(w.duracion); sec = Number.isFinite(m) && m > 0 ? m * 60 : null }
  return sec == null ? null : sec / 60
}

function durationSummary(list, minSessions = MIN_SESSIONS_DURATION) {
  const withData = list.map(w => ({ type: w.type, min: durationMinutes(w) })).filter(x => x.min != null)
  const avgOf = (items) => (items.length >= minSessions ? round1(mean(items.map(i => i.min))) : null)
  const byType = {}
  for (const t of ['fuerza', 'cardio', 'clase']) {
    const items = withData.filter(x => x.type === t)
    byType[t] = { value: avgOf(items), sessions: items.length, sessionsTotal: list.filter(w => w.type === t).length }
  }
  return { value: avgOf(withData), sessionsWithData: withData.length, sessionsTotal: list.length, byType }
}

function cardioSummary(list) {
  const cardio = list.filter(w => w.type === 'cardio')
  const mins = cardio.map(w => { const s = getEffectiveDurationSeconds(w); return s != null && Number(s) > 0 ? Number(s) / 60 : null }).filter(m => m != null)
  return { avgMinutes: mins.length ? round1(mean(mins)) : null, withData: mins.length, withoutData: cardio.length - mins.length, sessions: cardio.length }
}

function fatigueSummary(list) {
  const values = list.map(finiteFatigue).filter(v => v != null)
  return { avg: values.length ? round1(mean(values)) : null, count: values.length }
}

// Métricas crudas de una ventana [start, end], con el detalle semanal.
function windowMetrics(real, win, goal) {
  const inWin = real.filter(w => w.date >= win.start && w.date <= win.end)
  const weeks = weeksOf(win.start, win.end).map(wk => {
    const ws = inWin.filter(w => w.date >= wk.weekStart && w.date <= wk.weekEnd)
    const days = new Set(ws.map(w => w.date)).size
    return {
      ...wk, workouts: ws, trainings: ws.length, activeDays: days, volume: round2(ws.reduce((a, w) => a + workoutVolume(w), 0)),
      met: days >= goal, duration: durationSummary(ws, 1), cardio: cardioSummary(ws), fatigue: fatigueSummary(ws),
    }
  })
  const strengthWithVolume = inWin.filter(w => w.type === 'fuerza' && workoutVolume(w) > 0)
  return {
    inWin, weeks,
    trainings: inWin.length,
    activeDays: new Set(inWin.map(w => w.date)).size,
    volume: round2(inWin.reduce((a, w) => a + workoutVolume(w), 0)),
    strengthSessionsWithVolume: strengthWithVolume.length,
    weeksMet: weeks.filter(w => w.met).length,
    // La semana en curso (parcial) solo cuenta si ya se cumplió; las semanas cerradas siempre cuentan.
    weeksEvaluated: weeks.filter(w => !w.partial || w.met).length,
    duration: durationSummary(inWin),
    cardio: cardioSummary(inWin),
    fatigue: fatigueSummary(inWin),
  }
}

function indicator(value, previous, series, extra = {}) {
  return {
    value, previous,
    changePct: pctChange(value, previous),
    delta: value != null && previous != null ? round2(value - previous) : null,
    series, ...extra,
  }
}

const seriesOf = (weeks, fn) => weeks.map(w => ({ weekStart: w.weekStart, weekEnd: w.weekEnd, partial: w.partial, value: fn(w) }))

// ─── Dato clave ──────────────────────────────────────────────────────────────

function rangeContains(range, date) { return date >= range.start && date <= range.end }

// R2 · récord de peso: eventos de récord en kg dentro del período; el más reciente (empate: mayor mejora relativa).
function ruleWeightRecord(records, range) {
  const evs = records.events.filter(e => e.unit === 'kg' && rangeContains(range, e.date))
  if (!evs.length) return null
  const pick = evs.reduce((best, e) => {
    if (!best) return e
    if (e.date !== best.date) return e.date > best.date ? e : best
    const rel = (x) => (x.value - x.previous) / x.previous
    return rel(e) > rel(best) ? e : best
  }, null)
  return `Récord nuevo en ${pick.name}: ${fmtNum(pick.value)} kg (+${fmtNum(pick.value - pick.previous)} kg sobre tu marca anterior de ${fmtNum(pick.previous)} kg).`
}

// R3 · mejor tiempo: ejercicio en segundos cuyo máximo por serie en el período supera el de todas las sesiones
// anteriores al período, comparando series con el mismo peso (o ambas sin peso), con marca anterior > 0.
function ruleBestTime(groups, range) {
  let best = null
  for (const g of groups.values()) {
    if (g.unit !== 'secs') continue
    const weights = new Set()
    g.sessions.forEach(s => s.secsByWeight.forEach((_, w) => weights.add(w)))
    for (const w of weights) {
      let prevMax = 0, inMax = 0, inDate = null
      for (const s of g.sessions) {
        const v = s.secsByWeight.get(w) ?? 0
        if (s.date < range.start) prevMax = Math.max(prevMax, v)
        else if (rangeContains(range, s.date) && v > inMax) { inMax = v; inDate = s.date }
      }
      if (prevMax > 0 && inMax > prevMax) {
        const cand = { name: g.name, n: inMax, m: prevMax, w, date: inDate, rel: (inMax - prevMax) / prevMax }
        if (!best || cand.date > best.date || (cand.date === best.date && cand.rel > best.rel)) best = cand
      }
    }
  }
  if (!best) return null
  return `Aguantaste ${fmtNum(best.n)} seg en ${best.name}${best.w > 0 ? ` con ${fmtNum(best.w)} kg` : ''}, tu mejor marca (antes ${fmtNum(best.m)} seg).`
}

// Evalúa las 5 reglas y devuelve las que se cumplen, en orden de prioridad: [{ rule, text }].
//   R1 cansancio alto > R2 récord de peso > R3 mejor tiempo > R4 variación de volumen > R5 constancia
function evaluateRules({ workouts, groups, records, range, cur, prev, goal, today }) {
  const out = []

  const fat = getFatigueStatus(workouts, today)
  if (fat.high) out.push({ rule: 'R1', text: `Tu cansancio promedio de las últimas 2 semanas fue ${fmtNum(fat.avg)}/10. Podés considerar una semana de descarga.` })

  const r2 = ruleWeightRecord(records, range)
  if (r2) out.push({ rule: 'R2', text: r2 })

  const r3 = ruleBestTime(groups, range)
  if (r3) out.push({ rule: 'R3', text: r3 })

  if (prev && cur.strengthSessionsWithVolume >= 2 && prev.strengthSessionsWithVolume >= 2 && prev.volume > 0) {
    const delta = pctChange(cur.volume, prev.volume)
    if (delta != null && Math.abs(delta) >= 10) {
      const inP = cur.inWin.filter(w => w.type === 'fuerza')
      const suffix = inP.some(w => w.deload === true) ? ' (incluye semana de descarga)' : inP.some(w => w.regreso === true) ? ' (incluye una sesión de regreso)' : ''
      const amount = delta > 200 ? 'más de un 200 %' : `un ${Math.abs(delta)} %`
      out.push({ rule: 'R4', text: `Tu volumen de fuerza ${delta > 0 ? 'subió' : 'bajó'} ${amount} frente a las ${range.weeks} semanas anteriores${suffix}.` })
    }
  }

  const n = cur.weeksEvaluated, k = cur.weeksMet
  if (n >= 4 && k >= 1) {
    out.push({ rule: 'R5', text: k === n ? `¡Cumpliste tu objetivo de ${goal} días las ${n} semanas!` : `Cumpliste tu objetivo de ${goal} días en ${k} de ${n} semanas.` })
  }
  return out
}

// ─── API principal ───────────────────────────────────────────────────────────

// computeProgressStats({ workouts, catalog, profile, period, today }) → todo lo que muestra Progreso.
// period: '4w' | '12w' | 'all'. Cada indicador: { value, previous, changePct, delta, series } (series = una entrada por
// semana del período; previous/changePct/delta son null en 'all').
export function computeProgressStats({ workouts, catalog = DEFAULT_CATALOG, profile = null, period = '4w', today = getTodayLocal() } = {}) {
  const real = realWorkouts(workouts, today)
  const range = resolvePeriod(period, today, workouts)
  const goal = getWeeklyGoal(profile)
  const cur = windowMetrics(real, range, goal)
  const prev = range.previous ? windowMetrics(real, range.previous, goal) : null
  const P = (fn) => (prev ? fn(prev) : null)

  const records = computeRecords(workouts, catalog)
  const groups = groupExercises(workouts, catalog)
  const rules = evaluateRules({ workouts, groups, records, range, cur, prev, goal, today })

  return {
    period: range.key,
    range: { start: range.start, end: range.end, weeks: range.weeks },
    previousRange: range.previous,
    goal,

    trainings: indicator(cur.trainings, P(p => p.trainings), seriesOf(cur.weeks, w => w.trainings)),
    activeDays: indicator(cur.activeDays, P(p => p.activeDays), seriesOf(cur.weeks, w => w.activeDays)),
    volume: indicator(cur.volume, P(p => p.volume), seriesOf(cur.weeks, w => w.volume)),
    weeksMet: indicator(cur.weeksMet, P(p => p.weeksMet),
      cur.weeks.map(w => ({ weekStart: w.weekStart, weekEnd: w.weekEnd, partial: w.partial, value: w.met ? 1 : 0, days: w.activeDays })),
      { goal, weeksEvaluated: cur.weeksEvaluated, previousWeeksEvaluated: P(p => p.weeksEvaluated) }),

    duration: indicator(cur.duration.value, P(p => p.duration.value),
      seriesOf(cur.weeks, w => w.duration.value),
      { sessionsWithData: cur.duration.sessionsWithData, sessionsTotal: cur.duration.sessionsTotal, byType: cur.duration.byType,
        previousSessionsWithData: P(p => p.duration.sessionsWithData), minSessions: MIN_SESSIONS_DURATION }),

    cardio: indicator(cur.cardio.avgMinutes, P(p => p.cardio.avgMinutes),
      seriesOf(cur.weeks, w => w.cardio.avgMinutes),
      { withData: cur.cardio.withData, withoutData: cur.cardio.withoutData, sessions: cur.cardio.sessions }),

    fatigue: indicator(cur.fatigue.avg, P(p => p.fatigue.avg),
      seriesOf(cur.weeks, w => w.fatigue.avg),
      { count: cur.fatigue.count, status: getFatigueStatus(workouts, today) }),

    // Siempre sobre todo el historial (no dependen del período)
    records,
    mayorProgreso: computeMayorProgreso(workouts, catalog),
    masTrabajado: computeMasTrabajado(workouts, catalog),
    totals: computeTotals(workouts, today),
    weeklyStreak: computeWeeklyStreak3Plus(workouts, today),
    monthSummary: computeMonthSummary(workouts, today),

    keyInsight: rules[0]?.text ?? null,
    keyInsightRule: rules[0]?.rule ?? null,
    keyInsights: rules,
  }
}

// Atajo: solo la frase del dato clave (la de mayor prioridad que se cumpla) o null.
export function computeKeyInsight(args) {
  return computeProgressStats(args).keyInsight
}
