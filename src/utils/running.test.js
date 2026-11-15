import { describe, it, expect } from 'vitest'
import {
  isValidRun, validRuns, paceOf, comparePace, firstLastPace, movingAverage, computePaceAxis, computeKmBars,
  computeConclusion, computeRecords, computeRunningSummary, computeRunningDetail, dateLabel, weekLabel,
} from './running.js'
import { resolveViewPeriod } from './viewPeriod.js'
import { formatKm } from './format.js'

// Hoy = jueves 2026-11-12. Lunes de la semana en curso = 2026-11-09.
const TODAY = '2026-11-12'
const NB = ' '

// Carrera de `km` en `sec` segundos (ritmo = sec / km).
const run = (date, km, sec, extra = {}) => ({ type: 'cardio', activity: 'Running', date, distancia: km, durationSeconds: sec, ...extra })
// Carrera de 5 km al ritmo `pace` (seg/km).
const at = (date, pace, extra = {}) => run(date, 5, pace * 5, extra)
const runsOf = (ws) => validRuns(ws, TODAY)

describe('carreras válidas', () => {
  it('Running en cualquier mayúscula, con distancia y duración > 0', () => {
    expect(isValidRun(run('2026-11-01', 5, 1500))).toBe(true)
    expect(isValidRun(run('2026-11-01', 5, 1500, { activity: 'running' }))).toBe(true)
    expect(isValidRun(run('2026-11-01', 5, 1500, { activity: '  RUNNING ' }))).toBe(true)
  })
  it('excluye otras actividades', () => {
    for (const activity of ['Caminata', 'Trekking', 'Bici', 'Rollers', 'Tenis', 'otra', '', undefined]) {
      expect(isValidRun(run('2026-11-01', 5, 1500, { activity }))).toBe(false)
    }
  })
  it('excluye la cinta de fuerza (workout.cinta) y los workouts que no son cardio', () => {
    expect(isValidRun(run('2026-11-01', 5, 1500, { cinta: { min: 15, kmh: 8 } }))).toBe(false)
    expect(isValidRun({ type: 'fuerza', activity: 'Running', date: '2026-11-01', distancia: 5, durationSeconds: 1500 })).toBe(false)
    expect(isValidRun(null)).toBe(false)
  })
  it('exige distancia > 0 y duración > 0', () => {
    expect(isValidRun(run('2026-11-01', 0, 1500))).toBe(false)
    expect(isValidRun(run('2026-11-01', null, 1500))).toBe(false)
    expect(isValidRun(run('2026-11-01', '', 1500))).toBe(false)
    expect(isValidRun(run('2026-11-01', 5, 0))).toBe(false)
    expect(isValidRun(run('2026-11-01', 5, null))).toBe(false)
    expect(isValidRun({ type: 'cardio', activity: 'Running', date: '2026-11-01', distancia: 5 })).toBe(false)
  })
  it('workouts viejos: la duración sale del campo `tiempo` (minutos)', () => {
    expect(isValidRun({ type: 'cardio', activity: 'Running', date: '2026-11-01', distancia: 5, tiempo: 30 })).toBe(true)
    expect(runsOf([{ type: 'cardio', activity: 'Running', date: '2026-11-01', distancia: 5, tiempo: 30 }])[0]).toMatchObject({ seconds: 1800, pace: 360 })
  })
  it('validRuns: ignora fechas futuras y devuelve de la más antigua a la más reciente', () => {
    const ws = [run('2026-11-10', 5, 1500), run('2026-12-01', 5, 1500), run('2026-10-05', 5, 1500), run('2026-11-01', 5, 0)]
    expect(runsOf(ws).map(r => r.date)).toEqual(['2026-10-05', '2026-11-10'])
  })
  it('carga el esfuerzo (1 a 10) y las notas; sin dato es null, nunca 0', () => {
    const [a, b, c] = runsOf([at('2026-10-01', 360, { fatigue: 6, notes: ' con Ru ' }), at('2026-10-02', 360), at('2026-10-03', 360, { fatigue: '' })])
    expect(a).toMatchObject({ fatigue: 6, notes: 'con Ru' })
    expect(b).toMatchObject({ fatigue: null, notes: null })
    expect(c.fatigue).toBeNull()
  })
})

