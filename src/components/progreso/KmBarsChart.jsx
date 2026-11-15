import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TYPE_COLORS } from '../../utils/workoutTypes'
import { formatKm, formatNumber } from '../../utils/format'

const BAR_COLOR = TYPE_COLORS.cardio   // verde de cardio: el de running en toda la app

function KmTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const bar = payload[0].payload
  return (
    <div className="bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-app-muted capitalize">{bar.title}</p>
      <p className="text-app-text font-medium">{formatKm(bar.km)}</p>
    </div>
  )
}

// Barras de km por semana (4 semanas / 3 meses) o por mes (Todo). bars: computeKmBars().bars
// [{ key, label, title, km, current }]. La semana o el mes en curso va con menos opacidad.
// compact: versión mini del bloque de Progreso (sin eje Y, más baja).
export default function KmBarsChart({ bars, compact = false }) {
  if (!bars.length) return null
  const dense = bars.length > 13
  return (
    <ResponsiveContainer width="100%" height={compact ? 84 : 150}>
      <BarChart data={bars} margin={{ top: 6, right: 4, left: compact ? 0 : -24, bottom: 0 }} barCategoryGap={dense ? '12%' : '28%'}>
        <XAxis dataKey="label" tick={{ fill: '#9090A8', fontSize: 9 }} axisLine={false} tickLine={false}
          interval={dense ? 'preserveStartEnd' : bars.length > 7 ? 1 : 0} />
        {compact
          ? <YAxis hide domain={[0, 'auto']} />
          : <YAxis domain={[0, 'auto']} tick={{ fill: '#9090A8', fontSize: 10 }} axisLine={false} tickLine={false}
              tickCount={4} tickFormatter={formatNumber} />}
        {!compact && <Tooltip content={<KmTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />}
        <Bar dataKey="km" fill={BAR_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {bars.map(b => <Cell key={b.key} fillOpacity={b.current ? 0.45 : 1} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
