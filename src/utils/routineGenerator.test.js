import { describe, it, expect, vi, afterEach } from 'vitest'
import { exercises } from '../data/exercises.js'
import {
  generateRoutine, generateRoutineDetailed, routineNotices, equipFilter, isBasicEquip,
  hardRulesOk, MUSCLE_BLOCKS, PATTERN_REGION, PATTERN_ZONE,
  generatorCountOptions, clampGeneratorCount, blockedMuscles, toggleGeneratorBlock,
  generatorRoutineName, generatedRoutineMuscles,
} from './routineGenerator.js'
import { todayStr } from './dates.js'

const BLOCK_IDS = MUSCLE_BLOCKS.map(b => b.id)
const block = (id) => MUSCLE_BLOCKS.find(b => b.id === id)
const passesBasic = (e) => isBasicEquip(e.equip)
const isCore = (e) => PATTERN_REGION[e.pattern] === 'core'

// Todos los subconjuntos no vacíos de los 4 grupos (en orden de selección).
const blockSubsets = () => {
  const out = []
  for (let mask = 1; mask < 1 << BLOCK_IDS.length; mask++) out.push(BLOCK_IDS.filter((_, i) => mask & (1 << i)))
  return out
}

// ¿Existe algún orden de `items` donde todos los pares consecutivos cumplan las reglas duras?
function validOrderExists(items) {
  const used = new Array(items.length).fill(false)
  const go = (n, prev) => {
    if (n === items.length) return true
    for (let i = 0; i < items.length; i++) {
      if (used[i] || (prev && !hardRulesOk(items[i], prev))) continue
      used[i] = true
      if (go(n + 1, items[i])) { used[i] = false; return true }
      used[i] = false
    }
    return false
  }
  return go(0, null)
}

const violations = (list) => list.slice(1).filter((e, i) => !hardRulesOk(e, list[i])).length

// ¿Se puede asignar cada ejercicio a un hueco distinto de `slots` (patrón y músculo permitidos)?
function matchesSlots(list, slots) {
  const usedSlot = new Array(slots.length).fill(false)
  const fits = (e, s) => s.patterns.includes(e.pattern) && (!s.muscles || s.muscles.includes(e.muscle))
  const go = (k) => {
    if (k === list.length) return true
    for (let i = 0; i < slots.length; i++) {
      if (usedSlot[i] || !fits(list[k], slots[i])) continue
      usedSlot[i] = true
      if (go(k + 1)) return true
      usedSlot[i] = false
    }
    return false
  }
  return go(0)
}

// Math.random determinístico (LCG) para comparar corridas.
function seedRandom(seed) {
  let s = seed >>> 0
  vi.spyOn(Math, 'random').mockImplementation(() => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  })
}

afterEach(() => { vi.restoreAllMocks() })

// Sesión de fuerza de hoy con estos ejercicios (cuenta para historyScore: 56 días previos).
const workoutWith = (...ids) => ({ type: 'fuerza', date: todayStr(), exercises: ids.map(exerciseId => ({ exerciseId })) })

