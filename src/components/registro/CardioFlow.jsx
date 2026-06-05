import { useState } from 'react'

const ACTIVITIES = ['Running', 'Caminata', 'Rollers', 'Trekking', 'Bici', 'Tenis']

export default function CardioFlow({ data, onChange }) {
  const { activity, tiempo, distancia, ritmo, fatigue, otra } = data

  const set = (field, val) => onChange({ ...data, [field]: val })

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
          <label className="text-app-muted text-xs mb-1.5 block">Tiempo (min)</label>
          <input
            type="number"
            value={tiempo ?? ''}
            onChange={e => set('tiempo', e.target.value)}
            placeholder="45"
            className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2.5 text-app-text text-sm text-center focus:outline-none focus:border-app-green/60"
          />
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

      {(activity === 'Running') && (
        <div>
          <label className="text-app-muted text-xs mb-1.5 block">Ritmo promedio (min/km)</label>
          <input
            value={ritmo ?? ''}
            onChange={e => set('ritmo', e.target.value)}
            placeholder="5:30"
            className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2.5 text-app-text text-sm focus:outline-none focus:border-app-green/60"
          />
        </div>
      )}

    </div>
  )
}
