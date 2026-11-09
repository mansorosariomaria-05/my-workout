import { describe, it, expect } from 'vitest'
import {
  computeProgressStats, computeKeyInsight, computeRecords, computeMayorProgreso, computeMasTrabajado,
  computeTotals, getFatigueStatus, resolvePeriod, pctChange, getWeeklyGoal, groupExercises,
} from './progressStats.js'
import { computeStreak } from './streak.js'
import { addDays, mondayOf } from './weeks.js'

// ── Historiales inventados ───────────────────────────────────────────────────
// Hoy = jueves 2026-11-12. Lunes de la semana en curso = 2026-11-09.
// Semanas: M0 = 11-09 (en curso), M-1 = 11-02, M-2 = 10-26, M-3 = 10-19, M-4 = 10-12, M-5 = 10-05, M-6 = 09-28, M-7 = 09-21, M-8 = 09-14.
const TODAY = '2026-11-12'
const M = (n) => addDays('2026-11-09', -7 * n) // lunes de la semana M-n

const wk = (type, date, extra = {}) => ({ type, date, fatigue: 5, ...extra })
const ex = (exerciseId, name, sets, extra = {}) => ({ exerciseId, name, sets: sets.map(([reps, weight]) => ({ reps, weight })), ...extra })
const F = (date, exercises, extra = {}) => wk('fuerza', date, { exercises, ...extra })
// El proveedor entrega los workouts en orden de fecha descendente.
const desc = (ws) => [...ws].sort((a, b) => b.date.localeCompare(a.date))
// n días distintos de entrenamiento (clases) en la semana que empieza en `monday`
const weekDays = (monday, n) => Array.from({ length: n }, (_, i) => wk('clase', addDays(monday, i), { clase: 'HIIT', duracion: 60 }))
const stats = (workouts, opts = {}) => computeProgressStats({ workouts: desc(workouts), today: TODAY, period: '4w', ...opts })

describe('períodos y comparación', () => {
  it('4w: semanas de lunes a domingo, período anterior de igual longitud y variación %', () => {
    const range = resolvePeriod('4w', TODAY)
    expect(range.start).toBe(M(3))                 // 3 semanas antes del lunes de esta semana
    expect(range.end).toBe(TODAY)
    expect(range.previous.start).toBe(M(7))        // 4 semanas antes del inicio
    // igual longitud en días: 25 días (11-19 → hoy) y 25 días (09-21 → 10-15)
    expect(range.previous.end).toBe('2026-10-15')

    const ws = [
      F('2026-11-10', [ex('glut_01', 'Hip Thrust', [[10, 40]])]),  // M0
      wk('clase', '2026-11-03'),                                    // M-1
      wk('cardio', '2026-10-27', { tiempo: 30 }),                   // M-2
      F('2026-10-20', [ex('glut_01', 'Hip Thrust', [[10, 40]])]),  // M-3
      wk('clase', '2026-10-14'), wk('clase', '2026-10-07'),         // período anterior (2)
      wk('clase', '2026-10-16'),                                    // fuera de ambos (después del fin del anterior, antes del inicio actual)
      wk('clase', '2026-11-14'),                                    // futuro: se ignora
      { type: 'pausa', date: '2026-11-05' }, { type: 'descanso', date: '2026-11-06' }, // no son entrenamientos reales
    ]
    const s = stats(ws)
    expect(s.range).toEqual({ start: M(3), end: TODAY, weeks: 4 })
    expect(s.trainings.value).toBe(4)
    expect(s.trainings.previous).toBe(2)
    expect(s.trainings.changePct).toBe(100)
    expect(s.activeDays.value).toBe(4)
    expect(s.activeDays.previous).toBe(2)
    expect(s.trainings.series).toHaveLength(4)
    expect(s.trainings.series.map(w => w.value)).toEqual([1, 1, 1, 1])
    expect(s.trainings.series[3].partial).toBe(true)
    expect(s.trainings.series[0].partial).toBe(false)
  })

  it('12w tiene 12 semanas y su propio período anterior', () => {
    const s = stats([wk('clase', '2026-11-10'), wk('clase', '2026-08-26')], { period: '12w' })
    expect(s.trainings.series).toHaveLength(12)
    expect(s.range.start).toBe(M(11))
    expect(s.previousRange.start).toBe(M(23))
    expect(s.trainings.value).toBe(2)
  })

  it("'all' no tiene comparación y va desde el lunes del primer entrenamiento", () => {
    const s = stats([wk('clase', '2026-09-30'), wk('clase', '2026-11-10')], { period: 'all' })
    expect(s.range.start).toBe(mondayOf('2026-09-30'))
    expect(s.previousRange).toBeNull()
    for (const k of ['trainings', 'activeDays', 'volume', 'weeksMet', 'duration', 'cardio', 'fatigue']) {
      expect(s[k].previous).toBeNull()
      expect(s[k].changePct).toBeNull()
    }
    expect(s.trainings.value).toBe(2)
  })

  it('la variación % es null si el período anterior vale 0 o falta', () => {
    expect(pctChange(5, 0)).toBeNull()
    expect(pctChange(5, null)).toBeNull()
    expect(pctChange(null, 5)).toBeNull()
    expect(pctChange(15, 10)).toBe(50)
    expect(pctChange(5, 10)).toBe(-50)
    const s = stats([wk('clase', '2026-11-10')])
    expect(s.trainings.previous).toBe(0)
    expect(s.trainings.changePct).toBeNull()
  })

  it('días activos cuenta días distintos; entrenamientos cuenta registros', () => {
    const s = stats([wk('clase', '2026-11-10'), wk('cardio', '2026-11-10'), wk('clase', '2026-11-11')])
    expect(s.trainings.value).toBe(3)
    expect(s.activeDays.value).toBe(2)
  })
})

