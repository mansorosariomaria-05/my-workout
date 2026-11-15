import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { ProgressCard, SectionTitle } from './ProgressUI'
import { TYPE_COLORS, TYPE_LABELS } from '../../utils/workoutTypes'
import { formatNumber, formatScore, formatPercent, formatKm } from '../../utils/format'
import { formatPace } from '../../utils/cardio'

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

// "7:05 /km" → "7:05" (para mostrar "6:40 → 6:05 /km" con la unidad una sola vez).
const paceClock = (sec) => formatPace(sec).replace(/\s*\/km$/, '')

function SummaryRow({ label, children }) {
  return (
    <div className="py-3 border-t border-white/[0.06]">
      <p className="text-[11px] uppercase tracking-widest text-app-muted">{label}</p>
      <div className="mt-1 text-sm text-app-text">{children}</div>
    </div>
  )
}

// Ritmo de running: el que baja es mejora (verde); si subió o quedó igual, se muestra neutral.
function CardioRow({ cardio }) {
  const better = cardio.direction === 'better'
  let pace
  if (cardio.mode) {
    pace = (
      <span className={better ? 'text-app-green-light font-semibold' : 'text-app-muted'}>
        {paceClock(cardio.from)} → {formatPace(cardio.to)}
      </span>
    )
  } else if (cardio.avgPace != null) {
    pace = <span className="text-app-muted">promedio {formatPace(cardio.avgPace)}</span>
  }
  return <>{formatKm(cardio.km)} corridos{pace && <> · ritmo {pace}</>}</>
}

// Resumen de cierre de "3 meses" y "Todo": etiqueta, titular generado por reglas y datos de apoyo, un dato por fila.
// summary: computePeriodSummary()
function PeriodSummary({ summary }) {
  const { label, headline, weeks, mix, strengthImproved, cardio, bestMonth, empty } = summary
  const hasRows = !empty && (weeks.evaluated > 0 || mix.length > 0 || strengthImproved > 0 || cardio || bestMonth)
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-app-muted">{label}</p>
      <p className="mt-1.5 text-xl font-bold leading-snug text-app-text">{headline.text}</p>

      {hasRows && (
        <div className="mt-4">
          {weeks.evaluated > 0 && (
            <SummaryRow label="Constancia">
              {formatScore(weeks.avgDays)} días por semana en promedio · objetivo cumplido en {formatNumber(weeks.met)} de {formatNumber(weeks.evaluated)} semanas
            </SummaryRow>
          )}
          {mix.length > 0 && (
            <SummaryRow label="Qué entrenaste">
              <div className="flex h-2 rounded-full overflow-hidden bg-white/5" role="img"
                aria-label={mix.map(m => `${TYPE_LABELS[m.type]} ${formatPercent(m.pct)}`).join(', ')}>
                {mix.map(m => <div key={m.type} style={{ width: `${m.pct}%`, backgroundColor: TYPE_COLORS[m.type] }} />)}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {mix.map(m => (
                  <span key={m.type} className="flex items-center gap-1 text-xs text-app-muted">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[m.type] }} />
                    {TYPE_LABELS[m.type]} {formatPercent(m.pct)}
                  </span>
                ))}
              </div>
            </SummaryRow>
          )}
          {strengthImproved > 0 && (
            <SummaryRow label="Fuerza">
              Subiste peso en <span className="font-semibold text-app-green-light">{plural(strengthImproved, 'ejercicio', 'ejercicios')}</span>
            </SummaryRow>
          )}
          {cardio && <SummaryRow label="Cardio"><CardioRow cardio={cardio} /></SummaryRow>}
          {bestMonth && (
            <SummaryRow label="Mejor mes">
              {capitalize(bestMonth.monthName)}{bestMonth.showYear ? ` de ${bestMonth.year}` : ''} ({plural(bestMonth.days, 'día', 'días')})
            </SummaryRow>
          )}
        </div>
      )}
    </>
  )
}

// En vivo ("4 semanas"): entrenamientos del mes (número grande) y comparación con el mes anterior, racha y estado de la semana.
function LiveHeader({ comparison, streak, goal }) {
  const { monthName, current, text, tone } = comparison
  const weekMet = streak.currentWeekDays >= goal
  return (
    <>
      <p className="text-5xl font-bold leading-none text-app-text">{formatNumber(current)}</p>
      <p className="mt-1.5 text-base text-app-text">{current === 1 ? 'entrenamiento' : 'entrenamientos'} en {monthName}</p>
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
    </>
  )
}

// Bloque protagonista. Responde al período: "4 semanas" = en vivo (mes en curso, racha, semana); "3 meses" y "Todo" =
// resumen de cierre (`summary`, computePeriodSummary; null en la vista en vivo). El gráfico va siempre debajo.
// comparison: computeMonthComparison · streak: computeWeeklyStreak3Plus · chart: computeConstanciaBars.
export default function ConstanciaBlock({ comparison, streak, goal, chart, summary }) {
  return (
    <div>
      <SectionTitle>Constancia</SectionTitle>
      <ProgressCard className="p-5">
        {summary
          ? <PeriodSummary summary={summary} />
          : <LiveHeader comparison={comparison} streak={streak} goal={goal} />}
        <ConstanciaChart chart={chart} />
      </ProgressCard>
    </div>
  )
}
