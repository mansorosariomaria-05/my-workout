import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, ResponsiveContainer } from 'recharts'
import { formatScore } from '../../utils/format'

const LINE_COLOR = '#9B7FD4'  // violeta de marca
const BAND_COLOR = '#40916C'  // zona liviana a moderada baja (5 o menos), apenas insinuada

function FatigueTooltip({ active, payload }) {
  if (!active || !payload?.length || payload[0].value == null) return null
  const p = payload[0].payload
  return (
    <div className="bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-app-muted">Semana del {p.label}</p>
      <p className="text-app-text font-medium">Esfuerzo {formatScore(p.avg)}</p>
    </div>
  )
}

// Promedio semanal de esfuerzo percibido del período. weekly: computeBodySummary().weekly
// [{ weekStart, label, avg|null, count }]. Eje Y de 1 a 10; banda sutil en la zona de 5 o menos.
export default function FatigueChart({ weekly }) {
  const withData = weekly.filter(w => w.avg != null)
  if (withData.length < 2) {
    return <p className="mt-4 text-xs text-app-muted">Con registros en al menos 2 semanas vas a ver cómo se mueve tu esfuerzo.</p>
  }
  const dense = weekly.length > 13

  return (
    <div className="mt-4">
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={weekly} margin={{ top: 6, right: 14, left: -28, bottom: 0 }}>
          <ReferenceArea y1={1} y2={5} fill={BAND_COLOR} fillOpacity={0.1} stroke="none" />
          <XAxis dataKey="label" tick={{ fill: '#9090A8', fontSize: 9 }} axisLine={false} tickLine={false}
            interval={dense ? 'preserveStartEnd' : weekly.length > 7 ? 1 : 0} />
          <YAxis domain={[1, 10]} ticks={[1, 5, 10]} tick={{ fill: '#9090A8', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<FatigueTooltip />} />
          <Line type="monotone" dataKey="avg" stroke={LINE_COLOR} strokeWidth={2} connectNulls isAnimationActive={false}
            dot={{ fill: LINE_COLOR, r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