describe('volumen de fuerza', () => {
  it("suma peso × reps de series con unit 'reps' y peso > 0; excluye 'secs', peso 0 y vacío; acepta peso como texto", () => {
    const s = stats([
      F('2026-11-10', [
        ex('glut_01', 'Hip Thrust', [[10, 40], [10, 40], [10, 40]]),        // 1200
        ex('cua_07', 'Sentadilla isométrica', [[40, 10], [40, 10]]),        // 'secs' con peso: no suma
        ex('abs_02', 'Plancha con flexión', [[12, 0], [12, '']]),           // sin peso: 0
        ex('glut_02', 'Hip Thrust a una pierna', [[10, '25'], [10, 25]]),    // texto "25" → 500
      ]),
    ])
    expect(s.volume.value).toBe(1700)
  })

  it('una alternativa alt-… con el nombre de un ejercicio en segundos tampoco suma volumen', () => {
    const s = stats([F('2026-11-10', [ex('alt-0-111', 'La Plancha', [[60, 10]])])])
    expect(s.volume.value).toBe(0)
  })

  it('serie semanal y variación del volumen', () => {
    const s = stats([
      F('2026-11-10', [ex('glut_01', 'Hip Thrust', [[10, 50]])]),            // 500 en M0
      F('2026-10-20', [ex('glut_01', 'Hip Thrust', [[10, 50]])]),            // 500 en M-3
      F('2026-10-07', [ex('glut_01', 'Hip Thrust', [[10, 50]])]),            // anterior: 500
    ])
    expect(s.volume.value).toBe(1000)
    expect(s.volume.previous).toBe(500)
    expect(s.volume.changePct).toBe(100)
    expect(s.volume.series.map(w => w.value)).toEqual([500, 0, 0, 500])
  })
})

describe('semanas cumplidas (objetivo semanal) y semana en curso', () => {
  const profile = { diasSemana: 3 }
  it('una semana cumple con días entrenados ≥ profile.diasSemana', () => {
    const s = stats([...weekDays(M(3), 3), ...weekDays(M(2), 2), ...weekDays(M(1), 4)], { profile })
    expect(s.goal).toBe(3)
    expect(s.weeksMet.value).toBe(2)
    expect(s.weeksMet.series.map(w => w.value)).toEqual([1, 0, 1, 0])
    expect(s.weeksMet.series.map(w => w.days)).toEqual([3, 2, 4, 0])
    expect(s.weeksMet.weeksEvaluated).toBe(3) // 3 semanas cerradas; la en curso no cumplió, no cuenta
  })

  it('la semana en curso cuenta solo si ya se cumplió', () => {
    const base = [...weekDays(M(1), 3)]
    const incompleta = stats([...base, ...weekDays(M(0), 2)], { profile })
    expect(incompleta.weeksMet.value).toBe(1)
    expect(incompleta.weeksMet.weeksEvaluated).toBe(3)
    const cumplida = stats([...base, ...weekDays(M(0), 3)], { profile })
    expect(cumplida.weeksMet.value).toBe(2)
    expect(cumplida.weeksMet.weeksEvaluated).toBe(4)
  })

  it('el objetivo sale del perfil y tiene respaldo en 3', () => {
    expect(getWeeklyGoal({ diasSemana: 5 })).toBe(5)
    expect(getWeeklyGoal({})).toBe(3)
    expect(getWeeklyGoal(null)).toBe(3)
    const s = stats(weekDays(M(1), 4), { profile: { diasSemana: 5 } })
    expect(s.weeksMet.value).toBe(0)
  })

  it('compara con el período anterior', () => {
    const s = stats([...weekDays(M(1), 3), ...weekDays(M(2), 3), ...weekDays(M(5), 3)], { profile })
    expect(s.weeksMet.value).toBe(2)
    expect(s.weeksMet.previous).toBe(1)
    expect(s.weeksMet.changePct).toBe(100)
  })
})

