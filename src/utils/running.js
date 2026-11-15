// Seguimiento de running (bloque "Tu running" de Progreso y pantalla /progreso/running). Funciones PURAS: reciben
// workouts y devuelven datos listos para mostrar; el JSX no calcula nada. Documentado en LOGICA_TECNICA.md (sección 30).
//
// Reglas:
//   · Carrera válida: type 'cardio', activity 'Running' (sin distinguir mayúsculas), sin `cinta`, distancia > 0 y
//     duración efectiva > 0 (getEffectiveDurationSeconds). Caminata, Trekking, Bici, etc. no son carreras.
//   · El ritmo de un conjunto de carreras es TIEMPO TOTAL ÷ KM TOTALES (no el promedio de los ritmos).
//   · Para las estadísticas de ritmo se excluyen las carreras con ritmo < 3:00 o > 12:00 /km (datos imposibles o mal
//     cargados). Esas carreras SÍ suman km.
//   · Una comparación de ritmo entre dos conjuntos necesita al menos 3 carreras con ritmo válido en cada uno.
//   · Nunca hay tono de culpa: lo que empeora se muestra neutral, sin juicio.

import { getEffectiveDurationSeconds, computePace } from './cardio.js'
import { formatNumber, formatKm } from './format.js'
import { finiteFatigue, round1 } from './progressStats.js'
import { mondayOf, monthOf } from './weeks.js'
import { MONTH_NAMES, MONTH_SHORT, resolveViewPeriod, weekStartsOf } from './viewPeriod.js'

export const PACE_MIN_SECONDS = 180        // 3:00 /km
export const PACE_MAX_SECONDS = 720        // 12:00 /km
export const COMPARE_MIN_RUNS = 3          // carreras con ritmo válido en CADA período para comparar
export const FIRST_LAST_RUNS = 3           // "Todo": primeras 3 vs. últimas 3
export const SUMMARY_MIN_RUNS = 2          // menos de 2 carreras en el período → estado vacío
export const RECORD_MIN_KM = 3             // el mejor ritmo solo cuenta en carreras de 3 km o más
export const CONCLUSION_MIN_RUNS = 6       // mínimo para la conclusión (primer tercio vs. último tercio)
export const MOVING_AVERAGE_WINDOW = 3
export const EFFORT_SAME = 0.5             // ±0,5 de esfuerzo = parecido
export const PACE_SAME_SECONDS = 5         // ±5 s/km = ritmo parecido

const sum = (arr) => arr.reduce((a, b) => a + b, 0)
const mean = (arr) => sum(arr) / arr.length

// ─── Carreras válidas ────────────────────────────────────────────────────────

const isRunningActivity = (w) =>
  w.type === 'cardio' && !w.cinta && typeof w.activity === 'string' && w.activity.trim().toLowerCase() === 'running'

export function isValidRun(w) {
  if (!w || !w.date || !isRunningActivity(w)) return false
  const km = Number(w.distancia)
  const seconds = Number(getEffectiveDurationSeconds(w))
  return Number.isFinite(km) && km > 0 && Number.isFinite(seconds) && seconds > 0
}

const validFatigue = (w) => {
  const f = finiteFatigue(w)
  return f != null && f >= 1 && f <= 10 ? f : null
}

// Carrera lista para mostrar: { id, date, km, seconds, pace (seg/km), paceOk, fatigue|null, notes|null }.
function toRun(w, order) {
  const km = Number(w.distancia)
  const seconds = Number(getEffectiveDurationSeconds(w))
  const pace = computePace(seconds, km)
  return {
    id: w.id ?? null, date: w.date, km, seconds, pace,
    paceOk: pace != null && pace >= PACE_MIN_SECONDS && pace <= PACE_MAX_SECONDS,
    fatigue: validFatigue(w),
    notes: typeof w.notes === 'string' && w.notes.trim() ? w.notes.trim() : null,
    order,
  }
}

// Todas las carreras válidas hasta hoy (nunca fechas futuras), de la más antigua a la más reciente.
export function validRuns(workouts, today) {
  return (workouts ?? [])
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => isValidRun(w) && w.date <= today)
    .map(({ w, i }) => toRun(w, i))
    // El proveedor entrega la lista en orden descendente: a igual fecha, la que viene después es la más antigua.
    .sort((a, b) => a.date.localeCompare(b.date) || b.order - a.order)
}

export const runsInWindow = (runs, start, end) => runs.filter(r => r.date >= start && r.date <= end)

