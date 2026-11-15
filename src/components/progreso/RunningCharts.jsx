import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, ResponsiveContainer } from 'recharts'
import { TYPE_COLORS } from '../../utils/workoutTypes'
import { formatKm, formatNumber } from '../../utils/format'
import { formatPace } from '../../utils/cardio'

// Los dos gráficos (ritmo y esfuerzo) comparten el MISMO eje X (una posición por carrera, en el mismo orden) y las
// mismas márgenes y ancho de eje Y, así que cada carrera queda en la misma columna en ambos.
const MARGIN = { top: 6, right: 14, left: 0, bottom: 0 }
const Y_AXIS_WIDTH = 40
const TICK = { fill: '#9090A8', fontSize: 10 }
const PACE_COLOR = TYPE_COLORS.cardio   // verde de cardio: el de running
const AVG_COLOR = '#F0EEF8'
const EFFORT_COLOR = '#9B7FD4'          // violeta de marca (el mismo que "Cómo está tu cuerpo")
const BAND_COLOR = '#40916C'

// "6:05 /km" → "6:05" para las marcas del eje (la unidad va una sola vez, en la leyenda).
const paceClock = (sec) => formatPace(sec).replace(/\s*\/km$/, '')

const xInterval = (n) => (n > 6 ? Math.ceil(n / 6) - 1 : 0)

function PaceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  if (p.pace == null) return null
  return (
    <div className="bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-app-muted">Carrera del {p.label}</p>
      <p className="text-app-text font-medium">{formatPace(p.pace)} · {formatKm(p.km)}</p>
      {p.paceAvg != null && <p className="text-app-muted">media de 3: {formatPace(p.paceAvg)}</p>}
    </div>
  )
}

function EffortTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  if (p.fatigue == null) return null
  return (
    <div className="bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-app-muted">Carrera del {p.label}</p>
      <p className="text-app-text font-medium">Esfuerzo {formatNumber(p.fatigue)}/10</p>
    </div>
  )
}

// Ritmo: un punto por carrera, eje Y INVERTIDO (más rápido arriba) con etiquetas mm:ss y media móvil de 3 carreras.
// series: computeRunningDetail().series · axis: computePaceAxis() ({ domain, ticks })
export function PaceChart({ series, axis }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[10px] text-app-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: PACE_COLOR }} />Cada carrera</span>
        <span className="flex items-center gap-1"><span className="w-3 border-t-2 rounded" style={{ borderColor: AVG_COLOR, opacity: 0.8 }} />Media de 3 carreras</span>
        <span>↑ más rápido (min/km)</span>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={series} margin={MARGIN}>
          <XAxis dataKey="key" tick={false} axisLine={false} tickLine={false} height={6} />
          <YAxis reversed domain={axis.domain} ticks={axis.ticks} width={Y_AXIS_WIDTH} tick={TICK} axisLine={false} tickLine={false}
            tickFormatter={paceClock} interval={0} />
          <Tooltip content={<PaceTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.12)' }} />
          <Line dataKey="paceAvg" type="monotone" stroke={AVG_COLOR} strokeOpacity={0.75} strokeWidth={2} dot={false} activeDot={false}
            connectNulls isAnimationActive={false} />
          <Line dataKey="pace" stroke={PACE_COLOR} strokeOpacity={0} strokeWidth={0} isAnimationActive={false}
            dot={{ r: series.length > 40 ? 2.5 : 3.5, fill: PACE_COLOR, stroke: 'none' }} activeDot={{ r: 5, fill: PACE_COLOR, stroke: 'none' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Esfuerzo percibido (fatigue, 1 a 10) de cada carrera, con el mismo eje X que el gráfico de ritmo y justo debajo.
// Las carreras sin esfuerzo no tienen punto (la línea las salta).
export function EffortChart({ series }) {
  const labelByKey = Object.fromEntries(series.map(s => [s.key, s.label]))
  return (
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={series} margin={MARGIN}>
        <ReferenceArea y1={1} y2={5} fill={BAND_COLOR} fillOpacity={0.1} stroke="none" />
        <XAxis dataKey="key" tick={{ fill: '#9090A8', fontSize: 9 }} axisLine={false} tickLine={false}
          interval={xInterval(series.length)} tickFormatter={(k) => labelByKey[k] ?? ''} />
        <YAxis domain={[1, 10]} ticks={[1, 5, 10]} width={Y_AXIS_WIDTH} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<EffortTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.12)' }} />
        <Line dataKey="fatigue" type="monotone" stroke={EFFORT_COLOR} strokeWidth={2} connectNulls isAnimationActive={false}
          dot={{ r: series.length > 40 ? 2.5 : 3, fill: EFFORT_COLOR, stroke: 'none' }} activeDot={{ r: 5, fill: EFFORT_COLOR, stroke: 'none' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