describe('duración promedio por sesión', () => {
  it('fuerza sin durationSeconds (ausente, null o 0) no cuenta como 0: sin datos suficientes → null', () => {
    const s = stats([
      F('2026-11-10', [], {}), F('2026-11-04', [], { durationSeconds: null }), F('2026-10-28', [], { durationSeconds: 0 }),
    ])
    expect(s.duration.value).toBeNull()
    expect(s.duration.sessionsWithData).toBe(0)
    expect(s.duration.sessionsTotal).toBe(3)
    expect(s.duration.byType.fuerza.sessions).toBe(0)
  })

  it('promedia solo las sesiones con dato (las demás no bajan el promedio)', () => {
    const s = stats([
      F('2026-11-10', [], { durationSeconds: 3600 }), F('2026-11-04', [], { durationSeconds: 3600 }), F('2026-10-28', [], { durationSeconds: 3600 }),
      F('2026-10-27', []), F('2026-10-26', [], { durationSeconds: null }),
    ])
    expect(s.duration.value).toBe(60)
    expect(s.duration.sessionsWithData).toBe(3)
    expect(s.duration.sessionsTotal).toBe(5)
    expect(s.duration.byType.fuerza).toEqual({ value: 60, sessions: 3, sessionsTotal: 5 })
  })

  it('con menos de 3 sesiones con dato devuelve null pero informa la cantidad', () => {
    const s = stats([F('2026-11-10', [], { durationSeconds: 3000 }), F('2026-11-04', [], { durationSeconds: 3000 })])
    expect(s.duration.value).toBeNull()
    expect(s.duration.sessionsWithData).toBe(2)
  })

  it('clase usa su duración y cardio su tiempo; promedio global y por tipo', () => {
    const s = stats([
      ...[0, 1, 2].map(i => wk('clase', addDays('2026-11-10', -i), { duracion: 45 })),
      ...[3, 4, 5].map(i => wk('cardio', addDays('2026-11-10', -i), { tiempo: 30 })),
      ...[6, 7, 8].map(i => F(addDays('2026-11-10', -i), [], { durationSeconds: 3600 })),
    ])
    expect(s.duration.byType.clase.value).toBe(45)
    expect(s.duration.byType.cardio.value).toBe(30)
    expect(s.duration.byType.fuerza.value).toBe(60)
    expect(s.duration.value).toBe(45)            // (45×3 + 30×3 + 60×3) / 9
    expect(s.duration.sessionsWithData).toBe(9)
  })

  it('cardio con durationSeconds nuevo y con "tiempo" viejo', () => {
    const s = stats([
      wk('cardio', '2026-11-10', { durationSeconds: 1800 }), wk('cardio', '2026-11-04', { tiempo: 20 }), wk('cardio', '2026-10-28', { durationSeconds: 3000 }),
    ])
    expect(s.duration.byType.cardio.value).toBe(33.3) // (30 + 20 + 50) / 3
  })

  it('compara contra el período anterior solo si ese también tiene datos suficientes', () => {
    const cur = [0, 1, 2].map(i => F(addDays('2026-11-10', -i), [], { durationSeconds: 3600 }))
    const prevOk = [30, 31, 32].map(i => F(addDays('2026-11-10', -i), [], { durationSeconds: 1800 }))
    expect(stats([...cur, ...prevOk]).duration.changePct).toBe(100)
    expect(stats([...cur, prevOk[0]]).duration.changePct).toBeNull()
  })
})

describe('cardio', () => {
  it('minutos promedio solo con sesiones que tienen tiempo; cuenta las que tienen y no tienen dato', () => {
    const s = stats([
      wk('cardio', '2026-11-10', { durationSeconds: 2400 }),      // 40
      wk('cardio', '2026-11-04', { tiempo: 20 }),                  // 20 (registro viejo)
      wk('cardio', '2026-10-28'),                                  // sin tiempo
      wk('cardio', '2026-10-27', { durationSeconds: null, tiempo: null }), // sin tiempo
    ])
    expect(s.cardio.value).toBe(30)
    expect(s.cardio.withData).toBe(2)
    expect(s.cardio.withoutData).toBe(2)
    expect(s.cardio.sessions).toBe(4)
  })

  it('sin ninguna sesión con tiempo el promedio es null (no 0)', () => {
    const s = stats([wk('cardio', '2026-11-10'), wk('cardio', '2026-11-04')])
    expect(s.cardio.value).toBeNull()
    expect(s.cardio.withData).toBe(0)
    expect(s.cardio.withoutData).toBe(2)
  })

  it('serie semanal: null en las semanas sin cardio con tiempo', () => {
    const s = stats([wk('cardio', '2026-11-10', { tiempo: 30 }), wk('cardio', '2026-10-20', { tiempo: 50 })])
    expect(s.cardio.series.map(w => w.value)).toEqual([50, null, null, 30])
  })
})

