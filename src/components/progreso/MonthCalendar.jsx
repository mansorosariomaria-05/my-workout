import { useState } from 'react'
import { toDateStr, dateToLocal } from '../../utils/dates'

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_LABELS  = ['L','M','X','J','V','S','D']

const TYPE_COLOR = {
  fuerza:   '#40916C',
  cardio:   '#4A9EDB',
  clase:    '#7C5CBF',
  tabata:   '#D49A3A',
  descanso: '#3D5A80',
}

function getWeekKey(dateStr) {
  const [yr, mo, dy] = dateStr.split('-').map(Number)
  const d   = new Date(yr, mo - 1, dy)
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return dateToLocal(mon)
}

export default function MonthCalendar({ workouts, settings }) {
  const now = new Date()
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const today = toDateStr(now)

  // Build Monday-first grid
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

  const cells = []
  for (let i = startPad; i > 0; i--) {
    const d = new Date(firstDay)
    d.setDate(firstDay.getDate() - i)
    cells.push({ date: d, current: false })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), current: true })
  }
  const tail = cells.length % 7
  if (tail > 0) {
    for (let i = 1; i <= 7 - tail; i++) {
      cells.push({ date: new Date(year, month + 1, i), current: false })
    }
  }

  const byDate = {}
  workouts.forEach(w => { byDate[w.date] = w })

  // Deload weeks
  const deloadWeeks = new Set(
    workouts.filter(w => w.deload).map(w => getWeekKey(w.date))
  )

  // Average (trained days only, not rest days)
  const weekBuckets = {}
  cells.filter(c => c.current).forEach(c => {
    const key = getWeekKey(toDateStr(c.date))
    if (!weekBuckets[key]) weekBuckets[key] = { trained: 0, latestDate: null }
    const w = byDate[toDateStr(c.date)]
    if (w && w.type !== 'descanso') weekBuckets[key].trained++
    if (!weekBuckets[key].latestDate || c.date > weekBuckets[key].latestDate)
      weekBuckets[key].latestDate = c.date
  })
  const elapsedWeeks = Object.values(weekBuckets).filter(b => b.latestDate <= now)
  const avg = elapsedWeeks.length
    ? elapsedWeeks.reduce((s, b) => s + b.trained, 0) / elapsedWeeks.length
    : 0
  const avgCfg = avg >= 5
    ? { color: '#D49A3A', label: 'Ideal ⭐' }
    : avg >= 4
    ? { color: '#40916C', label: 'Óptimo ✓' }
    : avg >= 3
    ? { color: '#4A9EDB', label: 'Aceptable ✓' }
    : { color: '#9090A8', label: 'Seguí sumando' }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="text-app-muted text-xl leading-none w-7 h-7 flex items-center justify-center"
        >‹</button>
        <span className="text-app-text text-sm font-semibold">{MONTH_NAMES[month]} {year}</span>
        <button
          onClick={() => { if (!isCurrentMonth) setViewDate(new Date(year, month + 1, 1)) }}
          className={`text-xl leading-none w-7 h-7 flex items-center justify-center ${isCurrentMonth ? 'text-app-muted/20 cursor-default' : 'text-app-muted'}`}
        >›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[9px] text-app-muted/50">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((cell, i) => {
          if (!cell.current) {
            return (
              <div key={i} className="aspect-square flex items-center justify-center">
                <span className="text-[9px] text-app-muted/15">{cell.date.getDate()}</span>
              </div>
            )
          }

          const dateStr    = toDateStr(cell.date)
          const workout    = byDate[dateStr]
          const isToday    = dateStr === today
          const isFuture   = dateStr > today
          const isSunday   = cell.date.getDay() === 0
          const weekK      = getWeekKey(dateStr)
          const isDeload   = deloadWeeks.has(weekK)
          const isRest     = workout?.type === 'descanso'
          const bgColor    = workout && !isFuture
            ? (TYPE_COLOR[workout.type] ?? '#40916C')
            : 'transparent'

          return (
            <div key={i} className="aspect-square flex items-center justify-center">
              <div
                style={{
                  backgroundColor: bgColor,
                  border: isToday
                    ? '2px solid #7C5CBF'
                    : isDeload && !workout ? '1.5px solid #D49A3A'
                    : 'none',
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center"
              >
                {isRest ? (
                  <span className="text-[8px] leading-none">💤</span>
                ) : workout && !isFuture ? (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={`text-[10px] font-medium ${
                    isToday    ? 'text-[#7C5CBF]'
                    : isFuture  ? 'text-app-text/15'
                    : isSunday  ? 'text-app-muted'
                    : 'text-app-text/50'
                  }`}>{cell.date.getDate()}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-app-muted capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Average */}
      {elapsedWeeks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-center gap-1.5">
          <span className="text-app-muted text-[10px]">Promedio este mes:</span>
          <span className="text-[10px] font-medium" style={{ color: avgCfg.color }}>
            {avg.toFixed(1)} días/semana · {avgCfg.label}
          </span>
        </div>
      )}
    </div>
  )
}
