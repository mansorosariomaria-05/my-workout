import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { exercises } from '../../data/exercises'
import { nextWeight } from '../../utils/weights'
import { getSeriesSuggestion, OBJETIVO_PARAMS } from '../../utils/progression'
import { format, parseISO } from 'date-fns'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-app-muted">{payload[0]?.payload.label}</p>
      <p className="text-app-text font-medium">{payload[0]?.value} kg</p>
    </div>
  )
}

export default function ExerciseProgress({ workouts, profile }) {
  const [selected, setSelected] = useState('')
  const [open, setOpen] = useState(false)

  const exercisesWithHistory = useMemo(() => {
    const used = new Set()
    workouts.forEach(w => {
      w.exercises?.forEach(e => { if (e.exerciseId) used.add(e.exerciseId) })
    })
    return exercises.filter(e => used.has(e.id))
  }, [workouts])

  const selectedEx = exercises.find(e => e.id === selected)

  const chartData = useMemo(() => {
    if (!selected) return []
    return workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === selected))
      .map(w => {
        const ex = w.exercises.find(e => e.exerciseId === selected)
        const maxWeight = Math.max(0, ...(ex?.sets?.map(s => s.weight ?? 0) ?? []))
        return { label: w.date, weight: maxWeight }
      })
      .reverse()
  }, [selected, workouts])

  const pr = chartData.length ? Math.max(...chartData.map(d => d.weight)) : 0
  const lastWeight = chartData[chartData.length - 1]?.weight ?? 0
  const next = nextWeight(lastWeight)
  const nextSuggestion = useMemo(() => {
    if (!selected || !chartData.length) return null
    const ex = exercises.find(e => e.id === selected)
    const relevantWorkouts = workouts.filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === selected))
    return getSeriesSuggestion(selected, 0, profile, relevantWorkouts, ex?.level)
  }, [selected, chartData, workouts, profile])

  const objetivo = profile?.objetivo ?? 'Bienestar general'
  const params = OBJETIVO_PARAMS[objetivo] ?? OBJETIVO_PARAMS['Bienestar general']

  return (
    <div>
      <p className="text-app-muted text-xs mb-2">Progresión por ejercicio</p>
      <div className="relative mb-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full bg-app-bg border border-white/10 rounded-xl px-4 py-2.5 text-left text-sm flex items-center justify-between"
        >
          <span className={selectedEx ? 'text-app-text' : 'text-app-muted'}>
            {selectedEx?.name ?? 'Seleccionar ejercicio'}
          </span>
          <span className="text-app-muted">↓</span>
        </button>
        {open && (
          <div className="absolute z-10 w-full top-full mt-1 bg-app-elevated border border-white/10 rounded-xl max-h-48 overflow-y-auto">
            {exercisesWithHistory.map(e => (
              <button
                key={e.id}
                className={`w-full text-left px-4 py-2.5 text-sm border-b border-white/5 last:border-0 ${
                  selected === e.id ? 'text-app-purple-light bg-app-purple/10' : 'text-app-text'
                }`}
                onClick={() => { setSelected(e.id); setOpen(false) }}
              >
                {e.name}
              </button>
            ))}
            {!exercisesWithHistory.length && (
              <p className="text-app-muted text-sm text-center py-4">Sin historial aún</p>
            )}
          </div>
        )}
      </div>

      {selected && chartData.length > 0 && (
        <div className="animate-fadeIn">
          <div className="flex gap-4 mb-3">
            <div>
              <p className="text-app-muted text-[10px]">PR histórico</p>
              <p className="text-app-gold font-bold text-sm">{pr} kg 🏆</p>
            </div>
            <div>
              <p className="text-app-muted text-[10px]">Último</p>
              <p className="text-app-text font-bold text-sm">{lastWeight} kg</p>
            </div>
            <div>
              <p className="text-app-muted text-[10px]">Próxima sesión</p>
              <p className="text-app-green-light font-bold text-sm">
                {nextSuggestion && nextSuggestion.suggestedWeight > 0
                  ? `${nextSuggestion.suggestedWeight}kg × ${params.repsMin}-${params.repsMax} reps`
                  : `${next} kg`}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#9090A8', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9090A8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={pr} stroke="#D4AF37" strokeDasharray="3 3" strokeOpacity={0.6} />
              <Line
                type="monotone" dataKey="weight" stroke="#40916C" strokeWidth={2}
                dot={{ fill: '#40916C', r: 3 }} activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {selected && chartData.length === 0 && (
        <p className="text-app-muted text-sm text-center py-6">Sin registros para este ejercicio</p>
      )}
    </div>
  )
}
