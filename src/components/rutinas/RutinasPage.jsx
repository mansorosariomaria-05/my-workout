import { useState } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkouts } from '../../hooks/useWorkouts'
import PreArmadasTab from './PreArmadasTab'
import BibliotecaTab from './BibliotecaTab'
import GeneradorTab from './GeneradorTab'

const TABS = [
  { id: 'prearmadas', label: 'Pre-armadas' },
  { id: 'biblioteca', label: 'Biblioteca' },
  { id: 'generador',  label: 'Generador' },
]

export default function RutinasPage() {
  const { user } = useAuthContext()
  const { workouts } = useWorkouts(user?.uid)
  const [tab, setTab] = useState('prearmadas')

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-app-text text-xl font-bold mb-4">Rutinas</h1>
        <div className="flex bg-app-surface rounded-xl p-1 gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.id ? 'bg-app-purple text-white' : 'text-app-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 animate-fadeIn">
        {tab === 'prearmadas' && <PreArmadasTab workouts={workouts} />}
        {tab === 'biblioteca' && <BibliotecaTab workouts={workouts} />}
        {tab === 'generador'  && <GeneradorTab workouts={workouts} />}
      </div>
    </div>
  )
}
