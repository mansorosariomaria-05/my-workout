import { useState } from 'react'
import { getMonthDays, toDateStr } from '../../utils/dates'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import Modal from '../ui/Modal'

const TYPE_DOT = {
  fuerza: 'bg-app-purple',
  cardio: 'bg-app-green-light',
  clase:  'bg-app-blue-light',
  tabata: 'bg-app-amber',
}

export default function WorkoutHistorial({ workouts }) {
  const [month, setMonth] = useState(new Date())
  const [selected, setSelected] = useState(null)
  const days = getMonthDays(month)
  const byDate = {}
  workouts.forEach(w => { if (!byDate[w.date]) byDate[w.date] = w })

  const prev = () => { const d = new Date(month); d.setMonth(d.getMonth() - 1); setMonth(d) }
  const next = () => { const d = new Date(month); d.setMonth(d.getMonth() + 1); setMonth(d) }

  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const firstDay = days[0].getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1

  const selectedWorkout = selected ? byDate[selected] : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="text-app-muted p-1">‹</button>
        <p className="text-app-text text-sm font-medium capitalize">
          {format(month, 'MMMM yyyy', { locale: es })}
        </p>
        <button onClick={next} className="text-app-muted p-1">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayLabels.map(d => (
          <p key={d} className="text-app-muted text-[10px] text-center">{d}</p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }, (_, i) => <div key={`pad-${i}`} />)}
        {days.map(day => {
          const dateStr = toDateStr(day)
          const workout = byDate[dateStr]
          const isToday = dateStr === toDateStr(new Date())
          return (
            <button
              key={dateStr}
              onClick={() => workout && setSelected(dateStr)}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs relative transition-all ${
                workout
                  ? `${TYPE_DOT[workout.type] ?? 'bg-app-purple'} text-white font-medium active:scale-90`
                  : isToday
                    ? 'border border-app-purple/30 text-app-purple-light'
                    : 'text-app-muted/50'
              }`}
            >
              {day.getDate()}
              {workout?.deload && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-app-gold" />
              )}
            </button>
          )
        })}
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? format(parseISO(selected), "EEEE d 'de' MMMM", { locale: es }) : ''}>
        {selectedWorkout && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium text-white ${TYPE_DOT[selectedWorkout.type] ?? 'bg-app-purple'}`}>
                {selectedWorkout.type}
              </span>
              {selectedWorkout.deload && <span className="text-app-gold text-xs">🔄 Descarga</span>}
            </div>

            {selectedWorkout.exercises?.map((e, i) => (
              <div key={i} className="bg-app-bg rounded-xl p-3">
                <p className="text-app-text text-sm font-medium">{e.name}</p>
                <p className="text-app-muted text-xs">{e.muscle}</p>
                <div className="mt-2 space-y-1">
                  {e.sets?.map((s, j) => (
                    <p key={j} className="text-xs text-app-muted">
                      Serie {j + 1}: {s.reps} reps · {s.weight} kg
                    </p>
                  ))}
                </div>
              </div>
            ))}

            {selectedWorkout.cinta && (
              <div className="bg-app-bg rounded-xl p-3">
                <p className="text-app-text text-sm font-medium">
                  Cinta{selectedWorkout.cinta.tipo ? ` · ${selectedWorkout.cinta.tipo}` : ''}
                </p>
                <p className="text-app-muted text-xs">
                  {[
                    selectedWorkout.cinta.min         ? `${selectedWorkout.cinta.min} min`               : null,
                    selectedWorkout.cinta.kmh         ? `${selectedWorkout.cinta.kmh} km/h`              : null,
                    selectedWorkout.cinta.inclinacion ? `${selectedWorkout.cinta.inclinacion}% inclinación` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}

            {selectedWorkout.activity && (
              <div className="bg-app-bg rounded-xl p-3">
                <p className="text-app-text text-sm font-medium">{selectedWorkout.activity}</p>
                <p className="text-app-muted text-xs">
                  {selectedWorkout.tiempo} min {selectedWorkout.distancia ? `· ${selectedWorkout.distancia} km` : ''}
                </p>
              </div>
            )}

            {selectedWorkout.clase && (
              <div className="bg-app-bg rounded-xl p-3">
                <p className="text-app-text text-sm font-medium">{selectedWorkout.clase}</p>
                <p className="text-app-muted text-xs">{selectedWorkout.duracion} min</p>
              </div>
            )}

            <div className="flex items-center justify-between bg-app-bg rounded-xl p-3">
              <span className="text-app-muted text-sm">Cansancio</span>
              <span className={`font-bold text-sm ${
                selectedWorkout.fatigue <= 4 ? 'text-app-green-light' :
                selectedWorkout.fatigue <= 7 ? 'text-app-amber' : 'text-app-coral'
              }`}>{selectedWorkout.fatigue}/10</span>
            </div>

            {selectedWorkout.notes && (
              <div className="bg-app-bg rounded-xl p-3">
                <p className="text-app-muted text-xs mb-1">Notas</p>
                <p className="text-app-text text-sm">{selectedWorkout.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