describe('MUSCLE_BLOCKS — definición', () => {
  it('son 4 grupos con 6 huecos cada uno, con patrones que existen en el catálogo', () => {
    expect(BLOCK_IDS).toEqual(['piernas', 'traccion', 'empuje', 'brazos'])
    MUSCLE_BLOCKS.forEach(b => {
      expect(b.slots).toHaveLength(6)
      b.slots.forEach(s => s.patterns.forEach(p => {
        expect(PATTERN_REGION[p], p).toBeTruthy()
        expect(PATTERN_ZONE[p], p).toBeTruthy()
        expect(exercises.some(e => e.pattern === p && (!s.muscles || s.muscles.includes(e.muscle))), `${b.id}/${p}`).toBe(true)
      }))
    })
  })

  it('plantillas tal como se definieron', () => {
    const pats = (id) => block(id).slots.map(s => s.patterns.join('|'))
    expect(pats('piernas')).toEqual(['sentadilla', 'bisagra', 'empuje_cadera', 'zancada', 'curl_femoral|extension_rodilla', 'abduccion|gemelos'])
    expect(pats('traccion')).toEqual(['traccion_vertical', 'traccion_horizontal', 'biceps', 'traccion_horizontal', 'deltoides_posterior', 'biceps'])
    expect(pats('empuje')).toEqual(['empuje_horizontal', 'empuje_vertical', 'triceps', 'aperturas', 'elevacion_lateral', 'triceps'])
    expect(pats('brazos')).toEqual(['empuje_vertical', 'biceps', 'triceps', 'elevacion_lateral', 'biceps', 'triceps'])
    expect(block('piernas').slots[0].muscles).toEqual(['Cuádriceps'])
    expect(block('piernas').slots[1].muscles).toEqual(['Isquios', 'Glúteos'])
    expect(block('piernas').slots[2].muscles).toEqual(['Glúteos'])
  })

  it('músculos que cada grupo deshabilita en la UI', () => {
    expect(block('piernas').muscles).toEqual(['Glúteos', 'Isquios', 'Cuádriceps', 'Abductores', 'Gemelos'])
    expect(block('traccion').muscles).toEqual(['Espalda', 'Bíceps'])
    expect(block('empuje').muscles).toEqual(['Pecho', 'Hombros', 'Tríceps'])
    expect(block('brazos').muscles).toEqual(['Bíceps', 'Tríceps', 'Hombros'])
  })
})

