import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toDateStr } from '../../utils/dates'
import { REAL_WORKOUT_TYPES } from '../../utils/streak'
import Modal from '../ui/Modal'

const DAY_LABELS    = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTH_SHORT   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTH_FULL_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TYPE_META = {
  fuerza: { label: 'Fuerza', emoji: '💪', dot: 'bg-app-purple',      text: 'text-app-purple-light' },
  cardio: { label: 'Cardio', emoji: '🏃', dot: 'bg-app-green-light', text: 'text-app-green-light' },
  clase:  { label: 'Clase',  emoji: '🧘', dot: 'bg-app-blue-light',  text: 'text-app-blue-light' },
  tabata: { label: 'Tabata', emoji: '⏱️', dot: 'bg-app-amber',       text: 'text-app-amber' },
}

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

function formatSet(s) {
  const w = Number(s.weight) || 0
  const reps = s.reps ?? 0
  return w > 0 ? `${reps}×${w} kg` : `${reps} reps`
}

// Detalle de un entrenamiento (solo lectura) — mismo estilo compacto para los 4 tipos.
function WorkoutDetailBlock({ workout }) {
  const meta = TYPE_META[workout.type] ?? { label: workout.type, emoji: '📋', dot: 'bg-app-purple', text: 'text-app-purple-light' }

  return (
    <div className="bg-app-bg rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
        <span className={`text-xs font-semibold ${meta.text}`}>{meta.emoji} {meta.label}</span>
        {workout.deload && <span className="text-app-gold text-[10px] ml-1">🔄 Descarga</span>}
      </div>

      {workout.type === 'fuerza' && (
        <div className="space-y-1.5">
          {workout.exercises?.map((e, i) => (
            <p key={i} className="text-app-text text-xs leading-snug">
              <span className="font-medium">{e.name}</span>
              {e.sets?.length > 0 && (
                <span className="text-app-muted"> — {e.sets.map(formatSet).join(' · ')}</span>
              )}
            </p>
          ))}
          {workout.cinta && (
            <p className="text-app-muted text-xs">
              Cinta{workout.cinta.tipo ? ` · ${workout.cinta.tipo}` : ''}
              {[
                workout.cinta.min ? `${workout.cinta.min} min` : null,
                workout.cinta.kmh ? `${workout.cinta.kmh} km/h` : null,
                workout.cinta.inclinacion ? `${workout.cinta.inclinacion}% inclinación` : null,
              ].filter(Boolean).map(s => ` · ${s}`).join('')}
            </p>
          )}
        </div>
      )}

      {workout.type === 'cardio' && (
        <p className="text-app-text text-xs">
          {workout.activity}
          {workout.activity && ' — '}
          {[
            workout.tiempo ? `${workout.tiempo} min` : null,
            workout.distancia ? `${workout.distancia} km` : null,
            workout.ritmo || null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}

      {workout.type === 'clase' && (
        <p className="text-app-text text-xs">
          {workout.clase}
          {workout.clase && workout.duracion && ' — '}
          {workout.duracion ? `${workout.duracion} min` : ''}
        </p>
      )}

      {workout.type === 'tabata' && (
        <p className="text-app-text text-xs">{workout.tabataName ?? 'Sesión de Tabata'}</p>
      )}

      {workout.fatigue != null && (
        <p className="text-app-muted text-[10px]">
          Cansancio: <span className="text-app-text font-medium">{workout.fatigue}/10</span>
        </p>
      )}
      {workout.notes && (
        <p className="text-app-muted text-[10px] leading-snug pt-1 border-t border-white/5">{workout.notes}</p>
      )}
    </div>
  )
}

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
  const [selectedDate, setSelectedDate] = useState(null)
  const today   = toDateStr(new Date())
  const monday  = getMondayOffset(offset)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  // Todos los entrenamientos reales de cada fecha (fuerza/cardio/clase/tabata) — pausas/descansos
  // se ignoran. A diferencia de antes, guarda una lista por fecha (puede haber más de uno por día).
  const byDate = {}
  workouts.forEach(w => {
    if (REAL_WORKOUT_TYPES.includes(w.type) && w.date) {
      (byDate[w.date] ??= []).push(w)
    }
  })
  // Si hay más de uno el mismo día, orden estable por hora de creación (los sin createdAt —
  // borradores offline viejos— quedan primero, sin garantía de orden entre sí).
  Object.values(byDate).forEach(list => list.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)))

  const sunday = days[6]
  const headerStr = monday.getDate() + ' ' + MONTH_SHORT[monday.getMonth()] +
    ' — ' + sunday.getDate() + ' ' + MONTH_SHORT[sunday.getMonth()]
  const monthName = MONTH_FULL_ES[monday.getMonth()]

  const selectedWorkouts = selectedDate ? (byDate[selectedDate] ?? []) : []
  const modalTitle = selectedDate
    ? capitalize(format(parseISO(selectedDate + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es }))
    : ''

  return (
    <>
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
            const dayWorkouts = byDate[dateStr] ?? []
            const isToday  = dateStr === today
            const isFuture = dateStr > today
            const tappable = dayWorkouts.length > 0 && !isFuture

            const bgColor = tappable ? '#40916C' : 'transparent'

            return (
              <div key={i} className="flex flex-col items-center">
                <div className="aspect-square flex items-center justify-center w-full">
                  <button
                    type="button"
                    onClick={() => { if (tappable) setSelectedDate(dateStr) }}
                    disabled={!tappable}
                    style={{
                      backgroundColor: bgColor,
                      border: isToday ? '2px solid #7C5CBF' : 'none',
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                      tappable ? 'cursor-pointer active:scale-90' : 'cursor-default'
                    }`}
                  >
                    {tappable ? (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className={`text-[10px] font-medium ${
                        isToday ? 'text-[#7C5CBF]' : isFuture ? 'text-app-text/20' : 'text-app-text/50'
                      }`}>{day.getDate()}</span>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Modal isOpen={!!selectedDate} onClose={() => setSelectedDate(null)} title={modalTitle}>
        <div className="space-y-3">
          {selectedWorkouts.map((w, i) => <WorkoutDetailBlock key={w.id ?? i} workout={w} />)}
        </div>
      </Modal>
    </>
  )
}
