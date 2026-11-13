import { describe, it, expect } from 'vitest'
import { vi, afterEach } from 'vitest'
import {
  computeDailySuggestion, computeStrengthAlternative, canOfferStrengthAlternative, getCachedStrengthAlternative,
  STRENGTH_ALT_KEY, STRENGTH_MIN_EXERCISES,
} from './dailySuggestion.js'
import { EXERCISE_ALIASES } from '../data/exercises.js'

// Alternativa de fuerza del botón "Rutina de Fuerza" de la tarjeta de sugerencia diaria.
// Hoy = jueves 2026-11-12 (lunes de la semana = 11-09, ayer = 11-11, anteayer = 11-10).
const THU = '2026-11-12'
// Sesión de fuerza con varios grupos (vía muscleGroups; sin exercises)
const S = (date, ...groups) => ({ type: 'fuerza', date, fatigue: 5, muscleGroups: groups, exercises: [] })
const C = (date) => ({ type: 'cardio', date, activity: 'Correr', fatigue: 5 })
const FOCUS = ['Glúteos', 'Isquios', 'Cuádriceps', 'Espalda', 'Pecho', 'Hombros']
const REMOVED = Object.keys(EXERCISE_ALIASES)

describe('computeStrengthAlternative', () => {
  it('semana con glúteos y espalda: propone otros músculos', () => {
    const workouts = [S('2026-11-09', 'Glúteos', 'Espalda')]
    const alt = computeStrengthAlternative({ workouts, profile: null, today: THU })
    expect(alt.type).toBe('fuerza')
    expect(alt.muscles).toHaveLength(2)
    expect(alt.muscles).not.toContain('Glúteos')
    expect(alt.muscles).not.toContain('Espalda')
    expect(alt.muscles).toEqual(['Isquios', 'Pecho'])
    expect(alt.reason).toBe('Isquios: 0 veces esta semana · Pecho: 0 veces esta semana')
  })

  it('misma forma que la rama fuerza: prearmada { routineId, routineName, muscles, reason } o generada { generatedIds, title, muscles, reason }', () => {
    // Espalda hace 5 días (no es reciente): como en la sugerencia normal, Glúteos + Pecho encajan con una prearmada
    const pre = computeStrengthAlternative({ workouts: [S('2026-11-06', 'Espalda')], profile: null, today: '2026-11-11' })
    expect(Object.keys(pre).sort()).toEqual(['muscles', 'reason', 'routineId', 'routineName', 'type'])
    expect(pre).toMatchObject({ type: 'fuerza', routineId: 'rutina-empuje-horizontal', muscles: ['Glúteos', 'Pecho'] })
    const gen = computeStrengthAlternative({ workouts: [S('2026-11-09', 'Glúteos', 'Espalda')], profile: null, today: THU })
    expect(Object.keys(gen).sort()).toEqual(['generatedIds', 'muscles', 'reason', 'title', 'type'])
    expect(gen.title).toBe('Isquios + Pecho')
  })

  it('la rutina generada tiene 5 o más ejercicios (sin repetidos ni ids eliminados), en cualquier escenario', () => {
    const scenarios = [
      [],
      [S('2026-11-09', 'Glúteos', 'Espalda')],
      [S('2026-11-11', 'Glúteos', 'Isquios', 'Cuádriceps', 'Espalda', 'Pecho')],            // queda solo Hombros
      [S('2026-11-10', 'Glúteos', 'Isquios', 'Cuádriceps'), S('2026-11-11', 'Espalda')],    // quedan Pecho y Hombros
      [S('2026-11-10', 'Espalda', 'Pecho', 'Hombros')],                                      // quedan 3 músculos de piernas
      [S('2026-11-11', 'Glúteos', 'Isquios', 'Cuádriceps', 'Espalda', 'Hombros')],          // queda solo Pecho (5 ejercicios en el catálogo)
    ]
    for (const workouts of scenarios) {
      for (let rep = 0; rep < 40; rep++) {
        const alt = computeStrengthAlternative({ workouts, profile: null, today: THU })
        expect(alt.type).toBe('fuerza')
        if (alt.generatedIds) {
          expect(alt.generatedIds.length).toBeGreaterThanOrEqual(STRENGTH_MIN_EXERCISES)
          expect(new Set(alt.generatedIds).size).toBe(alt.generatedIds.length)
          alt.generatedIds.forEach(id => expect(REMOVED.includes(id)).toBe(false))
        }
      }
    }
  })

  it('un solo músculo elegible: rutina generada con ese músculo, de 5 o más ejercicios', () => {
    const workouts = [S('2026-11-11', 'Glúteos', 'Isquios', 'Cuádriceps', 'Espalda', 'Pecho')]
    for (let rep = 0; rep < 40; rep++) {
      const alt = computeStrengthAlternative({ workouts, profile: null, today: THU })
      expect(alt).toMatchObject({ type: 'fuerza', muscles: ['Hombros'], title: 'Hombros' })
      expect(alt.routineId).toBeUndefined()
      expect(alt.generatedIds.length).toBeGreaterThanOrEqual(5)
      expect(alt.reason).toBe('Hombros: 0 veces esta semana')
    }
  })

  it('con todo entrenado ayer y anteayer devuelve "none" con el mensaje', () => {
    const workouts = [S('2026-11-11', 'Glúteos', 'Espalda'), S('2026-11-10', 'Isquios', 'Cuádriceps', 'Pecho', 'Hombros')]
    FOCUS.forEach(m => expect(workouts.some(w => w.muscleGroups.includes(m))).toBe(true))
    const alt = computeStrengthAlternative({ workouts, profile: null, today: THU })
    expect(alt).toEqual({ type: 'none', reason: 'Entrenaste todos los grupos en los últimos 2 días. Hoy conviene recuperar.' })
  })

  it('no aplica los chequeos de días cumplidos, 3 días seguidos ni balance cardio (a diferencia de la sugerencia normal)', () => {
    // días cumplidos: objetivo 1 y ya entrenó el lunes → la sugerencia normal es descanso, la alternativa propone fuerza
    const done = [S('2026-11-09', 'Glúteos')]
    expect(computeDailySuggestion({ workouts: done, profile: { diasSemana: 1 }, today: THU }).type).toBe('descanso')
    expect(computeStrengthAlternative({ workouts: done, profile: { diasSemana: 1 }, today: THU }).type).toBe('fuerza')
    // 3 días seguidos (lun, mar, mié): descanso normal; la alternativa excluye solo martes y miércoles
    const streak = [C('2026-11-09'), S('2026-11-10', 'Glúteos', 'Espalda'), S('2026-11-11', 'Isquios')]
    expect(computeDailySuggestion({ workouts: streak, profile: null, today: THU }).type).toBe('descanso')
    const alt = computeStrengthAlternative({ workouts: streak, profile: null, today: THU })
    expect(alt.type).toBe('fuerza')
    ;['Glúteos', 'Espalda', 'Isquios'].forEach(m => expect(alt.muscles).not.toContain(m))
    // balance cardio: 2 fuerzas y ningún cardio → la sugerencia normal es cardio; la alternativa es fuerza
    const cardioDay = [S('2026-11-09', 'Glúteos'), S('2026-11-10', 'Espalda')]
    expect(computeDailySuggestion({ workouts: cardioDay, profile: null, today: THU }).type).toBe('cardio')
    expect(computeStrengthAlternative({ workouts: cardioDay, profile: null, today: THU }).type).toBe('fuerza')
  })

  it('es pura: no modifica los workouts y tolera entradas vacías', () => {
    const workouts = [S('2026-11-09', 'Glúteos', 'Espalda')]
    const snap = JSON.stringify(workouts)
    computeStrengthAlternative({ workouts, profile: { diasSemana: 6 }, today: THU })
    expect(JSON.stringify(workouts)).toBe(snap)
    expect(computeStrengthAlternative({ workouts: undefined, profile: undefined, today: THU }).type).toBe('fuerza')
  })

  it('sin historial propone la rama fuerza con los primeros músculos de cada lado', () => {
    const alt = computeStrengthAlternative({ workouts: [], profile: null, today: THU })
    expect(alt.type).toBe('fuerza')
    expect(alt.muscles).toEqual(['Glúteos', 'Espalda'])
  })
})

