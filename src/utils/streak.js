// Tipos de workout y umbral de la "Racha semanal 3+". La métrica en sí (cantidad total de semanas con 3+ días)
// vive en progressStats.js (computeWeeklyStreak3Plus), junto con el resumen del mes de su dorso.

// Únicos tipos de workout que cuentan como "entrenamiento real" para racha, logros y estadísticas.
export const REAL_WORKOUT_TYPES = ['fuerza', 'cardio', 'clase', 'tabata']

// Cantidad mínima de días distintos de entrenamiento real para que una semana cuente en la "Racha semanal 3+".
export const STREAK_MIN_DAYS = 3