describe('ritmo', () => {
  it('el ritmo de un conjunto es tiempo total ÷ km totales, no el promedio de ritmos', () => {
    const rs = runsOf([run('2026-11-01', 5, 1500), run('2026-11-02', 1, 400)])   // 300 y 400 s/km
    expect(paceOf(rs)).toBeCloseTo(1900 / 6, 5)                                    // 316,7 (y no 350)
  })
  it('excluye las carreras con ritmo < 3:00 o > 12:00 /km, pero 3:00 y 12:00 entran', () => {
    const rs = runsOf([run('2026-11-01', 1, 179), run('2026-11-02', 1, 721), run('2026-11-03', 1, 180), run('2026-11-04', 1, 720)])
    expect(rs.map(r => r.paceOk)).toEqual([false, false, true, true])
    expect(paceOf(rs)).toBe(450)                                                   // (180 + 720) / 2 km
  })
  it('sin ninguna carrera de ritmo válido, el ritmo es null', () => {
    expect(paceOf(runsOf([run('2026-11-01', 1, 100)]))).toBeNull()
    expect(paceOf([])).toBeNull()
  })
  it('las carreras fuera de rango sí suman km en el resumen del período', () => {
    const s = computeRunningSummary([run('2026-11-02', 5, 1500), run('2026-11-03', 5, 600)], 'month', TODAY)
    expect(s).toMatchObject({ count: 2, km: 10, paceRuns: 1, pace: 300 })
  })

  describe('comparación entre dos períodos', () => {
    const three = (pace) => runsOf([at('2026-10-01', pace), at('2026-10-02', pace), at('2026-10-03', pace)])
    it('con menos de 3 carreras en cualquiera de los dos NO compara', () => {
      expect(comparePace(runsOf([at('2026-10-01', 360), at('2026-10-02', 360)]), three(400))).toBeNull()
      expect(comparePace(three(360), runsOf([at('2026-10-01', 400), at('2026-10-02', 400)]))).toBeNull()
      expect(comparePace([], [])).toBeNull()
    })
    it('una carrera con ritmo fuera de rango no cuenta para el mínimo de 3', () => {
      const dos = runsOf([at('2026-10-01', 360), at('2026-10-02', 360), run('2026-10-03', 5, 100)])
      expect(comparePace(dos, three(400))).toBeNull()
    })
    it('con 3 y 3 compara: ritmo que baja = mejora', () => {
      expect(comparePace(three(365), three(400))).toEqual({ from: 400, to: 365, improvement: 35, direction: 'better', text: '35 s/km más rápido que antes' })
    })
    it('ritmo que sube: dirección worse con texto neutral, sin juicio', () => {
      const c = comparePace(three(400), three(360))
      expect(c).toMatchObject({ improvement: -40, direction: 'worse', text: '40 s/km más lento que antes' })
    })
    it('mismo ritmo', () => {
      expect(comparePace(three(360), three(360))).toMatchObject({ improvement: 0, direction: 'same', text: 'mismo ritmo que antes' })
    })
    it('"Todo": primeras 3 vs. últimas 3 solo con 6 o más carreras de ritmo válido', () => {
      const seis = runsOf([at('2026-04-01', 400), at('2026-04-02', 400), at('2026-04-03', 400), at('2026-10-01', 365), at('2026-10-02', 365), at('2026-10-03', 365)])
      expect(firstLastPace(seis)).toMatchObject({ from: 400, to: 365, improvement: 35 })
      expect(firstLastPace(seis.slice(1))).toBeNull()
    })
  })
})

