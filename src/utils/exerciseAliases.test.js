import { describe, it, expect } from 'vitest'
import { exercises, EXERCISE_ALIASES, canonicalExerciseId } from '../data/exercises.js'
import { builtinRoutines } from '../data/routines.js'
import {
  normalizeExerciseEntry, normalizeWorkoutExercises, normalizeWorkouts, normalizeIdList,
  normalizeRoutine, normalizeRoutines, normalizeInProgress,
} from './exerciseAliases.js'
import { groupExercises, computeRecords } from './progressStats.js'
import { getExerciseUnit } from './exerciseUnit.js'

const byId = Object.fromEntries(exercises.map(e => [e.id, e]))
const set = (reps, weight) => ({ reps, weight })
const F = (date, exs, extra = {}) => ({ type: 'fuerza', date, fatigue: 5, exercises: exs, ...extra })

describe('EXERCISE_ALIASES y canonicalExerciseId', () => {
  it('mapa exacto de alias', () => {
    expect(EXERCISE_ALIASES).toEqual({ glut_11: 'glut_02', glut_12: 'glut_05', hom_07: 'hom_03', bic_05: 'bic_02', isq_07: 'isq_06', hom_04: 'esp_07' })
  })

  it('devuelve el id canónico y el mismo id si no hay alias', () => {
    Object.entries(EXERCISE_ALIASES).forEach(([oldId, newId]) => expect(canonicalExerciseId(oldId)).toBe(newId))
    expect(canonicalExerciseId('glut_01')).toBe('glut_01')
    expect(canonicalExerciseId('glut_02')).toBe('glut_02')
    expect(canonicalExerciseId('custom_123')).toBe('custom_123')
    expect(canonicalExerciseId('alt-0-1699999999')).toBe('alt-0-1699999999')
    expect(canonicalExerciseId(undefined)).toBe(undefined)
    expect(canonicalExerciseId(null)).toBe(null)
    expect(canonicalExerciseId('')).toBe('')
  })

  it('no confunde propiedades heredadas de Object con alias', () => {
    expect(canonicalExerciseId('constructor')).toBe('constructor')
    expect(canonicalExerciseId('toString')).toBe('toString')
  })

  it('los alias son de un solo paso: el destino nunca es a su vez un alias', () => {
    Object.values(EXERCISE_ALIASES).forEach(id => expect(canonicalExerciseId(id)).toBe(id))
  })
})

