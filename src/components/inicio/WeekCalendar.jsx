import { useState } from 'react'
import { parseISO } from 'date-fns'
import { toDateStr } from '../../utils/dates'

const DAY_LABELS    = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTH_SHORT   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTH_FULL_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ICE_BLUE = '#38bdf8'

function getMondayOffset(offset) {
  const now = new Date()
  const day  = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon  = new Date(now)
  mon.setDate(now.getDate() + diff + offset * 7)
  mon.setHours(0, 0, 0, 0)
  return mon
}

export default function WeekCalendar({ workouts }) {
  const [offset, setOffset] = useState(0)
  const today   = toDateStr(new Date())
  const monday  = getMondayOffset(offset)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  // Build byDate: regular workouts take priority over pausa
  const byDate = {}

  // First pass: all non-pausa workouts
  workouts.forEach(w => {
    if (w.type !== 'pausa' && w.date && !byDate[w.date]) byDate[w.date] = w
  })
  // Second pass: pausa workouts expand their date range, filling uncovered days only
  workouts.forEach(w => {
    if (w.type !== 'pausa') return
    const start = parseISO((w.pausaInicio || w.date) + 'T12:00:00')
    const end   = parseISO((w.pausaFin   || w.date) + 'T12:00:00')
    for (let d = new Date(start.getTime()); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = toDateStr(d)
      if (!byDate[ds]) byDate[ds] = w
    }
  })

  const sunday = days[6]
  const headerStr = monday.getDate() + ' ' + MONTH_SHORT[monday.getMonth()] +
    ' — ' + sunday.getDate() + ' ' + MONTH_SHORT[sunday.getMonth()]
  const monthName = MONTH_FULL_ES[monday.getMonth()]

  return (
    <div className="mx-4 px-2 py-2 border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: '16px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => setOffset(o => o - 1)}
          className="text-app-muted text-lg leading-none w-6 h-6 flex items-center justify-center"
        >‹</button>
        <span className="text-[10px]" style={{ color: '#94A3B8' }}>{monthName} · {headerStr}</span>
        <button
          onClick={() => { if (offset < 0) setOffset(o => o + 1) }}
          className={`text-lg leading-none w-6 h-6 flex items-center justify-center ${offset >= 0 ? 'opacity-20 cursor-default' : ''}`}
          style={{ color: '#94A3B8' }}
        >›</button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[9px]" style={{ color: 'rgba(148,163,184,0.5)' }}>{d}</div>
        ))}
      </div>

      {/* Days row */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dateStr  = toDateStr(day)
          const workout  = byDate[dateStr]
          const isToday  = dateStr === today
          const isFuture = dateStr > today
          const isRest   = workout?.type === 'descanso'
          const isPausa  = workout?.type === 'pausa'

          // Pausa color + icon
          const isFrozen = isPausa && (workout.pausaMotivo === 'enfermedad' || workout.pausaMotivo === 'lesion')
          const pausaDotBg     = isFrozen ? 'rgba(56,189,248,0.25)' : 'rgba(75,85,99,0.4)'
          const pausaDotBorder = isFrozen ? '#38bdf8' : '#4B5563'

          const bgColor = isRest ? '#3D5A80'
            : workout && !isFuture && !isPausa ? '#40916C'
            : 'transparent'

          return (
            <div key={i} className="flex flex-col items-center">
              <div className="aspect-square flex items-center justify-center w-full">
                <div
                  style={{
                    backgroundColor: bgColor,
                    border: isToday && !isPausa ? '2px solid #7C5CBF' : isPausa ? `2px solid ${pausaDotBorder}` : 'none',
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                >
                  {isRest ? (
                    <span className="text-[9px] leading-none">💤</span>
                  ) : isPausa ? (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8, height: 8,
                        borderRadius: '50%',
                        backgroundColor: pausaDotBg,
                        border: `1.5px solid ${pausaDotBorder}`,
                      }}
                    />
                  ) : workout && !isFuture ? (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`text-[10px] font-medium ${
                      isToday ? 'text-[#7C5CBF]' : isFuture ? 'text-app-text/20' : 'text-app-text/50'
                    }`}>{day.getDate()}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
