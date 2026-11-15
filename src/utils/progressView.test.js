import { describe, it, expect } from 'vitest'
import {
  resolveViewPeriod, workoutsInRange, computeHistorySummary, computeMonthComparison, computeConstanciaBars,
  computeStrengthRanking, timeAgoText, getFatigueLevel, computeBodySummary, STABLE_AFTER_DAYS, computePeriodSummary, pickPeriodHeadline,
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

describe('barras de constancia (días distintos)', () => {
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
  it('día doble: fuerza + cardio el mismo día cuenta 1 día, pintado como fuerza', () => {
    const doble = [wk('fuerza', '2026-11-10'), wk('cardio', '2026-11-10')]
    const { bars } = computeConstanciaBars(doble, '4w', TODAY, 4)
    expect(bars[3]).toMatchObject({ total: 1, fuerza: 1, cardio: 0 })
  })
  it('prioridad de tipos en un día: fuerza > clase > tabata > cardio', () => {
    const tipo = (...types) => {
      const { bars } = computeConstanciaBars(types.map(t => wk(t, '2026-11-10')), '4w', TODAY, 4)
      return BAR_TYPES.find(t => bars[3][t] === 1)
    }
    const BAR_TYPES = ['fuerza', 'clase', 'tabata', 'cardio']
    expect(tipo('cardio', 'fuerza', 'clase')).toBe('fuerza')
    expect(tipo('cardio', 'clase')).toBe('clase')
    expect(tipo('cardio', 'tabata')).toBe('tabata')
    expect(tipo('tabata', 'clase')).toBe('clase')
    expect(tipo('cardio', 'cardio')).toBe('cardio')
  })
  it('una semana de 3 días con un día doble tiene 3 y NO alcanza una meta de 4', () => {
    const semana = [wk('fuerza', '2026-11-09'), wk('cardio', '2026-11-09'), wk('clase', '2026-11-10'), wk('cardio', '2026-11-11')]
    const { bars, goal } = computeConstanciaBars(semana, '4w', TODAY, 4)
    expect(bars[3].total).toBe(3)             // 4 workouts, 3 días
    expect(bars[3].total >= goal).toBe(false)
    expect(bars[3]).toMatchObject({ fuerza: 1, clase: 1, cardio: 1 })
  })
  it('vista mensual (todo): días distintos por mes, no workouts', () => {
    const ws = [wk('fuerza', '2026-10-05'), wk('cardio', '2026-10-05'), wk('clase', '2026-10-07'), wk('cardio', '2026-11-03')]
    const { bars } = computeConstanciaBars(ws, 'all', TODAY, 4)
    expect(bars.map(b => [b.key, b.total])).toEqual([['2026-10', 2], ['2026-11', 1]])
    expect(bars[0]).toMatchObject({ fuerza: 1, clase: 1, cardio: 0 })
  })
  it('el título mensual sigue contando workouts (no días)', () => {
    const ws = [wk('fuerza', '2026-11-10'), wk('cardio', '2026-11-10')]
    expect(computeMonthComparison(ws, TODAY).current).toBe(2)
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

// ─── Resumen de cierre por período ──────────────────────────────────────────

describe('resumen por período', () => {
  const days = (monday, n, type = 'clase') => Array.from({ length: n }, (_, i) => wk(type, addDays(monday, i)))
  const run = (date, km, seconds) => wk('cardio', date, { activity: 'Running', distancia: km, durationSeconds: seconds })
  const press = (date, weight) => F(date, [ex('press_01', 'Press', [[8, weight]]), ex('rem_01', 'Remo', [[8, weight]]), ex('sent_01', 'Sentadilla', [[8, weight]])])
  const GOAL = 4

  it('la vista "4 semanas" es en vivo: no tiene resumen', () => {
    expect(computePeriodSummary([wk('clase', '2026-11-10')], '4w', TODAY, GOAL)).toBeNull()
  })

  describe('constancia (semanas completas, días distintos)', () => {
    it('3 meses: el promedio y el conteo EXCLUYEN la semana en curso incompleta', () => {
      const base = [...days(M(1), 4), ...days(M(2), 2)]
      const s = computePeriodSummary(base, '13w', TODAY, GOAL)
      expect(s.weeks).toMatchObject({ evaluated: 12, met: 1, avgDays: 0.5, activeWeeks: 2 })
      const conActual = computePeriodSummary([...base, ...days(M(0), 4)], '13w', TODAY, GOAL)   // la semana en curso no cambia nada
      expect(conActual.weeks).toEqual(s.weeks)
    })
    it('semanas que cumplen el objetivo (>= meta) y promedio con un decimal', () => {
      const ws = [...days(M(1), 4), ...days(M(2), 5), ...days(M(3), 3), ...days(M(4), 4)]
      const s = computePeriodSummary(ws, '13w', TODAY, GOAL)
      expect(s.weeks.met).toBe(3)
      expect(s.weeks.avgDays).toBe(1.3)          // 16 días / 12 semanas
    })
    it('cuenta días distintos: dos workouts el mismo día son 1', () => {
      const ws = [wk('fuerza', M(1)), wk('cardio', M(1)), wk('clase', addDays(M(1), 1))]
      expect(computePeriodSummary(ws, '13w', TODAY, GOAL).weeks.activeWeeks).toBe(1)
      expect(computePeriodSummary(ws, '13w', TODAY, 2).weeks.met).toBe(1)
    })
    it('"Todo" cuenta desde la semana del primer entrenamiento', () => {
      const s = computePeriodSummary([...days(M(3), 3), ...days(M(1), 4)], 'all', TODAY, GOAL)
      expect(s.weeks).toMatchObject({ evaluated: 3, met: 1, avgDays: 2.3, activeWeeks: 2 })
    })
    it('si el primer entrenamiento es de esta semana no hay semanas completas', () => {
      const s = computePeriodSummary(days(M(0), 2), 'all', TODAY, GOAL)
      expect(s.weeks).toMatchObject({ evaluated: 0, avgDays: null, activeWeeks: 0 })
      expect(s.headline.rule).toBe('start')
    })
  })

  describe('qué entrenaste', () => {
    it('porcentajes por workouts que suman 100 (mayor resto), solo tipos con valor, de mayor a menor', () => {
      const ws = [wk('fuerza', M(1)), wk('cardio', M(1)), wk('clase', M(1))]
      const s = computePeriodSummary(ws, '13w', TODAY, GOAL)
      expect(s.mix.reduce((a, m) => a + m.pct, 0)).toBe(100)
      expect(s.mix.map(m => m.type).sort()).toEqual(['cardio', 'clase', 'fuerza'])
      const dos = computePeriodSummary([wk('fuerza', M(1)), wk('fuerza', M(2)), wk('cardio', M(3))], '13w', TODAY, GOAL)
      expect(dos.mix).toEqual([{ type: 'fuerza', count: 2, pct: 67 }, { type: 'cardio', count: 1, pct: 33 }])
    })
    it('siempre suman 100 con repartos incómodos', () => {
      const ws = [...days(M(1), 7, 'fuerza'), ...days(M(2), 3, 'cardio'), ...days(M(3), 3, 'clase'), wk('tabata', M(4))]
      const s = computePeriodSummary(ws, '13w', TODAY, GOAL)
      expect(s.mix.reduce((a, m) => a + m.pct, 0)).toBe(100)
      expect(s.mix).toHaveLength(4)
    })
  })

  describe('fuerza', () => {
    it('cuenta ejercicios cuyo mejor peso supera el primer registro del período', () => {
      const ws = desc([press('2026-10-05', 20), press('2026-11-05', 25), F('2026-10-06', [ex('x1', 'Curl', [[10, 10]])]), F('2026-11-06', [ex('x1', 'Curl', [[10, 10]])])])
      expect(computePeriodSummary(ws, '13w', TODAY, GOAL).strengthImproved).toBe(3)
    })
  })

  describe('cardio (reglas de utils/running.js)', () => {
    it('con menos de 2 carreras válidas no hay datos de cardio', () => {
      expect(computePeriodSummary([run('2026-10-01', 5, 2000)], '13w', TODAY, GOAL).cardio).toBeNull()
      const raros = [run('2026-10-01', 5, 2000), wk('cardio', '2026-10-05', { activity: 'Bici', distancia: 20, durationSeconds: 3000 }),
        wk('cardio', '2026-10-08', { activity: 'Running' })]                  // sin distancia
      expect(computePeriodSummary(raros, '13w', TODAY, GOAL).cardio).toBeNull()
    })
    it('"running" en minúsculas cuenta; una cinta o una caminata no', () => {
      const ws = [wk('cardio', '2026-10-01', { activity: 'running', distancia: 5, durationSeconds: 2000 }),
        wk('cardio', '2026-10-08', { activity: ' Running ', distancia: 3, durationSeconds: 1200 }),
        wk('cardio', '2026-10-09', { activity: 'Running', cinta: { min: 20 }, distancia: 2, durationSeconds: 900 }),
        wk('cardio', '2026-10-10', { activity: 'Caminata', distancia: 4, durationSeconds: 2400 })]
      expect(computePeriodSummary(ws, '13w', TODAY, GOAL).cardio).toMatchObject({ sessions: 2, km: 8 })
    })
    it('3 meses sin datos previos: km totales y solo el promedio', () => {
      const c = computePeriodSummary([run('2026-10-01', 5, 2000), run('2026-10-08', 3, 1200)], '13w', TODAY, GOAL).cardio
      expect(c).toMatchObject({ sessions: 2, km: 8, avgPace: 400, mode: null, improvement: null, direction: null })
    })
    it('3 meses: con menos de 3 carreras en el período anterior NO se compara (solo el promedio actual)', () => {
      const ws = [run('2026-06-10', 5, 3000), run('2026-06-17', 5, 3000), run('2026-10-01', 5, 1825), run('2026-10-08', 5, 1825), run('2026-10-15', 5, 1825)]
      expect(computePeriodSummary(ws, '13w', TODAY, GOAL).cardio).toMatchObject({ avgPace: 365, mode: null, from: null, direction: null })
    })
    it('3 meses: con menos de 3 carreras en el período actual NO se compara', () => {
      const ws = [run('2026-06-10', 5, 2000), run('2026-06-17', 5, 2000), run('2026-06-24', 5, 2000), run('2026-10-01', 5, 1825), run('2026-10-08', 5, 1825)]
      expect(computePeriodSummary(ws, '13w', TODAY, GOAL).cardio).toMatchObject({ avgPace: 365, mode: null })
    })
    it('3 meses: ritmo que MEJORA contra los 3 meses anteriores (3 carreras en cada uno)', () => {
      const ws = [run('2026-06-10', 5, 2000), run('2026-06-17', 5, 2000), run('2026-06-24', 5, 2000),
        run('2026-10-01', 5, 1825), run('2026-10-08', 5, 1825), run('2026-10-15', 5, 1825)]
      const c = computePeriodSummary(ws, '13w', TODAY, GOAL).cardio
      expect(c).toMatchObject({ mode: 'previous', from: 400, to: 365, improvement: 35, direction: 'better' })
    })
    it('3 meses: ritmo que EMPEORA (en los datos solo queda direction: worse)', () => {
      const ws = [run('2026-06-10', 5, 1800), run('2026-06-17', 5, 1800), run('2026-06-24', 5, 1800),
        run('2026-10-01', 5, 2000), run('2026-10-08', 5, 2000), run('2026-10-15', 5, 2000)]
      const c = computePeriodSummary(ws, '13w', TODAY, GOAL).cardio
      expect(c).toMatchObject({ from: 360, to: 400, improvement: -40, direction: 'worse' })
    })
    it('una carrera con ritmo imposible suma km pero no entra en el ritmo', () => {
      const ws = [run('2026-10-01', 5, 2000), run('2026-10-08', 5, 2000), run('2026-10-15', 5, 600)]   // la última: 2:00 /km
      const c = computePeriodSummary(ws, '13w', TODAY, GOAL).cardio
      expect(c).toMatchObject({ sessions: 3, km: 15, avgPace: 400 })
    })
    it('si ninguna carrera tiene ritmo válido, avgPace es null pero los km se muestran', () => {
      const c = computePeriodSummary([run('2026-10-01', 5, 600), run('2026-10-08', 5, 600)], '13w', TODAY, GOAL).cardio
      expect(c).toMatchObject({ sessions: 2, km: 10, avgPace: null, mode: null })
    })
    it('Todo: primeras 3 vs. últimas 3 carreras (con 6 o más)', () => {
      const ws = [run('2026-04-01', 5, 2000), run('2026-04-08', 5, 2000), run('2026-04-15', 5, 2000),
        run('2026-07-01', 5, 1900), run('2026-08-01', 5, 1900),
        run('2026-10-01', 5, 1825), run('2026-10-08', 5, 1825), run('2026-10-15', 5, 1825)]
      const c = computePeriodSummary(ws, 'all', TODAY, GOAL).cardio
      expect(c).toMatchObject({ sessions: 8, km: 40, mode: 'firstLast', from: 400, to: 365, improvement: 35, direction: 'better' })
    })
    it('Todo con menos de 6 carreras: no se compara, solo el promedio', () => {
      const cinco = [run('2026-04-01', 5, 2000), run('2026-04-08', 5, 2000), run('2026-10-01', 5, 1825), run('2026-10-08', 5, 1825), run('2026-10-15', 5, 1825)]
      expect(computePeriodSummary(cinco, 'all', TODAY, GOAL).cardio).toMatchObject({ sessions: 5, mode: null, from: null })
      const dos = computePeriodSummary([run('2026-04-01', 5, 2000), run('2026-10-01', 5, 1825)], 'all', TODAY, GOAL).cardio
      expect(dos).toMatchObject({ sessions: 2, mode: null, avgPace: 383 })
    })
  })

  describe('mejor mes (solo "Todo")', () => {
    const ws = [...days('2026-09-01', 5), ...days('2026-10-05', 3), wk('cardio', '2026-10-05')]
    it('el mes con más días distintos', () => {
      expect(computePeriodSummary(ws, 'all', TODAY, GOAL).bestMonth).toEqual({ month: '2026-09', monthName: 'septiembre', year: 2026, showYear: false, days: 5 })
    })
    it('ante un empate gana el más reciente; y no existe en "3 meses"', () => {
      const empate = [...days('2026-09-01', 3), ...days('2026-10-05', 3)]
      expect(computePeriodSummary(empate, 'all', TODAY, GOAL).bestMonth.month).toBe('2026-10')
      expect(computePeriodSummary(ws, '13w', TODAY, GOAL).bestMonth).toBeNull()
    })
  })

  describe('etiqueta', () => {
    it('Últimos 3 meses / Desde <mes> (con año si no es el actual)', () => {
      expect(computePeriodSummary([wk('clase', '2026-10-05')], '13w', TODAY, GOAL).label).toBe('Últimos 3 meses')
      expect(computePeriodSummary([wk('clase', '2026-04-20')], 'all', TODAY, GOAL).label).toBe('Desde abril')
      expect(computePeriodSummary([wk('clase', '2025-04-20')], 'all', TODAY, GOAL).label).toBe('Desde abril de 2025')
    })
  })

  describe('titular por prioridad', () => {
    const fuerte = desc([press('2026-10-05', 20), press('2026-11-05', 25)])   // 3 ejercicios suben
    const corre = [run('2026-06-10', 5, 2000), run('2026-06-17', 5, 2000), run('2026-06-24', 5, 2000), run('2026-10-01', 5, 1825), run('2026-10-08', 5, 1825), run('2026-10-15', 5, 1825)]
    it('a) promedio >= objetivo: "Sostuviste tu objetivo" (gana sobre todo lo demás)', () => {
      const sostiene = Array.from({ length: 12 }, (_, i) => days(M(i + 1), 4)).flat()
      const h = computePeriodSummary([...sostiene, ...fuerte, ...corre], '13w', TODAY, GOAL).headline
      expect(h).toEqual({ rule: 'goal', text: 'Sostuviste tu objetivo de 4 días por semana' })
    })
    it('el promedio se compara tal como se muestra', () => {
      expect(pickPeriodHeadline({ weeks: { avgDays: 4, activeWeeks: 5 }, strengthImproved: 0, cardio: null }, 4).rule).toBe('goal')
      expect(pickPeriodHeadline({ weeks: { avgDays: 3.9, activeWeeks: 5 }, strengthImproved: 0, cardio: null }, 4).rule).toBe('habit')
    })
    it('b) sube peso en 3+ ejercicios (y no cumple el objetivo)', () => {
      const h = computePeriodSummary([...fuerte, ...corre], '13w', TODAY, GOAL).headline
      expect(h).toEqual({ rule: 'strength', text: 'Subiste peso en 3 ejercicios: tu fuerza está creciendo' })
    })
    it('c) el ritmo mejoró (con menos de 3 ejercicios que suban)', () => {
      const h = computePeriodSummary(corre, '13w', TODAY, GOAL).headline
      expect(h).toEqual({ rule: 'cardio', text: 'Corrés más rápido: tu ritmo mejoró 35 s/km' })
    })
    it('c) no se elige si el ritmo empeoró o no hay comparación', () => {
      const peor = [run('2026-06-10', 5, 1800), run('2026-06-17', 5, 1800), run('2026-06-24', 5, 1800), run('2026-10-01', 5, 2000), run('2026-10-08', 5, 2000), run('2026-10-15', 5, 2000)]
      expect(computePeriodSummary(peor, '13w', TODAY, GOAL).headline.rule).toBe('habit')
      expect(computePeriodSummary([run('2026-10-01', 5, 2000), run('2026-10-08', 5, 2000)], '13w', TODAY, GOAL).headline.rule).toBe('habit')
    })
    it('d) por defecto: semanas activas (singular y plural)', () => {
      const dos = computePeriodSummary([...days(M(1), 2), ...days(M(3), 1)], '13w', TODAY, GOAL).headline
      expect(dos).toEqual({ rule: 'habit', text: 'Mantuviste el hábito: 2 semanas activas' })
      const una = computePeriodSummary(days(M(1), 2), '13w', TODAY, GOAL).headline
      expect(una.text).toBe('Mantuviste el hábito: 1 semana activa')
    })
    it('2 ejercicios que suben no alcanzan para el titular de fuerza', () => {
      expect(pickPeriodHeadline({ weeks: { avgDays: 1, activeWeeks: 3 }, strengthImproved: 2, cardio: null }, 4).rule).toBe('habit')
    })
  })

  describe('período sin datos', () => {
    it('estado vacío amable', () => {
      const s = computePeriodSummary([wk('clase', '2026-01-10')], '13w', TODAY, GOAL)   // fuera de los 3 meses
      expect(s).toMatchObject({ empty: true, mix: [], cardio: null, bestMonth: null, strengthImproved: 0 })
      expect(s.weeks.avgDays).toBeNull()
      expect(s.headline.rule).toBe('empty')
      expect(s.headline.text).toMatch(/Todavía no hay entrenamientos/)
      const todo = computePeriodSummary([], 'all', TODAY, GOAL)
      expect(todo.empty).toBe(true)
      expect(todo.label).toBe('Todo el historial')
    })
  })
})
