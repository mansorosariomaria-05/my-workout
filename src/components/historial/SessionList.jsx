import { parseISO, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { ProgressCard } from '../progreso/ProgressUI'
import { WorkoutIcon } from '../icons/WorkoutIcons'
import { formatDuration, getEffectiveDurationSeconds } from '../../utils/cardio'
import { TYPE_COLORS } from '../../utils/workoutTypes'
import { getFatigueLevel } from '../../utils/progressView'
import { formatNumber } from '../../utils/format'

// 'tabata' se conserva solo como tipo de lectura: los workouts históricos de ese tipo se siguen viendo.
const TYPE_LABEL = { fuerza: 'Fuerza', cardio: 'Cardio', clase: 'Clase', tabata: 'Tabata' }

// Misma escala que "Cómo está tu cuerpo" (getFatigueLevel). Sin rojo.
const FATIGUE_BADGE = {
  liviano:  { label: 'liviana',  dot: 'bg-app-green-light' },
  moderado: { label: 'moderada', dot: 'bg-app-purple-light' },
  alto:     { label: 'alta',     dot: 'bg-app-amber' },
}

function SessionCard({ workout: w, hasPR }) {
  const iconColor = TYPE_COLORS[w.type] ?? '#94A3B8'
  const relDate   = formatDistanceToNow(parseISO(w.date + 'T12:00:00'), { addSuffix: true, locale: es })
  const fat       = w.fatigue != null ? FATIGUE_BADGE[getFatigueLevel(Number(w.fatigue))] : null

  let subtitle = null
  if (w.type === 'fuerza' && w.muscleGroups?.length) subtitle = w.muscleGroups.join(' · ')
  else if (w.type === 'cardio' && w.activity)        subtitle = w.activity
  else if (w.type === 'clase' && w.clase)            subtitle = w.clase
  else if (w.type === 'tabata' && w.tabataName)      subtitle = w.tabataName

  const tiempoLabel = w.type === 'cardio'
    ? (getEffectiveDurationSeconds(w) ? formatDuration(getEffectiveDurationSeconds(w)) : null)
    : (w.duracion ? `${formatNumber(w.duracion)} min` : null)
  const hasLine3 = tiempoLabel || w.notes

  return (
    <ProgressCard className="!px-4 !py-3">
      {/* Fila 1: ícono · tipo · esfuerzo · [PR] · fecha */}
      <div className="flex items-center gap-2">
        <div style={{ color: iconColor, flexShrink: 0 }}>
          <WorkoutIcon type={w.type} size={20} />
        </div>
        <span className="text-sm font-semibold text-app-text">{TYPE_LABEL[w.type] ?? w.type}</span>
        {fat && (
          <div className="flex items-center gap-1">
            <div className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${fat.dot}`} />
            <span className="text-xs text-app-muted">{fat.label}</span>
          </div>
        )}
        <div className="flex-1" />
        {hasPR && (
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full mr-1 flex-shrink-0 bg-app-green-light/15 text-app-green-light">
            🏆 PR
          </span>
        )}
        <span className="text-xs flex-shrink-0 text-app-muted">{relDate}</span>
      </div>

      {subtitle && <p className="mt-1 text-xs truncate text-app-muted">{subtitle}</p>}

      {/* Fila 3: tiempo · notas (hasta 2 líneas) */}
      {hasLine3 && (
        <p className="mt-0.5 text-xs line-clamp-2 text-app-muted">
          {tiempoLabel && <span>{tiempoLabel}</span>}
          {tiempoLabel && w.notes && <span> · </span>}
          {w.notes && <em>{w.notes}</em>}
        </p>
      )}
    </ProgressCard>
  )
}

// Lista completa de sesiones agrupada por mes, con un encabezado por mes ("Noviembre 2026").
// groups: groupSessionsByMonth() de utils/historyView.js (la agrupación y los PR se calculan allá).
export default function SessionList({ groups }) {
  if (!groups.length) {
    return <p className="text-app-muted text-sm text-center py-4">Sin sesiones registradas aún</p>
  }

  return (
    <div className="space-y-5">
      {groups.map(g => (
        <section key={g.key} aria-label={g.label}>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-semibold text-app-text">{g.label}</h3>
            <span className="text-xs text-app-muted">
              {formatNumber(g.count)} {g.count === 1 ? 'sesión' : 'sesiones'}
            </span>
          </div>
          <div className="space-y-2">
            {g.sessions.map(({ workout, hasPR }, i) => (
              <SessionCard key={workout.id ?? `${workout.date}-${i}`} workout={workout} hasPR={hasPR} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
