import { describe, it, expect } from 'vitest'
import {
  resolveViewPeriod, workoutsInRange, computeHistorySummary, computeMonthReport, computeConstanciaBars, monthStretch, normalizeViewPeriod,
  computeStrengthRanking, timeAgoText, getFatigueLevel, computeBodySummary, STABLE_AFTER_DAYS, computePeriodSummary, pickPeriodHeadline,
} from './progressView.js'
import { addDays, mondayOf } from './weeks.js'

// Hoy = jueves 2026-11-12. Lunes de la semana en curso = 2026-11-09.
const TODAY = '2026-11-12'
const M = (n) => addDays('2026-11-09', -7 * n) // lunes de la semana M-n

const wk = (type, date, extra = {}) => ({ type, date, ...extra })
const ex = (exerciseId, name, sets) => ({ exerciseId, name, sets: sets.map(([reps, weight]) => ({ reps, weight })) })
const F = (date, exercises, extra = {}) => wk('fuerza', date, { exercises, ...extra })
const hip = (date, weight, reps = 10) => F(date, [ex('glut_01', 'Hip Thrust', [[reps, weight]])])
const desc = (ws) => [...ws].sort((a, b) => b.date.localeCompare(a.date))

describe('período seleccionado', () => {
  it('"Este mes": del día 1 hasta hoy, contra el mismo tramo del mes anterior', () => {
    const r = resolveViewPeriod('month', TODAY)                       // hoy = 12 de noviembre
    expect(r.start).toBe('2026-11-01')
    expect(r.end).toBe(TODAY)
    expect(r.previous).toEqual({ start: '2026-10-01', end: '2026-10-12' })
    expect(r.prevFull).toEqual({ start: '2026-10-01', end: '2026-10-31' })
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
  it('el selector: "Este mes" por defecto y se ignoran claves viejas', () => {
    expect(normalizeViewPeriod(undefined)).toBe('month')
    expect(normalizeViewPeriod('4w')).toBe('month')
    expect(normalizeViewPeriod('13w')).toBe('13w')
    expect(normalizeViewPeriod('all')).toBe('all')
  })
  it('filtra por período y descarta tipos no reales y fechas futuras', () => {
    const ws = [wk('clase', '2026-11-10'), wk('clase', '2026-10-31'), wk('clase', '2026-11-20'), { type: 'pausa', date: '2026-11-05' }]
    const r = resolveViewPeriod('month', TODAY)
    expect(workoutsInRange(ws, r, TODAY).map(w => w.date)).toEqual(['2026-11-10'])
  })
})

describe('"Este mes": el tramo equivalente del mes anterior', () => {
  it('del 1 al mismo día', () => {
    const s = monthStretch('2026-11-12')
    expect(s).toMatchObject({ month: '2026-11', prevMonth: '2026-10', monthName: 'noviembre', prevMonthName: 'octubre', day: 12, cutoff: 12, prevLength: 31, prevIsFull: false })
    expect(s.previous).toEqual({ start: '2026-10-01', end: '2026-10-12' })
  })
  it('el día 1 compara solo el día 1', () => {
    const s = monthStretch('2026-11-01')
    expect([s.start, s.end]).toEqual(['2026-11-01', '2026-11-01'])
    expect(s.previous).toEqual({ start: '2026-10-01', end: '2026-10-01' })
  })
  it('31 de marzo: el mes anterior (febrero) corta en su último día, 28 en un año común', () => {
    const s = monthStretch('2027-03-31')
    expect(s).toMatchObject({ cutoff: 28, prevLength: 28, prevIsFull: true })
    expect(s.previous).toEqual({ start: '2027-02-01', end: '2027-02-28' })
  })
  it('31 de marzo en un año bisiesto: hasta el 29 de febrero', () => {
    const s = monthStretch('2028-03-31')
    expect(s).toMatchObject({ cutoff: 29, prevLength: 29, prevIsFull: true })
    expect(s.previous.end).toBe('2028-02-29')
  })
  it('justo en el último día del mes anterior y un día antes', () => {
    expect(monthStretch('2027-03-28')).toMatchObject({ cutoff: 28, prevIsFull: true })
    expect(monthStretch('2027-03-29')).toMatchObject({ cutoff: 28, prevIsFull: true })     // marzo tiene más días que febrero
    expect(monthStretch('2027-03-27')).toMatchObject({ cutoff: 27, prevIsFull: false })
  })
  it('31 contra un mes de 30 días (diciembre vs. noviembre, octubre vs. septiembre)', () => {
    expect(monthStretch('2026-12-31')).toMatchObject({ prevMonth: '2026-11', cutoff: 30, prevIsFull: true })
    expect(monthStretch('2026-10-31')).toMatchObject({ prevMonth: '2026-09', cutoff: 30 })
  })
  it('enero compara con diciembre del año anterior', () => {
    const s = monthStretch('2026-01-15')
    expect(s).toMatchObject({ prevMonth: '2025-12', prevMonthName: 'diciembre', cutoff: 15 })
    expect(s.previous).toEqual({ start: '2025-12-01', end: '2025-12-15' })
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

describe('"Este mes": comparación con el mismo tramo del mes anterior', () => {
  const NB = '\u00A0'
  const run = (date, km, seconds, extra = {}) => wk('cardio', date, { activity: 'Running', distancia: km, durationSeconds: seconds, ...extra })
  const lift = (date, id, weight) => F(date, [ex(id, id, [[8, weight]])])
  const row = (report, key) => report.rows.find(r => r.key === key)

  it('etiqueta y número protagonista: días DISTINTOS entrenados en el mes', () => {
    const ws = [wk('fuerza', '2026-11-02'), wk('cardio', '2026-11-02'), wk('clase', '2026-11-05'), { type: 'pausa', date: '2026-11-06' }, wk('clase', '2026-11-20')]
    const r = computeMonthReport(ws, TODAY)
    expect(r.label).toBe('noviembre vs octubre · del 1 al 12')
    expect(r.days).toEqual({ current: 2, previous: 0 })              // 3 workouts reales, 2 días; la pausa y el futuro no cuentan
    expect(r).toMatchObject({ monthName: 'noviembre', prevMonthName: 'octubre', monthShort: 'nov', prevMonthShort: 'oct' })
  })
  it('si el mes anterior es más corto, la etiqueta lo aclara', () => {
    expect(computeMonthReport([], '2027-03-31').label).toBe('marzo vs febrero · del 1 al 31 (febrero: del 1 al 28)')
  })

  describe('fila "Días entrenados"', () => {
    it('mejora en verde con flecha hacia arriba; los días del mes anterior posteriores al corte no cuentan', () => {
      const ws = [wk('clase', '2026-11-02'), wk('clase', '2026-11-05'), wk('clase', '2026-11-09'),
        wk('clase', '2026-10-08'), wk('clase', '2026-10-13'), wk('clase', '2026-10-20')]          // 13 y 20 de octubre: después del 12
      expect(row(computeMonthReport(ws, TODAY), 'days')).toMatchObject({ current: 3, previous: 1, currentText: '3', previousText: '1', diff: 2, dir: 'up', tone: 'better', diffText: '↑ 2' })
    })
    it('empeora en gris (nunca rojo) con flecha hacia abajo', () => {
      const ws = [wk('clase', '2026-11-02'), wk('clase', '2026-10-02'), wk('clase', '2026-10-05'), wk('clase', '2026-10-09')]
      expect(row(computeMonthReport(ws, TODAY), 'days')).toMatchObject({ diff: -2, dir: 'down', tone: 'worse', diffText: '↓ 2' })
    })
    it('igual', () => {
      const ws = [wk('clase', '2026-11-02'), wk('clase', '2026-10-05')]
      expect(row(computeMonthReport(ws, TODAY), 'days')).toMatchObject({ diff: 0, dir: 'same', tone: 'same', diffText: '= igual' })
    })
  })

  describe('fila "Km corridos" (lógica de running.js)', () => {
    it('suma las carreras válidas de cada tramo y muestra la diferencia en km', () => {
      const ws = [run('2026-11-03', 5, 1500), run('2026-11-10', 3.25, 1000), run('2026-10-04', 5, 1600), run('2026-10-25', 20, 7000)]
      expect(row(computeMonthReport(ws, TODAY), 'km')).toMatchObject({
        current: 8.25, previous: 5, currentText: `8,3${NB}km`, previousText: `5${NB}km`, diffText: `↑ 3,3${NB}km`, tone: 'better',
      })                                                                                         // la carrera del 25/10 queda fuera del tramo
    })
    it('no cuenta cinta, caminatas ni sesiones sin distancia; una carrera con ritmo imposible igual suma km', () => {
      const ws = [run('2026-11-03', 5, 1500), run('2026-11-04', 5, 1500, { cinta: { min: 20 } }), wk('cardio', '2026-11-05', { activity: 'Caminata', distancia: 4, durationSeconds: 2400 }),
        run('2026-11-06', 5, 0), run('2026-11-07', 10, 300)]                                    // la última: 0:30 /km, imposible, pero suma
      expect(row(computeMonthReport(ws, TODAY), 'km').current).toBe(15)
    })
    it('menos km: gris con flecha hacia abajo', () => {
      const ws = [run('2026-11-03', 3, 1000), run('2026-10-04', 5, 1600)]
      expect(row(computeMonthReport(ws, TODAY), 'km')).toMatchObject({ diffText: `↓ 2${NB}km`, tone: 'worse' })
    })
    it('diferencias menores a 0,05 km se muestran como igual', () => {
      const ws = [run('2026-11-03', 5.02, 1600), run('2026-10-04', 5, 1600)]
      expect(row(computeMonthReport(ws, TODAY), 'km')).toMatchObject({ dir: 'same', diffText: '= igual' })
    })
  })

  describe('fila "Récords de peso"', () => {
    it('ejercicios cuyo mejor peso del tramo supera su máximo histórico ANTERIOR al tramo', () => {
      const ws = [
        lift('2026-09-10', 'sq', 50), lift('2026-10-05', 'sq', 60), lift('2026-11-03', 'sq', 65),   // octubre: récord; noviembre: récord
        lift('2026-09-12', 'dl', 80), lift('2026-11-04', 'dl', 80),                                  // igual al máximo: no es récord
        lift('2026-11-05', 'bp', 40),                                                                // primera vez que se hace: no hay máximo previo
        lift('2026-10-03', 'rw', 30), lift('2026-11-06', 'rw', 35),                                 // récord solo en noviembre
      ]
      expect(row(computeMonthReport(ws, TODAY), 'records')).toMatchObject({ current: 2, previous: 1, diff: 1, tone: 'better', diffText: '↑ 1' })
    })
    it('el máximo histórico incluye TODO lo anterior al tramo, no solo el mes previo', () => {
      const ws = [lift('2026-03-01', 'sq', 70), lift('2026-10-05', 'sq', 60), lift('2026-11-03', 'sq', 65)]
      expect(row(computeMonthReport(ws, TODAY), 'records')).toBeUndefined()      // ni 60 ni 65 superan 70: 0 y 0, fila oculta
    })
    it('lo hecho dentro del mismo tramo no cuenta como máximo previo', () => {
      const ws = [lift('2026-09-01', 'sq', 40), lift('2026-11-02', 'sq', 50), lift('2026-11-09', 'sq', 60)]
      expect(row(computeMonthReport(ws, TODAY), 'records').current).toBe(1)      // un ejercicio, un récord (mejor 60 > 40)
    })
    it('ignora los pesos 0 y los entrenamientos futuros', () => {
      const ws = [lift('2026-09-01', 'sq', 40), lift('2026-11-02', 'sq', 0), lift('2026-11-20', 'sq', 90)]
      expect(row(computeMonthReport(ws, TODAY), 'records')).toBeUndefined()
    })
  })

  describe('fila "Esfuerzo promedio"', () => {
    const fat = (date, fatigue) => wk('clase', date, { fatigue })
    it('siempre neutral (muted), también cuando sube o baja', () => {
      const sube = computeMonthReport([fat('2026-11-02', 8), fat('2026-11-05', 6), fat('2026-10-03', 6)], TODAY)
      expect(row(sube, 'effort')).toMatchObject({ current: 7, previous: 6, currentText: '7,0', previousText: '6,0', dir: 'up', tone: 'neutral', diffText: '↑ 1,0' })
      const baja = computeMonthReport([fat('2026-11-02', 5), fat('2026-10-03', 8)], TODAY)
      expect(row(baja, 'effort')).toMatchObject({ dir: 'down', tone: 'neutral', diffText: '↓ 3,0' })
    })
    it('promedio con 1 decimal; ignora vacíos y no usa el resto del mes anterior', () => {
      const ws = [fat('2026-11-02', 7), fat('2026-11-05', 8), fat('2026-11-06', null), fat('2026-11-07', ''), fat('2026-10-03', 6), fat('2026-10-20', 10)]
      expect(row(computeMonthReport(ws, TODAY), 'effort')).toMatchObject({ current: 7.5, previous: 6 })
    })
    it('con dato en un solo mes se muestra, sin diferencia', () => {
      const r = row(computeMonthReport([fat('2026-11-02', 7)], TODAY), 'effort')
      expect(r).toMatchObject({ currentText: '7,0', previousText: '—', diff: null, diffText: '', tone: 'neutral' })
    })
  })

  describe('filas ocultas', () => {
    it('sin nada en ningún mes: sin filas', () => {
      expect(computeMonthReport([], TODAY).rows).toEqual([])
    })
    it('una fila se oculta si vale 0 en ambos meses', () => {
      const r = computeMonthReport([wk('clase', '2026-11-02', { fatigue: 6 }), wk('clase', '2026-10-02')], TODAY)
      expect(r.rows.map(x => x.key)).toEqual(['days', 'effort'])           // sin km ni récords
    })
    it('se muestra si solo uno de los dos meses es distinto de 0', () => {
      const r = computeMonthReport([run('2026-10-04', 5, 1600)], TODAY)
      expect(row(r, 'km')).toMatchObject({ current: 0, previous: 5, currentText: `0${NB}km`, diffText: `↓ 5${NB}km`, tone: 'worse' })
      expect(row(r, 'days')).toMatchObject({ current: 0, previous: 1 })
    })
    it('el esfuerzo se oculta si falta en ambos meses', () => {
      expect(row(computeMonthReport([wk('clase', '2026-11-02'), wk('clase', '2026-10-02')], TODAY), 'effort')).toBeUndefined()
    })
    it('ningún tono es rojo', () => {
      const ws = [wk('clase', '2026-11-02', { fatigue: 9 }), wk('clase', '2026-10-02', { fatigue: 3 }), wk('clase', '2026-10-03'), run('2026-10-04', 5, 1600)]
      const tones = computeMonthReport(ws, TODAY).rows.map(r => r.tone)
      tones.forEach(tone => expect(['better', 'worse', 'same', 'neutral']).toContain(tone))
    })
  })

  describe('línea de referencia del mes anterior completo', () => {
    it('"Octubre completo: 12 días · 25,3 km"', () => {
      const dias = Array.from({ length: 12 }, (_, i) => wk('clase', addDays('2026-10-01', i * 2)))      // 12 días entre el 1 y el 23 de octubre
      const ws = [...dias, run('2026-10-03', 20, 6000), run('2026-10-28', 5.3, 1700), wk('clase', '2026-11-02')]
      const r = computeMonthReport(ws, TODAY)
      expect(r.fullPrev).toMatchObject({ days: 13, km: 25.3 })
      expect(r.fullPrev.text).toBe(`Octubre completo: 13 días · 25,3${NB}km`)
    })
    it('cuenta los días del mes anterior completo, incluso los posteriores al corte', () => {
      const r = computeMonthReport([wk('clase', '2026-10-02'), wk('clase', '2026-10-28')], TODAY)
      expect(r.fullPrev.text).toBe('Octubre completo: 2 días')                                          // sin km, no se muestra el km
      expect(r.days.previous).toBe(1)                                                                    // pero la comparación sigue hasta el día 12
    })
    it('singular', () => {
      expect(computeMonthReport([wk('clase', '2026-10-28')], TODAY).fullPrev.text).toBe('Octubre completo: 1 día')
    })
    it('sin entrenamientos el mes anterior: no hay línea', () => {
      expect(computeMonthReport([wk('clase', '2026-11-02')], TODAY).fullPrev).toBeNull()
    })
    it('si el tramo ya es el mes completo (31/3 vs. febrero) no se repite', () => {
      expect(computeMonthReport([wk('clase', '2027-02-10'), wk('clase', '2027-03-02')], '2027-03-31').fullPrev).toBeNull()
    })
    it('enero: "Diciembre completo"', () => {
      expect(computeMonthReport([wk('clase', '2025-12-28')], '2026-01-15').fullPrev.text).toBe('Diciembre completo: 1 día')
    })
  })
})

describe('barras de constancia (días distintos)', () => {
  const ws = [
    wk('fuerza', '2026-11-10'), wk('cardio', '2026-11-11'), wk('clase', '2026-11-03'),
    wk('fuerza', '2026-10-27'), wk('tabata', '2026-08-26'), { type: 'pausa', date: '2026-11-05' },
  ]
  const last = (arr) => arr[arr.length - 1]

  describe('"Este mes": semanas que tocan el mes anterior y el actual', () => {
    it('una barra por semana desde la que toca el día 1 del mes anterior hasta la semana en curso', () => {
      const { kind, bars, goal } = computeConstanciaBars(ws, 'month', TODAY, 4)
      expect(kind).toBe('week')
      expect(bars.map(b => b.key)).toEqual([M(6), M(5), M(4), M(3), M(2), M(1), M(0)])    // 28/9 (toca el 1/10) … 9/11
      expect(bars.map(b => b.total)).toEqual([0, 0, 0, 0, 1, 1, 2])
      expect(last(bars)).toMatchObject({ fuerza: 1, cardio: 1, clase: 0, current: true, label: '9', title: 'Semana del 9/11' })
      expect(bars[0].current).toBe(false)
      expect(goal).toBe(4)
    })
    it('agrupa por mes: cada semana va al mes donde cae su jueves; la primera al anterior y la de hoy al actual', () => {
      const { bars, groups } = computeConstanciaBars(ws, 'month', TODAY, 4)
      expect(groups).toEqual([{ key: '2026-10', label: 'Octubre', start: 0, count: 5 }, { key: '2026-11', label: 'Noviembre', start: 5, count: 2 }])
      expect(bars.map(b => b.group)).toEqual(['2026-10', '2026-10', '2026-10', '2026-10', '2026-10', '2026-11', '2026-11'])
    })
    it('cuenta los días de toda la semana, también los de fuera de los dos meses', () => {
      const { bars } = computeConstanciaBars([wk('clase', '2026-09-29'), wk('clase', '2026-09-30')], 'month', TODAY, 4)
      expect(bars[0].total).toBe(2)                                                            // semana del 28/9, que toca el 1/10
    })
    it('el día 1 (domingo): la semana de hoy es del mes actual aunque casi toda caiga en el anterior', () => {
      const { bars, groups } = computeConstanciaBars([wk('clase', '2026-11-01')], 'month', '2026-11-01', 4)
      expect(last(bars)).toMatchObject({ key: '2026-10-26', group: '2026-11', current: true, total: 1 })
      expect(groups.map(g => [g.label, g.count])).toEqual([['Octubre', 4], ['Noviembre', 1]])
    })
    it('siempre hay dos meses, hasta 12 semanas, la primera toca el mes anterior y la última es la de hoy (todo un año)', () => {
      let d = '2026-01-01'
      for (let i = 0; i < 365; i++, d = addDays(d, 1)) {
        const { bars, groups } = computeConstanciaBars([], 'month', d, 4)
        const st = monthStretch(d)
        expect(bars.length).toBeLessThanOrEqual(12)
        expect(groups).toHaveLength(2)
        expect(groups[0].key).toBe(st.prevMonth)
        expect(groups[1].key).toBe(st.month)
        expect(bars[0].key <= st.prevFull.start && addDays(bars[0].key, 6) >= st.prevFull.start).toBe(true)
        expect(last(bars).key).toBe(mondayOf(d))
      }
    })
    it('día doble: fuerza + cardio el mismo día cuenta 1 día, pintado como fuerza', () => {
      const doble = [wk('fuerza', '2026-11-10'), wk('cardio', '2026-11-10')]
      expect(last(computeConstanciaBars(doble, 'month', TODAY, 4).bars)).toMatchObject({ total: 1, fuerza: 1, cardio: 0 })
    })
    it('prioridad de tipos en un día: fuerza > clase > tabata > cardio', () => {
      const tipo = (...types) => {
        const { bars } = computeConstanciaBars(types.map(t => wk(t, '2026-11-10')), 'month', TODAY, 4)
        return BAR_TYPES.find(t => last(bars)[t] === 1)
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
      const { bars, goal } = computeConstanciaBars(semana, 'month', TODAY, 4)
      expect(last(bars).total).toBe(3)             // 4 workouts, 3 días
      expect(last(bars).total >= goal).toBe(false)
      expect(last(bars)).toMatchObject({ fuerza: 1, clase: 1, cardio: 1 })
    })
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
  it('vista mensual (todo): días distintos por mes, no workouts', () => {
    const w2 = [wk('fuerza', '2026-10-05'), wk('cardio', '2026-10-05'), wk('clase', '2026-10-07'), wk('cardio', '2026-11-03')]
    const { bars } = computeConstanciaBars(w2, 'all', TODAY, 4)
    expect(bars.map(b => [b.key, b.total])).toEqual([['2026-10', 2], ['2026-11', 1]])
    expect(bars[0]).toMatchObject({ fuerza: 1, clase: 1, cardio: 0 })
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
    const { rows } = computeStrengthRanking(ws, '13w', TODAY)
    expect(rows.map(r => r.name)).toEqual(['Hip Thrust', 'Press de Banca'])
    expect(rows[0]).toMatchObject({ firstWeight: 40, bestWeight: 46.5, bestReps: 14, delta: 6.5, lastImprovementDate: '2026-11-05', stable: false })
    expect(rows[1].delta).toBe(1.25)
  })
  it('"Este mes" solo mira las sesiones del 1 al día de hoy', () => {
    const ws = desc([hip('2026-10-22', 40), hip('2026-11-03', 44), hip('2026-11-10', 48)])
    expect(computeStrengthRanking(ws, 'month', TODAY).rows[0]).toMatchObject({ firstWeight: 44, bestWeight: 48, delta: 4 })
    expect(computeStrengthRanking(desc([hip('2026-10-22', 40), hip('2026-11-10', 48)]), 'month', TODAY).rows).toEqual([])   // una sola sesión en el mes
  })
  it('el período recorta: lo anterior al inicio no cuenta como base', () => {
    const ws = desc([hip('2026-08-01', 20), hip('2026-10-22', 40), hip('2026-11-05', 45)])
    expect(computeStrengthRanking(ws, '13w', TODAY).rows[0]).toMatchObject({ firstWeight: 40, delta: 5 })
    expect(computeStrengthRanking(ws, 'all', TODAY).rows[0]).toMatchObject({ firstWeight: 20, delta: 25 })
  })
  it('sin mejora, con una sola sesión o con peso 0 no entra (estado vacío)', () => {
    expect(computeStrengthRanking(desc([hip('2026-11-05', 40), hip('2026-11-10', 40)]), '13w', TODAY).rows).toEqual([])
    expect(computeStrengthRanking([hip('2026-11-05', 40)], '13w', TODAY).rows).toEqual([])
    expect(computeStrengthRanking(desc([hip('2026-11-05', 0), hip('2026-11-10', 0)]), '13w', TODAY).rows).toEqual([])
    expect(computeStrengthRanking(desc([hip('2026-11-05', 40), hip('2026-11-10', 30)]), '13w', TODAY).rows).toEqual([])
  })
  it('máximo 5 filas y total real', () => {
    const ws = []
    for (let i = 1; i <= 7; i++) ws.push(F('2026-11-03', [ex(`e${i}`, `Ejercicio ${i}`, [[10, 10]])]), F('2026-11-10', [ex(`e${i}`, `Ejercicio ${i}`, [[10, 10 + i]])]))
    const r = computeStrengthRanking(desc(ws), '13w', TODAY)
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
    const r = computeStrengthRanking(ws, '13w', TODAY).rows[0]
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
    const ws = [f('2026-11-10', 8), f('2026-11-04', 7), f('2026-11-02', 6), f('2026-11-03', null), f('2026-11-05', '')]
    const b = computeBodySummary(ws, 'month', TODAY)
    expect(b.avg).toBe(7)
    expect(b.count).toBe(3)
    expect(b.level).toBe('alto')
  })
  it('menos de 3 registros: sin promedio ni nivel', () => {
    const b = computeBodySummary([f('2026-11-10', 9), f('2026-11-04', 9)], 'month', TODAY)
    expect(b).toMatchObject({ avg: null, level: null, trend: null, count: 2 })
  })
  it('tendencia contra el MISMO tramo del mes anterior (del 1 al 12 de octubre)', () => {
    const actual = [f('2026-11-02', 8), f('2026-11-06', 7), f('2026-11-10', 7)]
    const prevSube = [f('2026-10-02', 6), f('2026-10-08', 6), f('2026-10-12', 6.5)]
    const b = computeBodySummary([...actual, ...prevSube], 'month', TODAY)
    expect(b.previous).toBe(6.2)
    expect(b.trend).toBe('up')
    const prevAlto = [f('2026-10-02', 9), f('2026-10-08', 8), f('2026-10-12', 8)]
    const b2 = computeBodySummary([...actual, ...prevAlto], 'month', TODAY)
    expect(b2.previous).toBe(8.3)
    expect(b2.trend).toBe('down')
    const prevIgual = [f('2026-10-02', 7), f('2026-10-08', 8), f('2026-10-12', 7)]
    expect(computeBodySummary([...actual, ...prevIgual], 'month', TODAY).trend).toBe('same')
  })
  it('lo que el mes anterior registró después del mismo día no entra en la comparación', () => {
    const actual = [f('2026-11-02', 8), f('2026-11-06', 7), f('2026-11-10', 7)]
    const prev = [f('2026-10-02', 6), f('2026-10-08', 6), f('2026-10-13', 6), f('2026-10-20', 6)]     // solo 2 hasta el 12/10
    expect(computeBodySummary([...actual, ...prev], 'month', TODAY).trend).toBeNull()
  })
  it('sin período anterior (todo) o con pocos registros previos: sin tendencia', () => {
    const actual = [f('2026-11-02', 8), f('2026-11-06', 7), f('2026-11-10', 7)]
    expect(computeBodySummary(actual, 'all', TODAY).trend).toBeNull()
    expect(computeBodySummary([...actual, f('2026-10-02', 3)], 'month', TODAY).trend).toBeNull()
  })
  it('el período recorta los registros', () => {
    const ws = [f('2026-11-10', 8), f('2026-11-04', 8), f('2026-11-02', 8), f('2026-08-18', 2), f('2026-08-19', 2), f('2026-08-20', 2)]
    expect(computeBodySummary(ws, 'month', TODAY).avg).toBe(8)
    expect(computeBodySummary(ws, '13w', TODAY).avg).toBe(5)
  })
  it('promedio semanal para el gráfico: una entrada por semana que toca el período, null sin registros', () => {
    const ws = [f('2026-11-10', 8), f('2026-11-11', 6), f('2026-11-03', 5)]
    const { weekly } = computeBodySummary(ws, 'month', TODAY)
    expect(weekly.map(w => w.weekStart)).toEqual([M(2), M(1), M(0)])
    expect(weekly.map(w => w.avg)).toEqual([null, 5, 7])
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

  it('la vista "Este mes" es en vivo: no tiene resumen', () => {
    expect(computePeriodSummary([wk('clase', '2026-11-10')], 'month', TODAY, GOAL)).toBeNull()
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
