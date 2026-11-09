import { startOfWeek, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

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

export const weekKey = (date = new Date()) =>
  toDateStr(weekStart(date))

export const isToday = (dateStr) => dateStr === todayStr()

export const getMonthDays = (date = new Date()) =>
  eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) })