describe('cansancio', () => {
  it('promedio del período y por semana (escala 1-10); ignora vacíos', () => {
    const s = stats([
      wk('clase', '2026-11-10', { fatigue: 8 }), wk('clase', '2026-11-11', { fatigue: 6 }),
      wk('clase', '2026-11-03', { fatigue: 4 }), wk('clase', '2026-11-04', { fatigue: null }), wk('clase', '2026-11-05', { fatigue: '' }),
    ])
    expect(s.fatigue.value).toBe(6)
    expect(s.fatigue.count).toBe(3)
    expect(s.fatigue.series.map(w => w.value)).toEqual([null, null, 4, 7])
  })

  it('getFatigueStatus: pocos registros → sin-datos aunque sean altos', () => {
    const st = getFatigueStatus(desc([wk('clase', '2026-11-03', { fatigue: 9 }), wk('clase', '2026-11-04', { fatigue: 9 })]), TODAY)
    expect(st.status).toBe('sin-datos')
    expect(st.high).toBe(false)
    expect(st.count).toBe(2)
  })

  it('getFatigueStatus: alto con promedio ≥ 7 y al menos 3 registros en las últimas 2 semanas completas', () => {
    const alto = getFatigueStatus([wk('clase', '2026-10-28', { fatigue: 7 }), wk('clase', '2026-11-03', { fatigue: 7 }), wk('clase', '2026-11-04', { fatigue: 7 })], TODAY)
    expect(alto).toMatchObject({ status: 'alto', high: true, avg: 7, count: 3, start: M(2), end: addDays(M(0), -1) })
    const normal = getFatigueStatus([wk('clase', '2026-10-28', { fatigue: 6 }), wk('clase', '2026-11-03', { fatigue: 7 }), wk('clase', '2026-11-04', { fatigue: 7 })], TODAY)
    expect(normal.status).toBe('normal')
    expect(normal.avg).toBe(6.7)
  })

  it('getFatigueStatus: usa el promedio redondeado a 1 decimal, igual que se muestra', () => {
    const st = getFatigueStatus([1, 2, 3].map(i => wk('clase', addDays('2026-11-02', i), { fatigue: 6.96 })), TODAY)
    expect(st.avg).toBe(7)
    expect(st.status).toBe('alto')
  })

  it('getFatigueStatus: la semana en curso, lo anterior a 2 semanas y los tipos no reales no cuentan', () => {
    const ws = [
      wk('clase', '2026-11-10', { fatigue: 10 }), wk('clase', '2026-11-11', { fatigue: 10 }), wk('clase', '2026-11-12', { fatigue: 10 }), // semana en curso
      wk('clase', '2026-10-20', { fatigue: 10 }), wk('clase', '2026-10-21', { fatigue: 10 }), wk('clase', '2026-10-22', { fatigue: 10 }), // 3 semanas atrás
      { type: 'pausa', date: '2026-11-03', fatigue: 10 }, { type: 'descanso', date: '2026-11-04', fatigue: 10 },
      wk('clase', '2026-11-03', { fatigue: 5 }),
    ]
    const st = getFatigueStatus(ws, TODAY)
    expect(st.count).toBe(1)
    expect(st.status).toBe('sin-datos')
  })
})

describe('racha estricta', () => {
  it('semanas consecutivas con 3+ días; una semana cerrada con menos de 3 corta la racha', () => {
    const ws = [
      ...[8, 7, 6, 5].flatMap(n => weekDays(M(n), 3)),   // 4 semanas
      ...weekDays(M(4), 2),                              // semana de 2 días → corta
      ...[3, 2, 1].flatMap(n => weekDays(M(n), 3)),      // 3 semanas
    ]
    const r = computeStreak(desc(ws), TODAY)
    expect(r.current).toBe(3)
    expect(r.record).toBe(4)
    expect(r.currentStart).toBe(M(3))
    expect(r.currentEnd).toBe(addDays(M(1), 6))
    expect(r.recordStart).toBe(M(8))
    expect(r.recordEnd).toBe(addDays(M(5), 6))
  })

  it('una semana con 0 días también corta', () => {
    const ws = [...[6, 5, 4].flatMap(n => weekDays(M(n), 3)), ...[2, 1].flatMap(n => weekDays(M(n), 3))]
    const r = computeStreak(desc(ws), TODAY)
    expect(r.current).toBe(2)
    expect(r.record).toBe(3)
  })

  it('semana en curso incompleta: no suma, pero tampoco corta', () => {
    const ws = [...[5, 4, 3, 2, 1].flatMap(n => weekDays(M(n), 3)), ...weekDays(M(0), 1)]
    const r = computeStreak(desc(ws), TODAY)
    expect(r.current).toBe(5)
    expect(r.currentEnd).toBe(addDays(M(1), 6))
    const sinNada = computeStreak(desc([...[5, 4, 3, 2, 1].flatMap(n => weekDays(M(n), 3))]), TODAY)
    expect(sinNada.current).toBe(5)
  })

  it('la semana en curso suma apenas llega a 3 días', () => {
    const ws = [...[5, 4, 3, 2, 1].flatMap(n => weekDays(M(n), 3)), ...weekDays(M(0), 3)]
    const r = computeStreak(desc(ws), TODAY)
    expect(r.current).toBe(6)
    expect(r.record).toBe(6)
    expect(r.currentEnd).toBe(addDays(M(0), 6))
  })

  it('si la semana anterior no llegó a 3, la racha actual es 0 aunque la actual todavía no haya empezado', () => {
    const ws = [...[4, 3, 2].flatMap(n => weekDays(M(n), 3)), ...weekDays(M(1), 2)]
    const r = computeStreak(desc(ws), TODAY)
    expect(r.current).toBe(0)
    expect(r.currentStart).toBeNull()
    expect(r.record).toBe(3)
  })

  it('devuelve las últimas 12 semanas con sus días; la última es la actual', () => {
    const r = computeStreak(desc([...weekDays(M(1), 4), ...weekDays(M(0), 2)]), TODAY)
    expect(r.last12).toHaveLength(12)
    expect(r.last12[11]).toMatchObject({ weekStart: M(0), days: 2, met: false, isCurrent: true })
    expect(r.last12[10]).toMatchObject({ weekStart: M(1), days: 4, met: true, isCurrent: false })
    expect(r.last12[0].weekStart).toBe(M(11))
  })

  it('sin workouts: todo en cero y fechas null; solo cuentan los tipos reales y las fechas hasta hoy', () => {
    const vacio = computeStreak([], TODAY)
    expect(vacio).toMatchObject({ current: 0, record: 0, currentStart: null, recordStart: null })
    expect(vacio.last12).toHaveLength(12)
    const noReales = computeStreak([{ type: 'pausa', date: '2026-11-03' }, ...weekDays('2026-11-16', 3)], TODAY)
    expect(noReales.record).toBe(0)
  })

  it('el récord se mantiene cuando la racha actual es menor; ante un empate gana el más reciente', () => {
    const ws = [...[8, 7].flatMap(n => weekDays(M(n), 3)), ...[3, 2].flatMap(n => weekDays(M(n), 3))]
    const r = computeStreak(desc(ws), TODAY)
    expect(r.record).toBe(2)
    expect(r.recordStart).toBe(M(3))
  })
})