describe('generateRoutine con grupos — selección', () => {
  it('cada grupo solo, count 3 a 6: toma sus primeros k huecos', () => {
    for (const id of BLOCK_IDS) {
      for (let k = 3; k <= 6; k++) {
        for (let rep = 0; rep < 15; rep++) {
          const r = generateRoutine({ muscles: [], blocks: [id], count: k, equip: 'Gym completo', workouts: [], regenerate: rep % 2 === 1 })
          expect(r, `${id} ${k}`).toHaveLength(k)
          expect(new Set(r.map(e => e.id)).size).toBe(k)
          expect(matchesSlots(r, block(id).slots.slice(0, k)), `${id} ${k}`).toBe(true)
        }
      }
    }
  })

  it('cada grupo solo, count 7 y 8: vuelve a recorrer la plantilla sin repetir ejercicios', () => {
    for (const id of BLOCK_IDS) {
      for (const k of [7, 8]) {
        for (let rep = 0; rep < 15; rep++) {
          const r = generateRoutine({ muscles: [], blocks: [id], count: k, equip: 'Gym completo', workouts: [], regenerate: rep % 2 === 1 })
          expect(r, `${id} ${k}`).toHaveLength(k)
          expect(new Set(r.map(e => e.id)).size).toBe(k)
          expect(matchesSlots(r, [...block(id).slots, ...block(id).slots].slice(0, k)), `${id} ${k}`).toBe(true)
        }
      }
    }
  })

  it('Piernas + Brazos, count 6: 3 + 3 (sentadilla, bisagra, empuje_cadera + empuje_vertical, biceps, triceps)', () => {
    for (let rep = 0; rep < 30; rep++) {
      const r = generateRoutine({ muscles: [], blocks: ['piernas', 'brazos'], count: 6, equip: 'Gym completo', workouts: [], regenerate: rep % 2 === 1 })
      expect(r.map(e => e.pattern).sort()).toEqual(
        ['bisagra', 'biceps', 'empuje_cadera', 'empuje_vertical', 'sentadilla', 'triceps'].sort()
      )
    }
  })

  it('Piernas + Pecho (músculo suelto), count 6: 3 de piernas + 3 de pecho', () => {
    for (let rep = 0; rep < 30; rep++) {
      const r = generateRoutine({ muscles: ['Pecho'], blocks: ['piernas'], count: 6, equip: 'Gym completo', workouts: [], regenerate: rep % 2 === 1 })
      expect(r).toHaveLength(6)
      expect(r.filter(e => e.muscle === 'Pecho')).toHaveLength(3)
      const legs = r.filter(e => e.muscle !== 'Pecho')
      expect(matchesSlots(legs, block('piernas').slots.slice(0, 3))).toBe(true)
    }
  })

  it('reparto entre bloques: floor + resto a los primeros (grupos primero, después músculos sueltos)', () => {
    // Piernas + Empuje + Bíceps suelto, count 8 → 3 + 3 + 2... (8/3 = 2, resto 2 → 3,3,2)
    const r = generateRoutine({ muscles: ['Abdominales'], blocks: ['piernas', 'empuje'], count: 8, equip: 'Gym completo', workouts: [] })
    expect(r).toHaveLength(8)
    expect(r.filter(e => e.muscle === 'Abdominales')).toHaveLength(2)
    const legsMuscles = ['Glúteos', 'Isquios', 'Cuádriceps', 'Abductores', 'Gemelos']
    expect(r.filter(e => legsMuscles.includes(e.muscle))).toHaveLength(3)
    expect(r.filter(e => ['Pecho', 'Hombros', 'Tríceps'].includes(e.muscle))).toHaveLength(3)
  })

  it('nunca repite un ejercicio, aun combinando grupos que comparten patrones', () => {
    for (const blocks of blockSubsets()) {
      for (let k = 3; k <= 8; k++) {
        const r = generateRoutine({ muscles: [], blocks, count: k, equip: 'Gym completo', workouts: [], regenerate: true })
        expect(new Set(r.map(e => e.id)).size).toBe(r.length)
      }
    }
  })

  it('un hueco sin candidatos se salta y se toma el siguiente', () => {
    const noSquat = exercises.filter(e => e.pattern === 'sentadilla' && e.muscle === 'Cuádriceps').map(e => e.id)
    for (let rep = 0; rep < 20; rep++) {
      const r = generateRoutine({ muscles: [], blocks: ['piernas'], count: 3, equip: 'Gym completo', workouts: [], neverIds: noSquat })
      expect(r).toHaveLength(3)
      // sin sentadilla de cuádriceps: bisagra, empuje_cadera y zancada (hueco 4)
      expect(matchesSlots(r, [block('piernas').slots[1], block('piernas').slots[2], block('piernas').slots[3]])).toBe(true)
    }
  })

  it('neverIds excluye también ejercicios elegidos por un grupo', () => {
    const never = exercises.filter(e => e.pattern === 'biceps').map(e => e.id)
    const r = generateRoutine({ muscles: [], blocks: ['brazos'], count: 6, equip: 'Gym completo', workouts: [], neverIds: never })
    expect(r.some(e => never.includes(e.id))).toBe(false)
  })

  it('"Solo básico": solo ejercicios que pasan el filtro y huecos saltados si hace falta', () => {
    for (const blocks of blockSubsets()) {
      for (let k = 3; k <= 8; k++) {
        const r = generateRoutine({ muscles: [], blocks, count: k, equip: 'Solo básico', workouts: [], regenerate: k % 2 === 0 })
        expect(r.length).toBeLessThanOrEqual(k)
        expect(r.every(passesBasic)).toBe(true)
        expect(new Set(r.map(e => e.id)).size).toBe(r.length)
      }
    }
  })

  it('ids de grupos inexistentes o repetidos se ignoran', () => {
    const r = generateRoutine({ muscles: [], blocks: ['piernas', 'piernas', 'inexistente'], count: 4, equip: 'Gym completo', workouts: [] })
    expect(r).toHaveLength(4)
    expect(generateRoutine({ muscles: [], blocks: ['inexistente'], count: 4, equip: 'Gym completo', workouts: [] })).toEqual([])
  })
})

