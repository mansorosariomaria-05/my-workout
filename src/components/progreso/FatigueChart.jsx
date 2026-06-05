import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { getLast12Weeks, toDateStr } from '../../utils/dates'
import { format } from 'date-fns'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-app-muted">{payload[0]?.payload.label}</p>
      <p className="text-app-text font-medium">Cansancio: {payload[0]?.value?.toFixed(1)}</p>
    </div>
  )
}

export default function FatigueChart({ workouts }) {
  const weeks = getLast12Weeks()
  const data = weeks.map(weekStart => {
    const key = toDateStr(weekStart)
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    const endStr = toDateStr(end)
    const weekW = workouts.filter(w => w.date >= key && w.date <= endStr && w.fatigue)
    const avg = weekW.length ? (weekW.reduce((a, w) => a + w.fatigue, 0) / weekW.length) : null
    return { label: format(weekStart, 'dd/MM'), fatigue: avg }
  }).filter(d => d.fatigue !== null)

  return (
    <div>
      <p className="text-app-muted text-xs mb-3">Cansancio promedio semanal</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: '#9090A8', fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 10]} tick={{ fill: '#9090A8', fontSize: 10 }} axisLine={false} tickLine={false} ticks={[0,2,4,6,8,10]} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={7} stroke="#E57373" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Line
            type="monotone" dataKey="fatigue" stroke="#9B7FD4" strokeWidth={2}
            dot={{ fill: '#9B7FD4', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-app-muted text-[10px] mt-1">La línea roja indica el umbral de descarga (≥7)</p>
    </div>
  )
}