describe('normalizeWorkoutExercises / normalizeWorkouts', () => {
  it('traduce exerciseId y originalExerciseId, y pone el nombre canónico cuando cambió el id', () => {
    const w = F('2026-11-02', [
      { exerciseId: 'glut_11', name: 'Hip Thrust unilateral', muscle: 'Glúteos', sets: [set(10, 20)] },
      { exerciseId: 'bic_01', name: 'Curl en barra Z', originalExerciseId: 'bic_05', muscle: 'Bíceps', originalMuscle: 'Bíceps', sets: [set(12, 8)] },
      { exerciseId: 'glut_01', name: 'Hip Thrust', sets: [set(10, 60)] },
    ])
    const n = normalizeWorkoutExercises(w)
    expect(n.exercises[0]).toMatchObject({ exerciseId: 'glut_02', name: byId.glut_02.name, muscle: 'Glúteos' })
    expect(n.exercises[0].sets).toEqual([set(10, 20)])
    // originalExerciseId se traduce; el name del ejercicio actual (que no cambió) no se toca
    expect(n.exercises[1]).toMatchObject({ exerciseId: 'bic_01', name: 'Curl en barra Z', originalExerciseId: 'bic_02' })
    // lo que no cambia queda idéntico (misma referencia)
    expect(n.exercises[2]).toBe(w.exercises[2])
  })

  it('no modifica el workout recibido (los datos guardados quedan con el id viejo)', () => {
    const w = F('2026-11-02', [{ exerciseId: 'hom_04', name: 'Face Pull', sets: [set(15, 10)] }])
    const snapshot = JSON.stringify(w)
    const n = normalizeWorkoutExercises(w)
    expect(JSON.stringify(w)).toBe(snapshot)
    expect(w.exercises[0].exerciseId).toBe('hom_04')
    expect(n.exercises[0].exerciseId).toBe('esp_07')
    expect(n).not.toBe(w)
  })

  it('un workout sin ids con alias devuelve el mismo objeto, y una lista sin cambios la misma lista', () => {
    const w = F('2026-11-02', [{ exerciseId: 'glut_01', name: 'Hip Thrust', sets: [set(10, 60)] }])
    expect(normalizeWorkoutExercises(w)).toBe(w)
    const list = [w, { type: 'cardio', date: '2026-11-03' }]
    expect(normalizeWorkouts(list)).toBe(list)
    expect(normalizeWorkouts([])).toEqual([])
    expect(normalizeWorkouts(null)).toBe(null)
  })

  it('workouts de cardio/clase/borradores sin exercises, o con entradas raras, no rompen', () => {
    const list = [{ type: 'cardio', date: '2026-11-03' }, F('2026-11-04', [null, { name: 'sin id', sets: [] }, { exerciseId: 'alt-0-1', name: 'Otra', sets: [] }])]
    expect(() => normalizeWorkouts(list)).not.toThrow()
    expect(normalizeWorkouts(list)).toBe(list)
  })

  it('una sesión vieja con los dos ejercicios del par queda con DOS entradas (series sin fusionar)', () => {
    const w = F('2026-11-02', [
      { exerciseId: 'glut_02', name: 'Hip Thrust a una pierna', sets: [set(10, 30), set(10, 30)] },
      { exerciseId: 'glut_11', name: 'Hip Thrust unilateral', sets: [set(8, 20)] },
    ])
    const n = normalizeWorkoutExercises(w)
    expect(n.exercises).toHaveLength(2)
    expect(n.exercises.map(e => e.exerciseId)).toEqual(['glut_02', 'glut_02'])
    expect(n.exercises.map(e => e.name)).toEqual([byId.glut_02.name, byId.glut_02.name])
    expect(n.exercises[0].sets).toHaveLength(2)
    expect(n.exercises[1].sets).toHaveLength(1)
  })

  it('normalizeExerciseEntry acepta entradas inválidas', () => {
    expect(normalizeExerciseEntry(null)).toBe(null)
    expect(normalizeExerciseEntry(undefined)).toBe(undefined)
    expect(normalizeExerciseEntry('x')).toBe('x')
  })

  it('la unidad guardada y la del catálogo se conservan tras traducir', () => {
    const n = normalizeExerciseEntry({ exerciseId: 'glut_11', name: 'Hip Thrust unilateral', unit: 'reps', sets: [] })
    expect(n.unit).toBe('reps')
    expect(getExerciseUnit(n)).toBe('reps')
  })
})

describe('progreso: un ejercicio registrado con el id viejo y con el canónico suma un solo historial', () => {
  const raw = [
    F('2026-11-09', [{ exerciseId: 'glut_02', name: 'Hip Thrust a una pierna', sets: [set(10, 40), set(10, 40)] }]),
    F('2026-11-02', [{ exerciseId: 'glut_11', name: 'Hip Thrust unilateral', sets: [set(10, 30), set(10, 30)] }]),
    F('2026-10-26', [{ exerciseId: 'glut_02', name: 'Hip Thrust a una pierna', sets: [set(10, 25)] }]),
  ]

  const groupsOf = (ws) => [...groupExercises(ws).values()]

  it('con los datos normalizados: un solo grupo, tres sesiones y un solo ejercicio con récords', () => {
    const ws = normalizeWorkouts(raw)
    const groups = groupsOf(ws)
    expect(groups.filter(g => g.catalogId === 'glut_02')).toHaveLength(1)
    expect(groups.find(g => g.catalogId === 'glut_02').sessions).toHaveLength(3)
    expect(groups.some(g => g.key.startsWith('name:'))).toBe(false)

    // 25 kg (base) → 30 kg (id viejo) → 40 kg: dos récords del MISMO ejercicio
    const rec = computeRecords(ws)
    expect(rec.events.map(e => [e.exerciseId, e.previous, e.value])).toEqual([['glut_02', 25, 30], ['glut_02', 30, 40]])
    expect(rec.distinctExercises).toBe(1)
    expect(rec.byExercise).toHaveLength(1)
    expect(rec.byExercise[0].count).toBe(2)
  })

  it('aun sin normalizar, progressStats agrupa el id viejo con el canónico (defensa)', () => {
    const groups = groupsOf(raw)
    expect(groups.filter(g => g.catalogId === 'glut_02')).toHaveLength(1)
    expect(groups.find(g => g.catalogId === 'glut_02').sessions).toHaveLength(3)
    expect(groups.some(g => g.key.startsWith('name:'))).toBe(false)
    expect(computeRecords(raw).distinctExercises).toBe(1)
  })

  it('el peso máximo considera las series hechas con el id viejo', () => {
    const ws = normalizeWorkouts([
      F('2026-11-09', [{ exerciseId: 'glut_02', name: 'Hip Thrust a una pierna', sets: [set(10, 30)] }]),
      F('2026-11-02', [{ exerciseId: 'glut_11', name: 'Hip Thrust unilateral', sets: [set(10, 50)] }]),
    ])
    const g = groupsOf(ws).find(x => x.catalogId === 'glut_02')
    expect(g.sessions).toHaveLength(2)
    expect(Math.max(...g.sessions.map(x => x.maxWeight))).toBe(50)
  })
})

