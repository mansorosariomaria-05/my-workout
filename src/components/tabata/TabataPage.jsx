import { useState, useEffect } from 'react'
import { builtinTabatas } from '../../data/tabatas'
import { useAuthContext } from '../../context/AuthContext'
import { getTabataSettings } from '../../services/db'
import TabataCard from './TabataCard'
import TabataDetail from './TabataDetail'

export default function TabataPage() {
  const { user, settings } = useAuthContext()
  const [selected, setSelected] = useState(null)
  const [customSettings, setCustomSettings] = useState({})

  useEffect(() => {
    if (!user) return
    const loadAll = async () => {
      const map = {}
      for (const t of builtinTabatas) {
        const s = await getTabataSettings(user.uid, t.id)
        if (s) map[t.id] = s
      }
      setCustomSettings(map)
    }
    loadAll()
  }, [user])

  if (selected) return (
    <div className="min-h-screen bg-app-bg px-4 py-5">
      <TabataDetail
        tabata={selected}
        onBack={() => setSelected(null)}
        deloadActive={settings?.deloadActive}
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-app-text text-xl font-bold mb-1">Tabata</h1>
        <p className="text-app-muted text-sm mb-4">{builtinTabatas.length} rutinas disponibles</p>
      </div>
      <div className="px-4">
        {builtinTabatas.map(t => (
          <TabataCard
            key={t.id}
            tabata={t}
            customSettings={customSettings[t.id]}
            onClick={() => setSelected(t)}
          />
        ))}
      </div>
    </div>
  )
}