describe('media móvil de 3 carreras', () => {
  it('promedia las últimas 3 y es null hasta tener 3 valores', () => {
    expect(movingAverage([400, 380, 360, 340])).toEqual([null, null, 380, 360])
  })
  it('con menos de 3 valores no hay línea', () => {
    expect(movingAverage([400, 380])).toEqual([null, null])
    expect(movingAverage([])).toEqual([])
  })
  it('ventana configurable', () => {
    expect(movingAverage([10, 20, 30, 40], 2)).toEqual([null, 15, 25, 35])
  })
})

describe('eje del gráfico de ritmo', () => {
  it('marcas cada 30 s que cubren el rango', () => {
    expect(computePaceAxis([335, 405])).toEqual({ domain: [330, 420], ticks: [330, 360, 390, 420] })
  })
  it('un solo valor: ancho mínimo de 30 s', () => {
    expect(computePaceAxis([360])).toEqual({ domain: [360, 390], ticks: [360, 390] })
  })
  it('rangos muy anchos pasan a marcas cada 60 s', () => {
    const { ticks } = computePaceAxis([200, 700])
    expect(ticks[1] - ticks[0]).toBe(60)
    expect(ticks[0]).toBeLessThanOrEqual(200)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(700)
  })
  it('sin datos devuelve un eje por defecto', () => {
    expect(computePaceAxis([]).ticks.length).toBeGreaterThan(1)
  })
})

