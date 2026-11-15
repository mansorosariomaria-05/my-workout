import { describe, it, expect } from 'vitest'
import {
  resolveViewPeriod, workoutsInRange, computeHistorySummary, computeMonthComparison, computeConstanciaBars,
  computeStrengthRanking, timeAgoText, getFatigueLevel, computeBodySummary, STABLE_AFTER_DAYS,
} from './progressView.js'
import { addDays } from './weeks.js'

// Hoy = jueves 2026-11-12. Lunes de la semana en curso = 2026-11-09.
const TODAY = '2026-11-12'
const M = (n) => addDays('2026-11-09', -7 * n) // lunes de la semana M-n

const wk = (type, date, extra = {}) => ({ type, date, ...extra })
const ex = (exerciseId, name, sets) => ({ exerciseId, name, sets: sets.map(([reps, weight]) => ({ reps, weight })) })
const F = (date, exercises, extra = {}) => wk('fuerza', date, { exercises, ...extra })
const hip = (date, weight, reps = 10) => F(date, [ex('glut_01', 'Hip Thrust', [[reps, weight]])])
const desc = (ws) => [...ws].sort((a, b) => b.date.localeCompare(a.date))

describe('período seleccionado', () => {
  it('4 semanas: 4 lunes a domingo, anterior de igual longitud', () => {
    const r = resolveViewPeriod('4w', TODAY)
    expect(r.start).toBe(M(3))
    expect(r.end).toBe(TODAY)
    expect(r.previous.start).toBe(M(7))
    expect(r.previous.end).toBe('2026-10-15')
  })
  it('3 meses = 13 semanas', () => {
    const r = resolveViewPeriod('13w', TODAY)
    expect(r.start).toBe(M(12))
    expect(r.weeks).toBe(13)
    expect(r.previous.start).toBe(M(25))
  })
  it('todo: desde el lunes del primer entrenamiento, sin período anterior', () => {
    const r = resolveViewPeriod('all', TODAY, [wk('clase', '2026-08-26'), wk('clase', '2026-11-10')])
    expect(r.start).toBe('2026-08-24')
    expect(r.previous).toBeNull()
  })
  it('filtra por período y descarta tipos no reales y fechas futuras', () => {
    const ws = [wk('clase', '2026-11-10'), wk('clase', '2026-10-01'), wk('clase', '2026-11-20'), { type: 'pausa', date: '2026-11-05' }]
    const r = resolveViewPeriod('4w', TODAY)
    expect(workoutsInRange(ws, r, TODAY).map(w => w.date)).toEqual(['2026-11-10'])
  })
})

describe('encabezado histórico', () => {
  it('total de entrenamientos reales y meses desde el primero (mínimo 1)', () => {
    const ws = [wk('clase', '2026-04-20'), wk('cardio', '2026-11-10'), { type: 'pausa', date: '2026-05-01' }]
    expect(computeHistorySummary(ws, TODAY)).toEqual({ total: 2, months: 7 })
    expect(computeHistorySummary([wk('clase', '2026-11-02')], TODAY)).toEqual({ total: 1, months: 1 })
    expect(computeHistorySummary([], TODAY)).toEqual({ total: 0, months: 0 })
  })
})

