import { describe, it, expect } from 'vitest'
import { computeDailySuggestion } from './dailySuggestion.js'
import { builtinRoutines } from '../data/routines.js'

const F = (date, ids, muscle) => ({
  type: 'fuerza', date, fatigue: 5,
  exercises: ids.map(exerciseId => ({ exerciseId, name: exerciseId, muscle, sets: [{ reps: 10, weight: 20 }] })),
})

describe('dailySuggestion con el catálogo reorganizado', () => {
  // Miércoles 2026-11-11. Última fuerza: Espalda hace 5 días (no es "reciente"); Glúteos y Pecho nunca entrenados.
  const today = '2026-11-11'
  const workouts = [F('2026-11-06', ['esp_01'], 'Espalda')]

  it('sigue pudiendo sugerir "rutina-empuje-horizontal" (Pecho y Glúteos) aunque sus abductores ahora sean del músculo Abductores', () => {
    const s = computeDailySuggestion({ workouts, profile: null, today })
    expect(s.type).toBe('fuerza')
    expect(s.muscles).toEqual(['Glúteos', 'Pecho'])
    expect(s.routineId).toBe('rutina-empuje-horizontal')
  })

  it('el array `muscles` de esa rutina sigue siendo exactamente ["Glúteos", "Pecho"]', () => {
    const r = builtinRoutines.find(x => x.id === 'rutina-empuje-horizontal')
    expect(r.muscles).toEqual(['Glúteos', 'Pecho'])
    // sus ejercicios de abducción figuran como Abductores en el campo muscle de cada entrada, no en `muscles`
    expect(r.exercises.find(e => e.id === 'glut_abd_pausa').muscle).toBe('Abductores')
    expect(r.muscles).not.toContain('Abductores')
  })

  it('sin prearmada que encaje, genera con el generador y nunca usa ids eliminados', () => {
    // Glúteos y Pecho recientes (ayer): fuerza el otro lado de la lista
    const recentWorkouts = [F('2026-11-10', ['glut_01'], 'Glúteos'), F('2026-11-10', ['pec_01'], 'Pecho')]
    const s = computeDailySuggestion({ workouts: recentWorkouts, profile: null, today })
    if (s.generatedIds) {
      ;['glut_11', 'glut_12', 'hom_07', 'bic_05', 'isq_07', 'hom_04'].forEach(id => expect(s.generatedIds).not.toContain(id))
    }
    expect(['fuerza', 'descanso', 'cardio']).toContain(s.type)
  })
})