describe('normalizeIdList (favoritos y "never")', () => {
  it('traduce los alias y elimina duplicados conservando el orden', () => {
    expect(normalizeIdList(['glut_11', 'glut_01', 'glut_02', 'hom_04', 'esp_07', 'bic_05'])).toEqual(['glut_02', 'glut_01', 'esp_07', 'bic_02'])
    expect(normalizeIdList([])).toEqual([])
    expect(normalizeIdList(['custom_1', 'custom_1'])).toEqual(['custom_1'])
    expect(normalizeIdList(null)).toBe(null)
  })
})

describe('rutinas personalizadas y entrenamiento en curso', () => {
  it('normalizeRoutine traduce id/exerciseId y el nombre, y no duplica el ejercicio canónico', () => {
    const r = { id: 'r1', name: 'Mi rutina', exercises: [
      { id: 'glut_12', exerciseId: 'glut_12', name: 'Step-ups con mancuernas al cajón alto', level: 'B' },
      { id: 'glut_05', name: 'Step-ups altos' },
      { id: 'isq_07', name: 'Curl de Isquiotibiales en máquina' },
      { id: 'custom_9', name: 'Propio' },
    ] }
    const n = normalizeRoutine(r)
    expect(n.exercises.map(e => e.id)).toEqual(['glut_05', 'isq_06', 'custom_9'])
    expect(n.exercises[0].exerciseId).toBe('glut_05')
    expect(n.exercises[0].name).toBe(byId.glut_05.name)
    expect(n.exercises[1].name).toBe(byId.isq_06.name)
    expect(r.exercises).toHaveLength(4) // el original no se toca
    const clean = { id: 'r2', exercises: [{ id: 'glut_01' }] }
    expect(normalizeRoutine(clean)).toBe(clean)
    expect(normalizeRoutines([clean])).toEqual([clean])
  })

  it('normalizeInProgress traduce los ejercicios cargados y los ids pendientes del generador', () => {
    const d = { type: 'fuerza', updatedAt: 1, detail: {
      mode: 'libre',
      exercises: [{ exerciseId: 'hom_07', name: 'Vuelos posteriores con mancuerna', muscle: 'Hombros', sets: [set(12, 4)] }],
      pendingGeneratedIds: ['glut_11', 'glut_02', 'cua_01'],
    } }
    const n = normalizeInProgress(d)
    expect(n.detail.exercises[0]).toMatchObject({ exerciseId: 'hom_03', name: byId.hom_03.name, muscle: 'Hombros' })
    expect(n.detail.pendingGeneratedIds).toEqual(['glut_02', 'cua_01'])
    expect(d.detail.exercises[0].exerciseId).toBe('hom_07')
    const cardio = { type: 'cardio', detail: { activity: 'x' } }
    expect(normalizeInProgress(cardio)).toBe(cardio)
    expect(normalizeInProgress(null)).toBe(null)
  })
})

describe('rutinas pre-armadas (routines.js) coherentes con el catálogo', () => {
  it('todos sus ejercicios existen, ninguno es un id con alias, y su campo muscle coincide con el catálogo', () => {
    builtinRoutines.forEach(r => {
      r.exercises.forEach(re => {
        const cat = byId[re.id]
        expect(cat, `${r.id}/${re.id}`).toBeTruthy()
        expect(EXERCISE_ALIASES[re.id], `${r.id}/${re.id}`).toBeUndefined()
        expect(re.muscle, `${r.id}/${re.id}`).toBe(cat.muscle)
      })
      expect(new Set(r.exercises.map(e => e.id)).size).toBe(r.exercises.length)
    })
  })

  it('los arrays `muscles` de las rutinas no cambiaron (dailySuggestion los compara de forma exacta)', () => {
    const m = Object.fromEntries(builtinRoutines.map(r => [r.id, r.muscles]))
    expect(m['rutina-empuje-horizontal']).toEqual(['Glúteos', 'Pecho'])
    expect(m['rutina-cadena-posterior']).toEqual(['Isquios', 'Espalda'])
    expect(m['rutina-empuje-vertical']).toEqual(['Cuádriceps', 'Glúteos', 'Hombros'])
    expect(m['rutina-fuerza-accesoria']).toEqual(['Cuádriceps', 'Hombros', 'Tríceps', 'Bíceps', 'Gemelos'])
    expect(m['rutina-gluteos']).toEqual(['Glúteos'])
  })
})