describe('comparación mensual a la misma altura del mes', () => {
  it('compara hasta el mismo día del mes anterior (los días posteriores no cuentan)', () => {
    const ws = [
      // noviembre: 3 hasta el 12
      wk('clase', '2026-11-02'), wk('fuerza', '2026-11-05'), wk('cardio', '2026-11-10'),
      // octubre: 1 hasta el 12, y 4 después (no cuentan)
      wk('clase', '2026-10-08'), wk('clase', '2026-10-13'), wk('clase', '2026-10-20'), wk('clase', '2026-10-25'), wk('clase', '2026-10-30'),
    ]
    const c = computeMonthComparison(ws, TODAY)
    expect(c).toMatchObject({ month: '2026-11', monthName: 'noviembre', prevMonthName: 'octubre', current: 3, previous: 1, diff: 2, tone: 'up' })
    expect(c.text).toBe('2 más que en octubre')
  })
  it('igual y menos (tono down, texto sin dramatismo)', () => {
    const base = [wk('clase', '2026-11-02'), wk('clase', '2026-10-05')]
    expect(computeMonthComparison(base, TODAY)).toMatchObject({ diff: 0, tone: 'same', text: 'igual que en octubre' })
    const menos = [wk('clase', '2026-11-02'), wk('clase', '2026-10-02'), wk('clase', '2026-10-05'), wk('clase', '2026-10-09'), wk('clase', '2026-10-12')]
    expect(computeMonthComparison(menos, TODAY)).toMatchObject({ diff: -3, tone: 'down', text: '3 menos que en octubre' })
  })
  it('un día 31 contra un mes de 30 días llega hasta el último día del anterior', () => {
    const c = computeMonthComparison([wk('clase', '2026-10-30'), wk('clase', '2026-12-31')], '2026-12-31')
    expect(c.prevMonth).toBe('2026-11')
    const c2 = computeMonthComparison([wk('clase', '2026-09-30'), wk('clase', '2026-10-31')], '2026-10-31')
    expect(c2).toMatchObject({ prevMonth: '2026-09', cutoff: 30, previous: 1, current: 1 })
  })
  it('enero compara con diciembre del año anterior', () => {
    const c = computeMonthComparison([wk('clase', '2025-12-03'), wk('clase', '2026-01-02')], '2026-01-15')
    expect(c).toMatchObject({ prevMonth: '2025-12', prevMonthName: 'diciembre', current: 1, previous: 1 })
  })
  it('solo cuenta entrenamientos reales y no los futuros', () => {
    const ws = [wk('clase', '2026-11-02'), { type: 'pausa', date: '2026-11-03' }, wk('clase', '2026-11-20')]
    expect(computeMonthComparison(ws, TODAY).current).toBe(1)
  })
})

