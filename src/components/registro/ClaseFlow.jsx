import { useState } from 'react'

const CLASES = ['Strong', 'HIIT', 'Funcional', 'Hyrox', 'Crossfit']

export default function ClaseFlow({ data, onChange, deloadActive }) {
  const { clase, duracion, fatigue, otra } = data
  const set = (field, val) => onChange({ ...data, [field]: val })

  const isHighIntensity = ['HIIT', 'Hyrox', 'Crossfit'].includes(clase)

  return (
    <div className="space-y-5 animate-fadeIn">
      {deloadActive && isHighIntensity && (
        <div className="bg-app-amber/10 border border-app-amber/30 rounded-xl px-4 py-3 text-app-amber text-sm">
          🔄 Estás en semana de descarga. ¿Querés continuar con alta intensidad?
        </div>
      )}

      <div>
        <p className="text-app-muted text-xs mb-2">Tipo de clase</p>
        <div className="grid grid-cols-2 gap-2">
          {CLASES.map(c => (
            <button
              key={c}
              onClick={() => set('clase', c)}
              className={`py-2.5 rounded-xl text-sm border transition-all ${
                clase === c
                  ? 'bg-app-blue-light border-app-blue-light text-white font-medium'
                  : 'bg-app-bg border-white/10 text-app-muted'
              }`}
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => set('clase', 'otra')}
            className={`py-2.5 rounded-xl text-sm border col-span-2 transition-all ${
              clase === 'otra'
                ? 'bg-app-blue-light border-app-blue-light text-white'
                : 'bg-app-bg border-white/10 text-app-muted'
            }`}
          >
            Otra clase
          </button>
        </div>
        {clase === 'otra' && (
          <input
            value={otra ?? ''}
            onChange={e => set('otra', e.target.value)}
            placeholder="¿Cuál?"
            className="mt-2 w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2.5 text-app-text text-sm placeholder-app-muted/40 focus:outline-none"
          />
        )}
      </div>

      <div>
        <label className="text-app-muted text-xs mb-1.5 block">Duración (min)</label>
        <input
          type="number"
          value={duracion ?? 60}
          onChange={e => set('duracion', Number(e.target.value))}
          className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2.5 text-app-text text-sm text-center focus:outline-none focus:border-app-blue-light/60"
        />
      </div>

    </div>
  )
}
