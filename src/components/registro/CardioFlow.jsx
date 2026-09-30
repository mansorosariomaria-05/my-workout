import { toSeconds, computePace, formatPace, computeSpeedKmh } from '../../utils/cardio'

const ACTIVITIES = ['Running', 'Caminata', 'Rollers', 'Trekking', 'Bici', 'Tenis']

// Minutos/segundos: 0-59, vacío se mantiene vacío.
const clampMinSec = (val) => {
  if (val === '') return ''
  return String(Math.max(0, Math.min(59, Math.floor(Number(val) || 0))))
}

export default function CardioFlow({ data, onChange }) {
  const { activity, horas, minutos, segundos, distancia, fatigue, otra } = data

  const set = (field, val) => onChange({ ...data, [field]: val })
  const selectContent = (e) => e.target.select()

  const durationSeconds = toSeconds(horas, minutos, segundos)
  const km = Number(distancia) || 0
  const isBici = activity === 'Bici'
  const hasComputedValue = durationSeconds > 0 && km > 0
  const computedValue = isBici
    ? (hasComputedValue ? `${computeSpeedKmh(durationSeconds, km)} km/h` : '—')
    : formatPace(computePace(durationSeconds, km))

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <p className="text-app-muted text-xs mb-2">Actividad</p>
        <div className="grid grid-cols-3 gap-2">
          {ACTIVITIES.map(a => (
            <button
              key={a}
              onClick={() => set('activity', a)}
              className={`py-2.5 rounded-xl text-sm border transition-all ${
                activity === a
                  ? 'bg-app-green border-app-green text-white font-medium'
                  : 'bg-app-bg border-white/10 text-app-muted'
              }`}
            >
              {a}
            </button>
          ))}
          <button
            onClick={() => set('activity', 'otra')}
            className={`py-2.5 rounded-xl text-sm border col-span-3 transition-all ${
              activity === 'otra'
                ? 'bg-app-green border-app-green text-white'
                : 'bg-app-bg border-white/10 text-app-muted'
            }`}
          >
            Otra actividad
          </button>
        </div>
        {activity === 'otra' && (
          <input
            value={otra ?? ''}
            onChange={e => set('otra', e.target.value)}
            placeholder="¿Cuál?"
            className="mt-2 w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2.5 text-app-text text-sm placeholder-app-muted/40 focus:outline-none focus:border-app-green/60"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-app-muted text-xs mb-1.5 block">Tiempo</label>
          <div className="flex items-center gap-1">
            <input
              type="number" inputMode="numeric" min="0"
              value={horas ?? ''}
              onChange={e => set('horas', e.target.value)}
              onFocus={selectContent}
              placeholder="h"
              className="w-full min-w-0 bg-app-bg border border-white/10 rounded-xl px-1 py-2.5 text-app-text text-sm text-center focus:outline-none focus:border-app-green/60"
            />
            <span className="text-app-muted text-sm">:</span>
            <input
              type="number" inputMode="numeric" min="0" max="59"
              value={minutos ?? ''}
              onChange={e => set('minutos', clampMinSec(e.target.value))}
              onFocus={selectContent}
              placeholder="min"
              className="w-full min-w-0 bg-app-bg border border-white/10 rounded-xl px-1 py-2.5 text-app-text text-sm text-center focus:outline-none focus:border-app-green/60"
            />
            <span className="text-app-muted text-sm">:</span>
            <input
              type="number" inputMode="numeric" min="0" max="59"
              value={segundos ?? ''}
              onChange={e => set('segundos', clampMinSec(e.target.value))}
              onFocus={selectContent}
              placeholder="s"
              className="w-full min-w-0 bg-app-bg border border-white/10 rounded-xl px-1 py-2.5 text-app-text text-sm text-center focus:outline-none focus:border-app-green/60"
            />
          </div>
        </div>
        <div>
          <label className="text-app-muted text-xs mb-1.5 block">Distancia (km)</label>
          <input
            type="number"
            step="0.1"
            value={distancia ?? ''}
            onChange={e => set('distancia', e.target.value)}
            placeholder="5"
            className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2.5 text-app-text text-sm text-center focus:outline-none focus:border-app-green/60"
          />
        </div>
      </div>

      <div>
        <label className="text-app-muted text-xs mb-1.5 block">{isBici ? 'Velocidad promedio' : 'Ritmo promedio'}</label>
        <div className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2.5 text-app-text text-sm">
          {computedValue}
        </div>
      </div>

    </div>
  )
}