describe('barras de constancia', () => {
  const ws = [
    wk('fuerza', '2026-11-10'), wk('cardio', '2026-11-11'), wk('clase', '2026-11-03'),
    wk('fuerza', '2026-10-27'), wk('tabata', '2026-08-26'), { type: 'pausa', date: '2026-11-05' },
  ]
  it('4 semanas: 4 barras apiladas por tipo, la última (en curso) marcada, con objetivo', () => {
    const { kind, bars, goal } = computeConstanciaBars(ws, '4w', TODAY, 4)
    expect(kind).toBe('week')
    expect(bars.map(b => b.key)).toEqual([M(3), M(2), M(1), M(0)])
    expect(bars.map(b => b.total)).toEqual([0, 1, 1, 2])
    expect(bars[3]).toMatchObject({ fuerza: 1, cardio: 1, clase: 0, current: true })
    expect(bars[0].current).toBe(false)
    expect(goal).toBe(4)
  })
  it('3 meses: 13 barras', () => {
    const { bars } = computeConstanciaBars(ws, '13w', TODAY, 3)
    expect(bars).toHaveLength(13)
    expect(bars.reduce((a, b) => a + b.total, 0)).toBe(5)  // el tabata de agosto (semana M-11) entra, la pausa no
    expect(bars.find(b => b.key === M(11)).tabata).toBe(1)
  })
  it('todo: agrupado por mes, con meses vacíos en cero, mes en curso marcado y sin línea de objetivo', () => {
    const { kind, bars, goal } = computeConstanciaBars(ws, 'all', TODAY, 4)
    expect(kind).toBe('month')
    expect(bars.map(b => b.key)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11'])
    expect(bars.map(b => b.total)).toEqual([1, 0, 1, 3])
    expect(bars[3].current).toBe(true)
    expect(goal).toBeNull()
  })
  it('todo sin entrenamientos: sin barras', () => {
    expect(computeConstanciaBars([], 'all', TODAY, 3).bars).toEqual([])
  })
})

describe('ranking de progreso por período', () => {
  it('delta = mejor peso − primer peso DEL PERÍODO, ordenado por delta, con mejor marca y reps', () => {
    const ws = desc([
      hip('2026-10-20', 40, 10), hip('2026-10-28', 42.5, 8), hip('2026-11-05', 46.5, 14), hip('2026-11-10', 46.5, 12),
      F('2026-10-21', [ex('press_01', 'Press de Banca', [[8, 20]])]), F('2026-11-04', [ex('press_01', 'Press de Banca', [[8, 21.25]])]),
    ])
    const { rows } = computeStrengthRanking(ws, '4w', TODAY)
    expect(rows.map(r => r.name)).toEqual(['Hip Thrust', 'Press de Banca'])
    expect(rows[0]).toMatchObject({ firstWeight: 40, bestWeight: 46.5, bestReps: 14, delta: 6.5, lastImprovementDate: '2026-11-05', stable: false })
    expect(rows[1].delta).toBe(1.25)
  })
  it('el período recorta: lo anterior al inicio no cuenta como base', () => {
    const ws = desc([hip('2026-08-01', 20), hip('2026-10-22', 40), hip('2026-11-05', 45)])
    expect(computeStrengthRanking(ws, '4w', TODAY).rows[0]).toMatchObject({ firstWeight: 40, delta: 5 })
    expect(computeStrengthRanking(ws, 'all', TODAY).rows[0]).toMatchObject({ firstWeight: 20, delta: 25 })
  })
  it('sin mejora, con una sola sesión o con peso 0 no entra (estado vacío)', () => {
    expect(computeStrengthRanking(desc([hip('2026-11-05', 40), hip('2026-11-10', 40)]), '4w', TODAY).rows).toEqual([])
    expect(computeStrengthRanking([hip('2026-11-05', 40)], '4w', TODAY).rows).toEqual([])
    expect(computeStrengthRanking(desc([hip('2026-11-05', 0), hip('2026-11-10', 0)]), '4w', TODAY).rows).toEqual([])
    expect(computeStrengthRanking(desc([hip('2026-11-05', 40), hip('2026-11-10', 30)]), '4w', TODAY).rows).toEqual([])
  })
  it('máximo 5 filas y total real', () => {
    const ws = []
    for (let i = 1; i <= 7; i++) ws.push(F('2026-11-03', [ex(`e${i}`, `Ejercicio ${i}`, [[10, 10]])]), F('2026-11-10', [ex(`e${i}`, `Ejercicio ${i}`, [[10, 10 + i]])]))
    const r = computeStrengthRanking(desc(ws), '4w', TODAY)
    expect(r.rows).toHaveLength(5)
    expect(r.total).toBe(7)
    expect(r.rows[0].name).toBe('Ejercicio 7')
  })
  it('estable: la última mejora quedó a más de 4 semanas (28 días); justo 28 todavía no', () => {
    expect(STABLE_AFTER_DAYS).toBe(28)
    // período 3 meses: mejora el 2026-09-20 (53 días antes de hoy) y después se estanca
    const viejo = desc([hip('2026-09-01', 30), hip('2026-09-20', 35), hip('2026-10-25', 35), hip('2026-11-10', 35)])
    expect(computeStrengthRanking(viejo, '13w', TODAY).rows[0]).toMatchObject({ delta: 5, lastImprovementDate: '2026-09-20', stable: true })
    const justo = desc([hip('2026-09-01', 30), hip('2026-10-15', 35)])             // 28 días antes de hoy
    expect(computeStrengthRanking(justo, '13w', TODAY).rows[0].stable).toBe(false)
    const pasado = desc([hip('2026-09-01', 30), hip('2026-10-14', 35)])            // 29 días
    expect(computeStrengthRanking(pasado, '13w', TODAY).rows[0].stable).toBe(true)
  })
  it('los segundos se rotulan con su unidad y los delta de punto flotante se limpian', () => {
    const ws = desc([
      F('2026-11-03', [{ exerciseId: 'p1', name: 'Plancha lastrada', unit: 'secs', sets: [{ reps: 30, weight: 22.2 }] }]),
      F('2026-11-10', [{ exerciseId: 'p1', name: 'Plancha lastrada', unit: 'secs', sets: [{ reps: 45, weight: 24.4 }] }]),
    ])
    const r = computeStrengthRanking(ws, '4w', TODAY).rows[0]
    expect(r.unit).toBe('secs')
    expect(r.bestReps).toBe(45)
    expect(r.delta).toBe(2.2)
  })
})

describe('esfuerzo percibido: umbrales', () => {
  it('liviano < 5, moderado 5 a < 7, alto ≥ 7', () => {
    expect(getFatigueLevel(1)).toBe('liviano')
    expect(getFatigueLevel(4)).toBe('liviano')
    expect(getFatigueLevel(4.9)).toBe('liviano')
    expect(getFatigueLevel(5)).toBe('moderado')
    expect(getFatigueLevel(6.9)).toBe('moderado')
    expect(getFatigueLevel(7)).toBe('alto')
    expect(getFatigueLevel(10)).toBe('alto')
    expect(getFatigueLevel(null)).toBeNull()
  })
})

describe('esfuerzo percibido: resumen y tendencia', () => {
  const f = (date, fatigue) => wk('clase', date, { fatigue })
  it('promedio del período con 1 decimal y nivel; ignora vacíos', () => {
    const ws = [f('2026-11-10', 8), f('2026-11-04', 7), f('2026-10-28', 6), f('2026-10-27', null), f('2026-10-26', '')]
    const b = computeBodySummary(ws, '4w', TODAY)
    expect(b.avg).toBe(7)
    expect(b.count).toBe(3)
    expect(b.level).toBe('alto')
  })
  it('menos de 3 registros: sin promedio ni nivel', () => {
    const b = computeBodySummary([f('2026-11-10', 9), f('2026-11-04', 9)], '4w', TODAY)
    expect(b).toMatchObject({ avg: null, level: null, trend: null, count: 2 })
  })
  it('tendencia contra el período anterior equivalente', () => {
    const actual = [f('2026-11-10', 8), f('2026-11-04', 7), f('2026-10-28', 7)]
    const prevSube = [f('2026-10-02', 6), f('2026-10-08', 6), f('2026-10-12', 6.5)]       // dentro del anterior (09-21 → 10-15)
    const b = computeBodySummary([...actual, ...prevSube], '4w', TODAY)
    expect(b.previous).toBe(6.2)
    expect(b.trend).toBe('up')
    const prevAlto = [f('2026-10-02', 9), f('2026-10-08', 8), f('2026-10-12', 8)]
    const b2 = computeBodySummary([...actual, ...prevAlto], '4w', TODAY)
    expect(b2.previous).toBe(8.3)
    expect(b2.trend).toBe('down')
    const prevIgual = [f('2026-10-02', 7), f('2026-10-08', 8), f('2026-10-12', 7)]
    expect(computeBodySummary([...actual, ...prevIgual], '4w', TODAY).trend).toBe('same')
  })
  it('sin período anterior (todo) o con pocos registros previos: sin tendencia', () => {
    const actual = [f('2026-11-10', 8), f('2026-11-04', 7), f('2026-10-28', 7)]
    expect(computeBodySummary(actual, 'all', TODAY).trend).toBeNull()
    expect(computeBodySummary([...actual, f('2026-10-02', 3)], '4w', TODAY).trend).toBeNull()
  })
  it('el período recorta los registros', () => {
    const ws = [f('2026-11-10', 8), f('2026-11-04', 8), f('2026-10-28', 8), f('2026-08-18', 2), f('2026-08-19', 2), f('2026-08-20', 2)]
    expect(computeBodySummary(ws, '4w', TODAY).avg).toBe(8)
    expect(computeBodySummary(ws, '13w', TODAY).avg).toBe(5)
  })
  it('promedio semanal para el gráfico: una entrada por semana, null sin registros', () => {
    const ws = [f('2026-11-10', 8), f('2026-11-11', 6), f('2026-11-03', 5)]
    const { weekly } = computeBodySummary(ws, '4w', TODAY)
    expect(weekly.map(w => w.weekStart)).toEqual([M(3), M(2), M(1), M(0)])
    expect(weekly.map(w => w.avg)).toEqual([null, null, 5, 7])
  })
})

describe('texto relativo', () => {
  it('hoy / días / semanas / meses', () => {
    expect(timeAgoText('2026-11-12', TODAY)).toBe('hoy')
    expect(timeAgoText('2026-11-11', TODAY)).toBe('hace 1 día')
    expect(timeAgoText('2026-11-08', TODAY)).toBe('hace 4 días')
    expect(timeAgoText('2026-11-05', TODAY)).toBe('hace 1 sem.')
    expect(timeAgoText('2026-10-08', TODAY)).toBe('hace 5 sem.')
    expect(timeAgoText('2026-06-12', TODAY)).toBe('hace 5 meses')
  })
})
