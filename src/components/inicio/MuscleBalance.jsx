import Card from '../ui/Card'

const TYPE_LABELS = { fuerza: 'Fuerza', cardio: 'Cardio', clase: 'Clase', tabata: 'Tabata' }

export default function MuscleBalance({ workouts }) {
  if (!workouts.length) return (
    <Card className="mx-4">
      <p className="text-app-muted text-xs mb-1">Último entrenamiento</p>
      <p className="text-app-muted/60 text-sm">Aún no hay entrenamientos registrados</p>
    </Card>
  )

  const last = workouts[0]
  const muscles = new Set()
  last.muscleGroups?.forEach(m => muscles.add(m))
  last.exercises?.forEach(e => e.muscle && muscles.add(e.muscle))
  const muscleList = [...muscles]

  const typeLabel = TYPE_LABELS[last.type] ?? last.type ?? 'Entrenamiento'
  const muscleText = muscleList.length
    ? muscleList.join(' · ')
    : null

  return (
    <Card className="mx-4">
      <p className="text-app-muted text-xs mb-2">Último entrenamiento</p>
      <p className="text-app-text text-sm font-medium">
        {typeLabel}{muscleText ? <span className="text-app-muted font-normal"> · {muscleText}</span> : null}
      </p>
      {muscleList.length > 0 && (
        <p className="text-app-muted/60 text-xs mt-1.5">Descansá estos músculos hoy 💤</p>
      )}
    </Card>
  )
}