describe('récords (fuente única)', () => {
  it('en kg: supera estrictamente la mejor marca previa; la primera sesión no cuenta', () => {
    const ws = [['2026-10-01', 20], ['2026-10-08', 25], ['2026-10-15', 25], ['2026-10-22', 30]].map(([d, kg]) => F(d, [ex('glut_01', 'Hip Thrust', [[10, kg]])]))
    const r = computeRecords(desc(ws))
    expect(r.events).toEqual([
      { exerciseKey: 'glut_01', exerciseId: 'glut_01', name: 'Hip Thrust', date: '2026-10-08', previous: 20, value: 25, unit: 'kg' },
      { exerciseKey: 'glut_01', exerciseId: 'glut_01', name: 'Hip Thrust', date: '2026-10-22', previous: 25, value: 30, unit: 'kg' },
    ])
    expect(r.total).toBe(2)
    expect(r.last.value).toBe(30)
    expect(r.mostRecords).toMatchObject({ exerciseKey: 'glut_01', count: 2 })
    expect(r.distinctExercises).toBe(1)
  })

  it('en segundos: ejercicio en secs sin peso', () => {
    const ws = [['2026-10-01', 30], ['2026-10-08', 40], ['2026-10-15', 40], ['2026-10-22', 50]].map(([d, s]) => F(d, [ex('cor_01', 'La Plancha', [[s, ''], [s, '']])]))
    const r = computeRecords(desc(ws))
    expect(r.events.map(e => [e.previous, e.value, e.unit])).toEqual([[30, 40, 'seg'], [40, 50, 'seg']])
  })

  it('en reps: ejercicio en repeticiones sin peso', () => {
    const ws = [['2026-10-01', 10], ['2026-10-08', 12], ['2026-10-15', 12], ['2026-10-22', 15]].map(([d, r]) => F(d, [ex('abs_02', 'Plancha con flexión', [[r, 0], [r, 0]])]))
    const r = computeRecords(desc(ws))
    expect(r.events.map(e => [e.previous, e.value, e.unit])).toEqual([[10, 12, 'reps'], [12, 15, 'reps']])
  })

  it('un ejercicio en segundos que alguna vez tuvo peso usa kg como métrica principal', () => {
    const ws = [['2026-10-01', 0, 40], ['2026-10-08', 8, 40], ['2026-10-15', 12, 60], ['2026-10-22', 12, 90]].map(([d, kg, s]) => F(d, [ex('cua_07', 'Sentadilla isométrica', [[s, kg]])]))
    const r = computeRecords(desc(ws))
    // la sesión sin peso no es base: la primera sesión con peso (8) es la base; 12 es récord; 90 s no suma nada
    expect(r.events.map(e => [e.previous, e.value, e.unit])).toEqual([[8, 12, 'kg']])
  })

  it('con una sola sesión (o una sesión por ejercicio) no hay récords', () => {
    expect(computeRecords([F('2026-10-01', [ex('glut_01', 'Hip Thrust', [[10, 40]])])]).total).toBe(0)
    expect(computeRecords([]).total).toBe(0)
    expect(computeRecords([]).last).toBeNull()
    expect(computeRecords([]).mostRecords).toBeNull()
  })

  it('una marca igual o menor no es récord; el peso como texto se interpreta', () => {
    const ws = [['2026-10-01', '20'], ['2026-10-08', 20], ['2026-10-15', 15], ['2026-10-22', '22.5']].map(([d, kg]) => F(d, [ex('glut_01', 'Hip Thrust', [[10, kg]])]))
    expect(computeRecords(desc(ws)).events.map(e => e.value)).toEqual([22.5])
  })

  it('el ejercicio con más récords y el último récord', () => {
    const a = [10, 12, 14, 16].map((kg, i) => F(addDays('2026-10-01', i * 7), [ex('glut_01', 'Hip Thrust', [[10, kg]])]))
    const b = [20, 30].map((kg, i) => F(addDays('2026-10-02', i * 30), [ex('glut_03', 'Kettlebell swing', [[10, kg]])]))
    const r = computeRecords(desc([...a, ...b]))
    expect(r.total).toBe(4)
    expect(r.mostRecords).toMatchObject({ exerciseKey: 'glut_01', count: 3 })
    expect(r.distinctExercises).toBe(2)
    expect(r.last.exerciseKey).toBe('glut_03')
  })
})