describe('barras de km', () => {
  it('este mes: una barra por semana (lunes a domingo) que toca el mes, con los km a 1 decimal; la semana en curso marcada', () => {
    const range = resolveViewPeriod('month', TODAY)                      // 1 al 12 de noviembre
    const rs = runsOf([run('2026-11-01', 5.25, 1800), run('2026-11-02', 4, 1500), run('2026-11-10', 8, 2400), run('2026-11-12', 2, 700)])
    const { kind, bars } = computeKmBars(rs, range, 'month', TODAY)
    expect(kind).toBe('week')
    expect(bars.map(b => b.key)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09'])   // la semana del 26/10 toca el 1/11
    expect(bars.map(b => b.km)).toEqual([5.3, 4, 10])                                  // 5,25 → 5,3
    expect(bars.map(b => b.current)).toEqual([false, false, true])
    expect(bars[0]).toMatchObject({ label: '26/10', title: 'Semana del 26/10' })
  })
  it('3 meses: 13 barras', () => {
    expect(computeKmBars([], resolveViewPeriod('13w', TODAY), '13w', TODAY).bars).toHaveLength(13)
  })
  it('Todo: una barra por mes desde la primera carrera hasta el mes en curso, con los meses vacíos en cero', () => {
    const rs = runsOf([run('2026-08-20', 5, 1500), run('2026-10-02', 10, 3000), run('2026-10-20', 3, 900)])
    const { kind, bars } = computeKmBars(rs, resolveViewPeriod('all', TODAY, []), 'all', TODAY)
    expect(kind).toBe('month')
    expect(bars.map(b => [b.key, b.km])).toEqual([['2026-08', 5], ['2026-09', 0], ['2026-10', 13], ['2026-11', 0]])
    expect(bars[3].current).toBe(true)
    expect(bars[0]).toMatchObject({ label: 'ago', title: 'agosto 2026' })
  })
  it('Todo sin carreras: sin barras', () => {
    expect(computeKmBars([], resolveViewPeriod('all', TODAY, []), 'all', TODAY)).toEqual({ kind: 'month', bars: [] })
  })
})

describe('conclusión (primer tercio vs. último tercio)', () => {
  // 6 carreras: las 2 primeras (ritmo p1, esfuerzo e1) y las 2 últimas (p2, e2); las del medio no cuentan.
  const six = (p1, e1, p2, e2) => runsOf([
    at('2026-10-01', p1, { fatigue: e1 }), at('2026-10-03', p1, { fatigue: e1 }),
    at('2026-10-10', 600, { fatigue: 10 }), at('2026-10-12', 600, { fatigue: 10 }),
    at('2026-10-20', p2, { fatigue: e2 }), at('2026-10-22', p2, { fatigue: e2 }),
  ])

  it('menos de 6 carreras: no se muestra', () => {
    expect(computeConclusion(six(400, 7, 380, 6).slice(0, 5))).toBeNull()
    expect(computeConclusion([])).toBeNull()
    expect(computeConclusion(six(400, 7, 380, 6))).not.toBeNull()
  })
  it('más rápido y menos esfuerzo', () => {
    expect(computeConclusion(six(400, 7, 380, 6))).toMatchObject({
      rule: 'fasterLessEffort', text: 'Corrés más rápido y con menos esfuerzo: tu estado físico mejora', paceDiff: 20, effortDiff: -1,
    })
  })
  it('más rápido con un esfuerzo parecido (±0,5)', () => {
    expect(computeConclusion(six(400, 7, 380, 7.5))).toMatchObject({ rule: 'fasterSameEffort', text: 'Corrés 20 s/km más rápido con un esfuerzo parecido' })
    expect(computeConclusion(six(400, 7, 380, 7))).toMatchObject({ rule: 'fasterSameEffort' })
    expect(computeConclusion(six(400, 7, 380, 6.5))).toMatchObject({ rule: 'fasterSameEffort', effortDiff: -0.5 })   // justo −0,5 = parecido
    expect(computeConclusion(six(400, 7, 380, 6.4))).toMatchObject({ rule: 'fasterLessEffort' })                   // −0,6 = menos
  })
  it('ritmo parecido (±5 s/km) y menos esfuerzo', () => {
    expect(computeConclusion(six(400, 7, 400, 6))).toMatchObject({ rule: 'samePaceLessEffort', text: 'Mismo ritmo, menos esfuerzo: estás más en forma' })
    expect(computeConclusion(six(400, 7, 395, 6))).toMatchObject({ rule: 'samePaceLessEffort' })   // justo 5 s/km = parecido
    expect(computeConclusion(six(400, 7, 405, 6))).toMatchObject({ rule: 'samePaceLessEffort' })   // 5 s/km más lento también
    expect(computeConclusion(six(400, 7, 394, 6))).toMatchObject({ rule: 'fasterLessEffort' })     // 6 s/km = más rápido
  })
  it('otros casos: neutral con el dato más positivo (ritmo, luego esfuerzo, luego km)', () => {
    // más rápido pero más esfuerzo → destaca el ritmo
    expect(computeConclusion(six(400, 6, 380, 8))).toMatchObject({ rule: 'neutralPace', text: 'Tu ritmo mejoró 20 s/km en este período' })
    // más lento pero menos esfuerzo → destaca el esfuerzo
    expect(computeConclusion(six(380, 8, 400, 6))).toMatchObject({ rule: 'neutralEffort', text: 'Tus carreras te exigen menos esfuerzo que al principio' })
    // más lento y más esfuerzo → solo los km, sin culpa
    const c = computeConclusion(six(380, 6, 400, 8))
    expect(c.rule).toBe('neutralKm')
    expect(c.text).toBe(`Sumaste ${formatKm(30)} corriendo en este período`)
    expect(c.text).toBe(`Sumaste 30${NB}km corriendo en este período`)
  })
  it('sin datos de esfuerzo: nunca usa las reglas de esfuerzo; si va más rápido destaca el ritmo', () => {
    const sin = (p1, p2) => runsOf([at('2026-10-01', p1), at('2026-10-03', p1), at('2026-10-10', 600), at('2026-10-12', 600), at('2026-10-20', p2), at('2026-10-22', p2)])
    expect(computeConclusion(sin(400, 380))).toMatchObject({ rule: 'neutralPace', effortDiff: null })
    expect(computeConclusion(sin(400, 400))).toMatchObject({ rule: 'neutralKm' })
  })
  it('las carreras con ritmo imposible no entran al ritmo de cada tercio', () => {
    const ws = [at('2026-10-01', 400, { fatigue: 7 }), run('2026-10-02', 5, 100, { fatigue: 7 }),    // 0:20 /km: se ignora
      at('2026-10-10', 600), at('2026-10-12', 600),
      at('2026-10-20', 380, { fatigue: 6 }), at('2026-10-22', 380, { fatigue: 6 })]
    expect(computeConclusion(runsOf(ws))).toMatchObject({ rule: 'fasterLessEffort', paceDiff: 20 })
  })
  it('usa el tercio entero de cada lado: con 9 carreras, 3 y 3', () => {
    const nine = runsOf(Array.from({ length: 9 }, (_, i) => at(`2026-10-${String(i + 1).padStart(2, '0')}`, i < 3 ? 400 : i < 6 ? 390 : 370, { fatigue: i < 3 ? 7 : 6 })))
    expect(computeConclusion(nine)).toMatchObject({ groupSize: 3, paceDiff: 30, rule: 'fasterLessEffort' })
  })
})

describe('récords', () => {
  it('carrera más larga (empate: la más reciente), con fecha', () => {
    const r = computeRecords(runsOf([run('2026-09-01', 10, 3600), run('2026-10-01', 12, 4300), run('2026-10-20', 12, 4400), run('2026-11-01', 5, 1500)]))
    expect(r.longest).toEqual({ km: 12, date: '2026-10-20' })
  })
  it('mejor ritmo: solo carreras de 3 km o más', () => {
    const r = computeRecords(runsOf([run('2026-09-01', 1, 240), run('2026-09-02', 2.9, 750), run('2026-10-01', 3, 1050), run('2026-10-02', 5, 1900)]))
    expect(r.bestPace).toEqual({ pace: 350, km: 3, date: '2026-10-01' })     // 1 km a 4:00 y 2,9 km a 4:19 no cuentan
  })
  it('mejor ritmo: ignora ritmos imposibles aunque la carrera sea larga', () => {
    const r = computeRecords(runsOf([run('2026-09-01', 5, 700), run('2026-09-02', 5, 1800)]))
    expect(r.bestPace).toMatchObject({ pace: 360, date: '2026-09-02' })
  })
  it('sin carreras de 3 km o más no hay mejor ritmo', () => {
    expect(computeRecords(runsOf([run('2026-09-01', 2, 600)])).bestPace).toBeNull()
  })
  it('semana con más km (lunes a domingo), con la fecha del lunes', () => {
    const r = computeRecords(runsOf([run('2026-10-05', 5, 1500), run('2026-10-11', 6, 1800),   // sem. del 5/10: 11 km
      run('2026-10-12', 8, 2400), run('2026-10-18', 2.5, 800),                                  // sem. del 12/10: 10,5 km
      run('2026-11-02', 4, 1200)]))
    expect(r.bestWeek).toEqual({ km: 11, weekStart: '2026-10-05', runs: 2 })
  })
  it('una carrera con ritmo imposible igual suma km al récord de la semana', () => {
    const r = computeRecords(runsOf([run('2026-10-05', 5, 1500), run('2026-10-06', 20, 200)]))
    expect(r.bestWeek.km).toBe(25)
  })
  it('sin carreras todo es null', () => {
    expect(computeRecords([])).toEqual({ longest: null, bestPace: null, bestWeek: null })
  })
})

describe('resumen del bloque "Tu running"', () => {
  it('este mes: km, cantidad, ritmo y comparación con el MISMO tramo del mes anterior (3 y 3)', () => {
    const actual = [at('2026-11-02', 360), at('2026-11-05', 360), at('2026-11-09', 360)]            // 1 al 12 de noviembre
    const anterior = [at('2026-10-02', 400), at('2026-10-06', 400), at('2026-10-10', 400)]          // 1 al 12 de octubre
    const s = computeRunningSummary([...actual, ...anterior], 'month', TODAY)
    expect(s).toMatchObject({ count: 3, km: 15, pace: 360, paceRuns: 3, empty: false })
    expect(s.comparison).toMatchObject({ from: 400, to: 360, improvement: 40, direction: 'better' })
  })
  it('este mes: lo que el mes anterior corrió DESPUÉS del mismo día no entra en la comparación', () => {
    const actual = [at('2026-11-02', 360), at('2026-11-05', 360), at('2026-11-09', 360)]
    const anterior = [at('2026-10-02', 400), at('2026-10-06', 400), at('2026-10-13', 300), at('2026-10-20', 300)]   // solo 2 hasta el 12/10
    expect(computeRunningSummary([...actual, ...anterior], 'month', TODAY).comparison).toBeNull()
    const tres = [...actual, ...anterior, at('2026-10-12', 400)]                                                    // el 12/10 sí entra
    expect(computeRunningSummary(tres, 'month', TODAY).comparison).toMatchObject({ from: 400, to: 360 })
  })
  it('con menos de 3 carreras en el período anterior: solo el ritmo actual', () => {
    const s = computeRunningSummary([at('2026-11-02', 360), at('2026-11-05', 360), at('2026-11-09', 360), at('2026-10-02', 400), at('2026-10-09', 400)], 'month', TODAY)
    expect(s.comparison).toBeNull()
    expect(s.pace).toBe(360)
  })
  it('3 meses: contra los 3 meses anteriores (3 y 3)', () => {
    const actual = [at('2026-10-20', 360), at('2026-10-27', 360), at('2026-11-03', 360)]
    const anterior = [at('2026-06-22', 400), at('2026-06-29', 400), at('2026-07-06', 400)]
    expect(computeRunningSummary([...actual, ...anterior], '13w', TODAY).comparison).toMatchObject({ from: 400, to: 360 })
  })
  it('"Todo" no tiene período anterior: sin comparación', () => {
    const s = computeRunningSummary([at('2026-04-20', 400), at('2026-05-20', 400), at('2026-06-20', 400), at('2026-10-20', 360)], 'all', TODAY)
    expect(s.comparison).toBeNull()
    expect(s.count).toBe(4)
  })
  it('estado vacío con menos de 2 carreras en el período', () => {
    expect(computeRunningSummary([], 'month', TODAY)).toMatchObject({ count: 0, km: 0, pace: null, empty: true })
    expect(computeRunningSummary([at('2026-11-03', 360)], 'month', TODAY)).toMatchObject({ count: 1, empty: true })
    expect(computeRunningSummary([at('2026-11-03', 360), at('2026-11-04', 360)], 'month', TODAY).empty).toBe(false)
  })
  it('una carrera fuera del período no cuenta', () => {
    expect(computeRunningSummary([at('2026-11-03', 360), at('2026-10-31', 360)], 'month', TODAY).count).toBe(1)     // el 31/10 es del mes anterior
  })
  it('cinta y otras actividades no cuentan', () => {
    const ws = [at('2026-11-03', 360), at('2026-11-04', 360, { cinta: { min: 20 } }), at('2026-11-05', 360, { activity: 'Caminata' })]
    expect(computeRunningSummary(ws, 'month', TODAY).count).toBe(1)
  })
})

describe('detalle /progreso/running', () => {
  const ws = [
    at('2026-11-10', 340, { fatigue: 6, notes: 'bien' }),
    at('2026-11-05', 350),                                          // sin esfuerzo
    run('2026-11-03', 5, 100, { fatigue: 5 }),                      // ritmo imposible: sin punto de ritmo, con esfuerzo
    at('2026-10-28', 360, { fatigue: 7 }),
    at('2026-10-22', 370, { fatigue: 7 }),
  ]
  it('series: una entrada por carrera, en orden cronológico, para los dos gráficos', () => {
    const d = computeRunningDetail(ws, '13w', TODAY)
    expect(d.series.map(s => s.date)).toEqual(['2026-10-22', '2026-10-28', '2026-11-03', '2026-11-05', '2026-11-10'])
    expect(d.series.map(s => s.pace)).toEqual([370, 360, null, 350, 340])
    expect(d.series.map(s => s.fatigue)).toEqual([7, 7, 5, null, 6])
    expect(d.series.map(s => s.paceAvg)).toEqual([null, null, null, 360, 350])       // medias de (370, 360, 350) y (360, 350, 340): la carrera sin ritmo válido no cuenta
    expect(d.series[0]).toMatchObject({ label: '22/10', km: 5 })
    expect(d.effortCount).toBe(4)
  })
  it('distancia: total y carrera más larga del período', () => {
    const d = computeRunningDetail([run('2026-11-03', 5, 1500), run('2026-11-05', 12, 4000), run('2026-09-01', 30, 9000)], 'month', TODAY)
    expect(d.distance).toEqual({ total: 17, longest: { km: 12, date: '2026-11-05' } })
  })
  it('los récords son de todo el historial, no del período', () => {
    const d = computeRunningDetail([run('2026-11-03', 5, 1500), run('2026-05-01', 21, 6300)], 'month', TODAY)
    expect(d.records.longest).toEqual({ km: 21, date: '2026-05-01' })
  })
  it('la lista del período va de la más reciente a la más antigua, con fecha legible', () => {
    const d = computeRunningDetail(ws, '13w', TODAY)
    expect(d.list.map(r => r.date)).toEqual(['2026-11-10', '2026-11-05', '2026-11-03', '2026-10-28', '2026-10-22'])
    expect(d.list[0]).toMatchObject({ dateLabel: '10 nov', km: 5, notes: 'bien' })
  })
  it('la conclusión aparece solo con 6 o más carreras en el período', () => {
    expect(computeRunningDetail(ws, '13w', TODAY).conclusion).toBeNull()
    const seis = [...ws, at('2026-10-20', 380, { fatigue: 7 })]
    expect(computeRunningDetail(seis, '13w', TODAY).conclusion).not.toBeNull()
  })
  it('"Este mes" recorta el detalle al tramo del 1 al día de hoy (series, lista y barras)', () => {
    const d = computeRunningDetail(ws, 'month', TODAY)
    expect(d.series.map(s => s.date)).toEqual(['2026-11-03', '2026-11-05', '2026-11-10'])
    expect(d.list.map(r => r.date)).toEqual(['2026-11-10', '2026-11-05', '2026-11-03'])
    expect(d.count).toBe(3)
    expect(d.bars.bars.map(b => b.key)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09'])
    expect(d.records.longest).not.toBeNull()                   // los récords siguen siendo de todo el historial
  })
  it('período sin datos: todo vacío y sin romper', () => {
    const d = computeRunningDetail([], '13w', TODAY)
    expect(d).toMatchObject({ count: 0, km: 0, pace: null, comparison: null, empty: true, series: [], list: [], conclusion: null, effortCount: 0 })
    expect(d.distance).toEqual({ total: 0, longest: null })
    expect(d.records).toEqual({ longest: null, bestPace: null, bestWeek: null })
    expect(d.bars.bars).toHaveLength(13)
  })
  it('"Todo" sin carreras: sin barras', () => {
    expect(computeRunningDetail([], 'all', TODAY).bars.bars).toEqual([])
  })
})

describe('fechas para mostrar', () => {
  it('"12 nov" y con año si no es el actual', () => {
    expect(dateLabel('2026-11-12', TODAY)).toBe('12 nov')
    expect(dateLabel('2025-03-05', TODAY)).toBe('5 mar 2025')
    expect(weekLabel('2026-11-09', TODAY)).toBe('Semana del 9 nov')
  })
})
