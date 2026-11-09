import { describe, it, expect } from 'vitest'
import { buildProgressOptions, resolveProgressValues, selectPreloadSets, cleanSetsForSave, REPS_CAP } from './progressSet.js'
import { getProgressionAdvice } from './progression.js'

const set = (reps, weight, extra = {}) => ({ reps, weight, ...extra })
const learned = [5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 40, 50, 60]

describe('serie de progreso: opciones [+ peso | + reps]', () => {
  it('+ peso: siguiente peso de la última serie, reps por Epley acotadas por repsMin y por las reps de esa serie', () => {
    const o = buildProgressOptions({ lastSet: set(10, 20), level: 'C', equip: 'Mancuernas', learnedWeights: learned })
    expect(o.weight).toEqual({ weight: 22, reps: 10 })        // 22 es el salto más chico disponible; Epley da 6, pero repsMin (10) lo sube y las reps de la serie (10) lo topan
    const alto = buildProgressOptions({ lastSet: set(14, 30), level: 'A', equip: 'Barra', learnedWeights: learned })
    expect(alto.weight.weight).toBeGreaterThan(30)
    expect(alto.weight.reps).toBeLessThanOrEqual(14)
    expect(alto.weight.reps).toBeGreaterThanOrEqual(6)         // repsMin del nivel A
  })

  it('+ reps: EXACTAMENTE el mismo peso, reps + 2', () => {
    const o = buildProgressOptions({ lastSet: set(10, 20), level: 'C', equip: 'Mancuernas', learnedWeights: learned })
    expect(o.reps).toEqual({ weight: 20, reps: 12 })
    expect(buildProgressOptions({ lastSet: set(10, '17.5'), level: 'C', equip: 'Mancuernas' }).reps).toEqual({ weight: '17.5', reps: 12 })
  })

  it('tope de repeticiones: no se ofrece + reps si pasaría de 25', () => {
    expect(REPS_CAP).toBe(25)
    expect(buildProgressOptions({ lastSet: set(23, 20), level: 'C', equip: 'Mancuernas' }).reps.reps).toBe(25)
    expect(buildProgressOptions({ lastSet: set(24, 20), level: 'C', equip: 'Mancuernas' }).reps).toBeNull()
  })

  it('pesos con decimales (17,5 y 22,5)', () => {
    const a = buildProgressOptions({ lastSet: set(12, 17.5), level: 'C', equip: 'Mancuernas' })
    expect(a.weight.weight).toBe(18)
    expect(a.reps).toEqual({ weight: 17.5, reps: 14 })
    const b = buildProgressOptions({ lastSet: set(10, 22.5), level: 'C', equip: 'Mancuernas' })
    expect(b.weight.weight).toBe(24)
    expect(b.reps).toEqual({ weight: 22.5, reps: 12 })
    const c = buildProgressOptions({ lastSet: set(8, 22.5), level: 'B', equip: 'Barra', learnedWeights: [20, 22.5, 25] })
    expect(c.weight.weight).toBe(24)                          // el pool incluye los estándar (24) además de los aprendidos
  })

  it('peso corporal (sin peso cargado): solo + reps, sin selector', () => {
    for (const w of [0, '', undefined]) {
      const o = buildProgressOptions({ lastSet: { reps: 12, weight: w }, level: 'C', equip: 'Sin equipamiento' })
      expect(o.weight).toBeNull()
      expect(o.reps).toEqual({ weight: w ?? '', reps: 14 })
      expect(o.defaultKey).toBe('reps')
    }
  })

  it('máquina y barra usan su salto típico cuando no hay un peso estándar disponible', () => {
    const maq = buildProgressOptions({ lastSet: set(12, 60), level: 'C', equip: 'Máquina', learnedWeights: [40, 50, 60] })
    expect(maq.weight.weight).toBe(70)                                                 // salto típico del usuario (10 kg)
    expect(buildProgressOptions({ lastSet: set(12, 60), level: 'C', equip: 'Máquina', learnedWeights: [] }).weight.weight).toBe(65) // sin historial de pesos: 5 kg en máquina
    const barra = buildProgressOptions({ lastSet: set(8, 100), level: 'A', equip: 'Barra', learnedWeights: [] })
    expect(barra.weight.weight).toBe(102.5)
  })

  it('opción por defecto: + peso si la sugerencia es de peso, si no + reps', () => {
    const base = { lastSet: set(10, 20), level: 'C', equip: 'Mancuernas', learnedWeights: learned }
    expect(buildProgressOptions({ ...base, advice: { suggest: true, suggestType: 'weight' } }).defaultKey).toBe('weight')
    expect(buildProgressOptions({ ...base, advice: { suggest: true, suggestType: 'reps' } }).defaultKey).toBe('reps')
    expect(buildProgressOptions(base).defaultKey).toBe('reps')                                  // "+ Serie" manual sin progresión
    expect(buildProgressOptions({ ...base, advice: { suggest: false, suggestType: 'weight' } }).defaultKey).toBe('reps')
    // si la opción por defecto no es válida, cae a la otra
    const sinReps = buildProgressOptions({ lastSet: set(24, 20), level: 'C', equip: 'Mancuernas', advice: { suggest: true, suggestType: 'reps' } })
    expect(sinReps.reps).toBeNull()
    expect(sinReps.defaultKey).toBe('weight')
  })

  it('si ninguna opción es válida no hay fila', () => {
    expect(buildProgressOptions({ lastSet: set(24, 0), level: 'C', equip: 'Sin equipamiento' })).toEqual({ weight: null, reps: null, defaultKey: null })
    expect(buildProgressOptions({ lastSet: set('', 20), level: 'C', equip: 'Mancuernas' }).defaultKey).toBeNull()
    expect(buildProgressOptions({ lastSet: undefined }).defaultKey).toBeNull()
  })

  it('modo regreso: + peso sube hacia el nivel previo al parate sin pasarlo; si no hay lugar, no se ofrece', () => {
    const adv = (preGapLevel) => ({ suggest: true, suggestType: 'weight', useReturnRule: true, preGapLevel })
    const base = { lastSet: set(12, 20), level: 'C', equip: 'Mancuernas', learnedWeights: learned }
    expect(buildProgressOptions({ ...base, advice: adv(30) }).weight.weight).toBe(22)
    expect(buildProgressOptions({ ...base, advice: adv(21) }).weight.weight).toBe(21)            // topado en el nivel previo
    expect(buildProgressOptions({ ...base, advice: adv(20) }).weight).toBeNull()                 // ya está en su nivel: nunca menos ni igual
    expect(buildProgressOptions({ ...base, advice: adv(15) }).weight).toBeNull()                 // nivel previo por debajo del actual: no se sugiere bajar
    expect(buildProgressOptions({ ...base, advice: adv(15) }).reps).toEqual({ weight: 20, reps: 14 })
  })

  it('ejercicios en segundos: + seg suma 5 con el mismo peso; + peso nunca da más segundos que la serie', () => {
    const adv = { suggest: true, suggestType: 'weight_secs', resetSecs: 30 }
    const o = buildProgressOptions({ lastSet: set(60, 10), level: 'C', equip: 'Pared', unit: 'secs', learnedWeights: learned, advice: adv })
    expect(o.reps).toEqual({ weight: 10, reps: 65 })
    expect(o.weight.weight).toBeGreaterThan(10)
    expect(o.weight.reps).toBe(30)
    expect(o.defaultKey).toBe('weight')
    expect(buildProgressOptions({ lastSet: set(20, 10), level: 'C', equip: 'Pared', unit: 'secs', advice: adv }).weight.reps).toBe(20)
    const sinPeso = buildProgressOptions({ lastSet: set(40, ''), level: 'D', equip: 'Sin equipamiento', unit: 'secs' })
    expect(sinPeso.weight).toBeNull()
    expect(sinPeso.reps).toEqual({ weight: '', reps: 45 })
  })

  it('NUNCA sugiere un peso menor al de la última serie: barrido de equipos, pesos, reps, niveles y modo regreso', () => {
    const equips = ['Barra', 'Mancuernas', 'Máquina', 'Sin equipamiento', 'Kettlebell', 'Polea', '']
    const weights = [0, 1, 2.5, 5, 7.5, 10, 12.5, 17.5, 20, 22.5, 25, 27.5, 30, 40, 60, 100, '17.5', '22.5']
    const returns = [null, { suggest: true, suggestType: 'weight', useReturnRule: true, preGapLevel: 18 }, { suggest: true, suggestType: 'weight', useReturnRule: true, preGapLevel: 40 }]
    let checked = 0
    for (const equip of equips) for (const w of weights) for (let reps = 1; reps <= 30; reps++) for (const level of ['A', 'B', 'C', 'D']) for (const advice of returns) for (const unit of ['reps', 'secs']) {
      const last = { reps, weight: w }
      const o = buildProgressOptions({ lastSet: last, level, equip, learnedWeights: [5, 10, 15, 20, 25, 30], unit, advice })
      const lastW = Number(w) || 0
      if (o.weight) {
        expect(o.weight.weight).toBeGreaterThan(lastW)                         // estrictamente mayor
        expect(o.weight.reps).toBeLessThanOrEqual(reps)                        // reps iguales o menores
        expect(o.weight.reps).toBeGreaterThanOrEqual(1)
        expect(lastW).toBeGreaterThan(0)                                       // sin peso cargado no hay + peso
      }
      if (o.reps) {
        expect(o.reps.weight).toBe(last.weight)                                // peso IDÉNTICO
        expect(o.reps.reps).toBeGreaterThan(reps)
        if (unit === 'reps') expect(o.reps.reps).toBeLessThanOrEqual(REPS_CAP)
      }
      if (o.defaultKey) expect(o[o.defaultKey]).not.toBeNull()
      checked++
    }
    expect(checked).toBeGreaterThan(10000)
  })

  it('resolveProgressValues devuelve la opción pedida o la de por defecto', () => {
    const o = buildProgressOptions({ lastSet: set(10, 20), level: 'C', equip: 'Mancuernas', learnedWeights: learned })
    expect(resolveProgressValues(o, 'weight')).toMatchObject({ key: 'weight', weight: 22 })
    expect(resolveProgressValues(o, 'reps')).toMatchObject({ key: 'reps', weight: 20, reps: 12 })
    expect(resolveProgressValues(o, 'otra').key).toBe('reps')
    expect(resolveProgressValues(o).key).toBe('reps')
    expect(resolveProgressValues({ weight: null, reps: null, defaultKey: null }, 'weight')).toBeNull()
  })
})