describe('mayor progreso', () => {
  it('primera marca contra la MEJOR marca (no la última); ranking por %', () => {
    const a = [['2026-10-01', 10], ['2026-10-08', 20], ['2026-10-15', 15]].map(([d, kg]) => F(d, [ex('glut_01', 'Hip Thrust', [[10, kg]])]))
    const b = [['2026-10-02', 10], ['2026-10-09', 12], ['2026-10-16', 15]].map(([d, kg]) => F(d, [ex('glut_03', 'Kettlebell swing', [[10, kg]])]))
    const r = computeMayorProgreso(desc([...a, ...b]))
    expect(r.ranking.map(x => [x.name, x.pct])).toEqual([['Hip Thrust', 100], ['Kettlebell swing', 50]])
    expect(r.top).toEqual({
      exerciseKey: 'glut_01', exerciseId: 'glut_01', name: 'Hip Thrust', unit: 'kg',
      firstValue: 10, firstDate: '2026-10-01', bestValue: 20, bestDate: '2026-10-08', pct: 100, sessions: 3,
    })
  })

  it('con menos de 3 sesiones no entra al ranking', () => {
    const ws = [['2026-10-01', 10], ['2026-10-08', 30]].map(([d, kg]) => F(d, [ex('glut_01', 'Hip Thrust', [[10, kg]])]))
    const r = computeMayorProgreso(desc(ws))
    expect(r.ranking).toEqual([])
    expect(r.top).toBeNull()
  })

  it('usa la misma métrica principal: segundos para un ejercicio en secs sin peso', () => {
    const ws = [['2026-10-01', 30], ['2026-10-08', 45], ['2026-10-15', 60]].map(([d, s]) => F(d, [ex('cor_01', 'La Plancha', [[s, '']])]))
    const r = computeMayorProgreso(desc(ws))
    expect(r.top).toMatchObject({ unit: 'seg', firstValue: 30, bestValue: 60, pct: 100, sessions: 3 })
  })

  it('un ejercicio que nunca superó su primera marca no es "top"', () => {
    const ws = [['2026-10-01', 20], ['2026-10-08', 15], ['2026-10-15', 15]].map(([d, kg]) => F(d, [ex('glut_01', 'Hip Thrust', [[10, kg]])]))
    const r = computeMayorProgreso(desc(ws))
    expect(r.ranking[0].pct).toBe(0)
    expect(r.top).toBeNull()
  })
})

describe('alternativas alt-… y agrupación por nombre', () => {
  it('una alternativa con el nombre de un ejercicio del catálogo se une a su historial', () => {
    const ws = [
      F('2026-10-01', [ex('cor_01', 'La Plancha', [[30, '']])]), F('2026-10-08', [ex('alt-0-1700001', 'La Plancha', [[40, '']])]),
      F('2026-10-15', [ex('alt-2-1700002', 'la plancha', [[50, '']])]), F('2026-10-22', [ex('cor_01', 'La Plancha', [[60, '']])]),
    ]
    const g = groupExercises(desc(ws))
    expect([...g.keys()]).toEqual(['cor_01'])
    expect(g.get('cor_01').sessions).toHaveLength(4)
    expect(computeMasTrabajado(desc(ws)).top).toMatchObject({ exerciseKey: 'cor_01', sessions: 4 })
    expect(computeRecords(desc(ws)).total).toBe(3)
  })

  it('alternativas fuera del catálogo se agrupan por nombre normalizado (sin tildes ni mayúsculas)', () => {
    const ws = [
      F('2026-10-01', [ex('alt-1-5', 'Elevación de piernas', [[10, 0]])]),
      F('2026-10-08', [ex('alt-0-9', 'elevacion  de PIERNAS ', [[12, 0]])]),
      F('2026-10-15', [ex('alt-3-2', 'Elevación de piernas', [[14, 0]])]),
    ]
    const g = groupExercises(desc(ws))
    expect(g.size).toBe(1)
    expect([...g.values()][0].sessions).toHaveLength(3)
    expect(computeMayorProgreso(desc(ws)).top).toMatchObject({ firstValue: 10, bestValue: 14, sessions: 3 })
  })

  it('un ejercicio propio (id fuera del catálogo) se agrupa por nombre', () => {
    const ws = [F('2026-10-01', [ex('custom_1', 'Mi ejercicio', [[10, 20]])]), F('2026-10-08', [ex('custom_2', 'mi ejercicio', [[10, 25]])])]
    expect(groupExercises(desc(ws)).size).toBe(1)
  })

  it('el mismo ejercicio dos veces en un workout cuenta como una sola sesión', () => {
    const ws = [F('2026-10-01', [ex('glut_01', 'Hip Thrust', [[10, 20]]), ex('alt-0-1', 'Hip Thrust', [[10, 30]])])]
    const g = groupExercises(ws).get('glut_01')
    expect(g.sessions).toHaveLength(1)
    expect(g.sessions[0].maxWeight).toBe(30)
  })
})

