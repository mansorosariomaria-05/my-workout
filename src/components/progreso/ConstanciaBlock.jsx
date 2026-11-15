import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { ProgressCard, SectionTitle } from './ProgressUI'
import { TYPE_COLORS, TYPE_LABELS } from '../../utils/workoutTypes'
import { formatNumber } from '../../utils/format'

const TYPES = ['fuerza', 'cardio', 'clase', 'tabata']
const GOAL_COLOR = '#F0EEF8'

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const plural = (n, one, many) => `${formatNumber(n)} ${n === 1 ? one : many}`

function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const bar = payload[0].payload
  return (
    <div className="bg-app-elevated border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-app-muted capitalize">{bar.title}</p>
      <p className="text-app-text font-medium">{plural(bar.total, 'día entrenado', 'días entrenados')}</p>
      {TYPES.filter(t => bar[t] > 0).map(t => (
        <p key={t} style={{ color: TYPE_COLORS[t] }}>{TYPE_LABELS[t]}: {formatNumber(bar[t])}</p>
      ))}
    </div>
  )
}

// Días entrenados por semana (o por mes en "Todo"), apilados por tipo (un día = un tipo). La semana/mes en curso va con menos opacidad
// y, en la vista semanal, una línea punteada marca el objetivo de días por semana.
function ConstanciaChart({ chart }) {
  const { bars, goal, kind } = chart
  if (!bars.length) return null
  const max = Math.max(goal ?? 0, ...bars.map(b => b.total), 1)
  const presentTypes = TYPES.filter(t => bars.some(b => b[t] > 0))
  const dense = bars.length > 13

  return (
    <div className="mt-5">
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={bars} margin={{ top: 8, right: 4, left: -28, bottom: 0 }} barCategoryGap={dense ? '12%' : '28%'}>
          <XAxis dataKey="label" tick={{ fill: '#9090A8', fontSize: 9 }} axisLine={false} tickLine={false}
            interval={dense ? 'preserveStartEnd' : bars.length > 7 ? 1 : 0} />
          <YAxis allowDecimals={false} domain={[0, max]} tick={{ fill: '#9090A8', fontSize: 10 }} axisLine={false} tickLine={false}
            tickCount={Math.min(max + 1, 5)} />
          <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          {goal ? <ReferenceLine y={goal} stroke={GOAL_COLOR} strokeOpacity={0.6} strokeDasharray="4 4" /> : null}
          {TYPES.map(t => (
            <Bar key={t} dataKey={t} stackId="entrenamientos" fill={TYPE_COLORS[t]} isAnimationActive={false}>
              {bars.map(b => <Cell key={b.key} fillOpacity={b.current ? 0.45 : 1} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
        {presentTypes.map(t => (
          <span key={t} className="flex items-center gap-1 text-[10px] text-app-muted">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] }} />{TYPE_LABELS[t]}
          </span>
        ))}
        {goal ? (
          <span className="flex items-center gap-1 text-[10px] text-app-muted">
            <span className="w-3 border-t border-dashed" style={{ borderColor: GOAL_COLOR }} />Objetivo: {plural(goal, 'día', 'días')} por semana
          </span>
        ) : null}
        {kind === 'month' ? <span className="text-[10px] text-app-muted">· por mes</span> : null}
      </div>
    </div>
  )
}

// Bloque protagonista: entrenamientos del mes, comparación con el mes anterior a la misma altura, racha y estado de la
// semana, y el gráfico del período. comparison: computeMonthComparison · streak: computeWeeklyStreak3Plus · chart: computeConstanciaBars.
export default function ConstanciaBlock({ comparison, streak, goal, chart }) {
  const { monthName, current, text, tone } = comparison
  const weekMet = streak.currentWeekDays >= goal
  return (
    <div>
      <SectionTitle>Constancia</SectionTitle>
      <ProgressCard className="p-5">
        <p className="text-2xl font-bold leading-tight text-app-text">
          {capitalize(monthName)}: {plural(current, 'entrenamiento', 'entrenamientos')}
        </p>
        <p className={`mt-1 text-sm font-medium ${tone === 'up' ? 'text-app-green-light' : 'text-app-muted'}`}>{text}</p>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {streak.total > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold bg-app-purple/15 text-app-purple-light">
              🔥 {plural(streak.total, 'semana', 'semanas')} con 3+ días
            </span>
          )}
          <span className={`text-xs ${weekMet ? 'text-app-green-light' : 'text-app-muted'}`}>
            {formatNumber(streak.currentWeekDays)} de {formatNumber(goal)} {goal === 1 ? 'día' : 'días'} esta semana
          </span>
        </div>

        <ConstanciaChart chart={chart} />
      </ProgressCard>
    </div>
  )
}
