import { useAuthContext } from '../../context/AuthContext'
import { useWorkouts } from '../../hooks/useWorkouts'
import WeekChart from './WeekChart'
import FatigueChart from './FatigueChart'
import ExerciseProgress from './ExerciseProgress'
import WorkoutHistorial from './WorkoutHistorial'
import MonthCalendar from './MonthCalendar'
import Card from '../ui/Card'

export default function ProgresoPage() {
  const { user, profile } = useAuthContext()
  const { workouts, loading } = useWorkouts(user?.uid)

  if (loading) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <p className="text-app-muted text-sm animate-pulse-slow">Cargando...</p>
    </div>
  )

  const totalWorkouts = workouts.length
  const fuerzaCount = workouts.filter(w => w.type === 'fuerza').length
  const cardioCount = workouts.filter(w => w.type === 'cardio').length
  const claseCount  = workouts.filter(w => w.type === 'clase').length

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-app-text text-xl font-bold mb-4">Progreso</h1>
      </div>

      <div className="px-4 space-y-4">
        <Card>
          <p className="text-app-muted text-xs mb-3">Resumen total</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Total', value: totalWorkouts, color: 'text-app-purple-light' },
              { label: 'Fuerza', value: fuerzaCount, color: 'text-app-purple-light' },
              { label: 'Cardio', value: cardioCount, color: 'text-app-green-light' },
              { label: 'Clases', value: claseCount, color: 'text-app-blue-light' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className={`font-bold text-xl ${color}`}>{value}</p>
                <p className="text-app-muted text-[10px]">{label}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <MonthCalendar workouts={workouts} />
        </Card>

        <Card>
          <WeekChart workouts={workouts} />
        </Card>

        <Card>
          <FatigueChart workouts={workouts} />
        </Card>

        <Card>
          <ExerciseProgress workouts={workouts} profile={profile} />
        </Card>

        <Card>
          <p className="text-app-muted text-xs mb-3">Historial</p>
          <WorkoutHistorial workouts={workouts} />
        </Card>
      </div>
    </div>
  )
}