describe('integración con getProgressionAdvice (misma doble progresión, bono por salto y modo regreso)', () => {
  const session = (reps, weight, n = 3) => ({ date: '2026-11-01', sets: Array.from({ length: n }, () => ({ reps, weight })) })

  it('con la regla cumplida, la opción por defecto sigue el tipo de sugerencia', () => {
    const advice = getProgressionAdvice('glut_01', 'Hip Thrust', 'C', [session(15, 20), session(15, 20)], learned, 'Mancuernas')
    expect(advice.suggest).toBe(true)
    expect(advice.suggestType).toBe('weight')
    const o = buildProgressOptions({ lastSet: { reps: 15, weight: 20 }, level: 'C', equip: 'Mancuernas', learnedWeights: learned, advice })
    expect(o.defaultKey).toBe('weight')
    expect(o.weight.weight).toBeGreaterThan(20)
  })

  it('peso corporal: la sugerencia es de reps y solo hay + reps', () => {
    const advice = getProgressionAdvice('abs_02', 'Plancha con flexión', 'B', [session(10, 0), session(10, 0)], [], 'Sin equipamiento')
    expect(advice.suggest).toBe(true)
    expect(advice.suggestType).toBe('reps')
    const o = buildProgressOptions({ lastSet: { reps: 10, weight: 0 }, level: 'B', equip: 'Sin equipamiento', advice })
    expect(o.weight).toBeNull()
    expect(o.defaultKey).toBe('reps')
  })

  it('modo regreso: la sugerencia trae useReturnRule (y no para parates médicos)', () => {
    const hist = [session(15, 20)]
    const normal = getProgressionAdvice('glut_01', 'Hip Thrust', 'C', hist, learned, 'Mancuernas', { active: true, motivo: 'descanso', preGapLevel: 30 })
    expect(normal.suggest).toBe(true)
    expect(normal.useReturnRule).toBe(true)
    expect(normal.returnActive).toBe(true)
    const medico = getProgressionAdvice('glut_01', 'Hip Thrust', 'C', hist, learned, 'Mancuernas', { active: true, motivo: 'lesion', preGapLevel: 30 })
    expect(medico.useReturnRule).toBe(false)
    const o = buildProgressOptions({ lastSet: { reps: 15, weight: 20 }, level: 'C', equip: 'Mancuernas', learnedWeights: learned, advice: normal })
    expect(o.weight.weight).toBeGreaterThan(20)
    expect(o.weight.weight).toBeLessThanOrEqual(30)
  })
})

