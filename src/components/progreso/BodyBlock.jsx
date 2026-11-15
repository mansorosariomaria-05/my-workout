import { ProgressCard, SectionTitle } from './ProgressUI'
import FatigueChart from './FatigueChart'
import { formatScore } from '../../utils/format'

// Etiqueta y color por nivel de esfuerzo. Nunca rojo ni 🔥: el esfuerzo es información, no un logro ni una falla.
const LEVELS = {
  liviano:  { label: 'Liviano',  text: 'text-app-green-light',  chip: 'bg-app-green-light/15 text-app-green-light' },
  moderado: { label: 'Moderado', text: 'text-app-purple-light', chip: 'bg-app-purple/15 text-app-purple-light' },
  alto:     { label: 'Alto',     text: 'text-app-amber',        chip: 'bg-app-amber/15 text-app-amber' },
}

const PERIOD_TEXT = { '4w': 'últimas 4 semanas', '13w': 'últimos 3 meses', all: 'todo el historial' }

// "Cómo está tu cuerpo": esfuerzo percibido promedio del período, nivel, tendencia contra el período anterior
// equivalente y gráfico semanal. body: computeBodySummary() · suggestDeload: useDeload().shouldSuggestDeload() y sin descarga activa.
export default function BodyBlock({ body, period, suggestDeload }) {
  const level = body.level ? LEVELS[body.level] : null

  return (
    <div>
      <SectionTitle>Cómo está tu cuerpo</SectionTitle>
      <ProgressCard>
        {!level ? (
          <p className="text-app-muted text-sm text-center py-4">
            Todavía no hay suficientes registros de esfuerzo en este período. Se anota al terminar cada entrenamiento.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className={`text-4xl font-bold leading-none ${level.text}`}>{formatScore(body.avg)}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${level.chip}`}>{level.label}</span>
            </div>
            <p className="mt-1.5 text-xs text-app-muted">esfuerzo percibido promedio · {PERIOD_TEXT[period]}</p>

            {body.trend && (
              <p className="mt-2 text-xs text-app-muted">
                {body.trend === 'up' && `↑ subió desde ${formatScore(body.previous)}`}
                {body.trend === 'down' && `↓ bajó desde ${formatScore(body.previous)}`}
                {body.trend === 'same' && `= igual que antes (${formatScore(body.previous)})`}
              </p>
            )}

            {body.level === 'alto' && suggestDeload && (
              <p className="mt-2 text-xs text-app-amber">Podría ser buen momento para una semana más liviana</p>
            )}

            <FatigueChart weekly={body.weekly} />
          </>
        )}
      </ProgressCard>
    </div>
  )
}
