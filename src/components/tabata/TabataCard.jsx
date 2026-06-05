import { calcTabataTime } from '../../data/tabatas'
import Card from '../ui/Card'

export default function TabataCard({ tabata, customSettings, onClick }) {
  const settings = { ...tabata.defaults, ...customSettings, stationCount: tabata.stations.length }
  const totalTime = calcTabataTime(settings)
  const equipment = [...new Set(tabata.stations.flatMap(s => s.equip.split('/').map(e => e.trim())))]

  return (
    <Card onClick={onClick} className="mb-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-app-text font-semibold text-sm">{tabata.name}</p>
          <p className="text-app-muted text-xs mt-0.5">{tabata.stations.length} estaciones · {totalTime} min</p>
        </div>
        <div className="bg-app-amber/20 text-app-amber text-xs px-2 py-0.5 rounded-full font-medium">
          Tabata
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {tabata.stations.map((s, i) => (
          <span key={i} className="text-app-muted text-[10px] bg-app-bg px-2 py-0.5 rounded-full">
            {s.name}
          </span>
        ))}
      </div>
    </Card>
  )
}