// ─── Ritmo ───────────────────────────────────────────────────────────────────

// Ritmo (seg/km) de un conjunto de carreras: tiempo total ÷ km totales, sin las carreras de ritmo fuera de rango.
// null si ninguna tiene ritmo válido.
export function paceOf(runs) {
  const ok = runs.filter(r => r.paceOk)
  if (!ok.length) return null
  return sum(ok.map(r => r.seconds)) / sum(ok.map(r => r.km))
}

export const countPaced = (runs) => runs.filter(r => r.paceOk).length

// "12 s/km más rápido que antes" · "8 s/km más lento que antes" · "mismo ritmo que antes". Nunca juzga.
function paceTrendText(improvement) {
  if (improvement > 0) return `${formatNumber(improvement)} s/km más rápido que antes`
  if (improvement < 0) return `${formatNumber(-improvement)} s/km más lento que antes`
  return 'mismo ritmo que antes'
}

// from/to en seg/km (sin redondear). improvement = from − to en segundos redondeados: positivo = más rápido (mejora).
function buildComparison(from, to) {
  const f = Math.round(from)
  const t = Math.round(to)
  const improvement = f - t
  return {
    from: f, to: t, improvement,
    direction: improvement > 0 ? 'better' : improvement < 0 ? 'worse' : 'same',
    text: paceTrendText(improvement),
  }
}

// Ritmo del período actual vs. el anterior. Solo con ≥ 3 carreras de ritmo válido en CADA uno; si no, null y se
// muestra solo el ritmo del período actual.
export function comparePace(current, previous) {
  if (countPaced(current) < COMPARE_MIN_RUNS || countPaced(previous) < COMPARE_MIN_RUNS) return null
  return buildComparison(paceOf(previous), paceOf(current))
}

// "Todo" no tiene período anterior: primeras 3 vs. últimas 3 carreras de ritmo válido (≥ 6 en total para que no se solapen).
export function firstLastPace(runs) {
  const ok = runs.filter(r => r.paceOk)
  if (ok.length < FIRST_LAST_RUNS * 2) return null
  return buildComparison(paceOf(ok.slice(0, FIRST_LAST_RUNS)), paceOf(ok.slice(-FIRST_LAST_RUNS)))
}

// Media móvil de las últimas `window` carreras. null hasta que hay `window` valores (o si alguno falta).
export function movingAverage(values, window = MOVING_AVERAGE_WINDOW) {
  return values.map((_, i) => {
    if (i < window - 1) return null
    const slice = values.slice(i - window + 1, i + 1)
    return slice.every(v => v != null && Number.isFinite(v)) ? mean(slice) : null
  })
}

// Eje Y del gráfico de ritmo: dominio y marcas redondeadas a 30 s (a 60 s si serían demasiadas).
export function computePaceAxis(paces) {
  const vals = paces.filter(p => p != null && Number.isFinite(p))
  if (!vals.length) return { domain: [300, 420], ticks: [300, 360, 420] }
  let lo = Math.floor(Math.min(...vals) / 30) * 30
  let hi = Math.ceil(Math.max(...vals) / 30) * 30
  if (hi === lo) hi = lo + 30
  const step = (hi - lo) / 30 > 6 ? 60 : 30
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  const ticks = []
  for (let t = lo; t <= hi; t += step) ticks.push(t)
  return { domain: [lo, hi], ticks }
}

// ─── Fechas para mostrar ─────────────────────────────────────────────────────

