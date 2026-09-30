// Semana de descarga: activación 100% manual (Configuración). Ya no reduce peso/series
// automáticamente en ningún lado — ver LOGICA_TECNICA.md. isActive solo se usa para mostrar la
// línea de referencia en ExerciseCard (FuerzaFlow.jsx) y avisos en Cardio/Clase/Tabata.
export function useDeload(settings, workouts) {
  const isActive = settings?.deloadActive ?? false

  const shouldSuggestDeload = () => {
    if (!workouts || workouts.length < 4) return false
    const last8Weeks = workouts.slice(0, 40)
    const fatigues = last8Weeks.map(w => w.fatigue ?? 5).filter(Boolean)
    if (fatigues.length < 8) return false
    const avg = fatigues.reduce((a, b) => a + b, 0) / fatigues.length
    return avg >= 7
  }

  return { isActive, shouldSuggestDeload }
}