describe('más trabajado', () => {
  it('cuenta sesiones de todos los ejercicios, incluidos los sin peso, con primera/última fecha y total de series', () => {
    const planchas = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22'].map(d => F(d, [ex('cor_01', 'La Plancha', [[60, ''], [60, '']])]))
    const hip = ['2026-10-02', '2026-10-09'].map(d => F(d, [ex('glut_01', 'Hip Thrust', [[10, 40], [10, 40], [10, 40]])]))
    const r = computeMasTrabajado(desc([...planchas, ...hip]))
    expect(r.top).toEqual({ exerciseKey: 'cor_01', exerciseId: 'cor_01', name: 'La Plancha', unit: 'seg', sessions: 4, firstDate: '2026-10-01', lastDate: '2026-10-22', totalSets: 8 })
    expect(r.ranking[1]).toMatchObject({ name: 'Hip Thrust', sessions: 2, totalSets: 6, unit: 'reps' })
  })

  it('empata por total de series y después por nombre', () => {
    const a = F('2026-10-01', [ex('glut_01', 'Hip Thrust', [[10, 40]]), ex('glut_03', 'Kettlebell swing', [[10, 20], [10, 20]])])
    const r = computeMasTrabajado([a])
    expect(r.top.name).toBe('Kettlebell swing')
  })

  it('sin historial: top null', () => {
    expect(computeMasTrabajado([]).top).toBeNull()
  })
})

describe('entrenamientos totales (todo el historial)', () => {
  it('total, días únicos, desglose por tipo, primer entrenamiento y mes con más días', () => {
    const ws = [
      wk('fuerza', '2026-08-03'), wk('cardio', '2026-08-03'), wk('clase', '2026-08-10'),
      wk('clase', '2026-10-01'), wk('clase', '2026-10-02'), wk('fuerza', '2026-10-05'),
      { type: 'pausa', date: '2026-10-06' }, wk('clase', '2026-12-25'),
    ]
    const t = computeTotals(desc(ws), TODAY)
    expect(t.total).toBe(6)
    expect(t.uniqueDays).toBe(5)
    expect(t.byType).toEqual({ fuerza: 2, cardio: 1, clase: 3, tabata: 0 })
    expect(t.firstDate).toBe('2026-08-03')
    expect(t.monthMostDays).toEqual({ month: '2026-10', days: 3 })
  })

  it('sin historial', () => {
    expect(computeTotals([], TODAY)).toMatchObject({ total: 0, uniqueDays: 0, firstDate: null, monthMostDays: null })
  })
})

