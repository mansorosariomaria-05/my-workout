// Formato de números para mostrar en pantalla (es-AR: coma decimal, espacio NO separable entre número y unidad).
// Convención: todo número visible pasa por este archivo. Solo presentación: no altera lo guardado
// en Firestore ni la lógica de cálculo.
//
// Los formateadores redondean ellos mismos antes de mostrar, así que alcanzan para restas de pesos
// (22.2 - 20 = 2.1999999999999993 → "+2,2 kg"). `diffKg` es el helper para cuando hace falta el
// número ya limpio (comparaciones, textos armados a mano).

const LOCALE = 'es-AR'
const MINUS  = '−'      // U+2212, el signo menos tipográfico para deltas negativos
const NBSP   = ' ' // espacio no separable: "24 kg" nunca se parte en dos líneas
const DASH   = '—'

const nfMax1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 })
const nfMax2 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const nfFix1 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nfInt  = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

const isNum = (n) => n != null && n !== '' && Number.isFinite(Number(n))

// Redondea a `d` decimales "half away from zero" absorbiendo el error binario (0.35 → 0.4, 2.2000000000000006 → 2.2).
function roundTo(n, d) {
  const f = 10 ** d
  const abs = Math.abs(Number(n))
  return Math.sign(n) * Math.round(abs * f + 1e-9) / f
}

// Diferencia de pesos sin error de punto flotante (22.2 − 20 → 2.2 y no 2.1999999999999993).
export function diffKg(a, b) {
  return roundTo((Number(a) || 0) - (Number(b) || 0), 2)
}

// Número genérico (reps, segundos, km/h): hasta 1 decimal, sin decimales si es entero. 12 → "12", 8.5 → "8,5".
export function formatNumber(n) {
  if (!isNum(n)) return DASH
  return nfMax1.format(roundTo(n, 1) || 0)
}

// Peso: hasta 2 decimales (hay discos de 1,25 kg), sin ceros sobrantes, coma decimal, con unidad.
// 24 → "24 kg", 22.25 → "22,25 kg", 2.200000000000001 → "2,2 kg".
export function formatKg(n) {
  if (!isNum(n)) return DASH
  const r = roundTo(n, 2)
  return `${r < 0 ? MINUS : ''}${nfMax2.format(Math.abs(r))}${NBSP}kg`
}

// Variación de peso con signo: "+2,2 kg" / "−1 kg". null si el delta redondeado es 0 (o no es un número) → no se muestra.
export function formatDeltaKg(n) {
  if (!isNum(n)) return null
  const r = roundTo(n, 2)
  if (r === 0) return null
  return `${r > 0 ? '+' : MINUS}${nfMax2.format(Math.abs(r))}${NBSP}kg`
}

// Variación porcentual entera con signo: "+67 %" / "−20 %" / "0 %".
export function formatPct(n) {
  if (!isNum(n)) return DASH
  const r = roundTo(n, 0)
  if (r === 0) return `0${NBSP}%`
  return `${r > 0 ? '+' : MINUS}${nfInt.format(Math.abs(r))}${NBSP}%`
}

// Porcentaje entero sin signo (proporciones, inclinación, reducciones): "25 %".
export function formatPercent(n) {
  if (!isNum(n)) return DASH
  const r = roundTo(n, 0)
  return `${r < 0 ? MINUS : ''}${nfInt.format(Math.abs(r))}${NBSP}%`
}

// Puntaje con un decimal fijo (fatiga, días por semana, km/h calculados): 7.1 → "7,1", 7 → "7,0".
export function formatScore(n) {
  if (!isNum(n)) return DASH
  return nfFix1.format(roundTo(n, 1) || 0)
}

// Distancia: hasta 2 decimales, con unidad. 5 → "5 km", 5.25 → "5,25 km".
export function formatKm(n) {
  if (!isNum(n)) return DASH
  return `${nfMax2.format(roundTo(n, 2) || 0)}${NBSP}km`
}