describe('botón "Rutina de Fuerza": cuándo se ofrece', () => {
  it('cardio y descanso lo muestran; fuerza, ya entrenó hoy, regreso y sin sugerencia no', () => {
    expect(canOfferStrengthAlternative({ type: 'cardio' })).toBe(true)
    expect(canOfferStrengthAlternative({ type: 'descanso', sub: 'x' })).toBe(true)
    expect(canOfferStrengthAlternative({ type: 'fuerza', routineId: 'r' })).toBe(false)
    expect(canOfferStrengthAlternative({ type: 'fuerza', generatedIds: ['a'] })).toBe(false)
    expect(canOfferStrengthAlternative({ type: 'trained_today' })).toBe(false)
    expect(canOfferStrengthAlternative({ type: 'regreso' })).toBe(false)
    expect(canOfferStrengthAlternative(null)).toBe(false)
    expect(canOfferStrengthAlternative(undefined)).toBe(false)
  })

  it('escenarios reales: la sugerencia normal de cardio y la de descanso ofrecen el botón; fuerza y "ya entrenó" no', () => {
    const cardioDay = [S('2026-11-09', 'Glúteos'), S('2026-11-10', 'Espalda')]
    const cardio = computeDailySuggestion({ workouts: cardioDay, profile: null, today: THU })
    expect(cardio.type).toBe('cardio')
    expect(canOfferStrengthAlternative(cardio)).toBe(true)

    const descanso = computeDailySuggestion({ workouts: cardioDay, profile: { diasSemana: 2 }, today: THU })
    expect(descanso.type).toBe('descanso')
    expect(canOfferStrengthAlternative(descanso)).toBe(true)

    const fuerza = computeDailySuggestion({ workouts: [S('2026-11-09', 'Glúteos', 'Espalda')], profile: null, today: THU })
    expect(fuerza.type).toBe('fuerza')
    expect(canOfferStrengthAlternative(fuerza)).toBe(false)
    const trained = computeDailySuggestion({ workouts: [S(THU, 'Glúteos')], profile: null, today: THU })
    expect(trained.type).toBe('trained_today')
    expect(canOfferStrengthAlternative(trained)).toBe(false)
  })
})

