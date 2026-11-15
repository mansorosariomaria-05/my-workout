import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { ProgressCard, SectionTitle } from './ProgressUI'
import ExerciseProgress from './ExerciseProgress'
import Modal from '../ui/Modal'
import { formatKg, formatDeltaKg, formatNumber } from '../../utils/format'
import { timeAgoText } from '../../utils/progressView'

// "Más fuerte que antes": hasta 5 ejercicios con mayor progreso de peso en el período. Tocar una fila abre la progresión
// de ese ejercicio; "Ver todos los ejercicios" abre el buscador. rows: computeStrengthRanking().rows
export default function StrengthBlock({ rows, workouts, today }) {
  const [open, setOpen] = useState(null) // null | { id, name } | { id: '' } (buscador)

  return (
    <div>
      <SectionTitle>Más fuerte que antes</SectionTitle>
      <ProgressCard className="!p-0 overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-app-muted text-sm text-center py-6 px-4">
            Todavía no hay mejoras de peso en este período. ¡Seguí entrenando y las vas a ver acá!
          </p>
        ) : rows.map(r => (
          <button key={r.id} type="button" onClick={() => setOpen({ id: r.id, name: r.name })}
            className="w-full text-left flex items-center gap-2 px-4 py-3 border-t border-white/[0.06] first:border-t-0 active:bg-white/[0.03]">
            <div className="flex-1 min-w-0">
              {/* Línea 1: nombre completo; si no entra se corta con "…" */}
              <p className="text-sm font-medium text-app-text truncate">{r.name}</p>
              {/* Línea 2: mejor marca · delta · última mejora */}
              <p className="mt-0.5 text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-app-muted">{formatKg(r.bestWeight)} × {formatNumber(r.bestReps)}{r.unit === 'secs' ? ' seg' : ''}</span>
                <span className="font-semibold text-app-green-light">{formatDeltaKg(r.delta)}</span>
                {r.stable
                  ? <span className="rounded-full px-2 py-0.5 text-[10px] bg-white/[0.06] text-app-muted">estable</span>
                  : null}
                <span className="text-app-muted">última mejora {timeAgoText(r.lastImprovementDate, today)}</span>
              </p>
            </div>
            <ChevronRight size={16} className="text-app-muted flex-shrink-0" />
          </button>
        ))}
        <button type="button" onClick={() => setOpen({ id: '' })}
          className="w-full flex items-center justify-center gap-1 py-3 border-t border-white/[0.06] text-sm font-medium text-app-purple-light">
          Ver todos los ejercicios
        </button>
      </ProgressCard>

      <Modal isOpen={!!open} onClose={() => setOpen(null)} title={open?.name || 'Progreso por ejercicio'}>
        {open && <ExerciseProgress workouts={workouts} initialExerciseId={open.id} />}
      </Modal>
    </div>
  )
}