describe('clasificaciones corregidas del catálogo', () => {
  it('Parte 2', () => {
    expect(byId.isq_03).toMatchObject({ muscle: 'Glúteos', group: 'Glúteo mayor', secondary: 'Cuádriceps', pattern: 'sentadilla' })
    expect(byId.isq_08.level).toBe('B')
    expect(byId.gem_01.level).toBe('C')
    ;['glut_08', 'glut_09', 'glut_patada_lateral', 'glut_abd_pausa'].forEach(id => expect(byId[id].muscle, id).toBe('Abductores'))
  })

  it('Parte 1: los ejercicios que quedan', () => {
    expect(byId.glut_02).toMatchObject({ name: 'Hip Thrust a una pierna', level: 'B', equip: 'Barra/Mancuerna', unilateral: true, alt: 'Puente de Glúteo unilateral', pattern: 'empuje_cadera' })
    expect(byId.glut_05).toMatchObject({ name: 'Step-ups al cajón alto', level: 'B', equip: 'Cajón / Cajón + Mancuernas', unilateral: true, pattern: 'zancada' })
    expect(byId.hom_03).toMatchObject({ name: 'Vuelo posterior', equip: 'Mancuernas' })
    expect(byId.bic_02.name).toBe('Curl mancuernas')
    expect(byId.isq_06).toMatchObject({ name: 'Curl femoral acostado', level: 'C', equip: 'Máquina', secondary: 'Gemelos', alt: 'Curl femoral fitball', pattern: 'curl_femoral' })
    expect(byId.esp_07).toMatchObject({ name: 'Face Pull', muscle: 'Espalda', equip: 'Polea/Banda elástica' })
    expect(exercises.filter(e => e.name === 'Face Pull')).toHaveLength(1)
  })

  it('Parte 3: los 6 ejercicios nuevos, y los tres en segundos usan unidad "secs"', () => {
    ;['adu_01', 'adu_02', 'adu_03', 'adu_04', 'cor_05', 'cor_06'].forEach(id => expect(byId[id], id).toBeTruthy())
    expect(byId.adu_01).toMatchObject({ pattern: 'aduccion', unilateral: true, unit: 'secs', level: 'C' })
    expect(byId.adu_04).toMatchObject({ pattern: 'sentadilla', muscle: 'Aductores', level: 'B' })
    expect(byId.cor_05).toMatchObject({ pattern: 'carga', unilateral: false, unit: 'secs', level: 'D', muscle: 'Core & Estabilidad' })
    expect(byId.cor_06).toMatchObject({ pattern: 'carga', unilateral: true, unit: 'secs' })
    ;['adu_01', 'cor_05', 'cor_06', 'cor_01', 'cor_04'].forEach(id => expect(getExerciseUnit(byId[id]), id).toBe('secs'))
    ;['adu_02', 'adu_03', 'adu_04'].forEach(id => expect(getExerciseUnit(byId[id]), id).toBe('reps'))
  })

  it('no quedan alt que nombren un ejercicio eliminado o renombrado', () => {
    const stale = ['hip thrust unilateral', 'vuelos posteriores con mancuerna', 'curl de bíceps con mancuerna', 'curl de isquiotibiales en máquina', 'curl femoral máquina', 'step-ups con mancuernas al cajón alto', 'step-ups altos']
    exercises.forEach(e => expect(stale.includes(String(e.alt).trim().toLowerCase()), `${e.id} → ${e.alt}`).toBe(false))
    builtinRoutines.forEach(r => r.exercises.forEach(e => expect(stale.includes(String(e.alt).trim().toLowerCase()), `${r.id}/${e.id} → ${e.alt}`).toBe(false)))
  })
})
