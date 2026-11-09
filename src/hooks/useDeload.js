// Semana de descarga: activación 100% manual (Configuración). Ya no reduce peso/series
// automáticamente en ningún lado — ver LOGICA_TECNICA.md. isActive solo se usa para mostrar la
// línea de referencia en ExerciseCard (FuerzaFlow.jsx) y avisos en Cardio/Clase/Tabata.
import { getFatigueStatus } from '../utils/progressStats'

export function useDeload(settings, workouts) {
  const isActive = settings?.deloadActive ?? false

  // Misma regla que Configuración y que el dato clave de Progreso (progressStats.getFatigueStatus)
  const shouldSuggestDeload = () => getFatigueStatus(workouts).high

  return { isActive, shouldSuggestDeload }
}
