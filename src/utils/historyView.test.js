import { describe, it, expect } from 'vitest'
import { computeSessionList, groupSessionsByMonth, findPRWorkouts } from './historyView.js'
import { detectPRs } from './prUtils.js'

const ex = (exerciseId, ...weights) => ({ exerciseId, name: exerciseId, sets: weights.map(weight => ({ weight, reps: 8 })) })
const fuerza = (date, ...exercises) => ({ type: 'fuerza', date, exercises })
const other = (type, date) => ({ type, date })

describe('computeSessionList', () => {
  it('solo sesiones reales con fecha, de la más reciente a la más antigua', () => {
    const list = computeSessionList([
      other('cardio', '2026-11-02'),
      other('pausa', '2026-11-03'),
      other('clase', '2026-11-10'),
      { type: 'fuerza' },                 // sin fecha
      other('fuerza', '2026-10-30'),
    ])
    expect(list.map(s => s.workout.date)).toEqual(['2026-11-10', '2026-11-02', '2026-10-30'])
  })

  it('los workouts tabata históricos siguen apareciendo', () => {
    const list = computeSessionList([other('tabata', '2026-05-04'), other('fuerza', '2026-05-05')])
    expect(list.map(s => s.workout.type)).toEqual(['fuerza', 'tabata'])
  })

  it('a igual fecha respeta el orden de entrada', () => {
    const a = { type: 'cardio', date: '2026-11-02', id: 'a' }
    const b = { type: 'clase', date: '2026-11-02', id: 'b' }
    expect(computeSessionList([a, b]).map(s => s.workout.id)).toEqual(['a', 'b'])
  })

  it('sin workouts devuelve una lista vacía', () => {
    expect(computeSessionList([])).toEqual([])
  })
})

describe('groupSessionsByMonth', () => {
  it('agrupa por mes con encabezado "Mes Año", del más reciente al más antiguo', () => {
    const groups = groupSessionsByMonth([
      other('fuerza', '2026-11-15'),
      other('cardio', '2026-11-02'),
      other('clase', '2026-10-31'),
      other('fuerza', '2025-12-01'),
    ])
    expect(groups.map(g => g.label)).toEqual(['Noviembre 2026', 'Octubre 2026', 'Diciembre 2025'])
    expect(groups.map(g => g.count)).toEqual([2, 1, 1])
    expect(groups[0].sessions.map(s => s.workout.date)).toEqual(['2026-11-15', '2026-11-02'])
  })

  it('el mismo mes de años distintos son grupos distintos', () => {
    const groups = groupSessionsByMonth([other('fuerza', '2026-03-01'), other('fuerza', '2025-03-01')])
    expect(groups.map(g => g.key)).toEqual(['2026-03', '2025-03'])
  })

  it('sin sesiones reales no hay grupos', () => {
    expect(groupSessionsByMonth([other('pausa', '2026-11-01')])).toEqual([])
  })
})

describe('findPRWorkouts', () => {
  it('la primera vez que se hace un ejercicio no es récord; subir el máximo sí', () => {
    const ws = [fuerza('2026-11-01', ex('sq', 50)), fuerza('2026-11-08', ex('sq', 55)), fuerza('2026-11-15', ex('sq', 55))]
    expect([...findPRWorkouts(ws)]).toEqual([1])
  })

  it('compara contra el máximo de todas las sesiones anteriores, no solo la última', () => {
    const ws = [fuerza('2026-11-01', ex('sq', 60)), fuerza('2026-11-08', ex('sq', 50)), fuerza('2026-11-15', ex('sq', 55))]
    expect(findPRWorkouts(ws).size).toBe(0)
  })

  it('dos sesiones el mismo día no se comparan entre sí', () => {
    const ws = [fuerza('2026-11-01', ex('sq', 50)), fuerza('2026-11-08', ex('sq', 60)), fuerza('2026-11-08', ex('sq', 70))]
    expect([...findPRWorkouts(ws)].sort()).toEqual([1, 2])
  })

  it('ignora ejercicios sin peso y sesiones que no son de fuerza', () => {
    const ws = [fuerza('2026-11-01', ex('pl', 0)), fuerza('2026-11-08', ex('pl', 0)), other('cardio', '2026-11-09')]
    expect(findPRWorkouts(ws).size).toBe(0)
  })

  it('da el mismo resultado que detectPRs sobre las sesiones anteriores', () => {
    // Historial inventado pero variado: 3 ejercicios, pesos que suben y bajan, fechas repetidas y desordenadas.
    const ids = ['sq', 'bp', 'dl']
    let seed = 7
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    const ws = []
    for (let i = 0; i < 80; i++) {
      const day = String(1 + Math.floor(rnd() * 28)).padStart(2, '0')
      const month = String(1 + Math.floor(rnd() * 6)).padStart(2, '0')
      const exs = ids.filter(() => rnd() > 0.4).map(id => ex(id, Math.round(rnd() * 12) * 5, Math.round(rnd() * 12) * 5))
      ws.push(fuerza(`2026-${month}-${day}`, ...exs))
    }
    const expected = new Set()
    ws.forEach((w, i) => {
      if (detectPRs(w, ws.filter(h => h.date < w.date)).length > 0) expected.add(i)
    })
    expect(findPRWorkouts(ws)).toEqual(expected)
    expect(expected.size).toBeGreaterThan(0)
  })

  it('computeSessionList marca hasPR en la sesión correcta', () => {
    const ws = [fuerza('2026-11-01', ex('sq', 50)), fuerza('2026-11-08', ex('sq', 55))]
    const list = computeSessionList(ws)
    expect(list.map(s => s.hasPR)).toEqual([true, false])
  })
})
