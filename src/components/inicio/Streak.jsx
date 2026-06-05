import Card from '../ui/Card'
import { dateToLocal, getWeekStartLocal } from '../../utils/dates'

export default function Streak({ workouts }) {
  const mondayStr = getWeekStartLocal()

  const daysThisWeek = new Set(
    workouts
      .filter(w => w.date >= mondayStr)
      .map(w => w.date)
  ).size

  const sortedWeeks = {}
  workouts.forEach(w => {
    const [yr, mo, dy] = w.date.split('-').map(Number)
    const d = new Date(yr, mo - 1, dy)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const mon = new Date(d)
    mon.setDate(d.getDate() + diff)
    const key = dateToLocal(mon)
    sortedWeeks[key] = (sortedWeeks[key] ?? 0) + 1
  })

  const qualifyingWeeks = Object.entries(sortedWeeks)
    .filter(([, c]) => c >= 3)
    .map(([k]) => k)
    .sort()
    .reverse()

  let streak = 0, prev = null
  for (const week of qualifyingWeeks) {
    if (prev === null) { streak = 1 }
    else {
      const diff = Math.round((new Date(prev) - new Date(week)) / (7 * 86400000))
      streak = diff === 1 ? streak + 1 : 1
    }
    prev = week
  }
  const currentStreak = streak > 0 ? streak : 0

  const getMotivation = (days) => {
    if (days >= 5) return { text: 'Ideal ⭐', color: 'text-app-amber' }
    if (days === 4) return { text: 'Óptimo ✓', color: 'text-app-green-light' }
    if (days === 3) return { text: 'Aceptable ✓', color: 'text-blue-400' }
    return { text: 'Seguí adelante 💪', color: 'text-app-muted' }
  }

  const motivation = getMotivation(daysThisWeek)

  return (
    <Card className="mx-4">
      <div className="flex items-center">
        <div className="flex-1">
          <p className="text-5xl font-bold text-app-purple-light leading-none">{daysThisWeek}</p>
          <p className="text-app-muted text-[10px] mt-1">días esta semana</p>
          <p className={`text-xs mt-1.5 font-medium ${motivation.color}`}>{motivation.text}</p>
        </div>
        <div className="w-px bg-white/5 self-stretch mx-4" />
        <div className="text-center">
          <p className="text-3xl font-bold text-app-amber">{currentStreak}</p>
          <p className="text-app-muted text-xs mt-0.5">Racha</p>
          <p className="text-app-muted/50 text-[10px] mt-0.5">semanas</p>
        </div>
      </div>
    </Card>
  )
}