describe('generateRoutine con grupos — historial y Regenerar', () => {
  // Favoritos: el último ejercicio nivel A de los huecos 1 y 2 de Piernas.
  const squatA = exercises.filter(e => e.pattern === 'sentadilla' && e.muscle === 'Cuádriceps' && e.level === 'A')
  const hingeA = exercises.filter(e => e.pattern === 'bisagra' && ['Isquios', 'Glúteos'].includes(e.muscle) && e.level === 'A')
  const favSquat = squatA[squatA.length - 1]
  const favHinge = hingeA[hingeA.length - 1]
  const history = [workoutWith(favSquat.id, favHinge.id), workoutWith(favSquat.id, favHinge.id)]

  it('sin regenerar, los huecos siguen el historial', () => {
    for (let rep = 0; rep < 20; rep++) {
      const ids = generateRoutine({ muscles: [], blocks: ['piernas'], count: 3, equip: 'Gym completo', workouts: history }).map(e => e.id)
      expect(ids).toContain(favSquat.id)
      expect(ids).toContain(favHinge.id)
    }
  })

  it('Regenerar mantiene los huecos 1 y 2 (principales) y sortea el resto', () => {
    const thirdSeen = new Set()
    for (let rep = 0; rep < 60; rep++) {
      const r = generateRoutine({ muscles: [], blocks: ['piernas'], count: 6, equip: 'Gym completo', workouts: history, regenerate: true })
      const ids = r.map(e => e.id)
      expect(ids).toContain(favSquat.id)
      expect(ids).toContain(favHinge.id)
      r.filter(e => e.pattern === 'zancada' || e.pattern === 'abduccion' || e.pattern === 'gemelos').forEach(e => thirdSeen.add(e.id))
    }
    expect(thirdSeen.size).toBeGreaterThan(2) // los accesorios varían entre regeneraciones
  })

  it('Regenerar produce rutinas distintas en los huecos no principales', () => {
    const sigs = new Set()
    for (let rep = 0; rep < 40; rep++) {
      sigs.add(generateRoutine({ muscles: [], blocks: ['traccion'], count: 6, equip: 'Gym completo', workouts: [], regenerate: true }).map(e => e.id).sort().join())
    }
    expect(sigs.size).toBeGreaterThan(1)
  })
})

