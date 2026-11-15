import { useState } from 'react'
import { parseISO, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown } from 'lucide-react'
import { ProgressCard } from './ProgressUI'
import { WorkoutIcon } from '../icons/WorkoutIcons'
import { REAL_WORKOUT_TYPES } from '../../utils/streak'
import { formatDuration, getEffectiveDurationSeconds } from '../../utils/cardio'
import { detectPRs } from '../../utils/prUtils'
import { TYPE_COLORS } from '../../utils/workoutTypes'
import { getFatigueLevel } from '../../utils/progressView'
import { formatNumber } from '../../utils/format'

const REAL_TYPES = new Set(REAL_WORKOUT_TYPES)
const TYPE_LABEL = { fuerza: 'Fuerza', cardio: 'Cardio', clase: 'Clase', tabata: 'Tabata' }
const INITIAL_COUNT = 5

// Misma escala que "Cómo está tu cuerpo" (getFatigueLevel). Sin rojo.
const FATIGUE_BADGE = {
  liviano:  { label: 'liviana',  dot: 'bg-app-green-light' },
  moderado: { label: 'moderada', dot: 'bg-app-purple-light' },
  alto:     { label: 'alta',     dot: 'bg-app-amber' },
}

// Últimas sesiones (las 5 más recientes). "Ver todo el historial" muestra todas. Las notas ocupan hasta 2 líneas.
export default function UltimasSesiones({ workouts }) {
  const [showAll, setShowAll] = useState(false)
  const all = workouts.filter(w => REAL_TYPES.has(w.type) && w.date)
  const sessions = showAll ? all : all.slice(0, INITIAL_COUNT)

  if (!all.length) {
    return <p className="text-app-muted text-sm text-center py-4">Sin sesiones registradas aún</p>
  }

  return (
    <div className="space-y-2">
      {sessions.map((w, i) => {
        const iconColor = TYPE_COLORS[w.type] ?? '#94A3B8'
        const relDate   = formatDistanceToNow(parseISO(w.date + 'T12:00:00'), { addSuffix: true, locale: es })
        const hasPR     = w.type === 'fuerza' && detectPRs(w, workouts.filter(h => h.date < w.date)).length > 0
        const fat       = w.fatigue != null ? FATIGUE_BADGE[getFatigueLevel(Number(w.fatigue))] : null

        let subtitle = null
        if (w.type === 'fuerza' && w.muscleGroups?.length) subtitle = w.muscleGroups.join(' · ')
        else if (w.type === 'cardio' && w.activity)        subtitle = w.activity
        else if (w.type === 'clase' && w.clase)            subtitle = w.clase

        const tiempoLabel = w.type === 'cardio'
          ? (getEffectiveDurationSeconds(w) ? formatDuration(getEffectiveDurationSeconds(w)) : null)
          : (w.duracion ? `${formatNumber(w.duracion)} min` : null)
        const hasLine3 = tiempoLabel || w.notes

        return (
          <ProgressCard key={`${w.date}-${i}`} className="!px-4 !py-3">
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
      })}

      {all.length > INITIAL_COUNT && (
        <button type="button" onClick={() => setShowAll(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-white/[0.06] bg-app-surface text-app-purple-light">
          <span className="text-sm font-medium">{showAll ? 'Ver menos' : 'Ver todo el historial'}</span>
          <ChevronDown size={13} className={`transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}
