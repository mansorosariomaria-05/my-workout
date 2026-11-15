import { describe, it, expect } from 'vitest'
import { formatKg, formatDeltaKg, formatPct, formatPercent, formatScore, formatNumber, formatKm, diffKg } from './format'

describe('formatKg', () => {
  it('entero sin decimales, con espacio y unidad', () => { expect(formatKg(24)).toBe('24 kg') })
  it('máximo 1 decimal con coma', () => {
    expect(formatKg(11.25)).toBe('11,3 kg')
    expect(formatKg(22.5)).toBe('22,5 kg')
  })
  it('absorbe el error de punto flotante', () => {
    expect(formatKg(2.200000000000001)).toBe('2,2 kg')
    expect(formatKg(22.2 - 20)).toBe('2,2 kg')
  })
  it('valores vacíos', () => {
    expect(formatKg(null)).toBe('—')
    expect(formatKg(undefined)).toBe('—')
    expect(formatKg(NaN)).toBe('—')
  })
  it('acepta números como string', () => { expect(formatKg('12.5')).toBe('12,5 kg') })
})

describe('formatDeltaKg', () => {
  it('con signo', () => {
    expect(formatDeltaKg(2.200000000000001)).toBe('+2,2 kg')
    expect(formatDeltaKg(5)).toBe('+5 kg')
    expect(formatDeltaKg(-1)).toBe('−1 kg')
  })
  it('null si el delta redondeado es 0', () => {
    expect(formatDeltaKg(0)).toBeNull()
    expect(formatDeltaKg(0.04)).toBeNull()
    expect(formatDeltaKg(-0.04)).toBeNull()
    expect(formatDeltaKg(22.1 - 22.1)).toBeNull()
  })
  it('null si no es número', () => { expect(formatDeltaKg(null)).toBeNull() })
})

describe('formatPct / formatPercent', () => {
  it('formatPct: entero con signo', () => {
    expect(formatPct(66.6667)).toBe('+67 %')
    expect(formatPct(-20)).toBe('−20 %')
    expect(formatPct(0)).toBe('0 %')
  })
  it('formatPercent: entero sin signo', () => {
    expect(formatPercent(25)).toBe('25 %')
    expect(formatPercent(33.3)).toBe('33 %')
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
  it('formatKm: hasta 2 decimales con unidad', () => {
    expect(formatKm(5)).toBe('5 km')
    expect(formatKm(5.25)).toBe('5,25 km')
  })
})

describe('diffKg', () => {
  it('redondea la resta de pesos', () => { expect(diffKg(22.2, 20)).toBe(2.2) })
})
