import { useState, useEffect } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import { getTabataSettings, saveTabataSettings } from '../../services/db'
import { calcTabataTime } from '../../data/tabatas'

export default function TabataDetail({ tabata, onBack, deloadActive }) {
  const { user } = useAuthContext()
  const [params, setParams] = useState(tabata.defaults)
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    getTabataSettings(user.uid, tabata.id).then(s => {
      if (s) setParams(p => ({ ...p, ...s }))
    })
  }, [user, tabata.id])

  const setParam = (field, val) => setParams(p => ({ ...p, [field]: Number(val) }))

  const handleSaveSettings = async () => {
    await saveTabataSettings(user.uid, tabata.id, params)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  const totalTime = calcTabataTime({ ...params, stationCount: tabata.stations.length })
  const equipment = [...new Set(tabata.stations.flatMap(s => s.equip.split('/').map(e => e.trim())))]

  return (
    <div className="animate-fadeIn pb-6">
      <button onClick={onBack} className="flex items-center gap-2 text-app-muted mb-4">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm">Tabatas</span>
      </button>

      <div className="flex items-center justify-between mb-1">
        <h2 className="text-app-text font-bold text-lg">{tabata.name}</h2>
        <span className="text-app-muted text-sm">~{totalTime} min</span>
      </div>
      {tabata.description && (
        <p className="text-app-muted text-xs mb-4 leading-relaxed">{tabata.description}</p>
      )}

      {deloadActive && (
        <div className="bg-app-amber/10 border border-app-amber/30 rounded-xl px-4 py-3 mb-4 text-app-amber text-sm">
          🔄 Estás en semana de descarga. Alta intensidad — ¿querés continuar?
        </div>
      )}

      {/* Stations */}
      <div className="bg-app-surface rounded-xl mb-4">
        <p className="text-app-muted text-xs px-4 pt-3 pb-2">
          Estaciones ({tabata.stations.length})
        </p>
        {tabata.stations.map((s, i) => (
          <div key={i} className="px-4 py-3 border-b border-white/5 last:border-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-app-text text-sm font-medium">{s.name}</p>
              <span className="text-[10px] bg-app-bg text-app-muted px-2 py-0.5 rounded-full border border-white/8 shrink-0">
                {s.equip}
              </span>
            </div>
            <p className="text-app-muted text-xs mt-0.5">{s.muscle}</p>
            {s.alt && <p className="text-app-muted/50 text-xs mt-0.5">Alt: {s.alt}</p>}
          </div>
        ))}
      </div>

      {/* Reference times */}
      <div className="bg-app-surface rounded-xl p-4 mb-4">
        <p className="text-app-muted text-xs mb-3">Tiempos de referencia</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'prep',    label: 'Preparación (s)' },
            { key: 'work',    label: 'Trabajo (s)' },
            { key: 'rest',    label: 'Descanso (s)' },
            { key: 'sets',    label: 'Sets' },
            { key: 'setRest', label: 'Desc. entre sets (s)' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-app-muted text-[10px] mb-1 block">{label}</label>
              <input
                type="number"
                value={params[key] ?? tabata.defaults[key]}
                onChange={e => setParam(key, e.target.value)}
                className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm text-center focus:outline-none"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
          <p className="text-app-text text-sm font-medium">Total: ~{totalTime} min</p>
          <button
            onClick={handleSaveSettings}
            className="text-app-purple-light text-xs px-3 py-1.5 rounded-lg bg-app-purple/20"
          >
            {settingsSaved ? '✓ Guardado' : 'Guardar tiempos'}
          </button>
        </div>
      </div>

      {/* Equipment */}
      <div className="bg-app-surface rounded-xl p-4">
        <p className="text-app-muted text-xs mb-2">Necesitás</p>
        <div className="flex flex-wrap gap-2">
          {equipment.map((e, i) => (
            <span key={i} className="text-xs bg-app-bg text-app-muted px-2.5 py-1 rounded-full border border-white/8">
              {e}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