describe('generateRoutine con grupos — orden final', () => {
  const muscleSets = [[], ['Pecho'], ['Glúteos'], ['Glúteos', 'Espalda'], ['Abdominales']]

  it('sin patrones consecutivos repetidos ni dos unilaterales de tren inferior seguidos cuando es posible; core al final', () => {
    let runs = 0
    for (const blocks of blockSubsets()) {
      for (const muscles of muscleSets) {
        for (let k = 3; k <= 8; k++) {
          for (const equip of ['Gym completo', 'Solo básico']) {
            for (let rep = 0; rep < 2; rep++) {
              const r = generateRoutine({ muscles, blocks, count: k, equip, workouts: [], regenerate: rep === 1 })
              runs++
              const nonCore = r.filter(e => !isCore(e))
              const core = r.filter(isCore)
              // core al final
              expect(r.slice(r.length - core.length).every(isCore)).toBe(true)
              // si existe un orden válido de cada segmento, el resultado no puede tener violaciones
              if (validOrderExists(nonCore) && validOrderExists(core)) {
                expect(violations(r), JSON.stringify({ blocks, muscles, k, equip, r: r.map(e => e.id) })).toBe(0)
              }
            }
          }
        }
      }
    }
    expect(runs).toBeGreaterThan(1000)
  })

  it('cada grupo solo con count 3 a 8 en "Gym completo" nunca queda con violaciones', () => {
    for (const id of BLOCK_IDS) {
      for (let k = 3; k <= 8; k++) {
        for (let rep = 0; rep < 40; rep++) {
          const r = generateRoutine({ muscles: [], blocks: [id], count: k, equip: 'Gym completo', workouts: [], regenerate: rep % 2 === 1 })
          expect(violations(r), `${id} ${k}`).toBe(0)
        }
      }
    }
  })

  it('Piernas con historial que favorece tres unilaterales: cambia un accesorio para que haya un orden válido', () => {
    // Peso muerto B-stance (unilateral A) + Hip Thrust a una pierna (unilateral A) + zancada (siempre unilateral):
    // 3 unilaterales de tren inferior en 4 ejercicios no se pueden ordenar sin dejar dos seguidos.
    const history = [workoutWith('isq_02', 'glut_02'), workoutWith('isq_02', 'glut_02')]
    for (let rep = 0; rep < 30; rep++) {
      const r = generateRoutine({ muscles: [], blocks: ['piernas'], count: 4, equip: 'Gym completo', workouts: history, regenerate: rep % 2 === 1 })
      expect(violations(r)).toBe(0)
      expect(r.map(e => e.id)).toContain('isq_02') // el principal del historial se respeta
      expect(r.map(e => e.id)).not.toContain('glut_02') // el accesorio es el que se cambia
    }
  })

  it('con la misma semilla, grupos + músculo suelto da siempre la misma rutina', () => {
    seedRandom(7)
    const a = generateRoutine({ muscles: ['Pecho'], blocks: ['brazos'], count: 6, equip: 'Gym completo', workouts: [] }).map(e => e.id)
    vi.restoreAllMocks(); seedRandom(7)
    const b = generateRoutine({ muscles: ['Pecho'], blocks: ['brazos'], count: 6, equip: 'Gym completo', workouts: [] }).map(e => e.id)
    expect(b).toEqual(a)
  })
})

describe('generateRoutine sin grupos — comportamiento de siempre', () => {
  const calls = [
    { muscles: ['Glúteos', 'Espalda'], count: 5 },
    { muscles: ['Pecho', 'Hombros', 'Tríceps'], count: 6 },
    { muscles: ['Cuádriceps'], count: 4, regenerate: true },
    { muscles: ['Abdominales', 'Gemelos'], count: 3, equip: 'Solo básico' },
  ]

  it('blocks ausente, null o [] da el mismo resultado con la misma semilla', () => {
    calls.forEach((c, i) => {
      const base = { equip: 'Gym completo', workouts: [], ...c }
      seedRandom(100 + i)
      const a = generateRoutine(base).map(e => e.id)
      vi.restoreAllMocks(); seedRandom(100 + i)
      const b = generateRoutine({ ...base, blocks: [] }).map(e => e.id)
      vi.restoreAllMocks(); seedRandom(100 + i)
      const c2 = generateRoutine({ ...base, blocks: null }).map(e => e.id)
      vi.restoreAllMocks()
      expect(b).toEqual(a)
      expect(c2).toEqual(a)
    })
  })

  it('reparte count entre músculos con floor + resto a los primeros', () => {
    const r = generateRoutine({ muscles: ['Glúteos', 'Pecho'], count: 5, equip: 'Gym completo', workouts: [] })
    expect(r.filter(e => e.muscle === 'Glúteos')).toHaveLength(3)
    expect(r.filter(e => e.muscle === 'Pecho')).toHaveLength(2)
  })

  it('sin músculos ni grupos devuelve []', () => {
    expect(generateRoutine({ muscles: [], count: 4, equip: 'Gym completo', workouts: [] })).toEqual([])
    expect(generateRoutine({ count: 4, equip: 'Gym completo', workouts: [] })).toEqual([])
  })
})

