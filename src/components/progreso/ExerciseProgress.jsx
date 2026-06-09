import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-app-muted">{payload[0]?.payload.label}</p>
      <p className="text-app-text font-medium">{payload[0]?.value} kg</p>
    </div>
  )
}

export default function ExerciseProgress({ workouts }) {
  const [selected, setSelected]       = useState('')
  const [query, setQuery]             = useState('')
  const [showResults, setShowResults] = useState(false)

  const exercisesWithHistory = useMemo(() => {
    const seen = new Map()
    workouts.forEach(w => {
      w.exercises?.forEach(e => {
        if (e.exerciseId && !seen.has(e.exerciseId)) seen.set(e.exerciseId, e.name || e.exerciseId)
      })
    })
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [workouts])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return exercisesWithHistory.slice(0, 5)
    return exercisesWithHistory.filter(e => e.name.toLowerCase().includes(q)).slice(0, 5)
  }, [query, exercisesWithHistory])

  const handleSelect = (ex) => {
    setSelected(ex.id)
    setQuery(ex.name)
    setShowResults(false)
  }

  const handleClear = () => {
    setSelected('')
    setQuery('')
    setShowResults(false)
  }

  const chartData = useMemo(() => {
    if (!selected) return []
    return workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === selected))
      .map(w => {
        const ex = w.exercises.find(e => e.exerciseId === selected)
        const maxWeight = Math.max(0, ...(ex?.sets?.map(s => Number(s.weight) || 0) ?? []))
        return { label: w.date, weight: maxWeight }
      })
      .reverse()
  }, [selected, workouts])

  const pr = chartData.length ? Math.max(...chartData.map(d => d.weight)) : 0

  // Most recent date the PR weight was achieved
  let prDate = ''
  for (let i = chartData.length - 1; i >= 0; i--) {
    if (chartData[i].weight === pr) { prDate = chartData[i].label; break }
  }

  // Last session's sets summary for the selected exercise
  const lastSession = useMemo(() => {
    if (!selected) return null
    const w = workouts.find(wk => wk.type === 'fuerza' && wk.exercises?.some(e => e.exerciseId === selected))
    if (!w) return null
    const ex   = w.exercises.find(e => e.exerciseId === selected)
    const sets = ex?.sets ?? []
    if (!sets.length) return null
    const maxW   = Math.max(0, ...sets.map(s => Number(s.weight) || 0))
    const topSet = sets.find(s => Number(s.weight) === maxW) ?? sets[sets.length - 1]
    return { count: sets.length, reps: topSet?.reps ?? 0, weight: maxW }
  }, [selected, workouts])

  return (
    <div>
      <p className="text-app-muted text-xs mb-2">Análisis por ejercicio</p>

      {/* Search input */}
      <div className="relative mb-3">
        <div className="flex items-center gap-2 bg-app-bg border border-white/10 rounded-xl px-3 py-2.5">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round">
            <circle cx={11} cy={11} r={8} />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            placeholder="Buscar ejercicio..."
            className="flex-1 bg-transparent text-app-text text-sm placeholder-app-muted/50 focus:outline-none"
            onChange={e => {
              setQuery(e.target.value)
              setShowResults(true)
              if (!e.target.value) setSelected('')
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
          />
          {query && (
            <button onClick={handleClear} className="text-app-muted text-xs leading-none">✕</button>
          )}
        </div>

        {showResults && filtered.length > 0 && (
          <div className="absolute z-20 w-full top-full mt-1 border border-white/10 rounded-xl overflow-hidden max-h-44 overflow-y-auto"
            style={{ backgroundColor: '#1a1625' }}>
            {filtered.map(e => (
              <button
                key={e.id}
                className={`w-full text-left px-4 py-2.5 text-sm border-b border-white/5 last:border-0 ${
                  selected === e.id ? 'text-app-purple-light bg-app-purple/10' : 'text-app-text'
                }`}
                onMouseDown={() => handleSelect(e)}
              >
                {e.name}
              </button>
            ))}
          </div>
        )}

        {showResults && query.trim() && !filtered.length && (
          <div className="absolute z-20 w-full top-full mt-1 border border-white/10 rounded-xl px-4 py-4"
            style={{ backgroundColor: '#1a1625' }}>
            <p className="text-app-muted text-sm text-center">Sin resultados para "{query}"</p>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div>
          <div className="flex gap-6 mb-3">
            <div>
              <p className="text-app-muted text-[10px]">Última serie</p>
              <p className="text-app-text font-bold text-sm">
                {lastSession ? `${lastSession.count}×${lastSession.reps} · ${lastSession.weight}kg` : '—'}
              </p>
            </div>
            <div>
              <p className="text-app-muted text-[10px]">PR histórico</p>
              <p className="font-bold text-sm" style={{ color: '#D4AF37' }}>
                🏆 {pr}kg
                {prDate && (
                  <span className="font-normal text-[10px] ml-1" style={{ color: '#6B7280' }}>
                    ({format(new Date(prDate + 'T12:00:00'), 'd MMM', { locale: es })})
                  </span>
                )}
              </p>
            </div>
          </div>

          {chartData.length >= 2 && (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#9090A8', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => {
                    try { return format(new Date(v + 'T12:00:00'), 'd MMM', { locale: es }) } catch { return v }
                  }}
                />
                <YAxis tick={{ fill: '#9090A8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={pr} stroke="#D4AF37" strokeDasharray="3 3" strokeOpacity={0.6} />
                <Line
                  type="monotone" dataKey="weight" stroke="#40916C" strokeWidth={2}
                  dot={{ fill: '#40916C', r: 3 }} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {chartData.length < 2 && (
            <p className="text-app-muted text-sm text-center py-6">
              Necesitás al menos 2 sesiones para ver la progresión
            </p>
          )}
        </div>
      )}

      {!selected && !exercisesWithHistory.length && (
        <p className="text-app-muted text-sm text-center py-4">Sin historial de fuerza aún</p>
      )}
    </div>
  )
}
