import { describe, it, expect } from 'vitest'
import { formatKg, formatDeltaKg, formatPct, formatPercent, formatScore, formatNumber, formatKm, diffKg } from './format'

const NB = ' '

describe('formatKg', () => {
  it('entero sin decimales, con espacio no separable y unidad', () => { expect(formatKg(24)).toBe(`24${NB}kg`) })
  it('hasta 2 decimales (discos de 1,25 kg), sin ceros sobrantes', () => {
    expect(formatKg(22.25)).toBe(`22,25${NB}kg`)
    expect(formatKg(11.75)).toBe(`11,75${NB}kg`)
    expect(formatKg(22.5)).toBe(`22,5${NB}kg`)
    expect(formatKg(22.5000001)).toBe(`22,5${NB}kg`)
  })
  it('absorbe el error de punto flotante', () => {
    expect(formatKg(2.200000000000001)).toBe(`2,2${NB}kg`)
    expect(formatKg(22.2 - 20)).toBe(`2,2${NB}kg`)
  })
  it('usa espacio no separable (nunca espacio común)', () => {
    expect(formatKg(24)).not.toContain(' ')
    expect(formatKg(24)).toContain(NB)
  })
  it('valores vacíos', () => {
    expect(formatKg(null)).toBe('—')
    expect(formatKg(undefined)).toBe('—')
    expect(formatKg(NaN)).toBe('—')
  })
  it('acepta números como string', () => { expect(formatKg('12.5')).toBe(`12,5${NB}kg`) })
})

describe('formatDeltaKg', () => {
  it('con signo', () => {
    expect(formatDeltaKg(2.200000000000001)).toBe(`+2,2${NB}kg`)
    expect(formatDeltaKg(1.25)).toBe(`+1,25${NB}kg`)
    expect(formatDeltaKg(5)).toBe(`+5${NB}kg`)
    expect(formatDeltaKg(-1)).toBe(`−1${NB}kg`)
  })
  it('null si el delta redondeado es 0', () => {
    expect(formatDeltaKg(0)).toBeNull()
    expect(formatDeltaKg(0.004)).toBeNull()
    expect(formatDeltaKg(-0.004)).toBeNull()
    expect(formatDeltaKg(22.1 - 22.1)).toBeNull()
  })
  it('un delta chico pero real se muestra', () => { expect(formatDeltaKg(0.25)).toBe(`+0,25${NB}kg`) })
  it('null si no es número', () => { expect(formatDeltaKg(null)).toBeNull() })
})

describe('formatPct / formatPercent', () => {
  it('formatPct: entero con signo', () => {
    expect(formatPct(66.6667)).toBe(`+67${NB}%`)
    expect(formatPct(-20)).toBe(`−20${NB}%`)
    expect(formatPct(0)).toBe(`0${NB}%`)
  })
  it('formatPercent: entero sin signo', () => {
    expect(formatPercent(25)).toBe(`25${NB}%`)
    expect(formatPercent(33.3)).toBe(`33${NB}%`)
  })
})

describe('formatScore / formatNumber / formatKm', () => {
  it('formatScore: 1 decimal fijo', () => {
    expect(formatScore(7.1)).toBe('7,1')
    expect(formatScore(7)).toBe('7,0')
    expect(formatScore(7.14999)).toBe('7,1')
    expect(formatScore(null)).toBe('—')
  })
  it('formatNumber: hasta 1 decimal', () => {
    expect(formatNumber(12)).toBe('12')
    expect(formatNumber(8.5)).toBe('8,5')
  })
  it('formatKm: hasta 1 decimal con unidad no separable', () => {
    expect(formatKm(5)).toBe(`5${NB}km`)
    expect(formatKm(58.1)).toBe(`58,1${NB}km`)
    expect(formatKm(5.25)).toBe(`5,3${NB}km`)                 // antes "5,25 km"
    expect(formatKm(58.14999)).toBe(`58,1${NB}km`)
    expect(formatKm(0.04)).toBe(`0${NB}km`)
    expect(formatKm(1234.5)).toBe(`1.234,5${NB}km`)
    expect(formatKm(null)).toBe('—')
  })
})

describe('diffKg', () => {
  it('redondea la resta de pesos', () => { expect(diffKg(22.2, 20)).toBe(2.2) })
  it('conserva los cuartos de kilo', () => { expect(diffKg(22.25, 20)).toBe(2.25) })
})