describe('helpers de la UI del generador', () => {
  it('cantidad: 3–6 sin grupos, 3–8 con al menos un grupo', () => {
    expect(generatorCountOptions([])).toEqual([3, 4, 5, 6])
    expect(generatorCountOptions(null)).toEqual([3, 4, 5, 6])
    expect(generatorCountOptions(['piernas'])).toEqual([3, 4, 5, 6, 7, 8])
    expect(clampGeneratorCount(8, [])).toBe(6)
    expect(clampGeneratorCount(8, ['empuje'])).toBe(8)
    expect(clampGeneratorCount(4, [])).toBe(4)
  })

  it('blockedMuscles une los músculos de los grupos elegidos', () => {
    expect([...blockedMuscles(['traccion'])].sort()).toEqual(['Bíceps', 'Espalda'])
    expect([...blockedMuscles(['empuje', 'brazos'])].sort()).toEqual(['Bíceps', 'Hombros', 'Pecho', 'Tríceps'])
    expect(blockedMuscles([]).size).toBe(0)
  })

  it('elegir un grupo quita los músculos que incluye y conserva el resto', () => {
    const next = toggleGeneratorBlock({ blocks: [], muscles: ['Pecho', 'Glúteos', 'Abdominales'], count: 4 }, 'empuje')
    expect(next).toEqual({ blocks: ['empuje'], muscles: ['Glúteos', 'Abdominales'], count: 4 })
  })

  it('quitar el último grupo ajusta la cantidad a 6 y no devuelve los músculos quitados', () => {
    const on = toggleGeneratorBlock({ blocks: [], muscles: ['Pecho'], count: 6 }, 'empuje')
    const big = { ...on, count: 8 }
    const off = toggleGeneratorBlock(big, 'empuje')
    expect(off).toEqual({ blocks: [], muscles: [], count: 6 })
    // con otro grupo todavía elegido, el 8 se mantiene
    const two = toggleGeneratorBlock({ blocks: ['piernas', 'empuje'], muscles: [], count: 8 }, 'empuje')
    expect(two.count).toBe(8)
  })

  it('nombre y músculos de la rutina generada', () => {
    expect(generatorRoutineName([], ['Glúteos', 'Espalda', 'Pecho'])).toBe('Generada: Glúteos + Espalda')
    expect(generatorRoutineName(['piernas', 'brazos'], ['Pecho'])).toBe('Generada: Piernas + Brazos')
    expect(generatorRoutineName(['empuje'], ['Abdominales'])).toBe('Generada: Empuje + Abdominales')
    const r = generateRoutine({ muscles: [], blocks: ['empuje'], count: 3, equip: 'Gym completo', workouts: [] })
    expect(generatedRoutineMuscles([], r).length).toBeGreaterThan(0)
    expect(generatedRoutineMuscles(['Glúteos'], [{ muscle: 'Glúteos' }, { muscle: 'Pecho' }])).toEqual(['Glúteos', 'Pecho'])
  })
})

