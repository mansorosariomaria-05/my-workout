import { daysUntilValencia, isAfterValencia } from '../../utils/dates'

export default function ValenciaCountdown() {
  const days = daysUntilValencia()
  const after = isAfterValencia()

  if (after) return (
    <div className="mx-4 bg-app-purple/20 border border-app-purple/30 rounded-xl px-4 py-3 text-center">
      <p className="text-app-purple-light font-semibold">¡Ya estás en Valencia!</p>
      <p className="text-app-muted text-xs mt-0.5">Disfrutá cada momento</p>
    </div>
  )

  if (days === 0) return (
    <div className="mx-4 bg-app-gold/20 border border-app-gold/30 rounded-xl px-4 py-4 text-center animate-pulse-slow">
      <p className="text-app-gold text-lg font-bold">¡HOY ES EL DÍA! 🎉🇪🇸</p>
      <p className="text-app-text font-medium mt-1">Valencia te espera</p>
    </div>
  )

  return (
    <div className="mx-4 bg-app-elevated rounded-xl px-4 py-3 border border-app-purple/20">
      <div className="flex items-center justify-between">
        <p className="text-app-text font-semibold text-sm">
          <span className="text-app-purple-light text-lg font-bold">{days}</span>
          {' '}días para Valencia 🇪🇸
        </p>
        <span className="text-xl">✈️</span>
      </div>
    </div>
  )
}