// '2026-11-12' → "12 nov" (con año si no es el actual: "12 nov 2025").
export function dateLabel(date, today) {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTH_SHORT[m - 1]}${y !== Number(today.slice(0, 4)) ? ` ${y}` : ''}`
}

const shortDay = (date) => { const [, m, d] = date.split('-').map(Number); return `${d}/${m}` }

// ─── Distancia ───────────────────────────────────────────────────────────────

// Barras de km: '4w' / '13w' → una por semana (lunes a domingo); 'all' → una por mes calendario desde la primera
// carrera hasta el mes en curso (meses sin correr incluidos, en cero). `current` marca la semana o el mes en curso.
// Cada barra: { key, label, title, km (1 decimal), current }.
export function computeKmBars(runs, range, periodKey, today) {
  if (periodKey === 'all') {
    if (!runs.length) return { kind: 'month', bars: [] }
    const last = monthOf(today)
    let [y, m] = monthOf(runs[0].date).split('-').map(Number)
    const bars = []
    for (;;) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      bars.push({ key, label: MONTH_SHORT[m - 1], title: `${MONTH_NAMES[m - 1]} ${y}`, km: 0, current: key === last })
      if (key === last) break
      if (++m > 12) { m = 1; y += 1 }
    }
    const byKey = new Map(bars.map(b => [b.key, b]))
    runs.forEach(r => { const b = byKey.get(monthOf(r.date)); if (b) b.km += r.km })
    bars.forEach(b => { b.km = round1(b.km) })
    return { kind: 'month', bars }
  }
  const thisMonday = mondayOf(today)
  const bars = weekStartsOf(range).map(ws => ({ key: ws, label: shortDay(ws), title: `Semana del ${shortDay(ws)}`, km: 0, current: ws === thisMonday }))
  const byKey = new Map(bars.map(b => [b.key, b]))
  runs.forEach(r => { const b = byKey.get(mondayOf(r.date)); if (b) b.km += r.km })
  bars.forEach(b => { b.km = round1(b.km) })
  return { kind: 'week', bars }
}

// Carrera más larga de un conjunto: { km, date } (ante un empate, la más reciente). null sin carreras.
function longestRun(runs) {
  let best = null
  runs.forEach(r => { if (!best || r.km > best.km || (r.km === best.km && r.date >= best.date)) best = r })
  return best ? { km: best.km, date: best.date } : null
}

// ─── Récords (todo el historial) ─────────────────────────────────────────────

// { longest: { km, date }, bestPace: { pace, km, date } (solo carreras ≥ 3 km con ritmo válido), bestWeek: { km, weekStart, runs } }.
// Cada uno es null si no hay datos. Ante un empate gana el más reciente.
export function computeRecords(allRuns) {
  let bestPace = null
  allRuns.forEach(r => {
    if (!r.paceOk || r.km < RECORD_MIN_KM) return
    if (!bestPace || r.pace < bestPace.pace || (r.pace === bestPace.pace && r.date >= bestPace.date)) bestPace = r
  })
  const byWeek = new Map()
  allRuns.forEach(r => {
    const ws = mondayOf(r.date)
    const cur = byWeek.get(ws) ?? { weekStart: ws, km: 0, runs: 0 }
    cur.km += r.km; cur.runs += 1
    byWeek.set(ws, cur)
  })
  let bestWeek = null
  byWeek.forEach(w => { if (!bestWeek || w.km > bestWeek.km || (w.km === bestWeek.km && w.weekStart > bestWeek.weekStart)) bestWeek = w })
  return {
    longest: longestRun(allRuns),
    bestPace: bestPace ? { pace: Math.round(bestPace.pace), km: bestPace.km, date: bestPace.date } : null,
    bestWeek: bestWeek ? { km: round1(bestWeek.km), weekStart: bestWeek.weekStart, runs: bestWeek.runs } : null,
  }
}

// ─── Conclusión (primer tercio vs. último tercio) ────────────────────────────

// Necesita ≥ 6 carreras en el período; con menos devuelve null (no se muestra). Compara las primeras y las últimas
// floor(n / 3) carreras:
//   · más rápido (> 5 s/km) y menos esfuerzo (< −0,5)        → 'fasterLessEffort'
//   · más rápido y esfuerzo parecido (±0,5)                  → 'fasterSameEffort'
//   · ritmo parecido (±5 s/km) y menos esfuerzo              → 'samePaceLessEffort'
//   · otros casos: neutral, con el dato más positivo disponible (ritmo más rápido › menos esfuerzo › km sumados)
// El ritmo usa solo las carreras de ritmo válido; el esfuerzo, las que tienen `fatigue` (promedio a 1 decimal).
export function computeConclusion(runs) {
  if (runs.length < CONCLUSION_MIN_RUNS) return null
  const n = Math.floor(runs.length / 3)
  const first = runs.slice(0, n)
  const last = runs.slice(-n)

  const p1 = paceOf(first), p2 = paceOf(last)
  const paceDiff = p1 != null && p2 != null ? Math.round(p1) - Math.round(p2) : null   // > 0: ahora más rápido

  const avgEffort = (group) => {
    const v = group.filter(r => r.fatigue != null).map(r => r.fatigue)
    return v.length ? round1(mean(v)) : null
  }
  const e1 = avgEffort(first), e2 = avgEffort(last)
  const effortDiff = e1 != null && e2 != null ? round1(e2 - e1) : null                  // < 0: ahora menos esfuerzo

  const faster = paceDiff != null && paceDiff > PACE_SAME_SECONDS
  const similarPace = paceDiff != null && Math.abs(paceDiff) <= PACE_SAME_SECONDS
  const lessEffort = effortDiff != null && effortDiff < -EFFORT_SAME
  const similarEffort = effortDiff != null && Math.abs(effortDiff) <= EFFORT_SAME

  const base = { paceDiff, effortDiff, groupSize: n }
  if (faster && lessEffort) return { rule: 'fasterLessEffort', text: 'Corrés más rápido y con menos esfuerzo: tu estado físico mejora', ...base }
  if (faster && similarEffort) return { rule: 'fasterSameEffort', text: `Corrés ${formatNumber(paceDiff)} s/km más rápido con un esfuerzo parecido`, ...base }
  if (similarPace && lessEffort) return { rule: 'samePaceLessEffort', text: 'Mismo ritmo, menos esfuerzo: estás más en forma', ...base }
  if (faster) return { rule: 'neutralPace', text: `Tu ritmo mejoró ${formatNumber(paceDiff)} s/km en este período`, ...base }
  if (lessEffort) return { rule: 'neutralEffort', text: 'Tus carreras te exigen menos esfuerzo que al principio', ...base }
  return { rule: 'neutralKm', text: `Sumaste ${formatKm(sum(runs.map(r => r.km)))} corriendo en este período`, ...base }
}

// ─── Período: carreras, resumen y detalle ────────────────────────────────────

function periodData(workouts, periodKey, today) {
  const all = validRuns(workouts, today)
  const range = resolveViewPeriod(periodKey, today, workouts)
  const runs = runsInWindow(all, range.start, range.end)
  const prev = range.previous ? runsInWindow(all, range.previous.start, range.previous.end) : []
  return { all, range, runs, prev }
}

// Bloque "Tu running" de Progreso.
// { periodKey, count, km, paceRuns, pace (seg/km redondeado | null), comparison ({ from, to, improvement, direction, text } | null),
//   bars: { kind, bars }, empty (menos de 2 carreras en el período) }
export function computeRunningSummary(workouts, periodKey, today) {
  const { range, runs, prev } = periodData(workouts, periodKey, today)
  const pace = paceOf(runs)
  return {
    periodKey,
    count: runs.length,
    km: sum(runs.map(r => r.km)),
    paceRuns: countPaced(runs),
    pace: pace == null ? null : Math.round(pace),
    comparison: periodKey === 'all' ? null : comparePace(runs, prev),
    bars: computeKmBars(runs, range, periodKey, today),
    empty: runs.length < SUMMARY_MIN_RUNS,
  }
}

// Pantalla /progreso/running: el resumen más distancia, series de ritmo y esfuerzo, conclusión, récords y lista.
//   series: una entrada por carrera, en orden cronológico, para los DOS gráficos (mismo eje X):
//           { key, date, label, km, pace|null (fuera de rango = null), paceAvg|null (media móvil de 3), fatigue|null }
//   records: de TODO el historial (no del período).  list: del período, la más reciente primero.
export function computeRunningDetail(workouts, periodKey, today) {
  const { all, range, runs } = periodData(workouts, periodKey, today)
  const summary = computeRunningSummary(workouts, periodKey, today)

  const pacedPaces = runs.filter(r => r.paceOk).map(r => r.pace)
  const avgs = movingAverage(pacedPaces)
  let k = 0
  const series = runs.map((r, i) => ({
    key: `${r.id ?? r.date}-${i}`, date: r.date, label: shortDay(r.date), km: r.km,
    pace: r.paceOk ? r.pace : null,
    paceAvg: r.paceOk ? avgs[k++] : null,
    fatigue: r.fatigue,
  }))

  return {
    ...summary,
    distance: { total: summary.km, longest: longestRun(runs) },
    series,
    paceAxis: computePaceAxis(pacedPaces),
    effortCount: runs.filter(r => r.fatigue != null).length,
    conclusion: computeConclusion(runs),
    records: computeRecords(all),
    list: [...runs].reverse().map(r => ({ ...r, dateLabel: dateLabel(r.date, today) })),
    range,
  }
}

// Semana de un récord para mostrar: "Semana del 9 nov".
export const weekLabel = (weekStart, today) => `Semana del ${dateLabel(weekStart, today)}`
