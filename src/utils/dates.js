import { startOfWeek, endOfWeek, format, differenceInDays, parseISO, isValid, eachWeekOfInterval, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'

// Returns the IANA timezone of the device (e.g. "America/Buenos_Aires", "Europe/Madrid")
export const getLocalTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

// Local midnight — avoids the UTC-midnight trap of new Date('YYYY-MM-DD')
export const VALENCIA_DATE = new Date(2026, 5, 28)

// Timezone-safe helpers — never use toISOString() for local dates
export const dateToLocal = (date) =>
  date.getFullYear() + '-' +
  String(date.getMonth() + 1).padStart(2, '0') + '-' +
  String(date.getDate()).padStart(2, '0')

export const getTodayLocal = () => dateToLocal(new Date())

// Parse a YYYY-MM-DD string as local midnight (never UTC) to avoid timezone bugs
export const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const getWeekStartLocal = () => {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return dateToLocal(monday)
}

export const toDateStr = (date) => format(date, 'yyyy-MM-dd')
export const todayStr = getTodayLocal

export const weekStart = (date = new Date()) =>
  startOfWeek(date, { weekStartsOn: 1 })

export const weekEnd = (date = new Date()) =>
  endOfWeek(date, { weekStartsOn: 1 })

export const weekKey = (date = new Date()) =>
  toDateStr(weekStart(date))

export const formatDate = (date, fmt = 'EEEE d MMM') =>
  format(date instanceof Date ? date : parseISO(date), fmt, { locale: es })

export const daysUntilValencia = () =>
  Math.max(0, differenceInDays(VALENCIA_DATE, new Date()))

export const isAfterValencia = () => new Date() > VALENCIA_DATE

export const isToday = (dateStr) => dateStr === todayStr()

export const getWeekDays = (date = new Date()) => {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export const getMonthDays = (date = new Date()) =>
  eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) })

export const getLast12Weeks = () => {
  const end = weekStart(new Date())
  const start = new Date(end)
  start.setDate(start.getDate() - 11 * 7)
  return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
}