describe('isBasicEquip / equipFilter — "Solo básico"', () => {
  it('acepta singular y plural, mayúsculas, acentos y variantes', () => {
    const basic = [
      'Sin equipamiento', 'sin equipo', 'SIN EQUIPAMIENTO', 'Sin', 'Sin equipamiento/Pesa', 'Sin equipamiento / Banda',
      'Mancuerna', 'Mancuernas', 'MANCUERNA', 'mancuernas', 'Mancuerna en rodillas', 'Barra/Mancuerna', 'Escalón/Mancuerna',
      'Barra EZ / Mancuernas', 'Cajón + Mancuernas', 'Banco inclinado + Mancuernas',
      'Banda', 'Bandas', 'Banda elástica', 'banda elastica', 'BANDA ELÁSTICA', 'Polea/Banda', 'Tobilleras/Polea/Banda',
      'Tobillera', 'Tobilleras', 'tobillera',
    ]
    basic.forEach(eq => expect(isBasicEquip(eq), eq).toBe(true))
  })

  it('no acepta equipamiento que no es básico (no se agregan categorías nuevas)', () => {
    const notBasic = [
      'Máquina', 'Maquina', 'Barra', 'Barra Z', 'Polea', 'Banco', 'Banco + Barra', 'Barra dominadas', 'Kettlebell', 'Cajón',
      'Fitball', 'Banco Romano', 'Barra + soporte landmine', 'Disco', 'Pared', 'Soga para saltar', 'Máquina de prensa',
      'Rueda abdominal', '', null, undefined,
    ]
    notBasic.forEach(eq => expect(isBasicEquip(eq), String(eq)).toBe(false))
  })

  it('compara por palabra: no confunde textos que solo contienen las letras', () => {
    expect(isBasicEquip('Casino')).toBe(false)
    expect(isBasicEquip('Bandejas')).toBe(false)
  })

  it('"Gym completo" deja pasar todo; "Solo básico" filtra por isBasicEquip', () => {
    exercises.forEach(e => {
      expect(equipFilter(e, 'Gym completo')).toBe(true)
      expect(equipFilter(e, 'Solo básico')).toBe(isBasicEquip(e.equip))
    })
  })

  it('catálogo con "Solo básico": los ejercicios con "Mancuerna" en singular ya pasan y cada músculo tiene candidatos', () => {
    const basic = exercises.filter(e => equipFilter(e, 'Solo básico'))
    expect(basic.length).toBe(61)
    ;['glut_01', 'glut_11', 'cua_03', 'gem_02', 'gem_03', 'esp_05', 'hom_06', 'tri_02', 'bic_04'].forEach(id =>
      expect(basic.some(e => e.id === id), id).toBe(true)
    )
    const muscles = [...new Set(exercises.map(e => e.muscle))]
    muscles.forEach(m => expect(basic.some(e => e.muscle === m), m).toBe(true))
  })

  it('"Solo básico" con Gemelos o Cuádriceps ya devuelve ejercicios', () => {
    expect(generateRoutine({ muscles: ['Gemelos'], count: 2, equip: 'Solo básico', workouts: [] })).toHaveLength(2)
    expect(generateRoutine({ muscles: ['Cuádriceps'], count: 3, equip: 'Solo básico', workouts: [] })).toHaveLength(3)
  })
})