describe('precarga: cantidad base de series (sin las series extra)', () => {
  it('pirámide: 18×12 / 20×12 / 24×14 / 25×12 (extra) → 20×12 / 24×14 / 25×12', () => {
    const last = [set(12, 18), set(12, 20), set(14, 24), set(12, 25, { isExtra: true })]
    expect(selectPreloadSets(last)).toEqual([set(12, 20), set(14, 24), set(12, 25)])
  })

  it('fijas: 20×10 ×3 / 22.5×8 (extra) → 20×10 / 20×10 / 22.5×8', () => {
    const last = [set(10, 20), set(10, 20), set(10, 20), set(8, 22.5, { isExtra: true })]
    expect(selectPreloadSets(last)).toEqual([set(10, 20), set(10, 20), set(8, 22.5)])
  })

  it('desempate: a igual peso se descarta el de menos reps; a igual peso y reps, el más temprano', () => {
    expect(selectPreloadSets([set(12, 20), set(10, 20), set(8, 25, { isExtra: true })])).toEqual([set(12, 20), set(8, 25)])
    const iguales = selectPreloadSets([set(10, 20, { tag: 'a' }), set(10, 20, { tag: 'b' }), set(10, 20, { tag: 'c' }), set(8, 22.5, { isExtra: true })])
    expect(iguales.map(s => s.tag)).toEqual(['b', 'c', undefined])      // se fue la primera (la más temprana)
  })

  it('conserva el orden original, ninguna serie precargada lleva isExtra y varias extras descartan varias series', () => {
    const last = [set(12, 20), set(12, 22, { isExtra: true }), set(12, 24), set(10, 26, { isExtra: true }), set(8, 28)]
    const r = selectPreloadSets(last)
    expect(r).toHaveLength(3)
    expect(r).toEqual([set(12, 24), set(10, 26), set(8, 28)])
    expect(r.every(s => !('isExtra' in s))).toBe(true)
  })

  it('sesiones antiguas sin isExtra se precargan tal cual; pesos como texto y vacíos no rompen', () => {
    const vieja = [set(10, 20), set(10, 20), set(10, 20)]
    expect(selectPreloadSets(vieja)).toEqual(vieja)
    expect(selectPreloadSets([set(10, '20'), set(10, ''), set(8, '22.5', { isExtra: true })])).toEqual([set(10, '20'), set(8, '22.5')])
    expect(selectPreloadSets([])).toEqual([])
    expect(selectPreloadSets(undefined)).toEqual([])
  })

  it('si todas las series fueran extra, se precargan todas (sin el flag)', () => {
    expect(selectPreloadSets([set(10, 20, { isExtra: true }), set(10, 20, { isExtra: true })])).toEqual([set(10, 20), set(10, 20)])
  })
})

