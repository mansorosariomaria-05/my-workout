// Aritmética de fechas 'YYYY-MM-DD' y semanas (lunes a domingo). Funciones puras, sin zona horaria:
// todo se hace sobre la fecha calendario (UTC solo como contenedor de aritmética), nunca con la hora local.

const MS_DAY = 86400000

const toUTC = (dateStr) => {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return Date.UTC(y, (m || 1) - 1, d || 1)
}

const fromUTC = (ms) => {
  const d = new Date(ms)
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0')
}

// Suma n días (puede ser negativo) a una fecha.
export const addDays = (dateStr, n) => fromUTC(toUTC(dateStr) + n * MS_DAY)

// Días de diferencia (b − a), enteros.
export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / MS_DAY)

// Lunes de la semana de una fecha.
export const mondayOf = (dateStr) => {
  const dow = new Date(toUTC(dateStr)).getUTCDay() // 0 = domingo
  return addDays(dateStr, -((dow + 6) % 7))
}

// Domingo de la semana que empieza en `monday`.
export const sundayOf = (monday) => addDays(monday, 6)

// Mes 'YYYY-MM' de una fecha.
export const monthOf = (dateStr) => String(dateStr).slice(0, 7)
