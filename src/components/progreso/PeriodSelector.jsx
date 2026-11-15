import { VIEW_PERIODS } from '../../utils/progressView'

// Segmented control "4 semanas · 3 meses · Todo". Lo usan Progreso y la pantalla de running.
export default function PeriodSelector({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Período" className="flex rounded-xl p-1 bg-app-surface border border-white/[0.06]">
      {VIEW_PERIODS.map(p => {
        const active = p.key === value
        return (
          <button key={p.key} type="button" role="radio" aria-checked={active} onClick={() => onChange(p.key)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              active ? 'bg-app-purple/25 text-app-purple-light' : 'text-app-muted'
            }`}>
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