describe('guardado: cleanSetsForSave', () => {
  it('descarta la serie de progreso pendiente y los flags de interfaz; isExtra se conserva aunque se edite', () => {
    const sets = [
      set(12, 20, { _suggested: { reps: true } }),
      set(12, 20),
      { reps: 14, weight: 22, isExtra: true, _opt: 'weight' },            // aceptada
      { isExtra: true, _pending: true, _opt: 'reps' },                     // pendiente sin tocar
    ]
    expect(cleanSetsForSave(sets)).toEqual([set(12, 20), set(12, 20), { reps: 14, weight: 22, isExtra: true }])
  })

  it('una fila pendiente descartada no deja series extra: la precarga siguiente es tal cual', () => {
    const saved = cleanSetsForSave([set(10, 20), set(10, 20), set(10, 20), { isExtra: true, _pending: true }])
    expect(saved).toHaveLength(3)
    expect(selectPreloadSets(saved)).toEqual([set(10, 20), set(10, 20), set(10, 20)])
  })

  it('ciclo completo: la serie extra aceptada se guarda con isExtra y la próxima sesión conserva la cantidad base', () => {
    const session1 = cleanSetsForSave([set(12, 18), set(12, 20), set(14, 24), { reps: 12, weight: 25, isExtra: true, _opt: 'weight' }])
    expect(session1.filter(s => s.isExtra)).toHaveLength(1)
    const preload = selectPreloadSets(session1)
    expect(preload).toHaveLength(3)
    expect(preload).toEqual([set(12, 20), set(14, 24), set(12, 25)])
  })
})