// ── Caché diario: daily_strength_alt_{uid} ──
const fakeStorage = (initial = {}) => {
  const data = { ...initial }
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v) }, removeItem: (k) => { delete data[k] } }
}
afterEach(() => { vi.restoreAllMocks() })

describe('getCachedStrengthAlternative (caché daily_strength_alt_{uid})', () => {
  // Con aleatoriedad en el generador, dos cálculos sin caché pueden diferir: el caché debe dejar la rutina estable.
  const workouts = [S('2026-11-09', 'Glúteos', 'Espalda')]
  const args = (storage, extra = {}) => ({ uid: 'u1', workouts, profile: null, today: THU, storage, ...extra })

  it('guarda { date, realCount, suggestion } con la clave propia y no toca daily_suggestion_{uid}', () => {
    const st = fakeStorage({ daily_suggestion_u1: '{"keep":"me"}' })
    const alt = getCachedStrengthAlternative(args(st))
    expect(STRENGTH_ALT_KEY('u1')).toBe('daily_strength_alt_u1')
    expect(JSON.parse(st.data.daily_strength_alt_u1)).toEqual({ date: THU, realCount: 1, suggestion: alt })
    expect(st.data.daily_suggestion_u1).toBe('{"keep":"me"}')
    expect(Object.keys(st.data).sort()).toEqual(['daily_strength_alt_u1', 'daily_suggestion_u1'])
  })

  it('la rutina propuesta es estable durante el día (la segunda vez sale del caché, sin recalcular)', () => {
    const st = fakeStorage()
    const first = getCachedStrengthAlternative(args(st))
    // si recalculara, con otra semilla saldría otra rutina: se fuerza Math.random distinto
    let n = 0
    vi.spyOn(Math, 'random').mockImplementation(() => ((n += 0.37) % 1))
    for (let i = 0; i < 20; i++) expect(getCachedStrengthAlternative(args(st))).toEqual(first)
  })

  it('se recalcula si cambió el día o la cantidad de workouts reales', () => {
    const st = fakeStorage()
    getCachedStrengthAlternative(args(st))
    const next = getCachedStrengthAlternative(args(st, { today: '2026-11-13' }))
    expect(JSON.parse(st.data.daily_strength_alt_u1).date).toBe('2026-11-13')
    expect(next.type).toBe('fuerza')
    const more = getCachedStrengthAlternative(args(st, { today: '2026-11-13', workouts: [...workouts, S('2026-11-12', 'Isquios', 'Pecho')] }))
    expect(JSON.parse(st.data.daily_strength_alt_u1).realCount).toBe(2)
    expect(more.muscles).not.toContain('Isquios')
  })

  it('cachea también el resultado "none"', () => {
    const none = [S('2026-11-11', 'Glúteos', 'Espalda'), S('2026-11-10', 'Isquios', 'Cuádriceps', 'Pecho', 'Hombros')]
    const st = fakeStorage()
    expect(getCachedStrengthAlternative(args(st, { workouts: none })).type).toBe('none')
    expect(JSON.parse(st.data.daily_strength_alt_u1).suggestion.type).toBe('none')
    expect(getCachedStrengthAlternative(args(st, { workouts: none })).type).toBe('none')
  })

  it('traduce los alias de ejercicios fusionados al leer una rutina generada cacheada', () => {
    const entry = { date: THU, realCount: 1, suggestion: { type: 'fuerza', generatedIds: ['glut_11', 'glut_02', 'cua_01'], title: 'x', muscles: ['Glúteos'], reason: 'r' } }
    const st = fakeStorage({ daily_strength_alt_u1: JSON.stringify(entry) })
    expect(getCachedStrengthAlternative(args(st)).generatedIds).toEqual(['glut_02', 'cua_01'])
  })

  it('tolera caché corrupto, almacenamiento que tira y sin almacenamiento (calcula igual)', () => {
    expect(getCachedStrengthAlternative(args(fakeStorage({ daily_strength_alt_u1: '{no es json' }))).type).toBe('fuerza')
    const boom = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('lleno') } }
    expect(getCachedStrengthAlternative(args(boom)).type).toBe('fuerza')
    expect(getCachedStrengthAlternative(args(null)).type).toBe('fuerza')
    expect(getCachedStrengthAlternative(args(fakeStorage(), { uid: undefined })).type).toBe('fuerza')
  })
})