describe('dato clave (5 reglas con prioridad)', () => {
  const hip = (date, kg, reps = 10, sets = 3, extra = {}) => F(date, [ex('glut_01', 'Hip Thrust', Array.from({ length: sets }, () => [reps, kg]))], extra)

  it('R1 cansancio alto: promedio de las últimas 2 semanas ≥ 7 con al menos 3 registros (máxima prioridad)', () => {
    const ws = [wk('clase', '2026-10-28', { fatigue: 8 }), wk('clase', '2026-11-03', { fatigue: 8 }), wk('clase', '2026-11-04', { fatigue: 9 }),
      hip('2026-10-05', 20), hip('2026-11-03', 25)] // también hay un récord de peso (R2), pero R1 gana
    const s = stats(ws)
    expect(s.keyInsightRule).toBe('R1')
    expect(s.keyInsight).toBe('Tu cansancio promedio de las últimas 2 semanas fue 7,5/10. Podés considerar una semana de descarga.')
    expect(s.keyInsights.map(k => k.rule)).toContain('R2')
  })

  it('R1 no dispara con menos de 3 registros', () => {
    const s = stats([wk('clase', '2026-11-03', { fatigue: 10 }), wk('clase', '2026-11-04', { fatigue: 10 })])
    expect(s.keyInsight).toBeNull()
  })

  it('R2 récord de peso dentro del período', () => {
    const s = stats([hip('2026-10-05', 20), hip('2026-11-03', 25)])
    expect(s.keyInsightRule).toBe('R2')
    expect(s.keyInsight).toBe('Récord nuevo en Hip Thrust: 25 kg (+5 kg sobre tu marca anterior de 20 kg).')
  })

  it('R2 no dispara si el récord es anterior al período, y elige el más reciente si hay varios', () => {
    expect(stats([hip('2026-08-05', 20), hip('2026-08-12', 25)]).keyInsight).toBeNull()
    const dos = stats([hip('2026-10-05', 20), hip('2026-10-22', 25), F('2026-11-03', [ex('glut_03', 'Kettlebell swing', [[10, 10]])]), F('2026-11-09', [ex('glut_03', 'Kettlebell swing', [[10, 14]])])])
    expect(dos.keyInsight).toBe('Récord nuevo en Kettlebell swing: 14 kg (+4 kg sobre tu marca anterior de 10 kg).')
  })

  it('R2 usa coma decimal', () => {
    const s = stats([hip('2026-10-05', 20), hip('2026-11-03', 22.5)])
    expect(s.keyInsight).toBe('Récord nuevo en Hip Thrust: 22,5 kg (+2,5 kg sobre tu marca anterior de 20 kg).')
  })

  it('R3 mejor tiempo en un ejercicio en segundos (supera el máximo previo al período)', () => {
    const plancha = (date, s) => F(date, [ex('cor_01', 'La Plancha', [[s, '']])])
    const s = stats([plancha('2026-10-05', 60), plancha('2026-11-03', 70)])
    expect(s.keyInsightRule).toBe('R3')
    expect(s.keyInsight).toBe('Aguantaste 70 seg en La Plancha, tu mejor marca (antes 60 seg).')
    expect(stats([plancha('2026-10-05', 60), plancha('2026-11-03', 60)]).keyInsight).toBeNull()
    expect(stats([plancha('2026-11-03', 70)]).keyInsight).toBeNull() // sin marca previa al período
  })

  it('R3 compara solo con el mismo peso', () => {
    const iso = (date, s, kg) => F(date, [ex('cua_07', 'Sentadilla isométrica', [[s, kg]])])
    const mismoPeso = stats([iso('2026-10-05', 30, 10), iso('2026-11-03', 45, 10)])
    expect(mismoPeso.keyInsights.map(k => k.rule)).toContain('R3')
    const otroPeso = stats([iso('2026-10-05', 30, 10), iso('2026-11-03', 45, 15)])
    expect(otroPeso.keyInsights.map(k => k.rule)).not.toContain('R3')
  })

  it('R4 variación de volumen (≥ 10 %, al menos 2 sesiones con volumen en cada período)', () => {
    const prev = [hip('2026-10-01', 50, 8), hip('2026-10-08', 50, 8)]
    const cur = [hip('2026-10-22', 50, 10), hip('2026-10-29', 50, 10)]
    const s = stats([...prev, ...cur])
    expect(s.keyInsightRule).toBe('R4')
    expect(s.keyInsight).toBe('Tu volumen de fuerza subió un 25 % frente a las 4 semanas anteriores.')
    const baja = stats([...[hip('2026-10-01', 50, 10), hip('2026-10-08', 50, 10)], ...[hip('2026-10-22', 50, 8), hip('2026-10-29', 50, 8)]])
    expect(baja.keyInsight).toBe('Tu volumen de fuerza bajó un 20 % frente a las 4 semanas anteriores.')
  })

  it('R4 menciona la semana de descarga y no dispara con menos de 2 sesiones, con cambio chico o en "all"', () => {
    const prev = [hip('2026-10-01', 50, 8), hip('2026-10-08', 50, 8)]
    const conDescarga = stats([...prev, hip('2026-10-22', 50, 10, 3, { deload: true }), hip('2026-10-29', 50, 10)])
    expect(conDescarga.keyInsight).toBe('Tu volumen de fuerza subió un 25 % frente a las 4 semanas anteriores (incluye semana de descarga).')
    expect(stats([...prev, hip('2026-10-29', 50, 10)]).keyInsight).toBeNull()
    expect(stats([...prev, hip('2026-10-22', 50, 8, 3), hip('2026-10-29', 50, 8, 3)]).keyInsight).toBeNull() // 0 %
    expect(stats([...prev, hip('2026-10-22', 50, 10), hip('2026-10-29', 50, 10)], { period: 'all' }).keyInsights.map(k => k.rule)).not.toContain('R4')
    const enorme = stats([...prev, hip('2026-10-22', 50, 30), hip('2026-10-29', 50, 30)])
    expect(enorme.keyInsight).toBe('Tu volumen de fuerza subió más de un 200 % frente a las 4 semanas anteriores.')
  })

  it('R5 constancia: semanas cumplidas del período (la semana en curso cuenta solo si ya se cumplió), con al menos 4 semanas', () => {
    const profile = { diasSemana: 3 }
    const todas = stats([...[3, 2, 1, 0].flatMap(n => weekDays(M(n), 3))], { profile })
    expect(todas.keyInsightRule).toBe('R5')
    expect(todas.keyInsight).toBe('¡Cumpliste tu objetivo de 3 días las 4 semanas!')
    const algunas = stats([...[5, 4, 3, 2, 1].flatMap(n => weekDays(M(n), 3))], { profile, period: '12w' })
    expect(algunas.keyInsight).toBe('Cumpliste tu objetivo de 3 días en 5 de 11 semanas.')
    // en 4w con la semana en curso sin cumplir solo hay 3 semanas evaluadas → no dispara
    expect(stats([...[3, 2, 1].flatMap(n => weekDays(M(n), 3))], { profile }).keyInsight).toBeNull()
    // ninguna semana cumplida → no dispara
    expect(stats(weekDays(M(5), 1), { profile, period: '12w' }).keyInsight).toBeNull()
  })

  it('prioridad: R2 gana a R5 y a R4; sin nada → null', () => {
    const profile = { diasSemana: 3 }
    const con = stats([...[3, 2, 1, 0].flatMap(n => weekDays(M(n), 3)), hip('2026-10-05', 20), hip('2026-11-03', 25)], { profile })
    expect(con.keyInsights.map(k => k.rule)).toEqual(['R2', 'R5'])
    expect(con.keyInsightRule).toBe('R2')
    expect(stats([]).keyInsight).toBeNull()
    expect(computeKeyInsight({ workouts: [], today: TODAY })).toBeNull()
  })

  it('es determinístico: mismos datos, misma frase', () => {
    const ws = [hip('2026-10-05', 20), hip('2026-11-03', 25)]
    expect(stats(ws).keyInsight).toBe(stats(ws).keyInsight)
  })
})