describe('generateRoutineDetailed / routineNotices — aviso de rutina incompleta', () => {
  const detailed = (args) => generateRoutineDetailed({ workouts: [], equip: 'Gym completo', ...args })

  it('generateRoutine devuelve la misma lista que generateRoutineDetailed().exercises (misma semilla)', () => {
    seedRandom(11)
    const a = generateRoutine({ muscles: ['Glúteos', 'Pecho'], blocks: ['brazos'], count: 7, equip: 'Gym completo', workouts: [] }).map(e => e.id)
    vi.restoreAllMocks(); seedRandom(11)
    const b = generateRoutineDetailed({ muscles: ['Glúteos', 'Pecho'], blocks: ['brazos'], count: 7, equip: 'Gym completo', workouts: [] }).exercises.map(e => e.id)
    expect(b).toEqual(a)
  })

  it('el detalle informa por bloque lo pedido y lo logrado', () => {
    const r = detailed({ muscles: ['Pecho'], blocks: ['piernas'], count: 7 })
    expect(r.requested).toBe(7)
    expect(r.entries).toEqual([
      { kind: 'block', label: 'Piernas', target: 4, picked: 4 },
      { kind: 'muscle', label: 'Pecho', target: 3, picked: 3 },
    ])
  })

  it('rutina completa: sin avisos', () => {
    for (const equip of ['Gym completo', 'Solo básico']) {
      const r = detailed({ muscles: ['Glúteos', 'Espalda'], count: 4, equip })
      expect(routineNotices(r, equip)).toEqual([])
    }
    expect(routineNotices(detailed({ muscles: [], blocks: ['empuje'], count: 6 }), 'Gym completo')).toEqual([])
  })

  it('sin bloques elegidos no hay avisos', () => {
    expect(routineNotices(detailed({ muscles: [], count: 4 }), 'Gym completo')).toEqual([])
  })

  it('un músculo sin ningún ejercicio posible se nombra (con neverIds, un pool vacío)', () => {
    const all = exercises.filter(e => e.muscle === 'Gemelos').map(e => e.id)
    const r = detailed({ muscles: ['Gemelos', 'Pecho'], count: 6, neverIds: all, equip: 'Solo básico' })
    expect(r.entries[0]).toEqual({ kind: 'muscle', label: 'Gemelos', target: 3, picked: 0 })
    expect(routineNotices(r, 'Solo básico')).toEqual(['Con Solo básico no hay ejercicios para Gemelos.'])
    expect(routineNotices(r, 'Gym completo')).toEqual(['Con el equipamiento elegido no hay ejercicios para Gemelos.'])
  })

  it('varios bloques vacíos se listan juntos', () => {
    const never = exercises.filter(e => ['Gemelos', 'Pecho'].includes(e.muscle)).map(e => e.id)
    const r = detailed({ muscles: ['Gemelos', 'Pecho', 'Espalda'], count: 6, neverIds: never, equip: 'Solo básico' })
    expect(routineNotices(r, 'Solo básico')).toEqual(['Con Solo básico no hay ejercicios para Gemelos y Pecho.'])
  })

  it('rutina más corta que lo pedido por pool agotado: "Se generaron X de Y"', () => {
    const r = detailed({ muscles: ['Pecho'], blocks: ['piernas'], count: 8, equip: 'Solo básico' })
    expect(r.exercises.length).toBeLessThan(8)
    expect(routineNotices(r, 'Solo básico')).toEqual([`Se generaron ${r.exercises.length} de 8 ejercicios con el equipamiento elegido.`])
  })

  it('más bloques que ejercicios: avisa los que no entran', () => {
    const r = detailed({ muscles: ['Pecho', 'Espalda'], blocks: ['piernas', 'empuje'], count: 3 })
    expect(r.exercises).toHaveLength(3)
    expect(routineNotices(r, 'Gym completo')).toEqual(['Con 3 ejercicios no entra Espalda: subí la cantidad o sacá algún bloque.'])
    const r2 = detailed({ muscles: ['Pecho', 'Espalda', 'Bíceps'], blocks: ['piernas', 'empuje'], count: 3 })
    expect(routineNotices(r2, 'Gym completo')).toEqual(['Con 3 ejercicios no entra Espalda y Bíceps: subí la cantidad o sacá algún bloque.'])
  })

  it('no repite en el segundo aviso lo que ya explica el primero', () => {
    const never = exercises.filter(e => e.muscle === 'Gemelos').map(e => e.id)
    const r = detailed({ muscles: ['Gemelos'], count: 4, neverIds: never })
    expect(r.exercises).toEqual([])
    expect(routineNotices(r, 'Gym completo')).toHaveLength(1)
  })

  it('"Solo básico" con cada grupo de 3 a 8, y Piernas + Pecho de 8: sin ejercicios que no sean básicos', () => {
    const cases = [...BLOCK_IDS.map(id => ({ muscles: [], blocks: [id] })), { muscles: ['Pecho'], blocks: ['piernas'] }]
    for (const c of cases) {
      for (let k = 3; k <= 8; k++) {
        for (let rep = 0; rep < 10; rep++) {
          const r = generateRoutineDetailed({ ...c, count: k, equip: 'Solo básico', workouts: [], regenerate: rep % 2 === 1 })
          expect(r.exercises.every(e => isBasicEquip(e.equip))).toBe(true)
          expect(new Set(r.exercises.map(e => e.id)).size).toBe(r.exercises.length)
          // si faltan ejercicios, el aviso lo dice; si no faltan, no hay aviso
          const notices = routineNotices(r, 'Solo básico')
          expect(notices.length > 0).toBe(r.exercises.length < k)
        }
      }
    }
  })
})
