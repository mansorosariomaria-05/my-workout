import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts'
import { getLast12Weeks, toDateStr, weekKey } from '../../utils/dates'
import { format } from 'date-fns'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const { days, deload } = payload[0].payload
  return (
    <div className="bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-app-muted">{label}</p>
      <p className="text-app-text font-medium">{days} días {deload ? '· Descarga' : ''}</p>
    </div>
  )
}

export default function WeekChart({ workouts }) {
  const weeks = getLast12Weeks()
  const data = weeks.map(weekStart => {
    const key = toDateStr(weekStart)
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    const endStr = toDateStr(end)
    const weekWorkouts = workouts.filter(w => w.date >= key && w.date <= endStr)
    const days = weekWorkouts.length
    const deload = weekWorkouts.some(w => w.deload)
    return {
      label: format(weekStart, 'dd/MM'),
      days,
      deload,
      fill: deload ? '#D4AF37' : days >= 5 ? '#F59E0B' : days >= 4 ? '#40916C' : days >= 3 ? '#4A9EDB' : '#22223A',
    }
  })

  return (
    <div>
      <p className="text-app-muted text-xs mb-3">Días por semana (últimas 12)</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: '#9090A8', fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 7]} tick={{ fill: '#9090A8', fontSize: 10 }} axisLine={false} tickLine={false} ticks={[0,1,2,3,4,5,6,7]} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="days" radius={[4, 4, 0, 0]} maxBarSize={24}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
          <ReferenceLine y={4} stroke="#40916C" strokeDasharray="3 3" strokeOpacity={0.4} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 mt-2 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] text-app-muted"><span className="w-2 h-2 rounded-sm bg-[#4A9EDB]" />Aceptable</span>
        <span className="flex items-center gap-1 text-[10px] text-app-muted"><span className="w-2 h-2 rounded-sm bg-[#40916C]" />Óptimo</span>
        <span className="flex items-center gap-1 text-[10px] text-app-muted"><span className="w-2 h-2 rounded-sm bg-[#F59E0B]" />Ideal</span>
        <span className="flex items-center gap-1 text-[10px] text-app-muted"><span className="w-2 h-2 rounded-sm bg-[#D4AF37]" />Descarga</span>
      </div>
    </div>
  )
}
