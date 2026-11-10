# Lógica Técnica — My Workout

Documentación técnica permanente para que cualquier instancia de Claude pueda entender las lógicas complejas, decisiones de producto y comportamiento esperado sin necesidad de preguntas adicionales. Complementa a `CONTEXTO.md` y tiene la misma prioridad: **debe mantenerse actualizado** cada vez que se toca alguna de las lógicas documentadas acá.

---

## 1. RACHA SEMANAL 3+ (`computeWeeklyStreak3Plus()`)

> **Historial.** Hasta septiembre 2026 la racha tenía 4 estados (`active`/`frozen`/`paused`/`broken`) acoplados a las pausas (sección 2); se reemplazó por una regla sin estados (semanas de 1-2 días neutras, reinicio tras 4 semanas vacías). En noviembre 2026 pasó primero a una "racha estricta" de semanas consecutivas y, el mismo mes, a la métrica actual: **"Racha semanal 3+"**, un total acumulado. **La racha de semanas consecutivas se eliminó** (ver "Eliminación de la racha consecutiva").

### Definición

- **Valor** = cantidad **TOTAL** de semanas (lunes a domingo) de **todo el historial** con **3 o más días distintos** de entrenamiento real.
- **No requiere semanas consecutivas** y **nunca baja**: un parate largo, o una semana floja, no la reinicia ni le resta; solo puede subir.
- **La semana en curso suma apenas alcanza 3 días** (no hace falta esperar al domingo). Con menos de 3 todavía no suma.
- Solo cuentan los tipos reales (`REAL_WORKOUT_TYPES = ['fuerza', 'cardio', 'clase', 'tabata']`, `utils/streak.js`); `pausa` y `descanso` no. Un día cuenta una vez aunque haya varios entrenamientos. Las fechas posteriores a hoy se ignoran. El umbral de 3 días es `STREAK_MIN_DAYS` (`utils/streak.js`), fijo e independiente del objetivo semanal del perfil (`profile.diasSemana`, sección 26).
- Semana = lunes a domingo, con fechas `YYYY-MM-DD` (`utils/weeks.js`, sin `Date`/UTC; ver sección 5).

### Código y consumidores

`src/utils/progressStats.js` → `computeWeeklyStreak3Plus(workouts, today)` devuelve `{ total, minDays, currentWeekStart, currentWeekDays, currentWeekCounts }`. El cálculo es: agrupar los días distintos de workouts reales por lunes y contar los lunes con `días ≥ 3`.

- [useWorkouts.js](src/hooks/useWorkouts.js): `getWeeklyStreak3Plus()` y `getMonthSummary()` (memoizados con `useMemo` por `workouts` y por día). Son la **misma fuente** para Inicio y Progreso.
- [WeeklyStreakCard.jsx](src/components/progreso/WeeklyStreakCard.jsx): la tarjeta (con `FlipCard`) que se usa **tal cual** en Inicio (`StatsCards`) y en Progreso (bloque "Tu camino").
- Progreso: se eliminó la tarjeta de racha duplicada de "Tus victorias" (quedan "mejor marca" y la de fatiga).

### La tarjeta

- **Frente**: título **"Racha semanal 3+"** (solo en Progreso: en Inicio se oculta con `showTitle={false}` porque el texto de abajo ya dice lo mismo), `🔥 {total}` y el texto **"semanas con 3+ días"**.
- **Dorso** (se toca para darla vuelta; `FlipCard.jsx`, con `aria-pressed`/`aria-label` y respeto por `prefers-reduced-motion`): arriba, chico, **"Este mes"**; luego **"X,X días por semana"**; una barra segmentada y los tres porcentajes de **fuerza, cardio y clase**, cada uno con su color de `TYPE_COLORS` (`utils/workoutTypes.js`: fuerza `#9B7FD4`, cardio `#4ade80`, clase `#60a5fa`, otros `#94A3B8`). Sin entrenamientos en el mes: **"Todavía no entrenaste este mes"**. Reemplaza al dorso anterior (las últimas 12 semanas).
- Altura fija de 108 px (la de la tarjeta de días de al lado).

### Dorso: resumen del mes (`computeMonthSummary(workouts, today)`)

Mes calendario en curso, del día 1 hasta hoy, solo workouts reales:

- **Días por semana** = `días distintos entrenados en el mes / (días transcurridos del mes / 7)`, redondeado a **1 decimal**. "Días transcurridos" = el día del mes de hoy (hoy cuenta). Se muestra con coma (`formatDaysPerWeek`: 3,5 · 4,0). Ejemplos: el día 1 con un entrenamiento → 7,0; el día 15 con 5 días distintos → 2,3; el día 30 con 12 días distintos → 2,8.
- **Porcentajes** de fuerza, cardio y clase = `entrenamientos del tipo / entrenamientos reales del mes × 100` (se cuentan **workouts**, no días), repartidos con el **método del resto mayor** para que los enteros sumen **exactamente 100** (desempate: mayor resto, luego mayor cantidad, luego el orden fuerza → cardio → clase → otros). **"Otros"** (por ejemplo tabata) aparece **solo si existen** y entra en el reparto.
- **Mes vacío** → `{ empty: true, ... }` (valores `null`).

### Eliminación de la racha consecutiva

Se eliminaron `computeStreak()` (racha estricta de semanas consecutivas, con récord y fechas), `computeStreakStats()` (los buckets de las últimas 12 semanas del dorso anterior) y `getCurrentStreak()`; ya no existe el concepto de "récord de racha" en Inicio ni en Progreso.

**Logros que dependían de esa función** (no cambió su lógica): `rachaFuego` ("4 semanas seguidas con 3+ días") y `rachaElite` ("12 semanas seguidas con 3+ días") leían `computeStreak(workouts).record`. Ahora leen `computeMaxStreak(workouts, 3)`, un helper que ya existía en `achievements.js` (usado por otros logros): la mayor cantidad de **semanas seguidas** con 3+ días. Es el **mismo resultado** que el récord de la función anterior (verificado con 3000 historiales al azar). Los demás logros de racha (`semanaActiva`, `dosSemanas`, `piernasAcero`, `balancePerfecto`, `semanaPerfecta`, `hamburguesaMerecida`) y la medalla `w_racha_viva` ya eran independientes de la función eliminada.

### Casos de ejemplo (verificados en `progressStats.test.js`)

| Escenario | `total` |
|---|---|
| Semanas con 3, 4, 2, 3, 5, 1 y 3 días separadas por parates largos | 5 (cuentan las de 3, 4, 3, 5 y 3) |
| Lo mismo, un año después sin entrenar | 5 (nunca baja) |
| Semana en curso con 2 días | No suma (`currentWeekCounts: false`) |
| Semana en curso con 3 días | Suma (+1) |
| Tres entrenamientos el mismo día | Cuentan como 1 día |
| `pausa` / `descanso` / fechas futuras | No cuentan |

---

## 2. SISTEMA DE PAUSA — ELIMINADO (septiembre 2026)

> **Estado: eliminado del código.** El sistema de pausas (registro, formulario, calendarios con tratamiento visual especial, pantalla de `WorkoutSummary`) fue removido por completo de la app. **Los documentos viejos `type: 'pausa'` y `type: 'descanso'` que ya existen en Firestore NO se borraron** — la app simplemente los ignora en todos lados, vía la constante compartida `REAL_WORKOUT_TYPES` (sección 1, `src/utils/streak.js`). La estructura exacta de esos documentos viejos queda documentada en la sección 7 (Estructura de datos Firebase), por si aparecen en el historial de un usuario.

### Qué existía y ya no existe

- **Registro**: `WorkoutWizard.jsx` ya no ofrece "Semana de pausa" como tipo de registro. Se eliminaron `PausaFlow`, `handleSavePausa`, el selector de motivos (🤒 enfermedad / 🤕 lesión / 🧘 descanso) y el componente `InlineRangePicker` (calendario inline con `date-fns` que solo usaba `PausaFlow` — no tenía otros consumidores, se eliminó entero).
- **Calendarios**: `WeekCalendar.jsx` y el `WeekRow` de `ProgresoPage.jsx` ya no tienen las 3 pasadas de prioridad (real > descanso > pausa) ni la expansión de rango `pausaInicio`–`pausaFin`. Ahora solo pintan días con `REAL_WORKOUT_TYPES.includes(w.type)` — un día sin entrenamiento real queda vacío, sin importar si hay un documento `pausa`/`descanso` viejo en esa fecha. `MonthCalendar.jsx` (Progreso, calendario mensual) tenía el mismo problema; ese componente ya no existe (se eliminó en noviembre 2026 por no tener ninguna referencia — no estaba montado en ninguna pantalla). El historial mensual vive en `WorkoutHistorial.jsx`, que filtra `byDate` por `REAL_WORKOUT_TYPES`.
- **`WorkoutSummary.jsx`**: se eliminó la rama `if (workout.type === 'pausa')` y su pantalla alternativa (🧊/⏸, "Que te mejores pronto. Tu racha está a salvo.") — ya no puede crearse un workout de tipo pausa, así que esa rama era inalcanzable.
- **`ProgresoPage.jsx`**: se eliminaron `pausaThisWeek`, `pausaMotivo` y la lógica condicional de `semanaAsideText`/`semanaAsideColor` ("Descansá · La próxima semana volvés 💙" / "Semana de descanso · Volvés más fuerte"). El aside de "Esta semana" ahora siempre muestra el texto normal (`{thisDays} de {diasSemana} días · {semanaMsg}`).
- **`ConfigPage.jsx`**: se eliminó el selector de UI "¿Volvés después de una pausa?" (`profile.pausa`, `PAUSA_OPTIONS`) — el campo no se usaba en ningún cálculo (confirmado por búsqueda). **El campo `pausa` no se borra de los documentos de perfil ya existentes en Firestore**, solo se removió la UI. *(Actualización noviembre 2026: verificado por búsqueda — `Onboarding.jsx` tampoco pregunta ni guarda `profile.pausa`; el campo solo puede existir en perfiles viejos de Firestore, sin ninguna lectura en el código.)*

### Bugs corregidos de paso (contaban pausa/descanso como entrenamiento real)

Varios filtros a lo largo del código excluían `'descanso'` pero no `'pausa'` (o directamente no filtraban nada), heredados de cuando el sistema de pausa todavía existía. Todos se unificaron para usar `REAL_WORKOUT_TYPES`:

| Archivo | Función | Bug |
|---|---|---|
| `Inicio.jsx` | `computeWeeklyStats()` | Una pausa en la semana contaba como día entrenado en el resumen semanal (`WeeklySummaryModal`) |
| `Inicio.jsx` | `getDailySuggestion()` | Una pausa con fecha de hoy hacía que la función devolviera `{ type: 'trained_today' }`, suprimiendo la sugerencia diaria |
| `Inicio.jsx` | `getThisWeekCount()`, `LastAndSuggestion` (`real`), `FraseDiariaCard` (`trainedToday`) | Mismo patrón, ya corregidos preventivamente |
| `achievements.js` | `checkResiliencia()` | Una pausa "tapaba" un hueco real de 7+ días sin entrenar, impidiendo detectar el logro `resiliencia` |
| `achievements.js` | chequeos de `medioAnio` y `aniversario` | Si el documento más viejo era una pausa, la fecha de "primer entrenamiento" quedaba mal calculada |
| `achievements.js` | chequeo de `cienDias` | Una pausa contaba como uno de los "100 días únicos entrenados" |
| `achievements.js` | chequeo de `semanaPerfecta` | Una pausa contaba como día cumplido del objetivo semanal |
| `achievements.js` | `computeMaxStreak()`, chequeo de `dosSemanas` | Ya corregidos en el cambio anterior (sección 1) |
| `WorkoutHistorial.jsx` | `byDate` | Tenía su propio `REAL = Set([...])` local duplicado — reemplazado por el import compartido |

Ninguno de estos requirió tocar datos en Firestore — todos son filtros de lectura, así que el fix aplica retroactivamente a cualquier documento viejo apenas se despliega.

---

## 3. SISTEMA DE MEDALLAS SEMANALES (`Logros.jsx`)

### Pool completo de 12 medallas

```js
// src/components/inicio/Logros.jsx — MEDAL_POOL
const MEDAL_POOL = [
  { key: 'w_semana_completa',   label: 'Semana completa',      Icon: CalendarCheck, categoria: 'consistencia' },
  { key: 'w_sin_excusas',       label: 'Sin excusas',          Icon: Shield,        categoria: 'consistencia' },
  { key: 'w_arrancaste_fuerte', label: 'Arrancaste fuerte',    Icon: Zap,           categoria: 'consistencia' },
  { key: 'w_mas_fuerte',        label: 'Más fuerte',           Icon: Dumbbell,      categoria: 'progresion'  },
  { key: 'w_supero_pr',         label: 'Nuevo récord',         Icon: Trophy,        categoria: 'progresion'  },
  { key: 'w_volumen_alto',      label: 'Volumen alto',         Icon: BarChart2,     categoria: 'progresion'  },
  { key: 'w_semana_mixta',      label: 'Semana mixta',         Icon: Shuffle,       categoria: 'balance'     },
  { key: 'w_cuerpo_sabio',      label: 'Cuerpo sabio',         Icon: Heart,         categoria: 'balance'     },
  { key: 'w_bien_descansada',   label: 'Bien descansada',      Icon: Moon,          categoria: 'balance'     },
  { key: 'w_racha_viva',        label: 'Racha viva',           Icon: Flame,         categoria: 'libre'       },
  { key: 'w_hamburguesa',       label: 'Hamburguesa merecida', Icon: Award,         categoria: 'libre'       },
  { key: 'w_sabado',            label: 'Guerrera del sábado',  Icon: Star,          categoria: 'libre'       },
]
```

Criterio exacto de completado de cada una (del `switch` dentro de `computeWeeklyMedals`):

| key | categoría | criterio exacto |
|---|---|---|
| `w_semana_completa` | consistencia | `Set(fechas únicas de la semana).size >= diasObjetivo` (default 3, o `profile.diasSemana`) |
| `w_sin_excusas` | consistencia | algún workout de la semana cae en domingo (`getDay()===0`) o sábado (`getDay()===6`) |
| `w_arrancaste_fuerte` | consistencia | el workout más temprano de la semana (ordenado por fecha) cayó en lunes (1) o martes (2) |
| `w_mas_fuerte` | progresion | algún workout de fuerza de la semana tiene `detectPRs(w, historialAnteriorAEseWorkout).length > 0` |
| `w_supero_pr` | progresion | **idéntico** a `w_mas_fuerte` — mismo bloque `case` en el switch, misma lógica de `detectPRs()` |
| `w_volumen_alto` | progresion | algún workout de fuerza de la semana tiene `exercises.length >= 5` |
| `w_semana_mixta` | balance | hay ≥1 workout `fuerza` Y ≥1 workout `cardio` o `clase` en la semana |
| `w_cuerpo_sabio` | balance | promedio de `fatigue` (de los workouts con `fatigue != null`) de la semana `<= 5` |
| `w_bien_descansada` | balance | ≥2 sesiones de `fuerza` en la semana, con al menos 1 día de diferencia entre cada par consecutivo ordenado por fecha |
| `w_racha_viva` | libre | días únicos reales de la semana actual (`thisWeek`) `>= 3` — es decir, esta semana ya suma a la racha (sección 1) |
| `w_hamburguesa` | libre | días únicos entrenados en la semana `>= 4` |
| `w_sabado` | libre | algún workout de la semana cae en sábado (`getDay()===6`) |

### Algoritmo de selección de las 4 medallas semanales

```js
function computeWeeklyMedals(workouts, profile) {
  const mondayStr  = getWeekStartLocal()
  const thisWeek   = workouts.filter(w => w.date >= mondayStr && REAL_WORKOUT_TYPES.includes(w.type))

  const hasFuerzaHistory = workouts.some(w => w.type === 'fuerza' && w.date < mondayStr)
  const diasObjetivo     = profile?.diasSemana ?? 3
  const weekNum = Math.floor(new Date(mondayStr + 'T12:00:00').getTime() / (7 * 86400000))
  // weekNum: número de semana absoluto desde Epoch → rota la selección semana a semana

  // 1. Calcular completed:true/false para cada una de las 12 medallas (switch de arriba)
  const medalsWithState = MEDAL_POOL.map(m => { /* ... */ })

  // 2. Filtrar medallas imposibles según contexto (ver reglas de exclusión abajo)
  const filtered = medalsWithState.filter(m => {
    if (['w_mas_fuerte', 'w_supero_pr', 'w_volumen_alto'].includes(m.key) && !hasFuerzaHistory) return false
    if (m.key === 'w_hamburguesa' && diasObjetivo < 4) return false
    return true
  })

  // 3. Seleccionar 1 por categoría: ['consistencia', 'progresion', 'balance', 'libre']
  const categories = ['consistencia', 'progresion', 'balance', 'libre']
  const selected = []
  for (const cat of categories) {
    const candidates = filtered.filter(m => m.categoria === cat)
    if (!candidates.length) continue
    const pool = candidates.some(m => m.completed)
      ? candidates.filter(m => m.completed)   // si hay completadas en la categoría, priorizarlas
      : candidates                             // si ninguna completada, rotar entre todas
    selected.push(pool[weekNum % pool.length]) // rotación semanal determinista
  }

  // 4. Fallback: completar hasta 4 con cualquier medalla no seleccionada (misma lógica de prioridad)
  while (selected.length < 4) {
    const usedKeys  = new Set(selected.map(m => m.key))
    const remaining = filtered.filter(m => !usedKeys.has(m.key))
    if (!remaining.length) break
    const pool = remaining.some(m => m.completed) ? remaining.filter(m => m.completed) : remaining
    selected.push(pool[weekNum % pool.length])
  }

  return selected.slice(0, 4)
}
```

`REAL_WORKOUT_TYPES` se importa desde [streak.js](src/utils/streak.js) (`import { REAL_WORKOUT_TYPES } from '../../utils/streak'`) — es la misma constante que usa la "Racha semanal 3+" (`progressStats.js`), ya no hay una copia local `REAL_TYPES` redefinida dentro de `Logros.jsx`.

### Reglas de exclusión por contexto

- `w_mas_fuerte`, `w_supero_pr`, `w_volumen_alto`: excluidas si `!hasFuerzaHistory` (no hay ningún workout de fuerza **anterior** a esta semana — sin historial no hay nada contra qué comparar para un PR).
- `w_hamburguesa`: excluida si `diasObjetivo < 4` (el objetivo de días/semana del perfil es menor a 4 → nunca se podría cumplir el criterio de ≥4 días).
- `w_racha_viva` **ya no tiene ninguna regla de exclusión** — está siempre disponible en el pool, sin importar el estado de la racha (ver más abajo).

### Medalla `w_racha_viva`: significado nuevo

Desde que se eliminaron los estados de racha (sección 1), `w_racha_viva` pasó a significar simplemente **"esta semana ya suma a la racha"**:
- `completed = new Set(thisWeek.map(w => w.date)).size >= 3` — el mismo umbral de 3 días que usa la "Racha semanal 3+" (sección 1) para calificar una semana.
- **Ya no se excluye del pool en ningún caso** — antes desaparecía por completo si la racha estaba `frozen`/`paused`/`broken`; ahora siempre es una opción posible dentro de la categoría `libre`, completada o no según si la semana en curso ya llegó a 3 días.

### Cadena completa de datos

```
useWorkouts.js: getWeeklyStreak3Plus() → computeWeeklyStreak3Plus(workouts) → { total, ... }
    ↓
Inicio.jsx: const { total: weeklyStreak } = getWeeklyStreak3Plus()
    ↓
Inicio.jsx: <Logros workouts={workouts} compact />
    ↓
Logros.jsx: computeWeeklyMedals(workouts, profile)
            → dentro del switch: case 'w_racha_viva': completed = días reales de esta semana >= 3
```

**Nota importante**: `Logros.jsx` **no llama `getWeeklyStreak3Plus()` directamente** — calcula `w_racha_viva` de forma independiente, filtrando `workouts` por fecha ≥ lunes de esta semana (mismo criterio de semana que la "Racha semanal 3+" para la semana en curso, pero sin pasar por esa función). Ya no recibe ningún prop de racha desde `Inicio.jsx` — el componente `Logros` perdió por completo la prop `streakState`.

### El reset semanal es automático

No hay ningún cron ni proceso batch. Cada componente que renderiza calcula `getWeekStartLocal()` en tiempo real — cada lunes esa función devuelve una clave de semana (`mondayStr`) distinta, lo que automáticamente cambia `thisWeek` (el filtro de workouts) y `weekNum` (usado para la rotación determinista). El "reset" es simplemente una consecuencia de que la clave de semana cambió, no un evento explícito.

---

## 4. DETECCIÓN DE PRs Y MEJORAS (`src/utils/prUtils.js`)

### `detectPRs(workout, workoutsHistory)`

**Qué compara**: el peso máximo de la sesión actual vs. el **máximo histórico absoluto de todas las sesiones anteriores** para ese ejercicio.

```js
export function detectPRs(workout, workoutsHistory) {
  if (!workout.exercises?.length) return []
  const prs = []
  for (const ex of workout.exercises) {
    if (!ex.exerciseId || !ex.sets?.length) continue
    const maxThisSession = Math.max(0, ...ex.sets.map(s => Number(s.weight) || 0))
    if (!maxThisSession) continue  // 0kg → ignorar
    const prevMax = workoutsHistory
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === ex.exerciseId))
      .flatMap(w => w.exercises.filter(e => e.exerciseId === ex.exerciseId))
      .flatMap(e => e.sets || [])
      .reduce((max, s) => Math.max(max, Number(s.weight) || 0), 0)
    if (maxThisSession > prevMax && prevMax > 0) {
      // prevMax > 0: solo cuenta como PR si hubo historial previo (no el primer registro del ejercicio)
      prs.push({ name: ex.name, weight: maxThisSession })
    }
  }
  return prs
}
```

**Retorna**: `[{ name: string, weight: number }]` — uno por ejercicio con nuevo récord absoluto. **Aplica** cuando `maxThisSession > prevMax` y `prevMax > 0` (es decir, ya existía al menos un registro previo de ese ejercicio con peso > 0; si es la primera vez que se hace el ejercicio, no cuenta como PR).

### `detectImprovements(workout, workoutsHistory)`

**Qué compara**: peso máximo / reps de la sesión actual vs. la **sesión inmediatamente anterior** de ese mismo ejercicio (no el máximo histórico). Desde noviembre 2026 las mejoras de tipo `'reps'` incluyen `unit` (`'reps'` | `'secs'`, ver sección 24) para que el resumen diga "seg" en los ejercicios por tiempo.

```js
export function detectImprovements(workout, workoutsHistory) {
  if (!workout.exercises?.length) return []
  const improvements = []
  for (const ex of workout.exercises) {
    if (!ex.exerciseId || !ex.sets?.length) continue
    const lastSession = workoutsHistory
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === ex.exerciseId))
      [0]  // ← [0] = sesión más reciente (workoutsHistory viene ordenado desc por fecha)
    if (!lastSession) continue  // primer registro → sin mejora que reportar
    const lastSets = lastSession.exercises.find(e => e.exerciseId === ex.exerciseId)?.sets || []
    if (!lastSets.length) continue

    const maxWeightNow  = Math.max(0, ...ex.sets.map(s => Number(s.weight) || 0))
    const maxWeightLast = Math.max(0, ...lastSets.map(s => Number(s.weight) || 0))
    // Comparar reps SOLO al mismo peso máximo de la sesión anterior
    const maxRepsNowAtSameWeight  = Math.max(0, ...ex.sets.filter(s => Number(s.weight) === maxWeightLast).map(s => Number(s.reps) || 0))
    const maxRepsLastAtSameWeight = Math.max(0, ...lastSets.filter(s => Number(s.weight) === maxWeightLast).map(s => Number(s.reps) || 0))

    if (maxWeightNow > maxWeightLast) {
      improvements.push({ name: ex.name, type: 'weight', deltaW: maxWeightNow - maxWeightLast, weight: maxWeightNow })
    } else if (maxWeightNow === maxWeightLast && maxRepsNowAtSameWeight > maxRepsLastAtSameWeight) {
      improvements.push({ name: ex.name, type: 'reps', deltaR: maxRepsNowAtSameWeight - maxRepsLastAtSameWeight, reps: maxRepsNowAtSameWeight })
    }
  }
  return improvements
}
```

**Retorna**:
- Mejora de peso: `{ name, type: 'weight', deltaW: number, weight: number }`
- Mejora de reps (al mismo peso máximo que la sesión anterior): `{ name, type: 'reps', deltaR: number, reps: number }`

**Aplica** cuando existe una sesión anterior (`lastSession`) del mismo ejercicio, y el peso máximo actual es mayor, o es igual pero con más reps al mismo peso.

### Diferencia clave entre ambas

| | `detectPRs` | `detectImprovements` |
|--|-------------|----------------------|
| Compara contra | Máximo histórico absoluto (todas las sesiones) | Solo la sesión inmediatamente anterior |
| Umbral | `prevMax > 0` (necesita al menos 1 registro previo) | `lastSession` existe |
| Semántica | Récord absoluto — celebración mayor | Progreso incremental — motivación sesión a sesión |
| Puede haber mejora sin ser PR | No aplica (es la definición de PR) | Sí — mejorar vs. la sesión pasada sin superar el máximo histórico |

### Dónde se consumen

- **`WorkoutSummary.jsx`**: usa **ambas**. `prs = detectPRs(workout, workouts)` y `improvements = detectImprovements(workout, workouts)`.
- **`ProgresoPage.jsx`** (bloque "Últimas Sesiones"): usa únicamente `detectPRs`.
- **`Logros.jsx`**: usa `detectPRs` para calcular el estado de las medallas `w_mas_fuerte` y `w_supero_pr` (sección 3).

### Por qué `detectImprovements` filtra ejercicios que ya aparecen en `detectPRs`

En `WorkoutSummary.jsx`, un ejercicio que logró un PR absoluto **también** cumpliría trivialmente el criterio de "mejora vs. sesión anterior" (todo PR es, por definición, mejor que la sesión pasada). Sin filtrar, el mismo ejercicio aparecería duplicado: una vez en el bloque dorado de PRs y otra vez en el bloque verde de mejoras. Por eso `WorkoutSummary.jsx` remueve de `improvements` cualquier ejercicio cuyo `name` ya esté presente en `prs`, para no mostrar el mismo logro dos veces con framing distinto.

---

## 5. TIMEZONE Y FECHAS (`src/utils/dates.js`)

### Por qué todas las fechas son strings `YYYY-MM-DD` y no Timestamps de Firestore

Firestore Timestamps guardan instantes en UTC. Al convertir un Timestamp a `Date` y formatearlo, el resultado depende del timezone del dispositivo. Si el usuario está en UTC-3, un Timestamp guardado a las 23:00 del lunes en hora local se vería como martes al leerlo en UTC. Usando strings `YYYY-MM-DD` en hora local, la fecha del entrenamiento siempre es exacta y portable, independiente del timezone del dispositivo que lee o escribe.

### Por qué se usa `parseISO()` de `date-fns` en lugar de `new Date(string)`

```js
// MAL: new Date('2026-06-16') → se interpreta como medianoche UTC
// → en UTC-3 eso es "2026-06-15T21:00:00" en hora local → FECHA INCORRECTA (un día antes)
new Date('2026-06-16')

// parseISO de date-fns respeta el formato ISO 8601, pero sin hora también cae en medianoche UTC
parseISO('2026-06-16')  // → igual de peligroso sin especificar hora

// CORRECTO para comparaciones y aritmética de fechas:
parseISO('2026-06-16T12:00:00')  // → mediodía LOCAL → timezone-safe
```

El patrón `parseISO(date + 'T12:00:00')` es la convención en todo el codebase (aparece en `progressStats.js`, `achievements.js`, `WeekCalendar.jsx`, `ProgresoPage.jsx`, `InlineRangePicker`) cuando se necesita un objeto `Date` a partir de un string `YYYY-MM-DD` para hacer aritmética de fechas. El mediodía local da suficiente margen para que cambios de DST o desfases de timezone nunca desplacen el día calculado.

### Por qué se usa `format(new Date(), 'yyyy-MM-dd')` en lugar de `.toISOString().split('T')[0]`

```js
// MAL: toISOString() siempre retorna la fecha en UTC
new Date().toISOString().split('T')[0]
// En UTC-3, poco antes de medianoche local, esto ya devuelve el día siguiente en UTC → BUG

// BIEN: usar getFullYear/getMonth/getDate (hora local del dispositivo)
// src/utils/dates.js
export function getTodayLocal() {
  return format(new Date(), 'yyyy-MM-dd')  // date-fns format() usa los getters locales del Date
}
```

`date-fns`'s `format()` usa los getters locales del objeto `Date` (`getFullYear`, `getMonth`, `getDate`), nunca los UTC — por eso es seguro para representar "el día de hoy en el dispositivo del usuario", a diferencia de `toISOString()` que siempre normaliza a UTC.

### El patrón `parseISO(date + 'T12:00:00')` para evitar problemas de timezone

Regla general del codebase: **siempre que se necesite aritmética de fechas (obtener el lunes de la semana, diferencia en días, comparar rangos de semana) sobre un string `YYYY-MM-DD`, hay que construir el `Date` con `parseISO(date + 'T12:00:00')`** en vez de pasar el string solo. Esto asegura que el objeto `Date` resultante caiga a mediodía en hora local, lejos de cualquier borde de medianoche que timezone o DST puedan desplazar.

### Las funciones clave de `src/utils/dates.js`

```js
getTodayLocal()        // → 'YYYY-MM-DD' de hoy, en hora local del dispositivo
dateToLocal(date)      // Date → 'YYYY-MM-DD' en hora local (mismo mecanismo que getTodayLocal)
getWeekStartLocal()    // → 'YYYY-MM-DD' del lunes de la semana actual, en hora local
parseLocalDate(str)    // 'YYYY-MM-DD' → new Date(y, m-1, d) → medianoche LOCAL (no UTC)
toDateStr(date)        // → format(date, 'yyyy-MM-dd') — wrapper directo de date-fns
todayStr               // alias/export usado en formularios (WorkoutWizard) para el valor default del date picker
weekKey(date)          // → lunes de la semana del Date dado (para agrupar workouts por semana)
getMonthDays(date)     // → array de Dates del mes del date dado (para `WorkoutHistorial.jsx`)
```

---

## 6. SISTEMA OFFLINE Y AUTH

### Persistencia de Firebase Auth

```js
// src/firebase.js
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
// ...
setPersistence(auth, browserLocalPersistence)
```

Por qué: el token de sesión se guarda en `localStorage`. Esto hace que la sesión sobreviva a cierres del navegador y a arranques en modo offline. En PWA standalone de iOS, `localStorage` persiste entre sesiones de la app instalada — sin esto, cada apertura de la PWA podría perder la sesión si no hay red inmediatamente disponible.

### Por qué el timeout de Auth es de 15s y qué hace cuando dispara

> *El fragmento siguiente es el código original (anterior a noviembre 2026), útil para entender el timeout. La carga del perfil se reescribió con estados explícitos: ver sección 23.*

```js
// src/context/AuthContext.jsx
const [user, setUser] = useState(undefined)   // undefined = indeterminado
const [authTimedOut, setAuthTimedOut] = useState(false)

useEffect(() => {
  const timeout = setTimeout(() => {
    setAuthTimedOut(true)
    setLoading(false)
    // user queda undefined — NO se fuerza a null para no mandar al usuario al login
  }, 15000)

  const unsub = onAuthChange(async (firebaseUser) => {
    clearTimeout(timeout)
    setAuthTimedOut(false)
    setUser(firebaseUser)          // null = sin sesión confirmada, objeto = sesión activa
    if (firebaseUser) {
      const [prof, sett] = await Promise.all([
        getUserProfile(firebaseUser.uid),
        getSettings(firebaseUser.uid),
      ])
      setProfile(prof)
      setSettings(sett ?? { deloadActive: false, restTimerSeconds: 90, coverUrl: '' })
    } else {
      setProfile(null)
      setSettings(null)
    }
    setLoading(false)
  })

  return () => { clearTimeout(timeout); unsub() }
}, [])
```

**Cuando el timeout dispara, `user` NO se setea a `null`.** Queda en `undefined`. Esto es crítico: forzar `null` dispararía la pantalla de login (`AuthScreen`), lo cual borraría efectivamente la sesión del usuario a los ojos de la UI aunque Firebase simplemente no haya podido responder a tiempo (ej. sin conexión). El timeout de 15s existe para no dejar al usuario colgado en un `LoadingScreen` infinito, pero su disparo se trata como "no sabemos" (mostrar mensaje de reintentar), nunca como "confirmado sin sesión".

### Diferencia crítica: `user === undefined` vs. `user === null`

| Valor | Significado | Acción en `App.jsx` |
|-------|-------------|-------------------|
| `undefined` | Estado indeterminado — Firebase todavía no respondió (o no respondió a tiempo) | Mostrar `LoadingScreen` (con opción de reintentar si `authTimedOut`) |
| `null` | Firebase confirmó explícitamente que **no** hay sesión activa | Mostrar `AuthScreen` |
| objeto `FirebaseUser` | Sesión activa confirmada | Cargar el perfil (pantalla "Cargando…") y mostrar la app o el onboarding según su estado (sección 23) |

```js
// src/App.jsx — AppRoutes (desde noviembre 2026 decide screenFor, utils/profileLoad.js; ver sección 23)
//   session-timeout → loading → auth → profile-error → onboarding → app
// El perfil tiene estados explícitos (loading / error / missing / ready): el onboarding solo aparece con el
// perfil ya resuelto, nunca mientras carga ni si falló la lectura.
```

### Guardado, borradores offline y sincronización

Reescrito en noviembre 2026: ver **sección 22** (IDs fijos con `setDoc`, guardado con tope de 8 s que cae a borrador, sincronización al abrir/al volver la conexión con candado, lectura que conserva el caché ante errores y contador de lecturas). Lo que sigue sigue vigente:

- **Cola local** (`src/utils/draftQueue.js`, `localStorage` `workout_draft_{uid}`): workouts ya completados que todavía no se confirmaron en Firestore. Campos de metadata: `_draftId` (= el ID definitivo del workout en Firestore), `_pendingSync: true`, `_draftCreatedAt`.
- **Indicador visual** de workout pendiente de sync: `<CloudUpload size={12} color="#94A3B8" title="Pendiente de sincronizar" />` cuando `workout._pendingSync === true` (12px, `#94A3B8`), en las vistas que listan workouts (`WorkoutHistorial.jsx`, `Inicio.jsx`, `ProgresoPage.jsx`).
- Al terminar de guardar con la cola, `WorkoutSummary` muestra "Guardado en tu dispositivo. Se va a subir solo cuando haya conexión." en vez de "Guardado correctamente".

---

## 7. ESTRUCTURA DE DATOS FIREBASE

### `users/{uid}/workouts/{id}`

**Tipo `fuerza`:**
```js
{
  type: 'fuerza',
  date: 'YYYY-MM-DD',
  fatigue: 5,                    // 1-10, slider en paso 3 del wizard
  notes: '',                     // texto libre opcional
  deload: false,                 // true si estaba activa la semana de descarga al guardar
  muscleGroups: ['Glúteos'],     // grupos musculares trabajados (para sugerencias y recovery)
  exercises: [{
    exerciseId: 'glut_01',
    name: 'Hip Thrust',
    muscle: 'Glúteos',
    originalMuscle: 'Glúteos',   // músculo del ejercicio original (antes de un swap)
    originalExerciseId: null,    // si se hizo swap al alternativo, apunta al ejercicio original
    sets: [{ reps: 12, weight: 20 }],   // + isExtra: true en la serie de progreso o la agregada con "+ Serie" (se guarda; sección 13)
    fatigue: null,               // fatigue por ejercicio individual, si se usó ExerciseCard
  }],
  durationSeconds: 3120 | null,  // duración real de la sesión (segundos, múltiplo de 60); null = sin dato. Desde noviembre 2026 (sección 25); los workouts viejos no lo tienen
  cinta: null | {
    tipo: string | null,         // ej. 'incline'
    min: number | null,
    kmh: number | null,
    inclinacion: number | null,
  },
  createdAt: serverTimestamp(),
}
```

**Tipo `cardio`:**
```js
{
  type: 'cardio',
  date: 'YYYY-MM-DD',
  fatigue: 5,
  notes: '',
  activity: 'Running' | 'Bici' | 'Rollers' | string,  // texto libre si se eligió "otra"
  tiempo: number | null,      // minutos
  distancia: number | null,   // km
  ritmo: string | null,       // 'mm:ss min/km'
  deload: false,
  muscleGroups: [],
  createdAt: serverTimestamp(),
}
```

**Tipo `clase`:**
```js
{
  type: 'clase',
  date: 'YYYY-MM-DD',
  fatigue: 5,
  notes: '',
  clase: 'Strong' | 'HIIT' | 'Funcional' | string,
  duracion: 60,   // minutos
  deload: false,
  muscleGroups: [],
  createdAt: serverTimestamp(),
}
```

**Tipo `pausa`** (**legacy — sistema eliminado por completo, ver sección 2**. Ya no se puede crear desde la app. Documentos viejos con esta forma pueden seguir existiendo en Firestore de usuarios que los crearon antes de septiembre 2026 — la app los ignora en todos lados vía `REAL_WORKOUT_TYPES`, no se borraron ni se migraron):
```js
{
  type: 'pausa',
  pausaMotivo: 'enfermedad' | 'lesion' | 'descanso',
  pausaInicio: 'YYYY-MM-DD',
  pausaFin:    'YYYY-MM-DD',
  date:        'YYYY-MM-DD',    // siempre = pausaInicio
  notes: '',
  createdAt: serverTimestamp(),
}
```

**Tipo `descanso`** (legacy — ya no se registra activamente desde el wizard, y desde septiembre 2026 tampoco recibe ningún tratamiento especial en calendarios/estadísticas/racha; se ignora exactamente igual que `pausa`, vía `REAL_WORKOUT_TYPES`):
```js
{ type: 'descanso', date: 'YYYY-MM-DD', createdAt: serverTimestamp() }
```

**Tipo `tabata`** (registrado desde `TabataPage`, vía `saveTabataRecord`):
```js
{ type: 'tabata', date: 'YYYY-MM-DD', tabataId: string, tabataName: string, createdAt: serverTimestamp() }
```

### `users/{uid}/customExercises/{id}`

```js
{
  id: 'custom_1718700000000',   // 'custom_' + Date.now() — generado en cliente
  name: 'Mi ejercicio',
  muscle: 'Glúteos',           // debe ser uno de los MUSCLE_GROUPS predefinidos
  group: 'Glúteos',            // igual a muscle en ejercicios custom
  level: 'C',                  // siempre 'C' para ejercicios custom
  equip: '',
  alt: '',
  custom: true,                // flag para mostrar el badge "Mío" en la UI
}
```

### `users/{uid}/data/achievements`

```js
{
  primerPaso: {
    unlocked: true,
    at: Timestamp,
    detail: 'Primer entrenamiento registrado',
  },
  semanaActiva: { unlocked: true, at: Timestamp, detail: 'Semana del 1 jun al 7 jun' },
  // ... un entry por key de ACHIEVEMENTS_META (35 logros permanentes/recurrentes definidos)
  // Los logros NO desbloqueados simplemente no tienen entry en el documento — no existen
  // como { unlocked: false }, su ausencia ES el estado "no desbloqueado".
}
```

### Perfil del usuario — `users/{uid}/data/profile`

```js
{
  name: string,
  genero: 'femenino' | 'masculino' | 'otro',
  objectives: string[],         // ej: ['Ganar masa muscular', 'Mejorar resistencia']
  objetivo: string,             // objetivo primario (el primero de objectives)
  nivel: 'Principiante' | 'Intermedio' | 'Avanzado',
  diasSemana: number,           // 3-6, objetivo de días de entrenamiento por semana
  tiposPreferidos: string[],    // ej: ['fuerza', 'cardio', 'clase']
  pausa: string,                 // legacy — 'Estoy activo/a' | '1-2 semanas' | '2-4 semanas' | '1-3 meses' | 'Más de 3 meses'.
                                  // No tiene relación con los documentos type:'pausa' (sección 2, sistema eliminado) ni
                                  // con `inactividad` (sección 14). Ya no se pregunta en ningún lado (se eliminó del
                                  // onboarding y de ConfigPage.jsx por no usarse en ningún cálculo); el campo no se
                                  // tocó en los perfiles de usuarios que ya lo tenían guardado en Firestore.
  inactividad: {                 // aviso de inactividad — ver sección 14 para el detalle completo
    motivo: 'enfermedad' | 'lesion' | 'estres' | 'descanso' | 'sin_respuesta',
    lastWorkoutDate: string,     // 'YYYY-MM-DD' del último entrenamiento real detectado cuando se mostró el aviso
    days: number,                // días de inactividad en ese momento
    answeredAt: string,          // 'YYYY-MM-DD' en que se respondió (o se cerró sin responder)
  } | undefined,                 // ausente hasta que se muestra el aviso por primera vez
  lesiones: string,             // texto libre de lesiones (solo relevante si lesionesYes === true)
  lesionesYes: boolean,
  equipamiento: 'Gym completo' | 'Casa' | string,
  onboardingDone: boolean,
  createdAt: Timestamp,
}
```

### Otras colecciones relevantes (vía `src/services/db.js`)

- `getFavorites` / `toggleFavorite`: lista de `exerciseId` favoritos del usuario — lógica de datos existe en Firestore, pero **sin UI que la consuma actualmente** (ver sección 11, pendientes).
- `getNeverList` / `toggleNever`: lista negra de `exerciseId` que el usuario no quiere ver sugeridos — misma situación, lógica lista en Firestore sin UI.
- `getCustomRoutines` / `saveCustomRoutine` / `updateCustomRoutine` / `deleteCustomRoutine`: rutinas armadas por el usuario, consumidas desde `RutinasPage.jsx`.

---

## 8. ÍCONOS SVG (`src/components/icons/WorkoutIcons.jsx`)

### Los 5 componentes SVG

Código completo del archivo:

```jsx
export function FuerzaIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Left weight plate */}
      <rect x="2" y="7.5" width="4.5" height="9" rx="1.5"/>
      {/* Handle */}
      <line x1="6.5" y1="12" x2="17.5" y2="12"/>
      {/* Right weight plate */}
      <rect x="17.5" y="7.5" width="4.5" height="9" rx="1.5"/>
    </svg>
  )
}

export function CardioIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Head */}
      <circle cx="14.5" cy="4" r="2"/>
      {/* Body (forward lean) */}
      <path d="M13.5 6L11 13"/>
      {/* Trailing arm (pointing forward) */}
      <path d="M12.5 8L9.5 6.2"/>
      {/* Leading arm (pointing back) */}
      <path d="M11.5 9.5L14.5 12"/>
      {/* Leading leg */}
      <path d="M11 13L14 19"/>
      {/* Leading foot */}
      <path d="M14 19L16 18.2"/>
      {/* Trailing leg */}
      <path d="M11 13L8 19"/>
    </svg>
  )
}

export function ClaseIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Lightning bolt */}
      <path d="M13 2L5 13h6l-2 9l11-11h-7z"/>
    </svg>
  )
}

export function TabataIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Main circle body */}
      <circle cx="12" cy="13" r="7"/>
      {/* Crown button + stem */}
      <path d="M10 4.5h4M12 4.5v1.5"/>
      {/* 12 o'clock tick mark */}
      <line x1="12" y1="7" x2="12" y2="9"/>
      {/* Hand pointing to ~2 o'clock */}
      <line x1="12" y1="13" x2="15.5" y2="10"/>
    </svg>
  )
}

export function DescansIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Crescent moon */}
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}
```

Los 5 son SVG custom dibujados a mano (no vienen de una librería de íconos), `stroke`-based (`fill="none"`), pensados para heredar `color` vía `currentColor` — por eso todos los usos externos les pasan el color por CSS/prop `color` o `style={{ color }}`, nunca un `fill` directo.

### El helper `WorkoutIcon({ type, size, className })`

```jsx
export function WorkoutIcon({ type, size = 24, className = '' }) {
  const map = {
    fuerza:   FuerzaIcon,
    cardio:   CardioIcon,
    clase:    ClaseIcon,
    tabata:   TabataIcon,
    descanso: DescansIcon,
  }
  const Icon = map[type] || FuerzaIcon   // fallback: FuerzaIcon si el type no matchea
  return <Icon size={size} className={className} />
}
```

Nota: `WorkoutIcon` no expone una prop de color propia — el color se controla heredando `currentColor` desde el CSS del elemento contenedor (`className`/`style` en el padre).

### Colores por tipo (constante en todo el codebase)

| Tipo | Color hex | Dónde está declarado |
|---|---|---|
| `fuerza` | `#9B7FD4` | `ProgresoPage.jsx` (`TYPE_COLORS`), `WorkoutWizard.jsx` (`TYPE_ICON_MAP`) |
| `cardio` | `#4ade80` | ídem |
| `clase`  | `#60a5fa` | ídem |
| `tabata` | `#f59e0b` | `ProgresoPage.jsx` (`TYPE_COLORS`) — `tabata` no tiene entrada en `TYPE_ICON_MAP` de WorkoutWizard porque el wizard no ofrece tabata como tipo inicial (se registra desde `TabataPage`) |

```js
// src/components/progreso/ProgresoPage.jsx
const TYPE_COLORS = {
  fuerza: '#9B7FD4',
  cardio: '#4ade80',
  clase:  '#60a5fa',
  tabata: '#f59e0b',
}
```
```js
// src/components/registro/WorkoutWizard.jsx — Step 0 (selector de tipo)
const TYPE_ICON_MAP = {
  fuerza: { Icon: FuerzaIcon, color: '#9B7FD4' },
  cardio: { Icon: CardioIcon, color: '#4ade80' },
  clase:  { Icon: ClaseIcon,  color: '#60a5fa' },
}
```

Estos mismos valores hex se repiten (no están centralizados en un único archivo de tema) en `App.jsx`, `Inicio.jsx`, `Logros.jsx`, `BibliotecaTab.jsx` y `FuerzaFlow.jsx` para el morado `#9B7FD4`. **Si se cambia la paleta de un tipo de workout, hay que actualizar cada uno de estos archivos individualmente** — no hay una constante compartida (ej. un `theme.js`) que centralice estos colores.

### Dónde se usan

- **`ProgresoPage.jsx`** (bloque "Últimas Sesiones"): `WorkoutIcon` con el color de `TYPE_COLORS[type]` para identificar visualmente cada entrada del historial.
- **`WorkoutWizard.jsx`** (Step 0, selector de tipo de entrenamiento): `FuerzaIcon`/`CardioIcon`/`ClaseIcon` importados directamente (no vía el helper `WorkoutIcon`) junto al color de `TYPE_ICON_MAP`, dentro de las `TYPE_CARDS`.

---

## 9. DECISIONES DE PRODUCTO

### Racha basada en semanas, no días
**Decisión**: la racha se mide en semanas (3+ días entrenados por semana), no en días consecutivos de entrenamiento.
**Motivo**: el entrenamiento de fuerza requiere descanso entre sesiones. Una racha de días consecutivos penalizaría el descanso necesario y empujaría a sobreentrenar.
**Alternativa descartada**: racha de días consecutivos estilo Duolingo. Descartada porque incentiva entrenar todos los días, contraproducente para el desarrollo de fuerza.

### Mínimo 3 días para que una semana sume
**Decisión**: una semana suma +1 a la racha solo si tiene ≥3 días únicos de entrenamiento real.
**Motivo**: 1 o 2 días es un inicio pero no refleja una semana de entrenamiento consistente. 3 días es además el default del objetivo del perfil (`diasSemana = 3` cuando no está seteado).
**Alternativa descartada**: 1 día = semana válida. Descartada porque inflaba la racha artificialmente sin reflejar un hábito real.

### Sin estados de racha — regla única sin `active`/`frozen`/`paused`/`broken`
**Decisión** (septiembre 2026): se reemplazó el sistema de 4 estados + override de descongelamiento por una sola regla: semanas de 3+ días suman, semanas de 1-2 días no suman ni cortan, y la racha solo se resetea tras 4 semanas calendario completas sin ningún entrenamiento real. Ver sección 1 para el detalle completo, incluyendo la fundamentación en Silverman & Barasch (2023) sobre el efecto desmotivador de una racha rota, y Lally et al. (2010) sobre que saltear una oportunidad no afecta la formación del hábito.
**Motivo**: simplicidad (4 estados + override eran difíciles de mantener y ya habían causado al menos un bug de producción), no castigar entrenar "un poco" igual que no entrenar nada, y perdonar la vida real (vacaciones, enfermedades, viajes) sin que el sistema necesite saber el motivo ni que el usuario registre nada.
**Alternativa descartada**: mantener los estados y arreglar el bug puntual del override. Descartada porque el problema de fondo no era el bug sino la complejidad estructural de acoplar la racha a las pausas — cualquier cambio futuro en pausas volvería a arriesgar romper la racha.

### Sistema de pausas eliminado por completo
**Decisión** (septiembre 2026, en dos pasos): primero se desconectaron las pausas del cálculo de racha — ni la congelaban, ni la pausaban, ni la descongelaban, pero el sistema de registro seguía existiendo. Después se eliminó el sistema entero: formulario de registro (`PausaFlow`, `InlineRangePicker`), tratamiento visual especial en los 3 calendarios (`WeekCalendar.jsx`, `MonthCalendar.jsx` [eliminado en noviembre 2026], `WeekRow` de `ProgresoPage.jsx`), pantalla especial en `WorkoutSummary.jsx`, y el aside de "semana de pausa" en `ProgresoPage.jsx`. Los documentos viejos `type: 'pausa'`/`'descanso'` en Firestore no se tocaron — la app los ignora vía `REAL_WORKOUT_TYPES` (sección 2 para el detalle completo).
**Motivo**: consecuencia directa de eliminar los estados de racha — la tolerancia de 4 semanas vacías ya cubre el caso de uso que las pausas resolvían (avisar que no vas a entrenar por un tiempo), sin necesidad de que el usuario registre nada explícitamente. Una vez que la racha dejó de necesitar las pausas, mantener todo el sistema (formulario, 3 calendarios con lógica duplicada, pantalla especial) era complejidad sin ningún consumidor real.
**Alternativa descartada**: mantener el registro de pausas como funcionalidad informativa aunque no afectara la racha. Descartada porque duplicaba lógica de calendario en 3 archivos distintos sin aportar nada que la tolerancia de 4 semanas no cubriera ya.

### Fechas como strings `YYYY-MM-DD` (no Timestamps de Firestore)
**Decisión**: todos los campos de fecha en workouts (`date`, `pausaInicio`, `pausaFin`) son strings, no Firestore Timestamps.
**Motivo**: los Timestamps dependen del timezone del dispositivo que los lee para su visualización — riesgo real de bugs de "un día de diferencia". Con strings, la fecha es exacta y portable, y las comparaciones son simples comparaciones de strings (`date >= mondayStr`).
**Alternativa descartada**: Timestamps de Firestore. Descartada tras bugs de timezone observados en dispositivos iOS con UTC-3.

### Recomendaciones con API de Claude eliminadas de ProgresoPage
**Decisión**: se removió la sección de "Recomendaciones" (que llamaba a la API de Claude) de `ProgresoPage.jsx`.
**Motivo**: la complejidad de integrar y mantener llamadas a una API externa no se justificaba para el espacio y valor que aportaba en una app personal de uso diario. Las sugerencias diarias en `Inicio.jsx` (`getDailySuggestion()`) ya cubren el caso de uso principal de "qué entreno hoy".
**Posible reimplementación futura**: si se retoma, debería pasar por una Cloud Function de Firebase que actúe como proxy — nunca exponer la API key de Claude en el bundle del frontend (ver decisión siguiente).

### API key de Claude descartada en el frontend
**Decisión**: no se integra la API de Claude directamente desde código cliente.
**Motivo**: cualquier API key hardcodeada en JavaScript que corre en el navegador puede extraerse del bundle público e ser usada sin restricciones por terceros — riesgo de seguridad y de costo no controlado.
**Alternativa descartada**: hardcodear la key en `.env` y subirla al build de Vite. Descartada por seguridad. La alternativa viable a futuro es una Cloud Function que reciba la request del cliente, la reenvíe a la API de Claude con la key guardada server-side, y devuelva la respuesta.

### Sistema de recomendaciones reemplazado por algoritmo local (pendiente de implementar)
**Decisión**: en lugar de reintroducir una API externa, la idea es reemplazar las recomendaciones por un algoritmo local basado en criterios de ciencia del entrenamiento (volumen, frecuencia por grupo muscular, fatiga acumulada, tiempo desde el último PR, etc.), corriendo enteramente en el cliente sin llamadas a IA.
**Motivo**: evita el costo, la latencia y el riesgo de seguridad de una API externa, y da control total sobre la lógica de sugerencias.
**Estado**: pendiente de implementar (ver sección 11).

### UI de favoritos y lista negra de ejercicios descartada por ahora
**Decisión**: aunque la lógica de datos existe en Firestore (`getFavorites`, `toggleFavorite`, `getNeverList`, `toggleNever` en `db.js`), no hay ninguna UI que permita al usuario marcar ejercicios como favoritos o "nunca sugerir".
**Motivo**: se priorizaron otras features; la lógica de backend se dejó lista para cuando se decida construir la UI correspondiente.
**Estado**: backend listo, UI no construida — no es un bug, es una feature incompleta a propósito.

---

## 10. ARCHIVOS CLAVE DEL PROYECTO

### `src/hooks/useWorkouts.js`
**Qué hace**: hook central de la app. Gestiona el array `workouts` con cache en `localStorage`, operaciones de escritura a Firestore, integración con el borrador offline, y expone `getCurrentStreak()` como wrapper de `computeStreak(workouts)`.
**Por qué es crítico**: cualquier cambio en la lógica de carga o guardado pasa por acá. Desde noviembre 2026 es un lector del **estado compartido** de `WorkoutsProvider` (`src/context/WorkoutsContext.jsx`, sección 22): ya no hay una carga/estado/listener por instancia (esa era la causa raíz del bug de race condition de entonces); acá viven solo los cálculos derivados (`getLastWeightsForExercise`, `getPRForExercise`, `getLearnedWeights`, `getCurrentStreak`, etc.).

### `src/utils/streak.js`
**Qué hace**: define la constante `REAL_WORKOUT_TYPES` (los 4 tipos que cuentan como entrenamiento real: `fuerza`, `cardio`, `clase`, `tabata`) y `STREAK_MIN_DAYS` (3, el umbral de la "Racha semanal 3+"). El cálculo de la racha vive en `progressStats.js` (`computeWeeklyStreak3Plus`, sección 1).
**Por qué es crítico**: función pura, sin dependencias de React/Firestore — se puede testear de forma aislada. `useWorkouts.js`, `Logros.jsx` y `achievements.js` importan de acá; no debería volver a haber una copia local de la lógica de semanas/racha en ningún otro archivo.

### `src/context/AuthContext.jsx`
**Qué hace**: provee `user`, `profile`, `settings`, `profileStatus` (`idle`/`loading`/`error`/`missing`/`ready`), `loading` (derivado), `authTimedOut`, `retryProfile`, `updateProfile`, `completeOnboarding`, `updateSettings` vía Context. Maneja el timeout de 15s de Auth. Distingue `user === undefined` de `user === null`. Carga del perfil con estados explícitos: sección 23. `updateProfile` es optimista desde septiembre 2026 (sección 14) y desde noviembre 2026 escribe **solo los campos recibidos** (merge).
**Por qué es crítico**: modificarlo sin entender la distinción `undefined`/`null` puede mostrar la pantalla de login a usuarios offline que en realidad tienen una sesión válida. `updateProfile` actualiza el estado local con un merge superficial (`{ ...prev, ...data }`) y escribe en Firestore solo `data` con `setDoc(..., { merge: true })` — Firestore sí mergea mapas anidados (como `inactividad`) campo a campo, mientras que el estado local reemplaza ese campo entero.

### `src/pages/Inicio.jsx`
**Qué hace**: home de la app. Llama `getWeeklyStreak3Plus()` y `getMonthSummary()` y pasa el total y el resumen del mes a `StatsCards` (que usa `WeeklyStreakCard`). Ya no le pasa nada de racha a `Logros` — `Logros` calcula `w_racha_viva` de forma independiente (sección 3). Contiene `computeWeeklyStats()` (resumen semanal), `getDailySuggestion()` y `computeInactivityInfo()` (aviso de inactividad, sección 14).
**Por qué es crítico**: `ProgresoPage.jsx` usa la **misma** tarjeta (`WeeklyStreakCard`) y las mismas funciones del hook (`getWeeklyStreak3Plus()` / `getMonthSummary()`, memoizadas en `useWorkouts`), así que ambas pantallas muestran siempre el mismo número de "Racha semanal 3+" y el mismo resumen del mes, sin ninguna lógica propia adicional.

### `src/utils/inactivity.js`
**Qué hace**: exporta `getInactivityInfo(profile)` — helper puro de una línea (`profile?.inactividad ?? null`) para leer el aviso de inactividad ya respondido. La detección/guardado en sí vive en `Inicio.jsx` (sección 14).
**Por qué es crítico**: pensado para reutilizarse en cualquier feature futura que necesite saber "¿este usuario está/estuvo inactivo?" sin duplicar el acceso al campo `profile.inactividad`.

### `src/components/inicio/WeekCalendar.jsx`
**Qué hace**: calendario semanal con puntos de color por tipo de workout real. Desde septiembre 2026 ya no tiene tratamiento especial para pausa/descanso (sección 2) — un solo filtro por `REAL_WORKOUT_TYPES`, sin pasadas de prioridad ni leyenda.
**Por qué es crítico**: es la referencia de cómo debería verse cualquier otro calendario de la app (`WeekRow` de `ProgresoPage.jsx`) — los dos deberían idealmente compartir esta lógica en vez de reimplementarla cada uno por su cuenta (deuda técnica pendiente, no se consolidó en este cambio; `MonthCalendar.jsx` se eliminó en noviembre 2026).

### `src/components/inicio/Logros.jsx`
**Qué hace**: sistema de logros permanentes (35, `ACHIEVEMENTS_META`) y medallas semanales (4 de un pool de 12, `MEDAL_POOL`). Ya no recibe ninguna prop de racha — `w_racha_viva` calcula "¿esta semana ya tiene 3+ días reales?" de forma independiente, sin llamar `getCurrentStreak()`/`computeStreak()`.
**Por qué es crítico**: `computeWeeklyMedals` y el algoritmo de selección 1-por-categoría con rotación semanal (`weekNum % pool.length`) es delicado — cambiar criterios de medallas acá requiere entender las reglas de exclusión (sección 3) y la prioridad de completadas sobre no completadas dentro de cada categoría.

### `src/components/registro/WorkoutWizard.jsx`
**Qué hace**: flujo de pasos para registrar un workout (tipo → detalle → sensación). Solo ofrece `fuerza`/`cardio`/`clase` como tipos — el flujo de pausa (`PausaFlow` + `InlineRangePicker`) se eliminó por completo (sección 2). Llama `workoutsHook.saveWorkout()` y muestra `WorkoutSummary`. Maneja el draft persistente del formulario (distinto del draft offline de `draftQueue.js`) y el timer de sesión.
**Por qué es crítico**: el orden de operaciones al guardar (save a Firestore → optimistic update de cache → navegación) afecta directamente lo que ve la tarjeta "Racha semanal 3+" (`getWeeklyStreak3Plus()`) cuando el usuario llega a `Inicio` inmediatamente después de guardar.

### `src/components/registro/WorkoutSummary.jsx`
**Qué hace**: pantalla post-guardado con confetti, stats, PRs (`detectPRs`), mejoras vs. sesión anterior (`detectImprovements`, filtrando duplicados con `prs`), logros nuevos y frase del día. Auto-cierra a los 8s.
**Por qué es crítico**: es el único lugar donde se muestran mejoras incrementales vs. la sesión anterior. Los `workouts` que recibe como prop son los del hook de `WorkoutWizard` capturados antes de que se agregue el workout recién guardado — por eso `detectPRs`/`detectImprovements` comparan correctamente contra el historial previo y no contra sí mismos.

### `src/components/progreso/ProgresoPage.jsx`
**Qué hace**: página de progreso con múltiples bloques — "Tu camino" (stats agregadas), "Tus victorias", historial en calendario mensual, progresión de ejercicios, gráficos de fatiga y volumen, "Últimas Sesiones" (usa `WorkoutIcon` + `TYPE_COLORS` + `detectPRs`).
**Por qué es crítico**: la tarjeta "Racha semanal 3+" de "Tu camino" es `WeeklyStreakCard` (la misma de Inicio); "PRs históricos" sale de `computeRecords` (`progressStats.js`, sección 26). Desde noviembre 2026 ya no hay tarjeta de racha en "Tus victorias".

### `src/utils/prUtils.js`
**Qué hace**: exporta `detectPRs` (vs. máximo histórico absoluto) y `detectImprovements` (vs. sesión inmediatamente anterior). Archivo pequeño pero crítico para no confundir ambas semánticas.
**Por qué es crítico**: las dos funciones parecen similares a simple vista pero comparan contra bases distintas — ver sección 4 antes de modificar cualquiera de las dos.

### `src/utils/draftQueue.js`
**Qué hace**: cola local de workouts sin confirmar en Firestore. `saveDraft` (lanza `draft-storage-failed` si `localStorage` falla), `getDrafts`, `removeDraft`, `draftToWorkout`, `syncDrafts` (con candado por usuario y tope por subida). Usa `localStorage` con prefijo `workout_draft_{uid}`. Complementan: `workoutSave.js` (guardado con fallback, lista, lectura segura) y `withTimeout.js`. Ver sección 22.
**Por qué es crítico**: los workouts con `_pendingSync: true` en el array de `workouts` **no están confirmados en Firestore todavía** (aunque desde noviembre 2026 ya tienen su ID definitivo en `id`/`_draftId`, el mismo que tendrán en Firestore).

### `src/utils/dates.js`
**Qué hace**: helpers de fechas timezone-safe — `getTodayLocal`, `getWeekStartLocal`, `dateToLocal`, `parseLocalDate`, `toDateStr`, `weekKey`, `getMonthDays`, `isToday`. Ver sección 5 para el razonamiento completo.
**Por qué es crítico**: usar `new Date().toISOString().split('T')[0]` en vez de `getTodayLocal()` produce bugs de timezone reales en dispositivos con UTC negativo (verificado en iOS UTC-3).

### `src/services/db.js`
**Qué hace**: todas las operaciones de lectura/escritura a Firestore — `getWorkouts`, `saveWorkout`, `getCustomExercises`, `saveCustomExercise`, `getUserProfileSnapshot` (perfil + `fromCache`), `getSettings`, `getFavorites`/`toggleFavorite`, `getNeverList`/`toggleNever`, `getCustomRoutines` y CRUD relacionado, `saveTabataRecord`/`getTabataRecordCount`, etc.
**Por qué es crítico**: `getWorkouts`/`getWorkoutsSnapshot` traen **todos** los workouts del usuario por defecto (`limitN = null`; desde noviembre 2026, antes se llamaba con 100) y **propagan** los errores de lectura; pasar un número limita a los N más recientes (hoy nadie lo usa). Agregar campos nuevos a los documentos puede requerir índices compuestos nuevos en Firestore si se combinan con `where`/`orderBy` adicionales.

### `src/utils/achievements.js`
**Qué hace**: `ACHIEVEMENTS_META` (35 logros con `key`, `label`, `desc`), `runAchievementCheck` (función async que evalúa y desbloquea logros nuevos), helpers de cálculo de criterios.
**Por qué es crítico**: `runAchievementCheck` se llama tanto en `WorkoutWizard.jsx` (tras cada guardado, `.then().catch()` sin bloquear el flujo) como en `Logros.jsx` (al montar, para revalidar). Los logros recurrentes (`hamburguesaMerecida`, `rachaFuerza`, `semanaPerfecta`) tienen lógica de cooldown para poder desbloquearse más de una vez.

### `src/components/icons/WorkoutIcons.jsx`
**Qué hace**: los 5 componentes SVG custom (`FuerzaIcon`, `CardioIcon`, `ClaseIcon`, `TabataIcon`, `DescansIcon`) y el helper `WorkoutIcon({ type, size, className })`. Ver sección 8 para el detalle completo.
**Por qué es crítico**: si se agrega un nuevo tipo de workout, el ícono correspondiente debe definirse acá y registrarse en el `map` interno de `WorkoutIcon` — de lo contrario cae al fallback `FuerzaIcon`.

---

## 11. PENDIENTES Y PRÓXIMOS PASOS

En orden de prioridad sugerido:

1. **Flip cards en "Tu Camino" de `ProgresoPage.jsx`.**
   Actualmente el bloque "Tu camino" (`ProgresoPage.jsx`, sección `CaminoCard`) usa tarjetas estáticas simples. `Logros.jsx` ya tiene un patrón de flip card funcionando (`TrophyCard`, con clases CSS `.flip-card`/`.flip-inner`/`.flip-front`/`.flip-back` definidas en `index.css`) que podría reutilizarse para mostrar más contexto al tocar cada `CaminoCard`.

2. **Algoritmo local de recomendaciones basado en ciencia del entrenamiento (sin API externa).**
   Reemplazo planeado del sistema de recomendaciones eliminado (ver sección 9). Debe correr enteramente en el cliente, sin llamadas a IA — criterios como volumen semanal por grupo muscular, frecuencia, fatiga acumulada y tiempo desde el último PR.

3. **Revisión y optimización completa del onboarding.**
   Sin alcance definido todavía — pendiente de diseño. La pregunta "¿Hace cuánto no entrenás?" (`profile.pausa`) ya se eliminó del flujo (septiembre 2026) por no usarse en ningún cálculo — el campo sigue existiendo en Firestore para perfiles viejos, solo se sacó la pregunta.

4. **(Backend listo, sin UI)** Favoritos y lista negra de ejercicios — ver sección 9. No es estrictamente un pendiente de prioridad alta, pero queda registrado como funcionalidad con datos ya modelados en Firestore (`getFavorites`, `toggleFavorite`, `getNeverList`, `toggleNever` en `db.js`) esperando una UI.

5. **Consolidar la lógica de calendario duplicada en 2 archivos** (`WeekCalendar.jsx`, `WeekRow` de `ProgresoPage.jsx`) — los dos filtran por `REAL_WORKOUT_TYPES` y pintan días de forma casi idéntica, pero son implementaciones separadas. Podrían compartir un solo helper.

6. ~~**Unificar ejercicios casi duplicados del catálogo**~~ — **RESUELTO (noviembre 2026).** Los seis pares (`glut_02`/`glut_11`, `glut_05`/`glut_12`, `hom_03`/`hom_07`, `bic_02`/`bic_05`, `isq_06`/`isq_07`, `esp_07`/`hom_04`) se fusionaron en un solo ejercicio y los ids eliminados quedan como alias que se traducen al leer, sin tocar Firestore. Ver sección 27 (`EXERCISE_ALIASES`).

---

## 12. SISTEMA DE PESOS (`src/utils/weights.js`)

Única fuente de verdad para todo lo relacionado a pesos sugeridos — reemplaza al sistema anterior de deltas fijos por keyword (`getWeightIncrement`) y a los helpers legacy de `GYM_WEIGHTS`. Se apoya en dos ideas: una **lista estándar** de pesos de gimnasio como base, y el **aprendizaje** de los pesos que el propio usuario ya usó en cada ejercicio.

### Lista estándar

```js
// src/utils/weights.js
export const STANDARD_WEIGHTS = [1, 2, 2.5, 3, 4, 5, 6, 7, 7.5, 8, 9, 10, 12, 12.5, 14, 15, 16, 17.5, 18, 20, 22, 24, 25]
```
Es la unión de los pesos disponibles en dos gimnasios distintos (mancuernas/discos típicos hasta 25kg). Por encima de 25kg (máquinas, barras cargadas) esta lista deja de ser representativa, así que las funciones la excluyen del cálculo cuando el peso actual ya supera ese umbral (ver `getNextWeight` más abajo).

### Categoría de equipamiento — `getEquipCategory(equip)`

Mapea el campo `equip` de `exercises.js` (string libre, ej. `'Mancuernas'`, `'Sin equipamiento'`, `'Polea/Banda'`) a una de 4 categorías: `'bodyweight' | 'barra' | 'maquina' | 'libre'`. Usa una tabla estática con los ~35 valores reales encontrados en `exercises.js` (`Sin equipamiento`, `Barra dominadas`, `Cajón`, `Fitball`, `Banco`, etc. → `bodyweight`; `Barra`, `Barra Z`, `Banco + Barra` → `barra`; `Máquina`, `Polea`, `Polea/Banda` → `maquina`; mancuernas, kettlebell y combinaciones ambiguas → `libre`), más un fallback por keyword (`incluye 'máquina'/'polea'` → maquina, `incluye 'sin equipamiento'` → bodyweight, `=== 'barra'` → barra, cualquier otro caso o `equip` vacío → `libre`) para ejercicios custom o valores nuevos no contemplados en la tabla.

### Aprendizaje por ejercicio desde el historial — `getLearnedWeights(exerciseId)`

En [useWorkouts.js](src/hooks/useWorkouts.js):
```js
const getLearnedWeights = (exerciseId) => {
  const weights = new Set()
  workouts.forEach(w => {
    if (w.type !== 'fuerza') return
    w.exercises?.forEach(e => {
      if (e.exerciseId !== exerciseId) return
      e.sets?.forEach(s => {
        const n = Number(s.weight) || 0
        if (n > 0) weights.add(n)
      })
    })
  })
  return [...weights].sort((a, b) => a - b)
}
```
Recorre **todo** el historial (sin el límite de 5 sesiones de `getLastWeightsForExercise`), junta los pesos distintos > 0 que el usuario efectivamente usó en ese ejercicio, y los devuelve ordenados ascendente. Es el insumo principal (`learnedWeights`) de `getNextWeight` y `floorWeight` — así la app aprende, por ejemplo, que en un gimnasio en particular las mancuernas de ese usuario saltan de a 4kg en vez de seguir la lista estándar.

### Regla de subida — `getNextWeight(current, learnedWeights, equipCategory)`

```js
export function getNextWeight(current, learnedWeights = [], equipCategory) {
  const pool = new Set(learnedWeights)
  if (current <= 25) STANDARD_WEIGHTS.forEach(w => pool.add(w))

  const cap = Math.max(current * 1.25, current + 2.5)
  const candidates = [...pool].filter(w => w > current && w <= cap + 1e-9)
  if (candidates.length) return Math.min(...candidates)

  const step = getTypicalStep(learnedWeights, current) ?? (equipCategory === 'maquina' ? 5 : 2.5)
  return round2(current + step)
}
```
1. **Pool**: pesos aprendidos del ejercicio, más la lista estándar completa **solo si el peso actual todavía es ≤25kg** (por encima de eso la lista estándar ya no aporta candidatos realistas).
2. **Tope del +25%**: busca en el pool el menor peso que sea mayor al actual pero no se pase de `max(current*1.25, current+2.5)` — evita saltos absurdos como pasar de 12kg a un peso aprendido de 60kg en otro ejercicio (caso de test: `getNextWeight(12, [12, 60], 'barra')` → `12.5`, no `60`).
3. **Salto típico** (`getTypicalStep`): si no hay ningún candidato dentro del tope (típico en pesos de máquina/barra por encima de 25kg), calcula la **moda de las diferencias entre pesos aprendidos distintos consecutivos** (considerando solo los que son ≥ 50% del peso actual, y requiriendo al menos 3 pesos distintos en ese filtro — si no hay suficientes, `null`). Empate → se queda con la diferencia menor.
4. **Fallback final**: si ni siquiera hay salto típico calculable, usa un delta fijo por categoría de equipo — `5` para `maquina`, `2.5` para cualquier otro.

### Regla de bajada — `floorWeight(target, learnedWeights)`

```js
export function floorWeight(target, learnedWeights = []) {
  const t = round2(target)
  const pool = new Set(learnedWeights)
  STANDARD_WEIGHTS.forEach(w => pool.add(w))

  const below = [...pool].filter(w => w <= t + 1e-9)
  if (below.length) {
    const candidate = Math.max(...below)
    if (candidate >= t * 0.85 - 1e-9) return candidate
  }

  const rounded = Math.floor(t / 2.5) * 2.5
  return Math.max(1, round2(rounded))
}
```
Pool = pesos aprendidos **∪ lista estándar completa** (sin el tope de 25kg que sí tiene `getNextWeight`, porque acá el objetivo es encontrar un peso real/conocido igual o menor al target). Busca el mayor peso del pool que sea ≤ `target` — pero solo lo acepta si no se aleja más de un 15% hacia abajo (`>= target * 0.85`); si el candidato más cercano igual queda demasiado lejos (ej. `target=78` con pool `{..., 25, 100, 110, 120}` → el mayor ≤78 es `25`, muy lejos de `78*0.85=66.3`), descarta la idea de "peso conocido" y en su lugar redondea `target` hacia abajo al múltiplo de 2.5 más cercano (`78 → 77.5`), con un piso de `1`.

`applyDeloadMultiplier(weight, learnedWeights)` es simplemente `floorWeight(weight * 0.65, learnedWeights)` — la reducción del 65% para la semana de descarga, ahora resuelta contra pesos reales/conocidos en vez de redondear ciegamente a la lista estándar (`nearestWeight`, eliminada).

### Progresión por reps en ejercicios de peso corporal

En `getProgressionAdvice()` ([progression.js](src/utils/progression.js)), la doble progresión (2 sesiones seguidas llegando al umbral de reps, mismo peso) se mantiene igual, pero al momento de decidir **qué sugerir**:

`repsThreshold` **es exactamente el `max` de `REP_RANGES[level]`** (ver sección 13 para el rango completo por nivel: A/B → 10, C/D → 15) — no es un valor independiente, es el mismo número que ya se usaba antes, solo que ahora nombrado y derivado de una tabla explícita (`REP_RANGES`) en lugar de un ternario inline (`['A','B'].includes(level) ? 10 : 15`). El criterio de **cuándo** sugerir subir peso no cambió.
```js
if (equipCategory === 'bodyweight' && currentWeight === 0) {
  return {
    hasHistory: true, suggest: true, pattern,
    suggestType: 'reps',
    currentWeight: 0,
    suggestedReps: repsThreshold + 2,
    repsThreshold,
  }
}
```
Si el ejercicio es de peso corporal (`equipCategory === 'bodyweight'`, resuelto vía `getEquipCategory(equip)`) y el usuario nunca le sumó peso (`currentWeight === 0`), no tiene sentido sugerir "subí a Xkg" — en su lugar la sugerencia es de **reps** (`suggestType: 'reps'`, `suggestedReps: repsThreshold + 2`). Para cualquier otro caso con `suggest: true`, `suggestType: 'weight'` y `newWeight` se calcula con `getNextWeight(currentWeight, learnedWeights, equipCategory)`. Desde la sección 13, `getProgressionAdvice` también expone `repsThreshold` en los casos `suggest: false` (siempre que `hasHistory: true`), para que `FuerzaFlow.jsx` pueda decidir si corresponde sumar +1 rep — ver esa sección para el detalle completo de cómo se consume este resultado.

`learnedWeights` y el `equip` crudo del ejercicio se pasan a `getProgressionAdvice` desde `FuerzaFlow.jsx` (`getLearnedWeights(entry.exerciseId)` y `ex.equip`) — `progression.js` no conoce Firestore ni `exercises.js` directamente, solo recibe estos datos ya resueltos.

---

## 13. SERIE DE PROGRESIÓN Y SUGERENCIAS (`src/components/registro/FuerzaFlow.jsx`, `src/utils/progressSet.js`)

> **Historial**: hasta septiembre 2026 la sugerencia se aplicaba **sola** al armar el ejercicio (`buildEntry` la precargaba directamente en las cajas). Se reemplazó por completo por un sistema **opt-in**: `buildEntry` ya nunca modifica valores (ver sección "Precarga = última sesión real" más abajo) — la sugerencia aparece como una tarjeta con opciones que el usuario elige a mano, o descarta. Motivo: el usuario decide qué progresión probar hoy (peso o reps — Plotkin et al. 2022, ambas vías son válidas para hipertrofia), en vez de que la app le reescriba las cajas antes de que llegue al gimnasio.

### Precarga = última sesión real, siempre

```js
// buildEntry(ex) en FuerzaFlow.jsx
const buildEntry = (ex) => {
  const history = getLastWeightsForExercise(ex.id)
  const defaultReps = ['A', 'B'].includes(ex.level) ? 10 : 12
  if (!history.length || !history[0]?.sets?.length) {
    return { exerciseId: ex.id, name: ex.name, muscle: ex.muscle, originalMuscle: ex.muscle,
      sets: Array.from({ length: 3 }, () => ({ reps: defaultReps, weight: '' })) }
  }
  const lastSets = selectPreloadSets(history[0].sets)   // desde noviembre 2026: sin las series extra (isExtra), ver más abajo
  const setsArr  = lastSets.map(s => ({ reps: s.reps ?? '', weight: s.weight ?? '' }))
  return { exerciseId: ex.id, name: ex.name, muscle: ex.muscle, originalMuscle: ex.muscle, sets: setsArr }
}
```

Sin excepciones de valores (la única diferencia es la cantidad de series cuando la última sesión tuvo series extra, ver "Precarga: cantidad base de series"): mismas series, mismos reps, mismos pesos que la última sesión registrada de ese `exerciseId` — sin importar si la descarga está activa, si hay un parate reciente (modo regreso, sección 15) o cuál fue la fatiga de las últimas sesiones. `buildEntry` es el único punto de armado de un ejercicio con series precargadas, y **todos** los flujos que arman o rearman un ejercicio pasan por ahí (`addExercise`, `loadRoutine`, `useGeneratedRoutine`, `swapToAlt`, `replaceWithExercise`) — así que todos heredan esta regla sin lógica duplicada.

### Serie de progreso (fila verde) — reemplaza a la tarjeta "¡Podés superarte!"

> **Cambio (noviembre 2026).** Se eliminó la tarjeta con las opciones "+ peso", "+2 reps" y "Hoy no" (y con ella el brillo violeta `_suggested`, `buildWeightOption`/`buildRepsOption`/`applySuggestionOption`). Ahora, cuando corresponde progresar, **se agrega una fila extra en verde al final de la tabla de series**. Ya **no se modifican las series existentes**: la progresión es siempre una serie más. Lógica pura en `src/utils/progressSet.js` (con pruebas); interfaz en `ExerciseCard` (`FuerzaFlow.jsx`).

**REGLA NO NEGOCIABLE: la app nunca sugiere un peso menor al de la última serie cargada.** Toda sugerencia es "**más peso con reps iguales o menores**" o "**mismo peso con más reps**".

**Cuándo aparece (automática).** Cuando `getProgressionAdvice()` indica que corresponde progresar (`advice.suggest`: la misma doble progresión de siempre, con el bono de reps por salto grande y la regla relajada del modo regreso), `ExerciseCard` agrega UNA fila al final con `{ isExtra: true, _pending: true, _opt }`. Se agrega una sola vez por ejercicio (no si ya hay alguna fila `isExtra` ni si `suggestionDismissed`). Si ninguna opción es válida, no se agrega la fila y se muestra "✓ Mantené el peso, vas bien.".

**Las dos opciones** (`buildProgressOptions({ lastSet, level, equip, learnedWeights, unit, advice })`), calculadas **siempre a partir de la serie anterior de la tabla** (`sets[i − 1]`):

| Opción | Peso | Reps |
|---|---|---|
| **+ peso** | `getNextWeight(peso de la serie anterior, learnedWeights, categoría de equipo)`. Modo regreso (`advice.useReturnRule`): `min(preGapLevel, max(siguiente, floorWeight(peso × 1,10)))` | Epley (`estimateRepsAtWeight`), acotadas entre `repsMin` (de `REP_RANGES[level]`) y las reps de esa serie: **nunca más reps que la serie anterior** |
| **+ reps** | **Exactamente el mismo peso** (el valor tal cual, incluso `''` o 0) | reps de la serie anterior **+ 2**; no se ofrece si pasaría de `REPS_CAP` (25) |

- **Guardas defensivas:** "+ peso" solo se ofrece si el peso calculado es **estrictamente mayor** que el de la serie anterior (con peso cargado > 0); "+ reps" copia el peso idéntico; si la serie anterior no tiene reps (> 0), no hay opciones. Los ejercicios de **peso corporal** (sin peso cargado) ofrecen **solo "+ reps", sin selector**. Un barrido de ~10.000 combinaciones (equipos, pesos con decimales como 17,5 y 22,5, reps, niveles, modo regreso, segundos) verifica que nunca se sugiere un peso menor.
- **Opción por defecto:** "+ peso" si `advice.suggest` y `suggestType` es `'weight'` (o `'weight_secs'`); si no, "+ reps"; si la elegida no es válida, la otra.
- **Ejercicios en segundos:** "+ seg" = mismo peso y +5 seg (`SECS_STEP`); "+ peso" = peso mayor con `min(30 seg, segundos de la serie)`. Los selectores dicen "+ seg".
- **Mismo comportamiento en pirámide y fijas:** como solo se agrega una fila basada en la última serie, ya no importa el patrón.

**Selector.** La fila (y toda fila `isExtra`) muestra dos pills "+ peso" / "+ reps" (`aria-pressed`) cuando ambas opciones son válidas; tocar una aplica sus valores (también sobre una fila ya aceptada, recalculando desde la serie anterior).

**Estados de la fila.**
- **Pendiente** (`_pending: true`, solo UI): los valores se calculan **en vivo** a partir de la serie anterior (así nunca quedan por debajo de ella aunque el usuario edite las series anteriores); hasta que el usuario toca una opción o edita un campo. Una pendiente sin opciones válidas no se muestra.
- **Aceptada:** al tocar el selector o editar un campo, `_pending` se quita y los valores se guardan en la serie, que **sigue marcada en verde** (`isExtra: true`).
- **Al guardar, una pendiente sin tocar se descarta** (`cleanSetsForSave`).
- **Eliminar:** la fila tiene la cruz roja como las demás; al eliminar **cualquier fila `isExtra`**, el ejercicio queda con `suggestionDismissed: true` (viaja en el borrador de `sessionStorage`, nunca se guarda en Firestore) y **la fila automática no vuelve a aparecer en esa sesión**.

**Botón "+ Serie" (manual).** Ya no copia la última serie: agrega una fila `isExtra` **ya aceptada**, con el mismo selector y el mismo cálculo, basada en la **última serie existente** (incluida una fila verde ya aceptada), aunque no se cumpla la doble progresión (por defecto "+ reps", salvo que la sugerencia sea de peso). Tocarlo dos veces agrega dos filas encadenadas (la segunda parte de la primera). Si hay una fila de progreso **pendiente**, "+ Serie" la **acepta** (calcularía lo mismo) en vez de duplicarla. Sin ninguna opción válida (por ejemplo, serie anterior vacía), copia la última serie tal cual (nunca menos peso).

**Flag persistente `isExtra`.** Se guarda en **Firestore**, dentro de cada serie del workout (`sets: [{ reps, weight, isExtra: true }]`), a diferencia de los flags de interfaz. Si el usuario edita los valores de la fila, el flag se mantiene. Lo usa la precarga (abajo).

### `suggestionDismissed` — por ejercicio, persiste en el draft, nunca se guarda

Vive directo en la entrada del ejercicio (`exData.suggestionDismissed`, junto a `sets`/`exerciseId`/etc.). Ahora significa "**el usuario eliminó una fila extra: no volver a agregar la de progreso en esta sesión**". Se quita al guardar (`stripSuggestedFlags`).

### Rangos de reps por nivel y ajuste con Epley

Antes de este ajuste, cuando se sugería subir el peso las reps quedaban iguales a la sesión anterior — con el peso nuevo, esas reps eran casi imposibles de completar. Ahora, cada serie donde se aplica `newWeight` recalcula sus reps con la fórmula de Epley, acotadas a un rango realista por nivel del ejercicio:

```js
// src/utils/progression.js
export const REP_RANGES = {
  A: { min: 6,  max: 10 },
  B: { min: 6,  max: 10 },
  C: { min: 10, max: 15 },
  D: { min: 10, max: 15 },
}

export function estimateRepsAtWeight(prevWeight, prevReps, newWeight) {
  if (!prevWeight || !newWeight) return prevReps
  const oneRM = prevWeight * (1 + prevReps / 30)
  // +1e-9: corrige el error de punto flotante de JS (ej. 24 puede representarse como 23.999999999999996)
  // que haría que Math.floor redondee un resultado matemáticamente entero hacia el entero anterior.
  return Math.floor(30 * (oneRM / newWeight - 1) + 1e-9)
}
```

`repsThreshold` (el umbral que dispara la sugerencia de subir peso, sección "Sistema de pesos") **es exactamente `REP_RANGES[level].max`** — 10 para A/B, 15 para C/D. `repsMin` (`REP_RANGES[level].min` — 6 para A/B, 10 para C/D) es el piso al que nunca deben bajar las reps sugeridas, sin importar cuánto suba el peso.

Para la fila de progreso, la opción "+ peso" (`buildProgressOptions`, `progressSet.js`) calcula las reps sugeridas así, a partir de la serie anterior:
```js
clamp(estimateRepsAtWeight(pesoAnteriorDeEsaSerie, repsAnterioresDeEsaSerie, newWeight), repsMin, repsAnterioresDeEsaSerie)
```
`clamp(valor, min, max) = Math.min(Math.max(valor, min), max)` — nunca por debajo de `repsMin` del nivel, y nunca por encima de las reps que esa serie hizo la sesión anterior (subir de peso no debería pedir *más* reps que antes).

**Ejemplo** (el mismo que verifica la implementación): pirámide `12×10kg / 10×14kg / 10×18kg`, nivel A/B (`repsMin=6`, `repsThreshold=10`), 2 sesiones iguales. `hitThreshold` se cumple (última serie llegó a 10 reps en ambas sesiones, mismo peso máximo 18kg) → `suggest: true`, `newWeight = getNextWeight(18, ...) = 20`. Como el patrón es `pyramid`, solo la última serie recibe el peso nuevo:
```
estimateRepsAtWeight(18, 10, 20)
  oneRM = 18 * (1 + 10/30) = 24
  reps  = floor(30 * (24/20 - 1)) = floor(6) = 6
clamp(6, repsMin=6, prevReps=10) = 6
```
Resultado: las dos primeras series quedan intactas (`12×10kg`, `10×14kg`), y la última pasa a `20kg × 6`, con **ambos campos** (peso y reps) marcados `_suggested` y brillando.

### Bono de reps por tamaño del salto de peso — `getJumpRepBonus`

**Problema que resuelve**: el ACSM (American College of Sports Medicine) recomienda incrementos de carga de **2-10%** por progresión. Con discos y máquinas de gimnasio ese rango es fácil de respetar (18→20kg es +11%). Pero con **mancuernas livianas**, el salto disponible entre pesos consecutivos es fijo en kg y termina siendo *proporcionalmente* enorme: 3→4kg es +33%, muy por encima de lo recomendado. Exigir el mismo `repsThreshold` sin importar el tamaño del salto significa que, con mancuernas livianas, el sistema sugiere saltos de peso desproporcionados tan pronto como se cumple el umbral normal — subestimando el esfuerzo real que representa ese salto. La solución: exigir **más reps** en las últimas 2 sesiones antes de sugerir el salto, proporcional a qué tan grande es ese salto.

```js
// src/utils/progression.js
export function getJumpRepBonus(currentWeight, nextWeight) {
  if (!currentWeight || !nextWeight) return 0
  const jump = (nextWeight - currentWeight) / currentWeight
  if (jump <= 0.15) return 0
  if (jump <= 0.25) return 2
  return 4
}
```

| Salto proporcional (`jump`) | Bono (`jumpBonus`) | Ejemplo |
|---|---|---|
| ≤ 15% | +0 reps | 18→20kg (+11%), 8→9kg (+12.5%) |
| 15%–25% | +2 reps | 10→12kg (+20%), 4→5kg (+25%) |
| > 25% | +4 reps | 3→4kg (+33%), 1→2kg (+100%) |

`getJumpRepBonus` devuelve `0` si `currentWeight` o `nextWeight` son `0`/inválidos — esto es lo que hace que el bono **no aplique al caso de peso corporal con peso 0** (`equipCategory === 'bodyweight' && currentWeight === 0`, sección anterior): con `currentWeight = 0` el guard dispara antes de siquiera calcular `jump`, así que `effectiveThreshold` para ese caso termina siendo igual al `repsThreshold` de siempre, sin necesidad de un caso especial adicional.

**Dónde se calcula, y por qué antes del chequeo de umbral**: en `getProgressionAdvice()`, `currentWeight` se deriva únicamente de la sesión más reciente (`sessionHistory[0]`, sin necesitar todavía una segunda sesión) — `pyramid` → peso máximo de esa sesión, `fixed` → promedio. Con eso ya se puede calcular:
```js
const nextWeight = getNextWeight(currentWeight, learnedWeights, equipCategory)
const jumpBonus = getJumpRepBonus(currentWeight, nextWeight)
const effectiveThreshold = repsThreshold + jumpBonus
```
`effectiveThreshold` (no `repsThreshold`) es lo que se compara contra las reps de las **2 últimas sesiones** (mismo criterio de antes: pyramid compara la última serie, fixed compara el promedio) para decidir `hitThreshold`. `newWeight` en el resultado final reutiliza el mismo `nextWeight` ya calculado, sin recalcularlo. `getProgressionAdvice` expone `effectiveThreshold`, `jumpBonus` y `nextWeight` en el objeto de retorno siempre que `hasHistory: true` (excepto en la rama de peso corporal con peso 0, que no los necesita).

**Ejemplos** (verificados en la implementación):

| Escenario | nivel | peso | reps (2 sesiones iguales) | `nextWeight` | `jumpBonus` | `effectiveThreshold` | Resultado |
|---|---|---|---|---|---|---|---|
| fijo | A/B | 10kg | 3×10 | 12kg | +2 (salto 20%) | 12 | **No** sugiere subir (10 reps < 12) → línea informativa "Objetivo: 12 reps" |
| fijo | A/B | 10kg | 3×12 | 12kg | +2 (salto 20%) | 12 | Sugiere subir a **12kg** (12 reps ≥ 12), con reps ajustadas por Epley + clamp |
| fijo | A/B | 18kg | 3×10 | 20kg | +0 (salto 11%) | 10 | Sugiere subir a **20kg** (10 reps ≥ 10) — sin bono, igual que antes |

### Flags de las series — qué se guarda y qué no

- **Se guarda:** `isExtra` (serie de progreso o serie agregada con "+ Serie").
- **Solo UI, nunca llegan a Firestore:** `_pending` (fila de progreso sin tocar), `_opt` (pill elegida: `'weight'` | `'reps'`), el legado `_suggested` (brillo violeta, ya no se genera) y `suggestionDismissed` (por ejercicio). `stripSuggestedFlags` (`WorkoutWizard.jsx`) aplica `cleanSetsForSave(sets)`: **descarta las series `_pending`** y quita `_pending`/`_opt`/`_suggested`; `isExtra` se conserva.
- Los flags de UI sí se preservan en el borrador **en curso** (tienen sentido mientras se entrena).
- **Estilo:** la fila `isExtra` usa borde y fondo verdes (`border-app-green-light/40 bg-app-green/10`, inputs con borde verde), distinto del viejo brillo violeta `.input-suggested` (`src/index.css`), que el registro ya no usa.

### Precarga: cantidad base de series (`selectPreloadSets`)

`buildEntry` sigue precargando la última sesión real, pero **sin las series extra**: si la última sesión tiene series con `isExtra`, la **cantidad base = total de series − series `isExtra`**. Se precarga solo esa cantidad, **descartando las series más livianas** (desempate: menos reps, luego la más temprana) y **conservando el orden original** de las que quedan. Las series precargadas **no llevan `isExtra`**.

| Última sesión | Precarga |
|---|---|
| Pirámide: 18×12 / 20×12 / 24×14 / 25×12 (extra) | 20×12 / 24×14 / 25×12 |
| Fijas: 20×10 / 20×10 / 20×10 / 22,5×8 (extra) | 20×10 / 20×10 / 22,5×8 |
| Sesiones antiguas sin `isExtra` | Tal cual, como antes |

(Si todas las series fueran extra, se precargan todas, sin el flag.) La doble progresión (`getProgressionAdvice`) sigue leyendo la sesión guardada completa, incluidas las series extra.

### Qué se muestra en cada caso

`ExerciseCard` ya no tiene una tarjeta de sugerencia. Líneas informativas (el deload es una línea aparte e independiente — ver "Deload manual" más abajo):

| Condición | Contenido |
|---|---|
| `!progressionAdvice.hasHistory` | `💡 Primera vez con este ejercicio...` |
| `advice.returnActive` (modo regreso, sección 15) | `🔁 Volviendo a tu nivel ({preGapLevel} kg)` — línea informativa |
| `!advice.suggest` y `effectiveThreshold != null` | `Objetivo: {effectiveThreshold} reps en la última serie` (pyramid) o `...por serie` (fixed) |
| `!advice.suggest` sin `effectiveThreshold` (caso residual) | `✓ Mantené el peso, vas bien.` |
| `advice.suggest` y ninguna opción válida (no se agrega fila) | `✓ Mantené el peso, vas bien.` |
| `advice.suggest` con fila verde, o ya eliminada | Nada extra: la fila verde es la sugerencia |

### Deload manual — solo una línea de referencia

La descarga (`settings.deloadActive`, activación 100% manual en Configuración) **ya no modifica ningún valor precargado** — antes reducía peso (×0.65, `floorWeight`) y series (-1, mínimo 2) directamente en `buildEntry`. Ahora es puramente informativa: se sigue mostrando el banner que la *sugiere* (`shouldSuggestDeload()` en `useDeload.js`, sin cambios — fatiga promedio ≥ 7 en las últimas 40 sesiones), y cuando está activa, cada `ExerciseCard` muestra una línea de referencia calculada en vivo a partir de la serie más pesada de la precarga (que, recordar, ya es la última sesión real tal cual):

```js
const deloadPreview = deloadActive && maxWeight > 0 ? applyDeloadMultiplier(maxWeight, learnedWeights ?? []) : null
// "Semana de descarga: probá con ~{deloadPreview} kg"
```

`applyDeloadMultiplier` (`utils/weights.js`, sin cambios) sigue siendo `floorWeight(peso × 0.65, learnedWeights)` — la misma fórmula de siempre, solo que ahora es una *sugerencia visual*, no algo que ya está escrito en las cajas. `useDeload.js` perdió `getDeloadWeight`/`getDeloadSets` (quedaron sin ningún consumidor tras este cambio).

---

## 14. AVISO DE INACTIVIDAD (`src/pages/Inicio.jsx`)

Modal que se muestra al abrir la app cuando pasó mucho tiempo desde el último entrenamiento real, para preguntar amablemente qué pasó y adaptar el regreso. Reemplaza, en espíritu, al viejo sistema de pausas (sección 2) — pero es puramente informativo/UX, **no afecta la racha ni ningún cálculo** (a diferencia de las pausas viejas, que sí llegaron a acoplarse al cálculo de racha).

### Umbral y detección — `computeInactivityInfo(workouts, profile)`

Función local (no exportada) en `Inicio.jsx`, calculada en cada render a partir de `workouts` y `profile` (ambos ya disponibles vía `useWorkouts`/`useAuthContext`, sin fetch extra):

```js
const INACTIVITY_THRESHOLD_DAYS = 14

function computeInactivityInfo(workouts, profile) {
  const realWorkouts = workouts.filter(w => REAL_WORKOUT_TYPES.includes(w.type) && w.date)
  if (!realWorkouts.length) return null // usuario nuevo, sin entrenamientos reales

  const lastRealDate = realWorkouts.reduce((max, w) => (!max || w.date > max) ? w.date : max, null)
  const daysSince = Math.round(
    (parseISO(getTodayLocal() + 'T12:00:00') - parseISO(lastRealDate + 'T12:00:00')) / 86400000
  )
  if (daysSince < INACTIVITY_THRESHOLD_DAYS) return null

  // Ya se preguntó por este mismo parate (mismo lastRealDate) — no volver a mostrar.
  if (getInactivityInfo(profile)?.lastWorkoutDate === lastRealDate) return null

  return { lastRealDate, daysSince }
}
```

- **`lastRealDate`** se calcula con `reduce` sobre el máximo, no asumiendo que `workouts` venga ordenado — es más seguro que tomar `workouts[0]` porque los drafts offline pendientes de sync pueden anteponerse al array sin garantizar orden por fecha (ver `useWorkouts.js`, sección 6).
- **`daysSince`** usa el mismo patrón timezone-safe que el resto de la app: `parseISO(date + 'T12:00:00')` para ambas puntas (sección 5) — nunca `new Date(dateStr)` directo ni UTC.
- **Umbral: 14 días** (`INACTIVITY_THRESHOLD_DAYS`), sin excepciones ni gradientes.
- **Una vez por parate**: la clave de "ya se preguntó" es `profile.inactividad.lastWorkoutDate === lastRealDate` — si el usuario entrena de nuevo y vuelve a estar 14+ días sin entrenar, `lastRealDate` cambia a la fecha del entrenamiento más reciente de ese nuevo parate, así que el aviso vuelve a mostrarse (es un parate distinto, no el mismo).
- **Usuario nuevo sin workouts reales**: `realWorkouts.length === 0` → `null` inmediatamente, sin más chequeos.

### El objeto `profile.inactividad`

```js
{
  motivo: 'enfermedad' | 'lesion' | 'estres' | 'descanso' | 'sin_respuesta',
  lastWorkoutDate: 'YYYY-MM-DD', // el lastRealDate detectado en el momento de mostrar el aviso
  days: number,                  // daysSince en ese momento
  answeredAt: 'YYYY-MM-DD',      // getTodayLocal() al momento de responder (o cerrar sin responder)
}
```
Se guarda con `getInactivityInfo(profile)` (helper puro en [src/utils/inactivity.js](src/utils/inactivity.js) — solo hace `profile?.inactividad ?? null`, pensado para reutilizarse en features futuras que necesiten leer este campo) para lectura, y con `updateProfile()` del `AuthContext` para escritura — la misma función que usan `Onboarding.jsx` y `ConfigPage.jsx`, que hace merge (`{ ...(profile ?? {}), ...data }`) sin pisar el resto del perfil.

### Actualización optimista de `updateProfile`

Se modificó `AuthContext.jsx` para que `updateProfile` actualice el estado local **antes** de esperar la escritura a Firestore (antes esperaba el `await` primero):
```js
const updateProfile = async (data) => {
  if (!user) return
  setProfile(prev => ({ ...(prev ?? {}), ...data })) // optimistic
  setStatus('ready')
  await saveUserProfile(user.uid, data)       // solo los campos recibidos, con merge (noviembre 2026)
}
```
Esto es necesario para que el modal de inactividad se cierre al toque apenas el usuario elige un motivo, sin esperar el round-trip de red — mismo motivo por el que `saveWorkout()` en `useWorkouts.js` ya era optimista (sección 6). Cambio retrocompatible: los otros dos consumidores de `updateProfile` (`Onboarding.jsx`, `ConfigPage.jsx`) solo hacían `await updateProfile(...)` y seguían con otra cosa — siguen funcionando igual, solo que ahora el `profile` en memoria se actualiza más rápido.

### El modal — `InactivityModal`

Reutiliza el componente genérico `Modal.jsx` (mismo patrón que `WeeklySummaryModal`). Título fijo en el `Modal`: `"¡Qué bueno verte de vuelta! 💜"`. El cuerpo (`InactivityModal`) tiene dos vistas:

1. **Vista principal**: texto `"Hace {daysSince} días que no entrenás. ¿Qué pasó? Lo usamos para que tu vuelta sea suave."` + 4 botones grandes en grid 2×2 (🤒 Enfermedad, 🤕 Lesión, 😮‍💨 Estrés / vida, 🏖️ Descanso / vacaciones).
2. **Vista de aviso de lesión** (solo si se eligió 🤕 Lesión): reemplaza la vista principal con el texto `"Si algo duele, consultá con un profesional antes de retomar ese ejercicio. Tomalo con calma 💜"` y un botón `"Entendido"` — recién ahí se guarda y se cierra. Es estado local del componente (`showLesionNotice`), no se toca `profile` hasta tocar "Entendido".

```js
const handlePick = (motivo) => {
  if (motivo === 'lesion') { setShowLesionNotice(true); return }
  onSave(motivo)
}
```

**Cierre sin elegir** (backdrop o botón X del `Modal`): el `onClose` del `Modal` llama `saveInactividad('sin_respuesta')` — el mismo guardado que cualquier otro botón, con `motivo: 'sin_respuesta'`. Esto es lo que evita que el aviso reaparezca en la próxima apertura para el mismo parate (`lastWorkoutDate` ya queda seteado en `profile.inactividad` sin importar qué haya elegido el usuario).

### Prioridad sobre el resumen semanal

Si el mismo día en que corresponde mostrar el aviso de inactividad también es lunes (día en que `WeeklySummaryModal` querría abrirse — sección de "Resumen semanal" en `Inicio.jsx`), el aviso de inactividad **gana** y el resumen semanal no se muestra en esa apertura:
```js
useEffect(() => {
  if (loading || !workouts.length) return
  if (inactivityInfo) return // el aviso de inactividad tiene prioridad esta apertura
  if (new Date().getDay() !== 1) return
  ...
}, [workouts, loading])
```
Importante: el `useEffect` del resumen semanal simplemente **no llega a ejecutar** su lógica esa vez — no marca la clave de `localStorage` (`weekly_summary_{mondayStr}`) como "ya mostrado". Eso significa que el resumen semanal todavía puede aparecer más tarde esa misma semana (por ejemplo, si el usuario vuelve a abrir la app un rato después, una vez que ya respondió el aviso de inactividad y `inactivityInfo` volvió a `null`) — la prioridad es solo "en esa apertura puntual", no una supresión permanente del resumen de esa semana.

### No afecta la racha

El aviso de inactividad es exclusivamente informativo/UX — no crea ningún workout, no crea ningún documento de pausa, y no toca la "Racha semanal 3+" (sección 1) de ninguna manera. `daysSince`/`lastRealDate` se calculan de forma completamente independiente al `weekMap` que usa la racha, aunque ambos parten del mismo array `workouts` filtrado por `REAL_WORKOUT_TYPES`.

---

## 15. MODO REGRESO (`src/utils/reentry.js`, `src/components/registro/FuerzaFlow.jsx`)

> **Historial**: hasta septiembre 2026 esto se llamaba "vuelta suave / reentrada" y **reducía peso y series en la precarga** tras un parate de 14+ días, subiendo gradualmente en 1-4 sesiones. Se reemplazó por completo: la precarga ya nunca se reduce sola (sección 13, "Precarga = última sesión real, siempre") — el modo regreso ahora es puramente un **detector** que, cuando corresponde, relaja el umbral de la sugerencia opcional de progresión, para que "recuperar" el peso de antes del parate sea más fácil de sugerir, no algo que la app le fuerza en las cajas.

**Por qué** (memoria muscular + decisión de producto): tras un parate, el nivel previo de fuerza se recupera más rápido de lo que costó alcanzarlo la primera vez — no hace falta un plan de varias sesiones reduciendo peso poco a poco; alcanza con no exigir la regla normal de "2 sesiones consecutivas al mismo peso" antes de sugerir subir, porque el usuario ya sabe a qué peso apuntar (el que manejaba antes). El techo (`preGapLevel`) evita sugerir de una pasarse del nivel previo en un solo salto.

### `getReturnState(exerciseSessions, today, inactividad)` — detección

Sin ningún campo nuevo en Firestore — se deriva en cada llamada de las fechas del historial completo de ese ejercicio (no el slice de 5).

1. Busca el gap de 14+ días **más reciente** entre sesiones consecutivas del ejercicio (sin acotar cuántas sesiones atrás, a diferencia del sistema viejo — ver "por qué sin límite" abajo). Si no hay ninguna sesión posterior a ese gap todavía (el usuario no volvió), no hay modo regreso — la precarga usa la última sesión real tal cual y el usuario ajusta a mano (sin sugerencias de subida).
2. `preGapLevel` = el mayor peso de la última serie (la más pesada en un esquema piramidal) entre el `baseline` (la sesión justo antes del gap) y hasta 2 sesiones más antes de él.
3. **Activo** si `preGapLevel > 0` y el peso máximo de la última sesión real es **menor** que `preGapLevel`. Se autoexpira solo por peso alcanzado, no por cantidad de sesiones — por eso no hace falta acotar la búsqueda del gap a una ventana fija como antes (el viejo sistema necesitaba ese límite porque `N` era una cantidad fija de sesiones; acá no hay `N`).
4. `motivo`: igual que antes, el `profile.inactividad` guardado solo cuenta si su fecha cae dentro de la ventana del parate detectado.

Devuelve `{ active, preGapLevel, sessionsSinceReturn, gapDays, motivo, baseline }`.

### `getProgressionAdvice(..., returnState)` — el umbral relajado

Mientras `returnState.active` es `true` y el motivo del parate **no** fue `'enfermedad'`/`'lesion'`:
- Alcanza con la **última sesión sola** (no 2 consecutivas) llegando a `repsThreshold` para que `advice.suggest` sea `true`.
- **Sin bono de salto** (`jumpBonus = 0` — `effectiveThreshold = repsThreshold` sin más): en modo regreso no aplica la lógica de "salto proporcionalmente grande" (sección 13), porque el objetivo no es el próximo escalón normal sino volver al nivel ya conocido.
- El peso sugerido tiene un piso de +10% (no el incremento chico de siempre) y un techo en `preGapLevel`:
  ```js
  const floorBased = floorWeight(currentWeight * 1.10, learnedWeights)
  newWeight = Math.min(returnState.preGapLevel, Math.max(getNextWeight(currentWeight, learnedWeights, equipCategory), floorBased))
  ```

Si el motivo del parate fue `'enfermedad'` o `'lesion'`, se ignora todo lo anterior y se usa la regla normal de 2 sesiones (con bono de salto incluido) — precaución extra para paretes por causa médica, donde conviene confirmar con más de una sesión antes de sugerir subir.

`advice` expone `returnActive: true` y `preGapLevel` cuando el modo regreso está activo (con o sin motivo médico), para que `ExerciseCard` muestre la línea informativa `"🔁 Volviendo a tu nivel ({preGapLevel} kg)"` (sección 13). `advice.useReturnRule` indica si rige la regla relajada de regreso (no en parates médicos): la fila de progreso topa el peso en `preGapLevel`.

### Ejemplo (verificado en la implementación)

Última sesión antes del parate: 3 series a 60kg (hace 40 días). Gap. Primera sesión de vuelta: 3×10 a 45kg (hace 3 días) — llega al `repsThreshold` de nivel A/B (10). `preGapLevel = 60`. Sin motivo médico:
```
getNextWeight(45, [], equip)        = 47.5   // salto normal, chico
floorWeight(45 * 1.10, [])          = 47.5   // piso del 10%
newWeight = min(60, max(47.5, 47.5)) = 47.5
```
Si el motivo hubiera sido `'enfermedad'`, con una sola sesión posterior al parate no alcanza (se exige la regla normal de 2 sesiones) — no hay sugerencia todavía. Una vez que el peso máximo de la última sesión llegue a 60kg (el `preGapLevel`), el modo regreso queda inactivo y todo vuelve a la regla normal.

### Qué NO toca

El sistema de pesos, Epley, `REP_RANGES`, el aviso de inactividad (sección 14) y la racha (sección 1) quedan sin cambios. La precarga (sección 13) tampoco se ve afectada por el modo regreso en absoluto — es exclusivamente una señal para `getProgressionAdvice`.

### Orden del historial

Igual que en el resto de la app (sección 5): `getReturnState` ordena explícitamente el historial por fecha descendente (estable ante empates) antes de usarlo, sin asumir que `exerciseSessions`/`workouts` vienen ordenados — los borradores offline (`draftQueue.js`) pueden anteponerse al array sin garantía de orden.

---

## 16. GENERADOR DE RUTINAS (`src/utils/routineGenerator.js`)

Reemplaza las dos implementaciones casi idénticas que existían antes (`generate()` en `GeneradorTab.jsx` y `generateForFlow()` en `FuerzaFlow.jsx`, cada una con su propio `intercalateExercises`), que elegían ejercicios al azar por nivel sin ningún criterio de patrón de movimiento — podían poner dos ejercicios del mismo patrón seguidos (ej. Zancadas atrás + Estocada en el lugar, ambos "zancada"). Ahora ambas UI llaman a la misma función `generateRoutine({ muscles, count, equip, workouts, regenerate })`, que devuelve la lista ya ordenada de ejercicios. Desde noviembre 2026 acepta además un parámetro opcional `blocks` (grupos generales: Piernas, Tracción, Empuje, Brazos), ver "Grupos generales" más abajo; sin `blocks` el comportamiento es exactamente el anterior.

### Etiquetas del catálogo (`src/data/exercises.js`)

Cada uno de los 90 ejercicios tiene dos campos nuevos:
- **`pattern`**: patrón de movimiento (23 valores: `sentadilla`, `zancada`, `bisagra`, `empuje_cadera`, `extension_cadera`, `abduccion`, `aduccion`, `curl_femoral`, `extension_rodilla`, `gemelos`, `traccion_vertical`, `traccion_horizontal`, `deltoides_posterior`, `empuje_horizontal`, `aperturas`, `empuje_vertical`, `elevacion_lateral`, `triceps`, `biceps`, `core_flexion`, `core_antiextension`, `core_rotacion`, `carga`). `aduccion` (aductores, región inferior) y `carga` (paseos con peso: granjero, maleta; región core) se sumaron en noviembre 2026.
- **`unilateral`** (boolean): ejercicios que trabajan un lado del cuerpo por vez (ej. Sentadillas búlgaras, Hip Thrust unilateral, Press de hombros unilateral).
- **`unit`** (`'reps'` | `'secs'`, desde noviembre 2026): en qué se mide el ejercicio; ver sección 24.

### Regiones y zonas de fatiga (`PATTERN_REGION`, `PATTERN_ZONE`)

- `PATTERN_REGION`: agrupa cada `pattern` en `'inferior'` (tren inferior), `'superior'` (tren superior) o `'core'`. Se usa para la regla dura de unilaterales y para que el core siempre quede al final.
- `PATTERN_ZONE`: agrupación más fina (`rodilla`, `posterior`, `abductores`, `aductores`, `gemelos`, `empuje`, `traccion`, `core`), usada solo como preferencia de orden (alternar zona entre ejercicios consecutivos), nunca como regla obligatoria.

### Reparto de `count` entre bloques

Cada músculo elegido (y, desde noviembre 2026, cada grupo elegido) es un **bloque**. `count` se reparte con `perGroup = floor(count / nBloques)` para todos y el resto (`count % nBloques`) se da de a 1 a los **primeros** bloques, en orden de selección. Ejemplos: 5 ejercicios y 2 músculos → 3 + 2; 8 ejercicios y 3 bloques → 3 + 3 + 2. Si `count` es menor que la cantidad de bloques, los últimos bloques quedan con 0. Si el pool de un bloque se agota antes de llegar a su cuota, esa cuota queda incompleta (la rutina sale con menos ejercicios; el resto no se redistribuye).

### Selección de un músculo suelto

Por cada músculo elegido, en el orden en que el usuario los seleccionó:
- **Slot principal**: nivel A (si no hay, B) con un `pattern` que todavía no se usó en la sesión (contador global, no por músculo). Entre los candidatos, gana el de mayor `historyScore` (sesiones de tipo `'fuerza'` con ese `exerciseId` en los últimos 56 días, fechas string), con empate al azar. El principal **siempre** sigue el historial, incluso con `regenerate: true`.
- **Slots accesorios**: prioridad de nivel B → C → A → D, también exigiendo `pattern` nuevo. Con `regenerate: false` se elige por `historyScore` igual que el principal; con `regenerate: true` se elige al azar entre los candidatos válidos (solo los accesorios, no el principal).
- Si para un slot no queda ningún candidato con `pattern` nuevo, se permite repetir un patrón ya usado (mejor un ejercicio repetido de patrón que dejar el hueco vacío) — el orden se encarga de separarlos si es posible.
- Nunca se repite el mismo `id` dentro de la misma rutina.
- **Músculos sin principal A/B**: el slot principal solo mira nivel A y B. Si el pool del músculo no tiene ninguno (hoy: **Core & Estabilidad**, todo nivel D; o cuando el equipamiento "Solo básico" deja afuera los A/B), no hay principal y el músculo se arma solo con el bucle de accesorios (B → C → A → D). Tríceps, Bíceps y Abductores tienen un único B (sin ningún A), y Gemelos un único A (sin ningún B): su "principal" es de hecho ese ejercicio y el resto son C.

### Grupos generales (`MUSCLE_BLOCKS`) y parámetro `blocks` (noviembre 2026)

`MUSCLE_BLOCKS` (en `routineGenerator.js`) define 4 grupos: **Piernas**, **Tracción**, **Empuje** y **Brazos**. Cada uno es una **plantilla**: una lista ORDENADA de 6 huecos por prioridad. Cada hueco define el/los patrón(es) permitidos (si son varios, el hueco acepta cualquiera) y, opcionalmente, los músculos permitidos (sin `muscles` = cualquier músculo del catálogo con ese patrón):

| Grupo | Huecos (en orden) | Chips que deshabilita |
|---|---|---|
| Piernas | sentadilla (Cuádriceps) → bisagra (Isquios/Glúteos) → empuje_cadera (Glúteos) → zancada → curl_femoral o extension_rodilla → abduccion, aduccion o gemelos | Glúteos, Isquios, Cuádriceps, Abductores, Aductores, Gemelos |
| Tracción | traccion_vertical → traccion_horizontal → biceps → traccion_horizontal (otro ejercicio) → deltoides_posterior → biceps | Espalda, Bíceps |
| Empuje | empuje_horizontal → empuje_vertical → triceps → aperturas → elevacion_lateral → triceps | Pecho, Hombros, Tríceps |
| Brazos | empuje_vertical → biceps → triceps → elevacion_lateral → biceps → triceps | Bíceps, Tríceps, Hombros |

Notas de la plantilla: el hueco `deltoides_posterior` de Tracción acepta ejercicios de Espalda y de Hombros (el catálogo tiene 1 y 3), aunque Hombros no figure entre los chips que Tracción deshabilita; "traccion_horizontal (otro ejercicio)" no necesita lógica propia porque nunca se repite un `id`.

`generateRoutine({ muscles, blocks, count, ... })`:
- **Sin `blocks`** (o `null`/`[]`) el resultado es idéntico al de siempre; verificado contra la versión anterior con 6000 corridas aleatorias con la misma semilla de `Math.random` (0 diferencias). `dailySuggestion.js` y `returnRoutine.js` no pasan `blocks` y no cambian.
- **Combinación**: se pueden combinar grupos entre sí y con músculos sueltos. Los bloques se ordenan **primero los grupos (en el orden recibido) y después los músculos sueltos (en el orden recibido)** — los dos arreglos son parámetros separados, por eso el "orden de selección" entre un grupo y un músculo suelto es siempre grupo primero. Ids de grupo repetidos o inexistentes se ignoran. `count` se reparte con la regla de arriba (Piernas + Brazos, 6 → 3 + 3: sentadilla, bisagra, empuje_cadera + empuje_vertical, biceps, triceps).
- **Selección de un grupo** (`pickForBlock`): toma los primeros *k* huecos *que puedan cubrirse*. En cada hueco elige el primer nivel con candidatos en el orden **A → B → C → D** y, dentro de él, el de mayor `historyScore` (empate al azar) — igual que el principal de un músculo suelto. Un hueco sin candidatos (equipamiento, lista "never" o pool agotado) se salta y se pasa al siguiente. Si el grupo necesita más ejercicios que huecos (7 u 8 con un solo grupo), vuelve a recorrer la plantilla desde el hueco 1 con los ejercicios que quedan. Nunca repite un `id` (el conjunto de ids usados es compartido con el resto de la rutina).
- **Regenerar**: los huecos 1 y 2 de cada grupo (los "principales", solo en la primera vuelta) siguen el historial, para no cortar la doble progresión; el resto se sortea: primero un patrón al azar entre los del hueco que tengan candidatos y después un ejercicio al azar del mejor nivel de ese patrón (así un hueco "abduccion o gemelos" no devuelve siempre el mismo ejercicio nivel A).
- `neverIds` aplica a grupos y músculos sueltos; `patternsByMuscle` y `referenceDate` ya funcionaban así: `patternsByMuscle` solo a músculos sueltos, `referenceDate` a ambos.
- **Reparación del orden** (`repairBlockPicks`, solo cuando hay grupos): la selección por huecos no mira el orden y puede juntar, por ejemplo, tres unilaterales de tren inferior en 4 ejercicios (zancada, que es siempre unilateral, más Hip Thrust a una pierna y Peso muerto B-stance), caso en que ningún orden evita dos seguidos. Si el conjunto elegido no tiene ningún orden que cumpla las reglas duras, se cambia UN ejercicio de grupo por otro del mismo hueco (primero los accesorios, de atrás para adelante; los principales solo si hace falta; prefiriendo el mismo nivel y el de más historial) y se repite hasta que exista un orden válido. Si ningún cambio lo logra, queda como estaba (caso inevitable). Los músculos sueltos no se tocan.
- El **orden final** sigue siendo `orderRoutine` (tiers, `PATTERN_ZONE`, `hardRulesOk`, core al final): alterna zonas y evita patrones consecutivos. El orden de la rutina mostrada **no** es el de la plantilla.
- Con **7–8** ejercicios de un solo grupo los patrones se repiten por necesidad (la plantilla tiene 4–6 patrones distintos); el orden los separa cuando es posible.
- Verificación (noviembre 2026): cada grupo solo con 3 a 8 ejercicios, combinaciones (Piernas + Brazos, Tracción + Empuje, Piernas + Pecho, 3 y 4 grupos) y "Solo básico", 200 corridas por caso alternando Regenerar: 0 patrones consecutivos repetidos y 0 pares de unilaterales de tren inferior seguidos. Una excepción de cantidad, no de orden: "Piernas + Pecho" de 8 ejercicios con "Solo básico" sale con 7, porque Pecho solo tiene 3 ejercicios que pasan el filtro (la pantalla lo avisa, ver "Aviso de rutina incompleta"). Después del arreglo del filtro, cada grupo solo con "Solo básico" completa de 3 a 8 ejercicios.
- Tests: `src/utils/routineGenerator.test.js` (52 tests; plantillas, reparto, huecos saltados, Regenerar con historial, orden, compatibilidad sin grupos, helpers de la UI, `isBasicEquip`/`equipFilter`, el aviso de rutina incompleta, Aductores y los patrones `aduccion`/`carga`), `exerciseAliases.test.js` (23), `dailySuggestion.test.js` (3). En total 174 tests.

### UI del generador (`GeneradorTab.jsx` y modo "Generador" de `FuerzaFlow.jsx`)

Las dos pantallas son iguales y comparten los helpers exportados por `routineGenerator.js` (`MUSCLE_BLOCKS`, `blockedMuscles`, `toggleGeneratorBlock`, `generatorCountOptions`, `generatorRoutineName`, `generatedRoutineMuscles`):
- **Valores por defecto**: ningún grupo ni músculo elegido, cantidad **4**, equipamiento "Gym completo".
- **Fila "Grupos"** (arriba de los chips de músculos): Piernas · Tracción · Empuje · Brazos, multi-selección. Al elegir un grupo, los chips de los músculos que incluye quedan deshabilitados (y se quitan de la selección si estaban elegidos). Al quitarlo, los chips se habilitan pero los músculos quitados no vuelven a quedar elegidos.
- **Cantidad**: 3–6 sin grupos; 3–8 con al menos un grupo. Si se quita el último grupo y la cantidad era 7 u 8, pasa a 6.
- **"Generar rutina"** se habilita con al menos un grupo o un músculo. Cambiar grupos, músculos o cantidad borra la rutina generada (cambiar el equipamiento no la borra ni la regenera).
- **Nombre** de la rutina: `Generada: ` + los dos primeros bloques (grupos primero). **`muscles`** de la rutina = los músculos sueltos más los de los ejercicios que pusieron los grupos (es lo que va a `selectedMuscles` del borrador y lo que guarda "Guardar"). "Guardar" (solo en `GeneradorTab`) guarda los ids como siempre.
- **Aviso de rutina incompleta** (noviembre 2026): `generateRoutine` sigue devolviendo solo la lista ordenada (lo usan `dailySuggestion.js`, `returnRoutine.js` y las pantallas, sin cambios); `generateRoutineDetailed` devuelve además `{ requested, entries: [{ kind, label, target, picked }] }` (lo pedido y lo logrado por músculo o grupo) y `routineNotices(result, equip)` arma las líneas de aviso. Debajo de la rutina generada, en texto chico ámbar, y igual en `GeneradorTab` y en el modo Generador de `FuerzaFlow`: (1) "Con Solo básico no hay ejercicios para Gemelos y Pecho." (o "Con el equipamiento elegido ..." si el filtro es "Gym completo") cuando a un bloque le tocaban ejercicios y no se pudo elegir ninguno; (2) "Con N ejercicios no entra X: subí la cantidad o sacá algún bloque." cuando hay más bloques que ejercicios; (3) "Se generaron 7 de 8 ejercicios con el equipamiento elegido." cuando la rutina sale más corta por pool agotado y lo anterior no lo explica. Sin faltantes no se muestra nada. Si la rutina sale vacía, "Usar ahora" y "Guardar" quedan deshabilitados. El aviso no se guarda con la rutina. No avisa la repetición de patrón por falta de variedad (ej. Gemelos tiene un único patrón).
- **Punto ámbar** ("entrenado recientemente"): `GeneradorTab` usa las últimas **72 h** (y lo dice en pantalla); el generador de `FuerzaFlow` usa las últimas **48 h** (`recentMuscles` de ese componente, sin leyenda). No está unificado.

### Datos del catálogo y límites conocidos (consulta de noviembre 2026)

- **No existe un campo compuesto/aislado.** Se deduce del `level`: A = compuesto pesado, B = compuesto secundario, C = aislado, D = core y estabilización (etiquetas en `BibliotecaTab.jsx`). El `pattern` no lo distingue (hay patrones con A, B y C). El generador trata A/B como principales y C/D como accesorios.
- **Catálogo base** (noviembre 2026, tras la reorganización de la sección 27): 90 ejercicios, 13 músculos, 23 patrones, 13 unilaterales (9 de región inferior: 4 de Glúteos, 1 de Isquios, 2 de Cuádriceps, 2 de Aductores), 83 en `reps` y 7 en `secs`. Por músculo: Glúteos 10, Isquios 8, Cuádriceps 9, Abductores 8, Aductores 4, Gemelos 4, Espalda 7, Pecho 5, Hombros 5, Tríceps 6, Bíceps 4, Abdominales 12, Core & Estabilidad 8. Todo `zancada` (6 ejercicios) es unilateral y nivel B. Sin ningún A/B: Gemelos y Core & Estabilidad; sin ningún A: Abductores, Aductores, Gemelos, Tríceps, Bíceps, Abdominales y Core & Estabilidad.
- **Músculos con un solo patrón**: Abductores, Gemelos, Tríceps y Bíceps. Pedir más de un ejercicio de ellos obliga a repetir patrón y puede dejar el orden en el caso límite del punto 5 de "Orden".
- **Filtro "Solo básico"** (`equipFilter`, que usa `isBasicEquip`; noviembre 2026): una vez normalizado el texto de `equip` (minúsculas, sin acentos) deja pasar el ejercicio si contiene, **como palabra**, `sin` (sin equipamiento / sin equipo), `mancuerna(s)`, `banda(s)` (incluida "banda elástica") o `tobillera(s)`, en singular o plural. Un `equip` con varias opciones ("Barra/Mancuerna", "Polea/Banda", "Cajón / Cajón + Mancuernas", "Mancuernas / Kettlebell") pasa si alguna es básica. Son las mismas categorías de siempre; lo único que cambió en ese arreglo es que entraron los ejercicios cuyo `equip` dice "Mancuerna" en singular (antes quedaban afuera por buscar solo el plural). **Cuenta actual (tras la reorganización del catálogo): pasan 63 de 90.** Por músculo: Glúteos 9/10, Isquios 2/8, Cuádriceps 3/9, Abductores 8/8, Aductores 3/4, Gemelos 2/4, Espalda 3/7, Pecho 3/5, Hombros 5/5, Tríceps 4/6, Bíceps 3/4, Abdominales 10/12, Core & Estabilidad 8/8. Con "Solo básico" siguen sin ningún A/B: Gemelos, Tríceps, Bíceps y Core & Estabilidad. Los nuevos `adu_01`, `adu_03`, `adu_04`, `cor_05` y `cor_06` pasan; `adu_02` (Máquina) no. Quedan afuera 27 ejercicios con 16 valores de `equip`: Máquina (5), Polea (4), Barra (3), Banco (2), Barra dominadas (2), y uno cada uno: Kettlebell, Fitball, Banco Romano, Barra + soporte landmine, Disco, Pared, Soga para saltar, Máquina de prensa, Banco + Barra, Barra Z, Rueda abdominal.
- **Aductores y patrones nuevos** (noviembre 2026): `aduccion` es de región `inferior` y zona `aductores` (zona nueva), de modo que sus unilaterales (`adu_01` Plancha Copenhague y `adu_03` Aducción de pie con banda o polea) cuentan para la regla dura de "no dos unilaterales de tren inferior seguidos"; `carga` es de región y zona `core`, así que sus ejercicios (`cor_05`, `cor_06`) van siempre al final de la rutina como el resto del core. `adu_04` Sentadilla sumo con mancuerna es del músculo Aductores pero de patrón `sentadilla`: el hueco 1 de Piernas solo acepta Cuádriceps, así que no lo toma. En Piernas, el hueco 6 (abducción, aducción o gemelos) solo elige aducción en Regenerar o si se agotan los abductores nivel B, porque los ejercicios de aducción son nivel C y A → B → C prioriza antes. `returnRoutine.js` suma `carga` a los patrones del hueco de core.
- **`intercalateExercises`** (`FuerzaFlow.jsx`) sigue existiendo: ya no es parte del generador, solo ordena la lista de ejercicios del modo **Libre** al filtrar por músculo (alterna tren inferior y superior por nivel y deja el core al final, sin mirar patrones ni unilaterales).
- Los parámetros `neverIds`, `patternsByMuscle` y `referenceDate` de la rutina de regreso están en la sección 20.

### Orden

1. **Tier**: los ejercicios de región `core` son siempre tier 3 (van al final), independientemente de su nivel. Los no-core son tier 0 (nivel A), 1 (nivel B) o 2 (nivel C/D).
2. **Reglas duras** entre cada par de ejercicios consecutivos: distinto `pattern`, y nunca dos `unilateral` de región `inferior` seguidos (evita encadenar dos ejercicios de estabilización unilateral de pierna, que fatigan igual sin dar descanso real).
3. **Regla blanda**: entre las opciones que sí cumplen las reglas duras, se prefiere alternar `PATTERN_ZONE` respecto al ejercicio anterior.
4. El orden final se arma con **backtracking** (no un greedy puro de una sola pasada): se intenta encontrar una secuencia donde *todos* los pares consecutivos cumplan las reglas duras, probando alternativas cuando un camino se traba más adelante, en vez de quedar atado a la primera elección. Con hasta 6 ejercicios por rutina esto es instantáneo. Los ejercicios core se ordenan como un segmento aparte y se concatenan al final, así "core siempre al final" es garantizado por construcción y no depende de que emerja de las reglas.
5. Solo si genuinamente no existe ningún orden posible que cumpla las reglas duras para todos los pares (ej. un músculo con muy pocos patrones distintos y más ejercicios pedidos que patrones — ej. Bíceps, Tríceps, Abductores y Gemelos tienen un único `pattern` para todos sus ejercicios) se arma por la misma prioridad (tier, zona, orden de músculo) sin esa garantía — es un límite real del catálogo, no del algoritmo.

**Bug descubierto y corregido durante el desarrollo** (antes de llegar a esta versión): una primera implementación con greedy de una sola pasada (elegir el primer candidato válido en cada posición, con la regla blanda como único ajuste) fallaba en dos formas verificadas con 2000+ corridas aleatorias: (1) podía dejar dos ejercicios unilaterales de región inferior adyacentes cuando, al llegar a la última posición, ya no quedaba ninguna alternativa — aun existiendo un orden válido de los mismos 4 ejercicios que si los evitaba (la falla era de miopía del greedy, no del conjunto elegido); (2) podía intercalar un ejercicio core antes de tiempo si en un paso ningún ejercicio no-core pasaba la regla dura contra el anterior pero uno core sí, rompiendo "core siempre al final". El backtracking (con el core como segmento separado) resuelve ambos.

### Pool de ejercicios

El generador solo elige del catálogo base (`exercises.js`), no de los ejercicios personalizados del usuario — a diferencia de la versión inline vieja de `FuerzaFlow.jsx`, que sí incluía ejercicios custom en su pool. Se dejó así porque los ejercicios custom no tienen `pattern`/`unilateral` (se crean sin ese dato) y el algoritmo de selección/orden depende enteramente de esos campos; incluirlos rompería las garantías de patrón. Si en el futuro se quiere generar con ejercicios propios, hay que pedirle `pattern` al crearlos.

### Uso en `FuerzaFlow.jsx` (evita el bug de precarga)

`useGeneratedRoutine()` sigue usando `buildEntry()` sobre cada ejercicio generado (igual que las rutinas prearmadas), así que cada uno se precarga con su última sesión real (sección 13). El bug que tenía `GeneradorTab.jsx` (`useRoutine()` armaba `sets: { reps, weight: 0 }` a mano, sin ninguna precarga) se corrigió: ahora ese flujo solo guarda los `id` de los ejercicios elegidos en el draft (`detail.pendingGeneratedIds`) y navega a `/registro`; un `useEffect` nuevo en `FuerzaFlow.jsx` detecta ese campo al montar, construye cada entrada con `buildEntry()` y limpia el campo. `saveAsPrearmada()` (guardar como rutina propia) no cambió.


### Sugerencia de siguiente ejercicio (`suggestNextExercise`, botón "✨ Sugerencia" en modo libre)

Recomienda un ejercicio a agregar a partir de lo ya cargado en la sesión en curso, reutilizando `historyScore`, `PATTERN_REGION`, `PATTERN_ZONE` y `hardRulesOk` (exportado desde `routineGenerator.js` para esto). No genera una rutina completa de una vez: evalúa una sola sesión en construcción, ejercicio por ejercicio, cada vez que se toca el botón.

`suggestNextExercise({ muscles, currentExercises, workouts, excludeIds })`:

1. **Músculos objetivo**: `muscles` es el selector de músculos del modo libre (`selectedMuscles` en `FuerzaFlow.jsx`). Si está vacío, se derivan de los músculos (`originalMuscle ?? muscle`) de `currentExercises`, en orden de aparición. Si ambos están vacíos, devuelve `null`.
2. **Conteo por músculo**: cuántos ejercicios de la sesión pertenecen a cada músculo objetivo (por `originalMuscle ?? muscle`, así un ejercicio cambiado a su alternativa sigue contando para el músculo original).
3. **Elegibilidad de core**: Abdominales y Core & Estabilidad solo entran en la selección si todos los músculos no-core elegidos ya tienen 2+ ejercicios en la sesión (o si no se eligió ningún músculo no-core) — evita sugerir core antes de cubrir el resto.
4. **Músculo a sugerir**: el elegible con menor conteo; empate → orden en que el usuario los seleccionó.
5. **Candidatos** para ese músculo (del catálogo base, excluyendo ids ya en la sesión y `excludeIds`):
   - Si el músculo todavía no tiene ningún ejercicio nivel A o B en la sesión → candidatos nivel A (si no hay, B) — es el **principal**.
   - Si ya lo tiene → candidatos con `pattern` no usado en la sesión (si no hay ninguno, se permite repetir patrón), escaneando niveles B → C → A → D y tomando el primer nivel con candidatos — es el **accesorio**.
6. **Orden de preferencia** entre esos candidatos: cumple las reglas duras contra el **último** ejercicio de la sesión (mismas reglas que `generateRoutine`: distinto `pattern`, no ambos `unilateral` de región inferior) > `pattern` nuevo en la sesión > distinta `PATTERN_ZONE` que el último > mayor `historyScore` > al azar. Si el último ejercicio de la sesión no está en el catálogo (ejercicio personalizado, sin `pattern`), las reglas duras/blandas no se aplican — solo cuentan patrón-nuevo e historial.
7. Si el músculo objetivo no tiene ningún candidato válido, se prueba con el siguiente músculo por conteo; si ninguno tiene candidatos, devuelve `null`.
8. Devuelve `{ exercise, reason }`, con `reason` = `"principal de {músculo}"` o `"accesorio de {músculo} · patrón nuevo"` (o `"accesorio de {músculo}"` si repite patrón por el punto 5).

**UI** (`FuerzaFlow.jsx`, modo libre): botón "✨ Sugerencia" debajo de "+ Agregar ejercicio" (mismo estilo, borde punteado). Si no hay músculos elegidos ni ejercicios en la sesión, el botón muestra "Elegí músculos o agregá un ejercicio primero" en vez de ser clickeable. Al tocarlo se abre una tarjeta inline (no modal) con nombre, músculo y `reason`, y dos botones: "Agregar" (arma la entrada con `buildEntry` — misma precarga que cualquier otra vía) y "Otra" (vuelve a llamar `suggestNextExercise` acumulando los ids ya mostrados en `excludeIds`, así nunca repite dentro de la misma ronda; si no queda ninguno, muestra "No hay más sugerencias para estos músculos"). Agregar un ejercicio por **cualquier** vía (sugerencia, panel manual, generador, etc.) cierra la tarjeta y limpia los excluidos, porque `addExercise()` es el único punto de entrada compartido por todas esas vías.

### Fundamentación

- **ACSM (2009) / NSCA**: los ejercicios compuestos van antes que los aislados dentro de una sesión — de ahí que el slot principal de cada músculo sea siempre nivel A/B y el tier de orden ponga los A/B antes que los C/D.
- **Nunes et al. (2021)**: el orden de ejercicios dentro de la sesión importa para las ganancias de fuerza (los ejercicios hechos primero, con el sistema nervioso más fresco, progresan mejor), pero importa mucho menos para hipertrofia — esto es lo que justifica priorizar el orden por tier/patrón sin necesidad de un esquema más rígido.
- **Evitar el mismo patrón de movimiento consecutivo** por fatiga periférica: dos ejercicios del mismo patrón seguidos comparten los mismos músculos estabilizadores y agonistas ya fatigados de la serie anterior, dando peor rendimiento en el segundo — de ahí la regla dura de `pattern` distinto entre consecutivos.
- **Kassiano et al. (2022)**: la variación sistemática de ejercicios (rotar patrones, alternar énfasis) es beneficiosa, pero la variación aleatoria excesiva (cambiar todo constantemente sin ningún criterio) dificulta la progresión — de ahí que el principal de cada músculo siga el historial reciente (`historyScore`) en vez de ser puramente al azar, y que `regenerate` solo aleatorice los accesorios, no el ejercicio principal.
- **Estabilidad necesaria para la doble progresión** (sección 12): el sistema de progresión compara la sesión actual contra la anterior con el mismo ejercicio — si el generador cambiara el ejercicio principal de cada músculo en cada sesión, la doble progresión nunca tendría dos sesiones consecutivas del mismo ejercicio para comparar. Por eso el principal prioriza el ejercicio con más historial reciente, incluso al regenerar.

---

## 17. SUGERENCIA DIARIA (`src/utils/dailySuggestion.js`, `src/pages/Inicio.jsx`)

### El bug que motivó la reescritura

La versión anterior (`getDailySuggestion()`, eliminada) hacía su **propio fetch a Firestore** (`getWorkouts(uid, 500)`) en vez de usar el historial ya cargado en memoria por `useWorkouts`. Si ese fetch fallaba (sin red), `getWorkouts` atrapa el error y devuelve `[]` — `getDailySuggestion` entonces veía `real.length === 0` y caía en el fallback de "primer entrenamiento", sugiriendo siempre `builtinRoutines[0]` aunque el usuario tuviera meses de historial. Además: descanso fijo los domingos (sin mirar si el usuario ya cumplió sus días), solo eligiendo entre las 5 rutinas fijas, con un desempate (`days = 999` para "nunca entrenada") que siempre le ganaba a cualquier rutina con historial real, y sin mirar el volumen de la semana por músculo.

### `computeDailySuggestion({ workouts, profile, today })` — función pura

Sin fetch, sin `Date.now()` interno — recibe `today` (`'YYYY-MM-DD'`) inyectado, así es 100% testeable con fechas fijas. Solo considera `workouts` con `type` en `REAL_WORKOUT_TYPES` (`fuerza`/`cardio`/`clase`/`tabata`, de `streak.js`).

1. **Ya entrenó hoy** (`real.some(w => w.date === today)`) → `{ type: 'trained_today' }`.
1b. **Rutina de regreso** (sección 20): con 15+ días desde el último workout de fuerza devuelve `{ type: 'regreso', ... }` antes de todo lo demás, salvo que se pase `skipReturn: true` ("Hoy no"). Parámetros nuevos de `computeDailySuggestion`: `neverIds`, `skipReturn`.
2. **Descanso inteligente** (reemplaza el domingo fijo):
   - `diasObjetivo = profile?.diasSemana ?? 3`. Si los días **distintos** con entrenamiento real de lunes a ayer ya llegan a `diasObjetivo` → `{ type: 'descanso', sub: 'Ya cumpliste tus {n} días de la semana 💜' }`.
   - Si hubo entrenamiento real ayer, anteayer y hace 3 días (3 días consecutivos) → `{ type: 'descanso', sub: 'Llevás 3 días seguidos...' }`.
   - Un domingo sin ninguna de estas dos condiciones **ya no** es descanso automático.
3. **Cardio** — misma regla que la versión anterior, sin cambios: `cardioCount === 0 && fuerzaCount >= 2`, o `cardioCount === 1 && remainingWorkingDays <= 2` (semana actual, lunes a antes de hoy) → `{ type: 'cardio' }`.
4. **Músculos de fuerza foco** — solo pueden ser foco:
   ```js
   const LOWER = ['Glúteos', 'Isquios', 'Cuádriceps']
   const UPPER = ['Espalda', 'Pecho', 'Hombros']
   ```
   Nunca Gemelos, Abductores, Tríceps, Bíceps, Abdominales ni Core & Estabilidad — son accesorios, no el foco de una sesión completa.
   - `recent`: músculos (`originalMuscle ?? muscle` de cada ejercicio, más `muscleGroups`) de sesiones de fuerza hechas ayer o anteayer — se excluyen de la elección.
   - `weekCount[m]`: días distintos de esta semana (lunes a ayer) con fuerza de ese músculo.
   - `daysSince[m]`: días desde la última sesión de fuerza con ese músculo, **tope 14** (nunca entrenado = 14 también, no `Infinity` ni `999` — así una rutina jamás entrenada no le gana automáticamente a todo lo demás, a diferencia del bug de la versión anterior).
   - Elegibles = no están en `recent`, ordenados por `weekCount` ascendente → `daysSince` descendente → orden fijo de la lista (así el desempate es determinístico, no aleatorio).
   - Se elige el mejor `LOWER` elegible y el mejor `UPPER` elegible; si un lado no tiene ninguno elegible, se toman los 2 mejores del otro lado. Si no hay 2 músculos elegibles en total → `{ type: 'descanso', sub: 'Tus músculos se están recuperando...' }`.
5. **Prearmada solo si encaja exactamente**: se busca en `builtinRoutines` una rutina cuyo `r.muscles` incluya los 2 músculos elegidos **y** que ninguno de sus músculos (ni siquiera los que no fueron elegidos, ej. un tercer músculo de una rutina de 3+) esté en `recent`. Entre varias, gana la de menos músculos extra (más ajustada a lo elegido). Si hay match → `{ type: 'fuerza', routineId, routineName, muscles, reason }`.
6. **Si ninguna prearmada encaja**: se genera con el mismo algoritmo del generador de rutinas (sección 16) — `generateRoutine({ muscles: [m1, m2], count: 5, equip: 'Gym completo', workouts })` → `{ type: 'fuerza', generatedIds, title: '{m1} + {m2}', muscles, reason }`.
7. **`reason`**: una línea por músculo elegido, unidas con ` · ` — `"{m}: 0 veces esta semana"` si `weekCount[m] === 0`, si no `"{m}: {daysSince[m]} días sin entrenar"`.
8. **Usuario sin ningún entrenamiento real todavía**: no hay un branch especial — corre la misma lógica normal (todo empata en `weekCount=0`/`daysSince=14`, así que elige `Glúteos` + `Espalda`, los primeros de cada lista) y, como ninguna `builtinRoutine` tiene exactamente esos dos, cae en el generador. Solo se le agrega `sub: '¡Tu primer entrenamiento! 💜'` al resultado.

### Integración en `Inicio.jsx` — usa el historial local, no un fetch propio

```js
const { workouts, loading, ... } = useWorkouts()
...
const computed = computeDailySuggestion({ workouts, profile, today: getTodayLocal() })
```

Si `loading && !workouts.length` (sin caché local todavía y sin respuesta de Firestore) el `useEffect` no calcula nada — la card queda en un estado de carga explícito ("Buscando tu sugerencia del día...") en vez de mostrar por defecto el fallback de "primer entrenamiento" por falta de datos, que era exactamente el bug original.

### Cache diaria (`localStorage`, clave `daily_suggestion_{uid}`)

```js
{ date: 'YYYY-MM-DD', realCount: number, suggestion: {...} }
```
Se reusa si `date === hoy` **y** `realCount` (cantidad de workouts reales en memoria) no cambió desde que se guardó — evita recalcular en cada render/remontaje de `Inicio.jsx` mientras nada relevante cambió. Si el usuario guarda un entrenamiento real (o cambia el día), `realCount` o `date` difieren y se recalcula. Lecturas/escrituras envueltas en `try/catch` (mismo patrón que el resto de la app — `localStorage` puede tirar en modo privado o con storage bloqueado).

### UI (`DailySuggestionCard`)

Muestra `suggestion.routineName ?? suggestion.title` (o `'Cardio o Clase 🏃'` para el tipo cardio) como título, y `suggestion.sub ?? suggestion.reason` como detalle expandible. Al tocar "Empezar":
- `routineId` → navega a `/registro` con `state: { type: 'fuerza', routineId }`, igual que antes.
- `generatedIds` → arma un draft con `pendingGeneratedIds` (mismo mecanismo que `GeneradorTab.useRoutine`, sección 16) y navega a `/registro` sin `state` — `FuerzaFlow.jsx` los detecta al montar y construye cada entrada con `buildEntry` (precarga = última sesión real de cada ejercicio, sección 13).
- `cardio` → navega a `/registro` con `state: { type: 'cardio' }`.

---

## 18. REGISTRO DE CARDIO (`src/utils/cardio.js`, `src/components/registro/CardioFlow.jsx`)

### Antes de este cambio

El tiempo se pedía como un solo input numérico en minutos (`tiempo`, entero), la distancia en km (`distancia`), y el ritmo (`ritmo`) era texto libre tipeado a mano ("5:30"), pedido solo para la actividad "Running". Ese estado se investigó antes de tocar nada (para no romper compatibilidad): `achievements.js` (`getAvgPaceMinPerKm`/`ritmoSolido`, `getTotalRunningKm`) calcula el ritmo **de nuevo, por su cuenta**, dividiendo `w.tiempo / w.distancia` directamente — nunca lee el campo `ritmo` guardado. `ritmo` en Firestore era puramente un campo de display (usado solo en el detalle del calendario), sin ningún consumidor de cálculo.

### Campos en Firestore (workout `type: 'cardio'`)

```js
{
  type: 'cardio', date, fatigue, notes, activity,
  durationSeconds: 1935,      // NUEVO — fuente de verdad del tiempo, en segundos
  tiempo: 32,                 // sigue existiendo — minutos, redondeado, derivado de durationSeconds
  distancia: 5.8,             // sin cambios
  paceSecondsPerKm: 334,      // NUEVO — segundos por km, redondeado
  ritmo: '5:34',              // sigue existiendo — "m:ss" (sin "/km"), derivado de paceSecondsPerKm
  createdAt: serverTimestamp(),
}
```

`durationSeconds` y `paceSecondsPerKm` son los campos nuevos y la fuente de verdad hacia adelante. `tiempo` y `ritmo` se siguen escribiendo, derivados de los nuevos campos en el momento de guardar (`WorkoutWizard.jsx`), **exactamente en el mismo formato que antes** (`tiempo` en minutos enteros, `ritmo` como "m:ss" sin sufijo) — así `achievements.js` y cualquier otro código que ya los lee sigue funcionando sin tocarlo. `ritmo`/`paceSecondsPerKm` quedan en `null` si el ritmo calculado supera 60 min/km (caso degenerado, ej. una caminata rarísima) en vez de guardar un valor sin sentido.

### Compatibilidad con workouts viejos

Los workouts guardados antes de este cambio no tienen `durationSeconds` ni `paceSecondsPerKm`. Dos helpers en `cardio.js` resuelven esto para **todo** el código que muestra un cardio:

```js
getEffectiveDurationSeconds(workout) // usa durationSeconds si existe; si no, workout.tiempo * 60
getEffectivePaceSecondsPerKm(workout) // usa paceSecondsPerKm si existe; si no, lo deriva de duración + distancia
```

Todos los lugares que muestran un cardio (`WeekCalendar.jsx`, `WorkoutHistorial.jsx`, `ProgresoPage.jsx`, `Inicio.jsx` → `LastWorkoutModal`, `WorkoutSummary.jsx`) pasan por estos dos helpers en vez de leer `durationSeconds`/`tiempo` directamente — así un workout de antes de este cambio se muestra igual de bien que uno nuevo, sin ninguna migración de datos.

### 1. Input de tiempo — tres campos numéricos

`CardioFlow.jsx` reemplaza el input único de minutos por tres inputs en fila (horas : minutos : segundos), `inputMode="numeric"`, con `onFocus={e => e.target.select()}` para seleccionar el contenido al tocar. Horas es opcional (vacío = 0, sin tope). Minutos y segundos se clampean a `[0, 59]` en cada cambio (`clampMinSec`). Estos tres valores (`horas`/`minutos`/`segundos`) se guardan en el draft de la sesión (`data`, vía `WorkoutDraftContext`) igual que `distancia`/`activity`, así se preservan si el usuario cierra y retoma el registro.

### 2. Distancia

Sin cambios — el mismo input numérico en km de siempre.

### 3. Ritmo / velocidad promedio — ya no es un input

Se calcula en vivo, mostrado como campo de solo lectura (mismo estilo visual que los demás campos, un `<div>` en vez de `<input>`):
- Para cualquier actividad menos "Bici": `formatPace(computePace(durationSeconds, km))` → `"m:ss /km"`.
- Para "Bici": `computeSpeedKmh(durationSeconds, km)` → `"xx,x km/h"`, con el label del campo cambiando a "Velocidad promedio".
- Si falta tiempo o distancia: `"—"`.

Se recalcula en cada render a partir de los inputs de tiempo/distancia — no hay estado propio ni debounce, así que se actualiza en vivo mientras se tipea.

### 4. Helpers puros (`src/utils/cardio.js`)

| Función | Qué hace |
|---|---|
| `toSeconds(h, m, s)` | horas+minutos+segundos → segundos totales |
| `formatDuration(seconds)` | `"h:mm:ss"` si hay horas, `"mm:ss"` si no (minutos siempre con 2 dígitos; horas nunca rellenadas) |
| `computePace(seconds, km)` | segundos por km, o `null` si falta tiempo o distancia |
| `formatPace(secPerKm)` | `"m:ss /km"` (minutos sin rellenar) — `"—"` si no hay pace o supera 60 min/km |
| `computeSpeedKmh(seconds, km)` | `"xx,x"` (string, coma decimal) — `"—"` si falta tiempo o distancia |
| `getEffectiveDurationSeconds(workout)` | `durationSeconds` si existe, si no lo deriva de `tiempo` (compatibilidad) |
| `getEffectivePaceSecondsPerKm(workout)` | `paceSecondsPerKm` si existe, si no lo deriva de duración+distancia (compatibilidad) |

### 5. Visualización

Donde se muestra un cardio, el tiempo usa `formatDuration()` (`"h:mm:ss"` o `"mm:ss"`) y el ritmo `formatPace()` (`"m:ss /km"`), o la velocidad para Bici — reemplaza los `"{tiempo} min"` / texto libre de `ritmo` que se mostraban antes en cada pantalla.

Verificado con corridas sintéticas sobre los helpers (casos exactos del pedido) y con un workout de cardio simulado sin `durationSeconds`/`paceSecondsPerKm` (formato viejo) mostrando el mismo resultado que uno con los campos nuevos, vía los helpers de compatibilidad.

---

## 19. ENTRENAMIENTO EN CURSO (`src/context/WorkoutDraftContext.jsx`, `src/utils/draftResolution.js`)

### Antes de este cambio

El borrador del wizard (`WorkoutWizard.jsx`) vivía en `sessionStorage`, clave `'workoutDraft'`. En iOS, cuando la PWA se cierra o pasa mucho tiempo en segundo plano, el sistema puede matar el proceso y `sessionStorage` se pierde — el usuario volvía a `/registro` y encontraba todo vacío, aunque hubiera cargado varios ejercicios.

No confundir con `workout_draft_{uid}` (`src/utils/draftQueue.js`): esa es la cola de workouts **ya completados** que no se pudieron guardar en Firestore por falta de red — un mecanismo totalmente distinto, que este cambio no tocó.

### Persistencia local — `workout_in_progress_{uid}`

`WorkoutDraftContext.jsx` guarda el draft en `localStorage` (sobrevive al cierre de la app), con clave por usuario para no mezclar sesiones si hay más de una cuenta en el mismo dispositivo. Cada `setDraft(data)`:
1. Preserva `startedAt` (timestamp) y `startedDate` (`YYYY-MM-DD` local) del draft existente si ya había uno — se fijan una sola vez, en el momento en que se crea el borrador (primer `setDraft` después de estar en `null`), y nunca se pisan en cambios posteriores.
2. Pisa `updatedAt` con `Date.now()` en cada llamada.
3. Escribe en `localStorage` de forma síncrona (try/catch — si el storage no está disponible, sigue funcionando solo en memoria).
4. Programa el respaldo en la nube (debounce, ver abajo).

Todo lo que ya persistía en el draft (`step`, `type`, `detail` con `exercises`/`sets` (con `isExtra`, `_pending`, `_opt`)/`suggestionDismissed`/`pendingGeneratedIds`, `fatigue`, `notes`, `date`) se mantiene tal cual — el cambio es solo el mecanismo de storage y los tres campos de timestamp nuevos.

### Respaldo en la nube — `users/{uid}/data/workoutInProgress`

Mismo patrón de documento singleton por usuario que `profile`/`settings`/`achievements`/`favorites`/`never` (`src/services/db.js`). `saveWorkoutInProgress`/`getWorkoutInProgress`/`deleteWorkoutInProgress` atrapan cualquier error de red internamente y no lo propagan: sin conexión, el guardado local alcanza y Firestore se sincroniza solo cuando vuelva la red (nunca bloquea ni muestra un error al usuario).

El guardado en la nube está debounced a ~5 segundos después del último cambio (`scheduleCloudSave`, temporizador reiniciado en cada `setDraft`), para no escribir en Firestore en cada tecla. Además, hay un guardado inmediato (`flushCloudSave`, cancela el debounce pendiente y guarda ya) en:
- `visibilitychange` → `document.visibilityState === 'hidden'` (la app pasa a segundo plano)
- `pagehide` (la app se cierra o navega fuera)

### Reglas de restauración al abrir la app

`resolveDraft()` (llamado una sola vez por apertura, desde `Inicio.jsx`) hace la reconciliación local-vs-nube:

```js
pickNewerDraft(local, cloud)  // usa el que tenga updatedAt más reciente; si solo hay uno, ese
isDraftExpired(draft)         // true si updatedAt tiene 7 días o más
draftHasRealContent(draft)    // fuerza: al menos 1 ejercicio · cardio/clase: algún dato cargado
```

Estas tres funciones puras viven en `src/utils/draftResolution.js` (sin dependencias de React/Firebase) para poder testearlas de forma aislada. Si la nube ganó, `resolveDraft()` sobreescribe el `localStorage` con esa versión antes de devolverla, así el resto de la app (incluido `WorkoutWizard.jsx` si el usuario navega a `/registro`) ve siempre la versión correcta desde el contexto.

Flujo en `Inicio.jsx`:
- Si el draft ganador está expirado (7+ días) → se borra (local + nube) sin preguntar, sin mostrar nada.
- Si no tiene contenido real (ej. quedó en el paso 1 sin cargar nada) → no se muestra el modal.
- Si tiene contenido real y menos de 7 días → modal "¿Continuás donde lo dejaste?" (`Modal.jsx`), con resumen en una línea: `Tipo · detalle (cantidad de ejercicios o actividad/clase) · empezado hoy/ayer/el {fecha} a las HH:MM` (usa `startedAt`, no `updatedAt`).
  - **Continuar** → navega a `/registro` (el draft ya está cargado en el contexto; `WorkoutWizard.jsx` lo lee vía `useWorkoutDraft()` en su `useState` inicial, exactamente igual que ya hacía con el draft de sesión).
  - **Descartar** → borra local + nube, cierra el modal.
  - Cerrar el modal tocando afuera o la X → NO descarta nada, solo lo oculta esta vez (el draft sigue ahí y se vuelve a ofrecer en la próxima apertura).
- **Prioridad**: mientras la resolución está pendiente o hay un draft para retomar, se difieren el aviso de inactividad y el resumen semanal a otra apertura (no se pierden — el resumen semanal no llega a marcarse como "visto" esta vez, así que su `useEffect` reintenta la próxima vez que se cumplan sus condiciones).
- El modal solo se renderiza dentro de `Inicio.jsx` (ruta `/`), así que nunca puede aparecer estando ya en `/registro` con ese mismo draft cargado.

### Fecha del workout restaurado

No hizo falta tocar `WorkoutWizard.jsx` para esto: su estado `date` ya se inicializaba como `savedDraft?.date ?? todayStr()` y se persiste en cada cambio del draft. Como ese campo se fija al crear el draft (mismo momento que `startedDate`) y solo cambia si el usuario edita el input de fecha, "usar `startedDate` salvo cambio manual" ya era el comportamiento existente — simplemente ahora sobrevive el cierre de la app en vez de perderse con `sessionStorage`.

### Limpieza — cuándo se borra el draft (local + nube)

`clearDraft()` (contexto) borra ambos lados siempre. Se llama en:
- `WorkoutWizard.jsx` → `handleSave`, tras un `saveWorkout` exitoso — incluye el camino de guardado offline: `useWorkouts.saveWorkout` devuelve `{ id, pending }` y solo lanza si ni el borrador local se pudo guardar (`draft-storage-failed`); en los demás casos (subido o borrador) el bloque `try` que llama a `clearDraft()` cubre los dos.
- `WorkoutWizard.jsx` → confirmar "Sí, cancelar" en el diálogo de cancelación.
- `WorkoutWizard.jsx` → `step === 0` (vuelta a la pantalla de elegir tipo, ya limpiaba el draft antes).
- `ConfigPage.jsx` → `handleLogout`, antes de `logout()` (para que `uid` todavía sea válido al disparar el `deleteDoc`).
- `Inicio.jsx` → botón "Descartar" del modal de continuar.

`stripSuggestedFlags` sigue aplicándose sobre `exercises` antes de guardar el workout final en Firestore (sin cambios) — los flags de UI (`_pending`, `_opt`, `suggestionDismissed`) sí se preservan en el borrador **en curso** (tienen sentido mientras se está entrenando), pero nunca llegan al workout guardado.

### Reglas de Firestore

No existe un `firestore.rules` en este repo (`firebase.json` no tiene clave `"firestore"`), y la CLI de Firebase instalada acá no tiene comando para leer las reglas en producción — las reglas actuales solo se pueden ver/editar desde la consola de Firebase. `workoutInProgress` vive bajo el mismo patrón de ruta que `profile`/`settings`/`achievements`/`favorites`/`never` (`users/{uid}/data/{docId}`), que ya funcionan hoy con distintos nombres de documento bajo ese mismo path — la conclusión práctica es que la regla vigente casi con certeza matchea `docId` como wildcard (no una lista fija de nombres), por lo que `workoutInProgress` ya queda cubierto sin necesidad de cambiar nada. No se creó ni desplegó ningún `firestore.rules` nuevo para no arriesgar reemplazar el ruleset real (gestionado en la consola) por una versión adivinada e incompleta. Si en algún momento se quiere verificar esto con certeza, hay que revisar las reglas directamente en la consola de Firebase (Firestore → Reglas) para el proyecto `my-workout-ro`.

Verificado con un script de Node contra la implementación real de `draftResolution.js` (local más nuevo que nube → usa local; solo nube → usa nube; nube más nueva → usa nube; 8 días → expirado; 6 días → no expirado; fuerza sin ejercicios / cardio vacío → sin contenido real; fuerza con 1 ejercicio / cardio con actividad → contenido real) — todos los escenarios pasaron.

---

## 20. RUTINA DE REGRESO (`src/utils/returnRoutine.js`, `src/pages/Inicio.jsx`, `src/components/registro/FuerzaFlow.jsx`)

Un full body de 5 ejercicios que se **sugiere** al volver después de un parate largo de **fuerza**. Respeta el principio de la sección 13 ("Precarga = última sesión real, siempre"): nada se modifica solo — la precarga normal sigue igual, y la reducción de pesos solo se aplica a la sesión que el usuario arma tocando "Empezar".

### Disparo

`getReturnTrigger(workouts, today)`: toma la fecha más reciente entre los workouts con `type === 'fuerza'` (cardio, clase y tabata **no** cuentan; ignora fechas futuras). Si pasaron `RETURN_MIN_DAYS = 15` días o más, se dispara. Un usuario sin ningún workout de fuerza no dispara (no hay "regreso" posible).

`computeDailySuggestion` lo evalúa justo después de "ya entrenó hoy" (si hoy ya entrenó cualquier cosa se muestra "¡Ya entrenaste!" y no la rutina de regreso) y **reemplaza** al resto de la sugerencia diaria: devuelve `{ type: 'regreso', daysSince, lastStrengthDate, reductionPct, generatedIds, muscles }`. Si no se pudo armar ningún ejercicio devuelve `null` y se sigue con la sugerencia normal.

`Inicio.jsx` muestra la tarjeta "🔁 Rutina de regreso" ("Hace X días que no entrenás fuerza. Te armé un full body para retomar con pesos ajustados.") con dos botones:
- **Empezar**: arma el borrador del wizard (`setDraft`) con `detail.pendingGeneratedIds`, `detail.selectedMuscles` y `detail.regreso = { pct, days }`, y navega a `/registro`. Igual que la sugerencia generada normal, `FuerzaFlow` construye cada ejercicio con `buildEntry` (mismas series, reps y pesos de la última sesión real) y, **solo si existe `data.regreso.pct`**, aplica `applyReturnReduction` encima.
- **Hoy no**: guarda la fecha en `localStorage` (`regreso_dismissed_{uid}`) y recalcula con `skipReturn: true` — se muestra la sugerencia normal por el resto del día (al día siguiente la tarjeta vuelve si el parate sigue).

El aviso de inactividad de 14 días (sección 14) **no se toca**: es independiente (cuenta cualquier tipo de workout real, umbral 14, y es solo informativo).

Caché: la sugerencia del día se cachea en `daily_suggestion_{uid}`; la entrada ahora también guarda `skipReturn` y un `profileKey` (`nivel|motivo|lastWorkoutDate` de inactividad). Si cambia alguno (por ejemplo, se responde el aviso de 14 días con "Enfermedad"), la sugerencia cacheada de hoy se recalcula para que el % incluya el modificador nuevo. La lista "never" se pide a Firestore (`getNeverList`, con timeout de 3 s y fallback a lista vacía si falla u offline) antes de calcular por primera vez en el día.

### Ejercicios

Se usa `generateRoutine` (sección 16) con `equip: 'Gym completo'` (igual que `dailySuggestion`) y un músculo por slot, con patrones permitidos:

| Slot | Músculo (alternativas) | Patrones permitidos |
|---|---|---|
| Rodilla | Cuádriceps | `sentadilla`, `zancada` (no `extension_rodilla`) |
| Cadera posterior | Isquios o Glúteos | `bisagra`, `empuje_cadera` |
| Empuje superior | Pecho u Hombros | `empuje_horizontal` / `empuje_vertical` (Pecho); `empuje_vertical` (Hombros) |
| Tracción | Espalda | `traccion_vertical`, `traccion_horizontal` |
| Core | Abdominales o Core & Estabilidad | `core_flexion`, `core_antiextension`, `core_rotacion` |

Cuando un slot tiene dos músculos posibles, gana el que tenga el ejercicio con mayor `historyScore` (empate → el primero de la tabla). Solo cuentan ejercicios de **nivel A o B** (los que `generateRoutine` elige como principal de un músculo; "Core & Estabilidad" son todos D, así que en la práctica el core sale de Abdominales). Cada músculo aporta 1 ejercicio (`count` = cantidad de slots cubiertos, normalmente 5) y el orden es el de `orderRoutine` sin cambios (compuestos primero, core al final, reglas duras/blandas de patrón y zona).

Cambios en `routineGenerator.js` (todos **opcionales** y sin efecto si no se pasan — el generador de Rutinas, el modo Generador, "Sugerencia" del modo libre y la sugerencia normal se comportan igual que antes):
- `historyScore(workouts, exerciseId, refDate)` / `generateRoutine({ referenceDate })`: la ventana de 56 días se cuenta hacia atrás desde `referenceDate` en vez de desde hoy. La rutina de regreso pasa la **fecha del último workout de fuerza**, así elige ejercicios conocidos aunque el parate sea largo (con la ventana "hoy − 56", un parate de 56+ días daría historial vacío y elegiría al azar).
- `generateRoutine({ neverIds })`: excluye los `exerciseId` de la lista "never" del usuario (`data/never`, ver sección 9 — sigue sin UI para editarla, pero si tiene datos se respeta).
- `generateRoutine({ patternsByMuscle })`: restringe el pool de cada músculo a los patrones indicados.

### Reducción de pesos

`reductionPct = base + modificadores`, con `days` = días desde el último workout de fuerza:

| Días desde el último fuerza | Reducción base |
|---|---|
| 15 a 28 | −10 % |
| 29 a 56 | −15 % |
| 57 o más | −20 % |

Modificadores (se suman en puntos porcentuales):
- **+5** si `profile.nivel` es principiante (acepta `'principiante'` del onboarding y `'Principiante (<1 año)'` de ConfigPage).
- **+5** si `profile.inactividad.motivo` es `enfermedad` o `lesion` **y corresponde a este mismo parate**: `inactividad.lastWorkoutDate >= lastStrengthDate` (la fecha del último workout real cuando se respondió el aviso es igual o posterior al último de fuerza; si es anterior, el motivo es de un parate viejo y se ignora).

Máximo posible: 20 + 5 + 5 = −30 %. No se diferencia tren superior de inferior.

Aplicación (`reduceWeight`, `FuerzaFlow.applyReturnReduction`): parte de los pesos de la última sesión real de cada ejercicio (`getLastWeightsForExercise` vía `buildEntry`) y, serie por serie, hace `floorWeight(peso × (1 − pct/100), pesosAprendidos)` (sección 12: el mayor peso del pool aprendido + estándar que sea ≤ objetivo y ≥ 85 % del objetivo; si no hay, múltiplo de 2.5 hacia abajo, mínimo 1), con tope en el peso original. **Series y repeticiones no se tocan.** Peso vacío o 0 (peso corporal) queda igual. Un ejercicio sin historial se precarga como siempre (series vacías por defecto). Los ejercicios que el usuario agregue a mano después de empezar se precargan normal (sin reducción).

### Alcance, flag y relación con el modo regreso

- La reducción vive en el borrador (`detail.regreso`) y solo afecta a la sesión que arranca con "Empezar". En la pantalla de entrenamiento se ve un indicador discreto "🔁 Regreso: pesos −X %" sobre la lista de ejercicios.
- Al guardar (`WorkoutWizard.handleSave`) el workout lleva `regreso: true` y `regresoPct: X` (solo si `detail.regreso` existe y quedan ejercicios cargados). Son campos informativos: **la sesión cuenta como una sesión real normal** para racha, historial, PRs, logros y precarga (la próxima precarga será la de esta sesión, con los pesos reducidos).
- **Modo regreso (sección 15) sin cambios**: `getReturnState` ve el parate de 14+ días en cada ejercicio y, como el peso máximo de esta sesión reducida queda por debajo de `preGapLevel`, queda activo; `getProgressionAdvice` relaja entonces el umbral (1 sola sesión, sin bono de salto, tope en `preGapLevel`) y ofrece, de forma opcional, subir de a poco hasta recuperar el nivel previo. La rutina de regreso solo decide con qué pesos *arranca* esa primera sesión; volver al nivel anterior sigue siendo trabajo del modo regreso.

---

## 21. BUGS CONOCIDOS E INCONSISTENCIAS (auditoría de noviembre 2026)

> **Estado (noviembre 2026): #1, #2, #3, #4 y #9 están RESUELTOS (sección 22) y #8 (sección 23); el resto sigue solo reportado.** Los hallazgos se escribieron durante la limpieza de noviembre 2026, que no cambió comportamiento. Números de línea al commit de la limpieza. Los marcados "sin verificar" salen de leer el código, no de reproducirlos en un dispositivo. Complementa `AUDITORIA.md` (octubre 2026), que ya listaba el tope de 100 (B1) y el borrado automático de ejercicios custom (A3).

### Gravedad alta

**1. ✅ RESUELTO (noviembre 2026, sección 22) — Todo se calculaba sobre los 100 workouts más recientes.** *(Descripción original:)* `useWorkouts.js:32` → `getWorkouts(uid, 100)` (`db.js`, `limit(limitN)`). Dependen de esa ventana: `computeStreak` (`current` y `record`), `computeStreakStats`, la precarga (`getLastWeightsForExercise`, `getLearnedWeights`, `getPRForExercise`), `getReturnState` (modo regreso), `computeInactivityInfo`, la rutina de regreso y los logros. Escenario: usuaria con 4 sesiones por semana y 8 meses de historia (~130 workouts): `computeStreak` arranca en la semana del workout #100 (≈ 25 semanas atrás), así que `current` y `record` nunca superan ~25 aunque la racha real sea de 34 semanas, y esa primera semana puede quedar cortada a la mitad (menos días → no suma). Un ejercicio que hace cada 3 meses puede quedar fuera de los 100: se precarga con series vacías, no hay `preGapLevel` (el modo regreso no se activa), el PR se subestima y puede aparecer un falso "¡Nuevo récord! 🏆", y los pesos aprendidos se pierden. Los logros "Medio año"/"Aniversario" miran el entrenamiento más viejo *de esos 100*. Empeora con el tiempo: cualquier usuaria activa lo alcanza en ~6 meses.

**2. ✅ RESUELTO (noviembre 2026, sección 22) — Los borradores offline (`_pendingSync`) solo se sincronizaban ante un evento `online`.** *(Descripción original:)* `useWorkouts.js:78-86` es el único llamador de `syncDrafts` (`draftQueue.js:30`). Escenario: se guarda un entrenamiento sin red (queda en `localStorage`, `workout_draft_{uid}`), se cierra la app, y al día siguiente se abre ya con conexión: no ocurre ningún evento `online`, así que el entrenamiento queda sin subir indefinidamente (visible solo en este dispositivo, se pierde si se limpia el almacenamiento, no cuenta en otros dispositivos) hasta que la conexión se corte y vuelva. Relacionados: (a) `syncDrafts` no es idempotente ni tiene candado — dos corridas simultáneas (dos eventos `online` seguidos) suben el mismo borrador dos veces antes de que `removeDraft` lo saque; (b) entre el `addDoc` exitoso y `removeDraft` un `load()` puede devolver el workout subido *y* el borrador pendiente (duplicado transitorio en listas y logros); (c) `saveDraft` (`draftQueue.js:12`) hace `localStorage.setItem` sin `try/catch` — con el almacenamiento lleno o bloqueado lanza dentro del `catch` de `saveWorkout` y el entrenamiento se pierde.

**3. ✅ RESUELTO (noviembre 2026, sección 22) — `getWorkouts` tragaba los errores y devolvía `[]`, lo que pisaba el caché local.** *(Descripción original:)* `db.js` (`getWorkouts`, `catch` que devuelve `[]`) + `useWorkouts.js:32-35`: `load()` recibe `[]`, hace `writeCache(uid, [])` y `setWorkouts([])`. El `catch` de `load()` que lee `readCache` (`useWorkouts.js:36-41`) nunca se ejecuta. Escenario: un error transitorio (token vencido, `permission-denied`, red intermitente) deja a la usuaria con historial vacío esa sesión — racha 0, calendario vacío, precarga con series vacías, sugerencia diaria "primer entrenamiento" — y borra el caché que habría servido de respaldo hasta el próximo `load()` exitoso.

### Gravedad media

**4. ✅ RESUELTO (noviembre 2026, sección 22; verificado por simulación, no en un dispositivo) — Guardar un entrenamiento sin conexión podía quedar colgado.** *(Descripción original:)* `db.js:34` (`saveWorkout` → `await addDoc`) con `persistentLocalCache` (`firebase.js`): en Firestore la promesa de una escritura se resuelve cuando el servidor la confirma; sin red no se rechaza, queda pendiente. `WorkoutWizard.jsx` (`handleSave`) y `useWorkouts.saveWorkout` esperan esa promesa, y el respaldo `saveDraft` solo corre en el `catch`. Escenario: terminar la sesión en el gimnasio sin señal → "Guardando…" sin fin; si la usuaria sale y vuelve a cargar, el `addDoc` encolado por Firestore y un segundo intento manual generan un duplicado. Hay que probarlo en modo avión antes de dar por válido el sistema de borradores.

**5. `profile.equipamiento` no se usa en ningún lado.** `Onboarding.jsx:42` y `ConfigPage.jsx:12` guardan `'Gym completo' | 'Solo mancuernas y bandas' | 'Sin equipamiento'`; `routineGenerator.js:29` (`equipFilter`) solo entiende `'Gym completo' | 'Solo básico'` y los selectores (`GeneradorTab.jsx:12,20`, `FuerzaFlow.jsx:504`) arrancan siempre en 'Gym completo' sin mirar el perfil. `dailySuggestion.js:158` y `returnRoutine.js:123` fijan `'Gym completo'`. Escenario: usuaria con "Sin equipamiento" recibe como sugerencia del día o como rutina de regreso Peso Muerto con barra, Prensa, Remo con barra. El subtítulo del onboarding ("Filtramos ejercicios según esto", `Onboarding.jsx:36`) es falso hoy. Falta un mapeo perfil → filtro.

**6. El filtro 'Solo básico' tiene errores.** *(Corregido en noviembre 2026: ahora compara por palabra, normalizado, en singular y plural; ver sección 16, "Datos del catálogo y límites conocidos". El texto de abajo describe el estado de la auditoría.)* `routineGenerator.js:29-34` hace `e.equip.includes(<primera palabra>)` con `'Sin'`, `'Mancuernas'`, `'Banda'`, `'Tobilleras'`. Resultado medido sobre el catálogo de entonces (51 de 90 pasan): quedan afuera 19 ejercicios de equipamiento básico: los que dicen `'Mancuerna'` en singular (Sentadilla goblet `cua_03`, Remo con mancuerna `esp_05`, Hip Thrust unilateral `glut_11`, Press unilateral `hom_06`, entre otros) y los de Kettlebell, Fitball, Banco, Cajón, Disco o Pared; y pasan ejercicios de polea o barra por contener 'Banda' o 'Mancuernas' (`esp_07`/`hom_04` Face Pull con polea, `cor_02` Press Pallof, `glut_10`, `hom_01` Press hombros "Mancuernas/Barra", `tri_05`). En 'Solo básico', Espalda queda con un solo ejercicio de nivel A/B y Cuádriceps con 2.

**7. Ejercicios custom (sin `pattern` ni `unilateral`).** Se crean en `FuerzaFlow.jsx:559` con `level: 'C'`, `equip: ''` y sin esos campos; solo existen en el modo libre. Efectos: `generateRoutine`/`orderRoutine`/`pickForMuscle` leen únicamente el catálogo (`exercises.js`), así que **nunca** los eligen ni los ven en `historyScore` (un custom que la usuaria entrena todas las semanas no pesa en la elección). `suggestNextExercise` (`routineGenerator.js:293-297`) busca cada ejercicio de la sesión en el catálogo: un custom da `undefined`, no entra en `usedPatterns`, y si es el último de la lista `lastExercise` es `null` → se saltan las reglas duras/blandas de patrón y zona; `hasMainAlready` (`:303`) no lo cuenta como principal (nivel `undefined`), entonces vuelve a sugerir un principal de ese músculo. `hardRulesOk` con dos patrones `undefined` devolvería `false` (`undefined === undefined`) — hoy no se llama con customs, pero es una trampa si se reutiliza. En `PATTERN_REGION[undefined]` → `undefined`, por lo que un custom contaría como "no core" en `tierOf` si llegara a ordenarse.

**8. ✅ RESUELTO (noviembre 2026, sección 23) — `AuthContext` podía quedar cargando para siempre si fallaba la lectura del perfil.** *(Descripción original:)* `AuthContext.jsx:21-37`: el callback de `onAuthChange` es `async`, hace `clearTimeout(timeout)` al entrar y luego `await Promise.all([getUserProfile, getSettings])` sin `try/catch`. Si `getDoc` rechaza (primer inicio de sesión en un dispositivo sin red y sin caché del documento), `setLoading(false)` no se ejecuta y el timeout de 15 s ya fue cancelado → pantalla de carga permanente más un rechazo de promesa sin capturar.

**9. ✅ RESUELTO (noviembre 2026, sección 22) — `useWorkouts.load` podía pisar datos nuevos con una respuesta vieja.** *(Descripción original:)* `useWorkouts.js:28-45,68`: varios `load()` concurrentes (el de `saveWorkout`, el de `visibilitychange` y el intervalo de `Inicio.jsx:725-731`, el `online`) sin token de orden. Si una carga empezó antes de que `addDoc` confirmara y termina después de la actualización optimista de `saveWorkout`, `setWorkouts(data)` y `writeCache` reemplazan el estado sin el workout recién guardado hasta la próxima recarga (racha, calendario y precarga lo "pierden" un rato).

**10. El logro "Tabata master" es inalcanzable.** `achievements.js:408-413` cuenta `getTabataRecordCount` (colección `tabataRecords`), pero `saveTabataRecord` (`db.js`) no tiene ningún llamador, y ninguna pantalla guarda workouts de `type: 'tabata'` (el Tabata es un temporizador; `'tabata'` solo existe en `REAL_WORKOUT_TYPES` y en lecturas). Las sesiones nuevas de Tabata no cuentan para racha, logros ni historial.

**11. Borrado automático de ejercicios custom + `getCustomExercises` sin `catch`.** `FuerzaFlow.jsx:522-527` borra de Firestore, cada vez que se monta el flujo de fuerza, los custom llamados "Reverse Frog" o "Abducción con pausa" (migración vieja que quedó permanente; ya en `AUDITORIA.md` A3), aunque esos dos ejercicios siguen en el catálogo (`glut_reverse_frog`, `glut_abd_pausa`, también en `routines.js`). Escenario: la usuaria crea un custom con ese nombre y desaparece. Además `.then(...)` no tiene `.catch`: offline sin caché es un rechazo sin capturar.

**12. Dos entrenamientos el mismo día: orden indefinido.** `useWorkouts.js:88-98` y `:102-110` ordenan solo por `date` (granularidad de día). Con dos sesiones de fuerza del mismo ejercicio en una fecha (mañana y noche con pesos distintos), "la última sesión real" para la precarga y para `getReturnState` depende del orden estable del array, no del momento real; puede precargar la sesión más vieja del día.

### Gravedad baja

**13. Texto "hace 1 días" y desfase de un día.** `Inicio.jsx:94` (`fechaRelativa`): `differenceInDays(new Date(), d)` con `d` a las 12:00 trunca por horas; antes del mediodía, un entrenamiento de anteayer da 1 → "hace 1 días" (debería ser 2, y además falla la concordancia).

**14. Fechas en UTC donde debería ser local.** `achievements.js:375` convierte un timestamp con `toISOString()` (UTC) para obtener la semana del último "hamburguesaMerecida": en Argentina (UTC−3), un logro desbloqueado un domingo después de las 21:00 cae en la semana siguiente y altera el cooldown de 2 semanas. `ConfigPage.jsx:73` usa lo mismo para el nombre del archivo exportado (cosmético). El resto del código usa `dateToLocal`/`parseLocalDate` correctamente.

**15. Logros por horario usan `createdAt`, que no siempre es la hora real.** `achievements.js:179-183,285-293` miran la hora de `createdAt`. Workouts importados guardan `createdAt` = medianoche local de su fecha (`db.js:35`, `Timestamp.fromDate(parseLocalDate(dateStr))`), o sea hora 0 → pueden desbloquear los logros de "antes de las 8" / "antes de las 6:30". Los borradores sincronizados más tarde reciben `serverTimestamp()` del momento de sincronizar, no del entrenamiento.

**16. "Últimas 8 semanas" son los últimos 40 workouts.** `useDeload.js:9` y `ConfigPage.jsx:106` usan `workouts.slice(0, 40)` como si fueran 8 semanas (con 2 sesiones por semana son 20 semanas; con 10, 4). Además asumen el array ordenado por fecha descendente, algo que los borradores pendientes (antepuestos) no garantizan. Afecta solo la sugerencia de descarga.

**17. Escrituras de perfil sin rollback ni captura** *(parcialmente mejorado en noviembre 2026: `updateProfile` ya escribe solo los campos recibidos y usa `setProfile` funcional, así que el perfil viejo del cierre no pisa datos; sigue sin rollback ni `catch`)*. `AuthContext.jsx:45-50` (`updateProfile`) actualiza en memoria y luego hace `await saveUserProfile` sin `catch`; `Inicio.jsx:680-690` (`saveInactividad`) no espera ni captura. Si Firestore rechaza, el estado local queda con un valor que no se guardó. Además `updated = { ...profile, ...data }` usa el `profile` del cierre: dos `updateProfile` seguidos en el mismo render parten del mismo perfil viejo y el segundo puede reescribir valores del primero.

**18. Fechas futuras.** `WorkoutWizard.jsx` permite elegir cualquier fecha. `computeInactivityInfo` (`Inicio.jsx:208-221`) toma la fecha máxima sin descartar futuras: un workout cargado con fecha futura apaga el aviso de inactividad de 14 días hasta que esa fecha pasa. (La rutina de regreso sí ignora fechas futuras, `returnRoutine.js` `getReturnTrigger`.)

**19. `getTrainedMusclesRecovery` mide "horas" con fechas de día.** `useWorkouts.js:153-163` calcula un corte en horas (48/72) pero compara con `w.date >= cutoffStr` (solo día): un entrenamiento de hace 72–95 h puede contar como "reciente" según la hora del día.

**20. Archivos sin referencia que se dejaron.** `src/assets/valencia-portada.jpg`, `public/logo-full.png.png` y `public/logo-icon.png.png` (nombre con doble extensión) no están referenciados por ningún archivo (`public/` se despliega igual). `getFavorites`, `toggleFavorite`, `toggleNever` y `saveTabataRecord` (`db.js`) tampoco tienen llamadores; se conservaron a propósito (decisión de producto de la sección 9 y hallazgo 10).

### Limpieza de noviembre 2026 (sin cambios de comportamiento)

Eliminado tras verificar con búsqueda en todo el proyecto que no tenían referencias: componentes `FatigueChart.jsx`, `MonthCalendar.jsx`, `WeekChart.jsx` y `LastWorkoutModal` (en `Inicio.jsx`); hook `useAuth.js`; funciones `getExerciseById`, `getExercisesByMuscle`, `getExercisesByLevel` (`exercises.js`), `getWorkoutsByDateRange`, `getWorkoutsForExercise`, `getIntention`, `saveIntention`, `getIntentionHistory` (`db.js`), `getLocalTimezone`, `weekEnd`, `formatDate`, `daysUntilValencia`, `isAfterValencia`, `getWeekDays`, `getLast12Weeks`, `VALENCIA_DATE` (`dates.js`); y imports/variables sin uso. Los datos de Firestore (incluida la colección `intentions` y los documentos `pausa`/`descanso`) y el campo `profile.pausa` no se tocaron. Se quitó el texto "vuelta suave" de comentarios y del modal de inactividad. Historial: hasta septiembre 2026 el modo regreso se llamaba "vuelta suave / reentrada" y reducía peso y series en la precarga (sección 15).

---

## 22. GUARDADO, SINCRONIZACIÓN Y LECTURA FIABLES DE WORKOUTS (noviembre 2026)

Objetivo: que ningún entrenamiento se pierda, se duplique ni desaparezca de la pantalla. Resuelve los hallazgos #1, #2, #3, #4 y #9 de la sección 21. Archivos: `src/context/WorkoutsContext.jsx`, `src/utils/workoutCache.js`, `src/services/db.js`, `src/utils/draftQueue.js`, `src/utils/workoutSave.js` (lógica sin React, probada con scripts), `src/utils/withTimeout.js`, `src/hooks/useWorkouts.js`, `WorkoutWizard.jsx`, `WorkoutSummary.jsx`.

### 1. IDs fijos + `setDoc` (base de todo)

- `newWorkoutId(uid)` (`db.js`) = `doc(collection(db, 'users', uid, 'workouts')).id`: se genera en el cliente, sin red, antes del primer intento de subida. El workout tiene su ID definitivo desde que se crea.
- `saveWorkout(uid, workout, dateStr, { id, createdAtMs })`: con `id` hace `setDoc(doc(..., id), { ...workout, createdAt })`; reintentar —o que una escritura anterior termine llegando tarde— **sobrescribe el mismo documento** y no crea otro. `createdAt` es `Timestamp.fromMillis(createdAtMs)` (el mismo valor en todos los intentos; así también se conserva la hora real de un borrador subido después y mejora el hallazgo #15). Sin `id` sigue usando `addDoc` (solo la importación de datos en `ConfigPage.jsx`).
- Requisito de las reglas de Firestore (que no están en el repo): el usuario debe poder `create` **y** `update` en `users/{uid}/workouts/*` (un reintento sobre un documento ya creado cuenta como update).
- El borrador local usa `_draftId` = ese mismo ID; en las listas el workout pendiente tiene `id` = ID definitivo.

### 2. Guardar sin quedar colgado (`saveWorkoutWithFallback`)

1. Genera el ID y `createdAtMs`.
2. Con conexión (`navigator.onLine`): intenta `setDoc` con tope de **8 s** (`SAVE_TIMEOUT_MS`, `withTimeout`). Si confirma → `{ pending: false }`.
3. Si no hay conexión, la escritura falla o no se confirma en 8 s → `saveDraft` con el **mismo ID** (`_pendingSync: true`) y `{ pending: true }`. La escritura original no se cancela: si Firestore la termina enviando después, el reintento del borrador cae sobre el mismo documento.
4. `WorkoutWizard` cierra el flujo normal en ambos casos (limpia el borrador en curso, muestra `WorkoutSummary`); con `pending` el resumen dice "Guardado en tu dispositivo. Se va a subir solo cuando haya conexión.". Si había conexión pero no se confirmó, `useWorkouts` reintenta a los 20 s.
5. **Si ni el borrador local se puede guardar** (`localStorage` lleno o bloqueado): `saveDraft` lanza `draft-storage-failed` → `saveWorkout` lo propaga → el wizard **no cierra** y muestra un aviso ("No se pudo guardar el entrenamiento en este dispositivo… tus datos siguen acá"), con el botón "Reintentar"; el borrador en curso (`workout_in_progress_{uid}`) sigue intacto.

### 3. Sincronización de borradores (#2)

`syncPendingDrafts` → `syncDrafts` (`draftQueue.js`) sube cada borrador con `setDoc` y su `_draftId`, y lo saca de la cola solo si se confirmó. Se ejecuta **al abrir** (al montar `useWorkouts`, después de la primera lectura, si hay conexión), al evento `online`, al volver la app a primer plano (`visibilitychange`), tras cada guardado exitoso y 20 s después de un guardado no confirmado. Sin cambios de fondo: `navigator.onLine === true` no garantiza red real; si la subida falla o vence (15 s por borrador) el borrador queda en la cola y se reintenta en el próximo disparo.

**Candado**: `syncDrafts` guarda una promesa por usuario (`inFlight`); si ya hay una sincronización corriendo, el segundo llamador recibe **la misma promesa** (no empieza otra) y el candado se libera siempre (`finally`). Aunque dos pestañas corrieran a la vez, el `setDoc` con el mismo ID es idempotente.

### 4. Lectura (#3) y carreras (#9)

- `getWorkoutsSnapshot(uid, n)` devuelve `{ workouts, fromCache }` y **propaga** los errores (`getWorkouts` es un wrapper que también los propaga). Ya no hay un `catch` que devuelva `[]`.
- `loadWorkoutsSafely` (`workoutSave.js`, usado por `useWorkouts.load`): ante un error de lectura, un tope de 15 s vencido, o un resultado vacío que viene solo del caché de Firestore (`fromCache && !server.length`) cuando ya hay historial local, **no toca ni el caché de `localStorage` ni el estado**: devuelve `{ ok: false }`, el hook marca `loadError` y conserva lo que mostraba. Un vacío confirmado por el servidor (`fromCache: false`) sí es "no hay workouts".
- **Contador de lecturas** (`loadSeq`): cada `load()` incrementa el contador; al terminar, si ya empezó otra lectura más nueva, la respuesta se descarta (`{ stale: true }`) y no pisa nada. El spinner (`loading`) lo baja siempre la última lectura iniciada.
- **Un workout recién guardado o en borrador nunca desaparece**: `composeWorkoutList(uid, servidor, recent)` arma la lista con (a) los borradores pendientes (los que el servidor ya devolvió se descartan por ID), (b) `recent`: los workouts subidos en esta sesión (guardados o sincronizados), que se anteponen mientras la lectura del servidor no los incluya —cubre una lectura lenta que empezó antes del guardado—, y (c) lo del servidor, deduplicando por ID. Orden por fecha descendente (estable). `reconcileWithServer` quita de `recent` lo que el servidor ya devolvió y purga borradores cuya escritura original terminó llegando tarde.
- El caché local guarda servidor + recientes (sin borradores, que ya viven en `workout_draft_{uid}`). El estado inicial del hook incluye los borradores pendientes.

### 5. Historial completo, estado compartido y caché (#1)

- **Sin límite.** `getWorkoutsSnapshot(uid, limitN = null)` / `getWorkouts` traen **todos** los workouts del usuario (`orderBy('date', 'desc')` sin `limit`). Pasar un número sigue limitando, pero la carga principal no lo usa. La racha (hoy "Racha semanal 3+"), `detectPRs`, `getLearnedWeights`, precarga, modo regreso, `computeInactivityInfo`, rutina de regreso y logros (`cienDias`, `primerPaso`, `medioAnio`, `aniversario`, `hasFuerzaHistory`, "50"/"100 entrenamientos") operan ahora sobre el historial completo **sin ningún cambio en sus reglas**. Costo: una lectura de Firestore por workout en cada carga (con el caché se muestra al instante y se actualiza en segundo plano).
- **Un solo estado.** `WorkoutsProvider` (`WorkoutsContext.jsx`, montado en `App.jsx` dentro de `AuthProvider`) es el único dueño de: el estado de la lista, la carga (`load` con contador de lecturas `loadSeq`), el mapa de recientes, `syncPending` (borradores, con el candado de `draftQueue.syncDrafts`), `saveWorkout` (IDs fijos + fallback a borrador de 8 s) y **un solo** conjunto de listeners (`online`, `visibilitychange`). `useWorkouts()` (`src/hooks/useWorkouts.js`, ya sin parámetro) lee ese estado y expone los cálculos derivados; `Inicio`, `WorkoutWizard`, `ProgresoPage`, `RutinasPage`, `ConfigPage` y `Logros` ven todos la misma lista. Un guardado en el wizard ya es visible en el resto de las pantallas sin releer.
- **Cambio de usuario.** El estado lleva el `uid` al que pertenece; al cambiar de usuario se invalida cualquier lectura en vuelo (`loadSeq++`), se limpian los recientes y se vuelve a cargar; un logout/login nunca recibe datos del usuario anterior.
- **Frecuencia de lectura.** Se lee al abrir/loguear, tras cada guardado exitoso (en segundo plano), al volver la conexión y, con `refresh()` (lo usa `Inicio` al volver a primer plano o cambiar de día), como máximo una vez por minuto (`REFRESH_MIN_INTERVAL_MS`). `forceReload()` relee ya (lo usa la importación de datos de `ConfigPage`). Antes, cada instancia del hook (cada pantalla) hacía su propia lectura al montarse. Navegar entre pantallas ya no relee nada.
- **Caché (`workoutCache.js`).** `workouts_cache_{uid}` en `localStorage` guarda el historial completo (servidor + recientes, sin borradores) y se muestra al instante al abrir; la lectura completa lo actualiza en segundo plano. Un workout pesa del orden de 1–3 KB, así que cientos de workouts caben holgados en la cuota (~5 MB). `writeWorkoutCache` **nunca lanza**: si no entra, prueba con los 300 más recientes, luego los 100 y, si tampoco, borra la clave y sigue sin caché — es solo una aceleración, ningún cálculo depende de él porque el historial completo siempre se vuelve a leer. El tope de espera de la lectura completa subió de 15 a 30 s.
- **Orden.** `composeWorkoutList` devuelve la lista por fecha descendente (estable); lo asumen, por ejemplo, los logros `medioAnio`/`aniversario` (`real[real.length - 1]` = el más viejo) y `getLastFatigueForExercise`.
- **Revisado y sin cambios necesarios:** `useDeload`/`ConfigPage` usan `slice(0, 40)` = "los 40 más recientes" (sigue válido con la lista completa ordenada); `ProgresoPage` usa `slice(0, 5)` para "últimas sesiones"; el resumen post-guardado cuenta `workouts.length` (ahora el total real). Los logros ya desbloqueados están guardados en Firestore y no se pierden; los que antes no podían detectarse por la ventana (p. ej. "Aniversario" o "100 días entrenados" con un historial más largo que 100 workouts) se desbloquean en la próxima verificación y se celebran como cualquier logro nuevo.

### 6. Verificación

Simulación en Node (Firestore falso con `setDoc` idempotente, `localStorage` falso): guardar sin red → reconectar → una sola vez (y con dos sincronizaciones simultáneas, una sola subida); escritura que no confirma en el tope y llega tarde + reintento del borrador → un documento; abrir con conexión y borradores pendientes → se suben todos; un borrador que falla queda en la cola y libera el candado; error de lectura / lectura vacía desde caché / lectura colgada → el historial y el caché no se vacían; lectura lenta que empieza antes del guardado → el workout nuevo sigue visible; respuesta vieja descartada; `localStorage` lleno → `draft-storage-failed`. 25 de 25 casos. **No se probó en un dispositivo real en modo avión**: conviene hacerlo una vez (guardar un entrenamiento sin señal, cerrar la app, abrirla con conexión). Para el historial completo se comparó con un script, sobre un historial **sintético** (no datos reales; ~14 meses, 4 sesiones por semana, un parate de 5 semanas): con los 100 más recientes → 100 workouts, racha 23, récord 23, 100 días únicos, primer entrenamiento a 196 días; con el historial completo → 205 workouts, racha 31, récord 31, 205 días únicos, primer entrenamiento a 434 días ("Aniversario" pasa de no detectable a detectable); el PR de un ejercicio con marca vieja pasa de 79 a 80 kg y los pesos aprendidos de 11 a 12.

### 7. Límites conocidos

- Tras 8 s sin confirmación sobre una red lenta (pero real), la usuaria ve "se va a subir cuando haya conexión" aunque Firestore termine subiéndolo en segundos; es correcto y no duplica, solo es un mensaje conservador.
- Un borrador con `permission-denied` permanente se reintenta en cada apertura sin éxito (queda en la cola).
- Cada carga lee todos los workouts (lecturas de Firestore proporcionales al historial). Si en el futuro pesa, la salida natural es una lectura incremental (solo `date >= última fecha conocida`) sobre el caché; no se hizo para no tocar la fiabilidad de lo ya resuelto.
- Si el caché de `localStorage` no entra completo (se recorta a 300/100), el primer pintado al abrir muestra solo los más recientes hasta que termina la lectura completa.
- El resto de la sección 21 (hallazgos no marcados como resueltos) no cambió.

---

## 23. CARGA DEL PERFIL Y ESTADOS (noviembre 2026)

### El bug: onboarding visible ~1 segundo para un usuario ya registrado

**Causa (reproducida con una simulación del código anterior):** en el callback de `onAuthChange`, `AuthContext` hacía `setUser(firebaseUser)` **antes** de leer el perfil y el flag `loading` ya estaba en `false` (se baja una vez resuelta la primera notificación de Auth, incluida la de "no hay sesión"). Si el usuario aparecía después de ese momento —un login desde `AuthScreen`, o una sesión restaurada que llega después de una primera notificación sin usuario— había un render con `user` definido, `loading === false` y `profile === null` (aún sin leer). `App.jsx` evaluaba `!profile?.onboardingDone` y mostraba el onboarding (la pregunta de género) hasta que terminaba la lectura (~1 s) y `setProfile` lo mandaba a Inicio. Secuencia observada con la lógica vieja: `loading → auth → onboarding → app`.

**Descartado:** (a) *Caché de Firestore*: el SDK (v10, `readDocumentViaSnapshotListener`) **rechaza** `getDoc` cuando el documento no existe en el caché y el resultado es `fromCache` ("Failed to get document because the client is offline"), así que no devuelve un falso "no existe" desde el caché; igual ahora no se depende de eso (ver abajo). (b) *Commits de hoy*: `bb3b24d` (limpieza) no tocó `AuthContext`/`App.jsx`; `de4960d` (`WorkoutsProvider`) solo envolvió el árbol en `App.jsx` y no participa en la carga del perfil. El defecto es anterior (la estructura de `AuthContext` data de junio 2026; la notificación sin usuario antes del login siempre existió).

### Estados del perfil (`profileStatus` en `AuthContext`)

| Estado | Significa | Pantalla (`screenFor`, `src/utils/profileLoad.js`) |
|---|---|---|
| `idle` | no hay usuario | `auth` (login) |
| `loading` | leyendo perfil y ajustes | **"Cargando…"** (fondo y colores del tema: `bg-app-bg`, ícono morado). Nunca onboarding ni la app vacía |
| `error` | la lectura falló, tardó más de 15 s (`PROFILE_LOAD_TIMEOUT_MS`) o el dato no está confirmado | mensaje + botón **"Reintentar"** (`retryProfile`). Nunca onboarding |
| `missing` | el **servidor** confirmó que el perfil no existe (usuario nuevo) | `onboarding` |
| `ready` | perfil cargado | `onboarding` si `onboardingDone !== true`; si no, `app` |

`loading` (expuesto) es derivado: `user === undefined` sin timeout, o hay usuario con `profileStatus === 'loading'`. Orden de `screenFor`: `session-timeout` (Auth no respondió en 15 s) → `loading` → `auth` → `profile-error` → `onboarding` → `app`.

### Cómo se carga (`loadProfileState`, `AuthContext.loadFor`)

1. Al recibir un usuario **nuevo** (login o sesión recién restaurada): se resetean `profile`/`settings`, se hace `setUser` y `setStatus('loading')` **en el mismo lote de render**, y recién ahí se lee. Así nunca existe un render con usuario y sin perfil que caiga en el onboarding.
2. `getUserProfileSnapshot(uid)` devuelve `{ profile, fromCache }`; `loadProfileState` lee perfil y ajustes con tope de 15 s (`withTimeout`) y decide: perfil inexistente + `fromCache` → `error` (no es una respuesta); perfil inexistente confirmado por el servidor → `missing`; perfil desde el caché con `onboardingDone !== true` → `error` (puede estar viejo o parcial); cualquier otro perfil → `ready` (un perfil completo desde el caché sin red sí vale: la app arranca offline).
3. Un contador (`seqRef`) descarta lecturas viejas (cambio rápido de usuario, logout, reintento).
4. Si Auth vuelve a notificar al **mismo** usuario ya `ready`, no se pasa a `loading` (no se desmonta la app en uso).
5. Cierra el hallazgo #8: ya no hay un `async` sin `try/catch` que deje la pantalla cargando para siempre; cualquier fallo termina en `error` con "Reintentar".

### Protección del perfil existente

- `updateProfile(data)` escribe **solo** `data` con `setDoc(..., { merge: true })` (antes reenviaba el perfil completo de memoria, que podía estar desactualizado) y actualiza el estado local con un `setProfile` funcional.
- `completeOnboarding(data)` (lo usa `Onboarding.jsx` en el último paso): antes de escribir relee el perfil; **si ya existe con `onboardingDone: true` no escribe nada** y adopta ese perfil. Solo si no existe (o está incompleto) escribe `{ ...data, onboardingDone: true }` con merge. Si la relectura falla, escribe igual (el estado ya era `missing`/incompleto y la escritura es merge).

### Verificación

Simulación con jsdom y el `AuthProvider` real (Auth y Firestore simulados), 21 casos: la lógica anterior reproduce `loading → auth → onboarding → app`; la nueva da `auth → loading → app` (login con lectura lenta) y `loading → app` (arranque con sesión) sin pasar nunca por onboarding; error → "Reintentar" → app; usuario nuevo sin perfil (servidor) → onboarding; "no existe"/incompleto desde el caché → error; perfil completo desde el caché → app; perfil con `onboardingDone` falso → onboarding; evento repetido sin desmontar; cambio de usuario descarta la lectura vieja; `completeOnboarding` no pisa un perfil completo; `updateProfile` envía solo los campos nuevos; demora excesiva → error. No se probó contra Firebase real.

---

## 24. UNIDAD POR EJERCICIO (reps o segundos) Y FIN DEL TEMPORIZADOR ▶ (noviembre 2026)

Implementa la opción "a + unidad por ejercicio" del informe `INFORME_EJERCICIOS_TIEMPO.md`. Archivos: `src/data/exercises.js`, `src/utils/exerciseUnit.js` (nuevo), `src/utils/progression.js`, `src/utils/prUtils.js`, `src/components/registro/FuerzaFlow.jsx`, `WorkoutWizard.jsx`, `WorkoutSummary.jsx`, `WeekCalendar.jsx`, `WorkoutHistorial.jsx`, `BibliotecaTab.jsx`.

### El campo `unit`

- **Catálogo:** cada uno de los 90 ejercicios tiene `unit: 'reps' | 'secs'` (por defecto `'reps'`). Están en `'secs'` solo 7: **Sentadilla isométrica** (`cua_07`), **La Plancha** (`cor_01`), **Plancha lateral** (`obl_03`), **Hollow Body Hold** (`cor_04`) y, desde noviembre 2026, **Plancha Copenhague** (`adu_01`), **Paseo del granjero** (`cor_05`) y **Paseo de maleta** (`cor_06`) — los tres nuevos se tratan igual que los demás (peso opcional). Plancha con flexión (`abs_02`), Plancha con Arrastre de Mancuerna, Dead Bug (`obl_04`), Bird Dog (`cor_03`) y Press Pallof (`cor_02`) quedan en `'reps'`.
- **Workout guardado:** cada ejercicio dentro de `workout.exercises[]` lleva ahora `unit` (campo nuevo, **solo aditivo**). Se agrega en `buildEntry` (`FuerzaFlow.jsx`) y se garantiza al guardar en `stripSuggestedFlags` (`WorkoutWizard.jsx`, también para borradores armados antes de este cambio). **Los segundos se siguen guardando en `sets[].reps`** (ninguna lectura ni escritura previa se rompe) y el peso sigue en `sets[].weight` (opcional; puede ser `0`, `''` o faltar).

### `getExerciseUnit(exercise)` (`src/utils/exerciseUnit.js`)

Helper único. Orden de búsqueda:

1. `unit` guardada en el propio registro (`'reps'` o `'secs'`);
2. catálogo por id (`exerciseId` o `id`);
3. catálogo por **nombre exacto** (ids `alt-…` y alternativas que existen en el catálogo, p. ej. "La Plancha");
4. `'reps'`.

**No hay ninguna detección por substring del nombre** (la lista `TIME_EXERCISES` y su `name.includes(...)` se eliminaron; un ejercicio propio llamado "Mi plancha rara" es `'reps'`). Además exporta `isSecs`, `DEFAULT_SECS = 30` y `formatSetText(set, unit, style)` (texto de una serie: `"45 seg"`, `"45 seg × 10 kg"`, `"12 reps"`, `"12×20 kg"`; con peso 0, `""`, faltante o no numérico **no** se muestra `"· 0 kg"`; estilo `'dot'`: `"12 reps · 20 kg"`).

### Registro (`FuerzaFlow.jsx`)

- **Eliminados:** `TIME_EXERCISES`, `InlineTimer` (el botón ▶, el ⏹ y la cuenta regresiva trabajo/descanso por serie), el botón **Reps/Segs** junto al nombre, la columna "Timer" y el estado `useSeconds` / `activeTimerIdx`. Con eso desaparece también el bug (descrito en `INFORME_EJERCICIOS_TIEMPO.md`) del estado `useSeconds` que quedaba pegado al ejercicio de la misma posición después de "Cambiar" (la unidad ahora sale del ejercicio, no de un estado por índice). **Se mantiene `InlineRestTimer`** (descanso entre series) sin cambios.
- **Rótulos:** en un ejercicio `'secs'` la columna se llama **"Seg"** (en vez de "Reps") y la de peso **"Peso (kg) opc."**; la fila sigue siendo de 3 columnas.
- **Precarga:** igual que antes (última sesión real tal cual). En `'secs'`, si no hay historial, 3 series de **30 seg** (en `'reps'`: 10/12 según nivel); si una serie vieja trae segundos vacíos o 0, también 30.
- **Cambiar / alternativa:** una alternativa que existe en el catálogo toma su `unit`; una alternativa que **no** está en el catálogo (id `alt-…`) **hereda la unidad del ejercicio que se estaba haciendo** (La Plancha → "Plancha en rodillas" sigue en segundos, con 30 por defecto).

### Progresión de ejercicios en `'secs'` (`getProgressionAdvice`, parámetro `unit`)

`getProgressionAdvice(..., returnState, unit)`: `unit` es opcional; si no se pasa se resuelve con `getExerciseUnit({ exerciseId, name })`. En `'secs'` **no se aplican umbrales de reps (`REP_RANGES`), `jumpBonus` ni Epley**; el resultado trae `unit: 'secs'` y nunca `effectiveThreshold`/`repsMin`/`repsThreshold`:

| Caso | Sugerencia (`suggestType`) | Opción en la tarjeta |
|---|---|---|
| Sin historial | — (`hasHistory: false`) | "Primera vez… segundos sugeridos" |
| Por defecto (sin peso, o con peso que todavía no llegó a 60 seg) | `'secs'`, `addSecs: 5` | **"+5 seg"** o **"+5 seg con X kg"**: mismo peso, +5 seg sobre la última sesión en **todas** las series |
| Con peso y **60 seg o más** (promedio de la serie) en las **dos últimas sesiones al mismo peso** | `'weight_secs'`, `newWeight` = siguiente escalón (`getNextWeight`), `resetSecs: 30` | **"+ peso: X kg × 30 seg"** (en lugar de "+5 seg") |

Con una sola sesión de historial se sugiere +5 seg (no se exigen dos sesiones). Si la última sesión tiene 0 seg promedio, no se sugiere nada. Sin peso nunca se sugiere subir peso. En modo regreso (motivo no médico) el peso sugerido se topa en `preGapLevel`; la regla relajada de 1 sesión del modo regreso no aplica a `'secs'`. Para `'reps'` el resultado es **idéntico al anterior** (verificado con ~6500 combinaciones contra la versión previa).

### Mensaje "Ya definiste tu progresión para hoy" (reemplazado)

> **Reemplazado por la serie de progreso (ver sección 13):** la tarjeta y este mensaje ya no existen. Lo que sigue es el comportamiento anterior.

Ahora solo aparece si hay sugerencia (`advice.suggest`) **y** el usuario ya la resolvió (`exData.suggestionDismissed`, tras elegir una opción o "Hoy no"). Si hay sugerencia pero **ninguna opción se mostró** (p. ej. la de "+2 reps" pasaría el tope de 25 y no hay opción de peso), la tarjeta dice `✓ Mantené el peso, vas bien.`.

### Mensajes de mejora, historiales y resúmenes

- `detectImprovements` agrega `unit` (`getExerciseUnit(ex)`) a cada mejora de tipo `'reps'`; `WorkoutSummary` muestra **"¡Aguantaste 10 seg más en La Plancha! 🎯"** si `unit === 'secs'` y el mensaje de reps de siempre si no. Las mejoras de peso no cambian.
- Se muestra **"45 seg"** en lugar de "45 reps" (con `formatSetText`) en: `ExerciseHistoryModal` (📊 Historial del ejercicio, en `FuerzaFlow.jsx`), `WeekCalendar` (detalle del día), `WorkoutHistorial` (detalle del entrenamiento) y `BibliotecaTab` (últimas sesiones). En todos, con peso 0, vacío o `""` ya no se muestra "· 0 kg".

### Lo que NO cambió (a propósito)

- **Progreso, `detectPRs`, logros** y los cálculos de "mayor progreso" siguen basados solo en **peso** (se revisan en el próximo paso). `ProgresoPage` y `ExerciseProgress` todavía rotulan "reps"/"×N" sin distinguir segundos.
- **`routines.js` y los generadores de rutina** no leen `unit`; Plancha con Arrastre de Mancuerna (`'reps'`, está en `rutina-empuje-vertical` y `rutina-fuerza-accesoria`) sigue funcionando: se verificó el catálogo, `buildEntry` y la progresión con ese ejercicio.
- **La sección Tabata es solo de referencia y no tiene temporizador**; este cambio no la toca.

### Historial anterior: no se migró

Los workouts guardados antes de este cambio no tienen `unit`: se resuelven por catálogo (id → nombre exacto → `'reps'`), así que La Plancha/Sentadilla isométrica/Plancha lateral/Hollow Body Hold viejos se leen como segundos, y el resto como repeticiones. **No se migró ni se reescribió nada.** El único caso conocido de unidades mezcladas es un registro de **Dead Bug** (una sesión cargada con un valor que parece segundos y otra con uno que parece repeticiones): Dead Bug es `'reps'`, así que la sesión cargada en segundos se lee como repeticiones; se deja sin migrar.

### Verificación

Con las funciones reales (arnés fuera del repo): `getExerciseUnit` (catálogo, `alt-…`, registro viejo sin `unit`, ejercicio propio), `getProgressionAdvice` (`'secs'` sin peso, con peso, con ≥60 seg en 2 sesiones, peso distinto, sin historial; y `'reps'` idéntico), `detectImprovements`, `formatSetText` y un render de `FuerzaFlow` (columna "Seg" solo en los 4 ejercicios, sin ▶ ni Reps/Segs, opciones "+5 seg" / "+ peso: … × 30 seg"): 68 casos OK. En el navegador se revisó el render estático de `FuerzaFlow` con el CSS real de la app (no la app con sesión iniciada).

---

## 25. DURACIÓN REAL DE LA SESIÓN DE FUERZA (`durationSeconds`, noviembre 2026)

Hasta ahora una sesión de fuerza no guardaba cuánto duró: el cronómetro de la sesión (`workout_start_ts` en `localStorage`) se mostraba en el encabezado y se borraba al guardar. Ahora se guarda en el workout. Archivos: `src/utils/sessionDuration.js` (nuevo) y `src/components/registro/WorkoutWizard.jsx`.

### El campo

- **`durationSeconds`** (número de segundos o `null`) en los workouts de **fuerza**. La clave **siempre** se escribe: `null` si no hay dato.
- **Cardio** ya tenía su `durationSeconds` (fuente de verdad de su tiempo, lo carga el formulario de cardio) y **no cambió**; **clase** sigue con `duracion` (minutos) y **no tiene** `durationSeconds`. El campo nuevo solo se pide y se guarda para fuerza.
- Se guarda en múltiplos de 60 (viene del campo en minutos).

### Qué ve el usuario (paso de guardado, solo en fuerza)

Un campo **"Duración (min)"** (número entero, opcional) arriba de la nota, **precargado con el cronómetro de la sesión redondeado a minutos** (`Math.round(segundos / 60)`) y editable. Debajo, un texto que explica de dónde salió el valor o por qué no se precargó. Si el campo queda **vacío** (o con un valor inválido), se guarda `durationSeconds: null`.

### Reglas de precarga (`getDurationPreload`)

| Condición | Resultado |
|---|---|
| Cronómetro entre **5:00 min y 4:00:00 h** (ambos límites incluidos) | Se precarga (minutos redondeados, de 5 a 240) |
| Cronómetro **< 5 min** | No se precarga; el campo queda vacío (se puede cargar a mano) |
| Cronómetro **> 4 h** | No se precarga; el campo queda vacío |
| Sin cronómetro, o con un inicio en el futuro | No se precarga |
| El workout tiene **fecha distinta de hoy** (se está cargando una sesión pasada) | No se precarga: el cronómetro es el de la sesión de hoy |

- La precarga se calcula **al entrar** al paso de guardado (y si se vuelve atrás y se entra otra vez, mientras el campo no se haya tocado). Si el usuario ya lo editó —aunque lo haya vaciado— **no se vuelve a pisar**. El valor y la marca de "tocado" (`durationMin`, `durationTouched`) viajan en el borrador del entrenamiento en curso, así que sobreviven a una recarga.
- El cronómetro arranca al agregar el primer ejercicio o al tocar "Continuar" en el detalle (`startTimer`); la clave `workout_start_ts` se sigue borrando al guardar o cancelar, como antes.
- Lo que se guarda es **lo que quedó escrito en el campo**, no un segundo cálculo al apretar "Guardar" (lo que ve el usuario es lo que se guarda).

### Conversión y validación (`durationSecondsFromMinutes`)

Minutos → segundos con `Math.round(min × 60)`. Devuelve `null` si el valor está vacío, no es numérico, es **≤ 0** o supera **1440 min (24 h)**. Nunca devuelve 0.

### Lectura: ausente o null = "sin dato", nunca 0

`getSessionDurationSeconds(workout)` devuelve un número **> 0** o `null` (ausente, `null`, `''`, 0 o no numérico). Cualquier lectura de `durationSeconds` (futuros indicadores de "horas de entrenamiento", por ejemplo) debe pasar por esa función o respetar la misma regla: **un workout sin duración no suma 0 minutos**, se excluye y se informa la cobertura ("N de M sesiones con duración"). El lector existente de cardio (`getEffectiveDurationSeconds`, `utils/cardio.js`) ya devuelve `null` para ausente o `null` (verificado) y no se tocó; las pantallas que lo usan están acotadas a `type === 'cardio'`, así que un `durationSeconds` en una sesión de fuerza no cambia nada de lo que se muestra hoy.

### Sin migración

Los workouts anteriores a este cambio **no tienen** `durationSeconds` y **no se migró nada**: quedan "sin dato" para siempre (no hay forma de reconstruirlo). Los workouts de fuerza nuevos pueden tener `null` si el usuario no lo cargó o el cronómetro estaba fuera de rango.

### Verificación

Con el wizard real (jsdom, contextos y subformularios simulados, reloj simulado) y las funciones reales: cronómetro normal (52:20 → precarga 52 → se guarda 3120), duración editada (45 → 2700), campo vacío (`null`, la clave existe), cronómetro de 3 min y de 5 h (campo vacío y `null`, con el texto que explica por qué), valor fuera de rango cargado a mano (50 → 3000), fecha pasada (sin precarga), límites exactos (4:59 / 5:00 / 4:00:00 / 4:00:01), y cardio y clase sin cambios (sin campo nuevo; cardio conserva su `durationSeconds` del formulario y clase su `duracion`): 26 comprobaciones, todas bien.

---

## 26. MÓDULO DE CÁLCULOS DE PROGRESO (`src/utils/progressStats.js`, noviembre 2026)

Módulo único, de **funciones puras** (sin React ni Firestore), que reúne los cálculos de la sección Progreso. Recibe `workouts`, el catálogo de ejercicios (`data/exercises.js` por defecto) y el perfil. Pruebas automáticas en `src/utils/progressStats.test.js` (vitest, `npm test`, 72 casos con historiales inventados). Archivos relacionados: `src/utils/weeks.js` (aritmética de fechas y semanas), `src/utils/streak.js` (tipos reales y umbral de 3 días), `src/utils/sessionDuration.js` (duración de fuerza, sección 25).

> **Estado de integración.** El módulo ya es la fuente única de: la **Racha semanal 3+** (Inicio y Progreso), los **récords** (tarjeta "PRs históricos" de Progreso y el logro "Superaste 3 PRs") y el **estado de cansancio** (sugerencia de descarga). Los demás indicadores (período, volumen, duración, cardio, mayor progreso, más trabajado, totales, dato clave) **están calculados y probados pero todavía no se muestran**: el rediseño de la pantalla es el próximo paso. Las tarjetas actuales de `ProgresoPage` ("mayor progreso", "más trabajado", "mejor marca", fatiga) siguen con su cálculo anterior (ver sección 21 de este archivo y `AUDITORIA_PROGRESO.md`).

### Convenciones

- Solo cuentan los workouts `REAL_WORKOUT_TYPES` (`fuerza`, `cardio`, `clase`, `tabata`) con `date`. `pausa` y `descanso` nunca. Los workouts con fecha posterior a "hoy" se ignoran.
- Semanas de **lunes a domingo**; fechas como `YYYY-MM-DD` (`weeks.js`, sin zona horaria).
- **Sin dato nunca es 0**: ausente, `null`, `''` y duración 0 se excluyen de los promedios.
- Todas las funciones aceptan `today` (por defecto `getTodayLocal()`) para poder probarlas.
- Objetivo semanal = `getWeeklyGoal(profile)` = `profile.diasSemana`, o **3** si no existe.

### Períodos (`resolvePeriod`)

| Período | Ventana actual | Período anterior |
|---|---|---|
| `'4w'` / `'12w'` | Las N semanas (4 o 12) que terminan en la semana en curso: desde el **lunes de hace N−1 semanas** hasta **hoy** (la última semana es parcial) | Empieza **N semanas antes** del inicio actual y dura **lo mismo en días** (así la comparación es pareja aunque la semana en curso esté a medias). Ej.: hoy jueves, 4w → actual de 25 días y anterior de 25 días |
| `'all'` | Desde el lunes de la semana del primer entrenamiento hasta hoy | **No hay** (todo es `null`) |

**Variación %** = `Math.round((actual − anterior) / anterior × 100)`; `null` si falta alguno o el anterior es 0 (`pctChange`). Cada indicador devuelve `{ value, previous, changePct, delta, series }`, donde `series` tiene una entrada por semana del período (`{ weekStart, weekEnd, partial, value }`) y `delta` = `actual − anterior` (para el cansancio, la diferencia en puntos).

### Indicadores por período (`computeProgressStats({ workouts, catalog, profile, period, today })`)

| Indicador | Fórmula exacta |
|---|---|
| **entrenamientos** (`trainings`) | Cantidad de workouts reales con fecha en la ventana (dos el mismo día cuentan 2) |
| **días activos** (`activeDays`) | Cantidad de **fechas distintas** de esos workouts |
| **volumen de fuerza** (`volume`) | Σ `peso × reps` de cada serie de cada ejercicio con `getExerciseUnit(e) === 'reps'` y `Number(peso) > 0`. Excluye los ejercicios en segundos (con o sin peso) y las series sin peso; acepta el peso como texto |
| **semanas cumplidas** (`weeksMet`) | Cantidad de semanas de la ventana con `días activos ≥ goal`. **La semana en curso (parcial) cuenta solo si ya se cumplió**; las cerradas siempre se evalúan. Devuelve además `goal` y `weeksEvaluated` (= semanas cerradas + la en curso si cumplió) |
| **duración promedio por sesión** (`duration`) | Minutos por sesión: **fuerza** = `getSessionDurationSeconds` (`durationSeconds > 0`); **cardio** = `getEffectiveDurationSeconds` > 0 (`durationSeconds` nuevo o `tiempo` viejo); **clase** = `duracion` > 0. Promedio **global** y **por tipo** (`byType`), `sessionsWithData` y `sessionsTotal`. **Con menos de 3 sesiones con dato** (global, y cada tipo por separado) el valor es `null` ("sin datos suficientes"). La serie semanal promedia lo que haya (sin mínimo) |
| **cardio** (`cardio`) | Minutos promedio por sesión de cardio **solo con sesiones que tienen tiempo**; `withData` / `withoutData` / `sessions`. `null` si ninguna tiene tiempo |
| **cansancio** (`fatigue`) | Promedio de `fatigue` (1-10) de los workouts reales de la ventana con valor numérico (se ignoran `null` y `''`); redondeado a 1 decimal; `count`; promedio por semana en `series` (`null` si la semana no tiene registros). Incluye `status` = `getFatigueStatus` (ver abajo) |

### Cansancio unificado (`getFatigueStatus(workouts, today)`) — fuente única

- **Ventana:** las **2 últimas semanas completas** (lunes a domingo, sin la semana en curso).
- **Estado:** `'alto'` si el promedio **redondeado a 1 decimal** (el que se muestra) es **≥ 7** y hay **al menos 3 registros**; `'sin-datos'` si hay menos de 3 registros; `'normal'` en el resto. Devuelve `{ status, high, avg, count, start, end, threshold: 7, minRecords: 3 }`.
- **La usan:** el dato clave R1, la sugerencia de descarga de **Configuración** (`ConfigPage.jsx`, ya no usa "últimos 40 registros con `?? 5` y ≥ 7") y `useDeload.shouldSuggestDeload` (que sigue sin llamadores).

**Deuda pendiente — otros lugares que calculan o clasifican el cansancio con reglas propias** (no se tocaron; conviene unificarlos con `getFatigueStatus` o con una constante común de umbrales):

| Lugar | Regla que usa |
|---|---|
| `ProgresoPage.jsx` — `computeAll` (`avgFatigaHistorica`) y el color/subtítulo de la tarjeta de fatiga | Promedio de **todo el historial** con fatiga (mínimo 3 registros); umbrales ≤ 5 / ≤ 7 / > 7 ("al límite") |
| `ProgresoPage.jsx` — `UltimasSesiones` | Etiqueta por sesión: ≤ 3 "liviana", ≤ 6 "moderada", > 6 "alta" |
| `Logros.jsx` (medalla semanal, ~línea 139) | Promedio de la fatiga de la semana en curso |
| `Inicio.jsx` (resumen semanal, ~línea 155) | Promedio de la fatiga de la semana pasada |
| `achievements.js` — `checkEnergiaAlza` | Promedio semanal; baja de ≥ 2 puntos entre semanas consecutivas |
| `useWorkouts.js` — `getLastFatigueForExercise` | `fatigue ?? 5` de las últimas 2 sesiones del ejercicio |
| `WorkoutWizard.jsx`, `WorkoutSummary.jsx`, `WorkoutHistorial.jsx` | Colores/niveles por sesión: ≤ 4 bajo, 5-7 intermedio, ≥ 8 alto (`WorkoutSummary` usa `fatigue ?? 5`) |

### Racha semanal 3+ y resumen del mes (`computeWeeklyStreak3Plus`, `computeMonthSummary`)

Ver la sección 1 (definición completa, fórmulas del promedio mensual y de los porcentajes, y la eliminación de la racha consecutiva). En una línea: **`total` = cantidad TOTAL de semanas (lunes a domingo) del historial con 3 o más días distintos de entrenamiento real; no requiere semanas consecutivas y nunca baja; la semana en curso suma apenas llega a 3 días.** `computeProgressStats` las devuelve como `weeklyStreak` y `monthSummary`; `useWorkouts` las expone memoizadas (`getWeeklyStreak3Plus()`, `getMonthSummary()`).

### Agrupación de ejercicios (`groupExercises`)

Los ejercicios se agrupan por **id del catálogo**; si el id no existe en el catálogo, por **nombre normalizado** (minúsculas, sin tildes, espacios colapsados) y, si ese nombre coincide con un ejercicio del catálogo, con el id de ese ejercicio. Así las alternativas `alt-…` (id único por uso) **no fragmentan** el historial. Los ejercicios propios (ids `custom_…`) se agrupan por nombre. Una "sesión" de un ejercicio = un workout (si aparece dos veces en el mismo workout se fusiona, con el máximo). Orden: fecha ascendente; ante empate de fecha se asume la lista en orden descendente (como la entrega el proveedor).

### Récords (`computeRecords`) — fuente única

- **Métrica principal por ejercicio:** **kg** si el ejercicio alguna vez tuvo peso > 0 (valor de la sesión = peso máximo de la sesión); si no, **segundos** si su unit es `'secs'` (valor = máximo de segundos de una serie); si no, **repeticiones** (máximo de reps de una serie).
- **Récord** = una sesión cuyo valor **supera estrictamente** el mejor valor previo de ese ejercicio. **La primera sesión con valor > 0 es la base y no cuenta** (las sesiones sin peso anteriores a la primera con carga se ignoran para la métrica de kg).
- **Devuelve:** `events` (cronológicos: `exerciseKey`, `exerciseId`, `name`, `date`, `previous`, `value`, `unit` = 'kg' | 'seg' | 'reps'), `total`, `last`, `mostRecords` (ejercicio con más récords; empate: el más reciente), `distinctExercises` y `byExercise`.
- **La usan:** la tarjeta "PRs históricos" de `ProgresoPage` (`total`) y el logro **"Superaste 3 PRs"** (`achievements.js`, `computePRData` → `distinctExercises`; la misma función alimenta `primerAumento` y `diezPRs`). *Efecto:* al contar también segundos y repeticiones, el total puede ser mayor que antes (que solo miraba kg).

### Mayor progreso (`computeMayorProgreso`)

Primera marca contra la **MEJOR** marca (misma métrica principal que los récords), solo ejercicios con **al menos 3 sesiones con dato**. `pct = Math.round((mejor − primera) / primera × 100)`. Devuelve `ranking` (por %; empate: más sesiones, luego nombre) y `top` (el primero con % > 0, o `null`); cada fila: ejercicio, valor y fecha inicial, valor y fecha del mejor (la primera vez que se alcanzó), unidad, %, sesiones.

### Más trabajado (`computeMasTrabajado`)

Sesiones de **todos** los ejercicios (también sin peso y en segundos): cuenta los workouts con al menos una serie con repeticiones/segundos > 0 o peso > 0. Cada fila: `sessions`, `firstDate`, `lastDate`, `totalSets` (series con reps/segundos > 0). Ranking: sesiones, luego series, luego nombre.

### Entrenamientos totales (`computeTotals`)

Todo el historial real hasta hoy: `total`, `uniqueDays`, `byType` (fuerza, cardio, clase, tabata), `firstDate` y `monthMostDays` (mes `YYYY-MM` con más días distintos; empate: el más reciente).

### Dato clave (`computeKeyInsight` / `keyInsight`)

Evalúa 5 reglas y devuelve **la frase de la de mayor prioridad que se cumpla, o `null`** (el resultado también trae `keyInsightRule` y `keyInsights`, todas las que se cumplen). P = período elegido, A = anterior.

| Prioridad | Regla | Condición exacta | Frase |
|---|---|---|---|
| 1 | **R1 · cansancio alto** | `getFatigueStatus(...).status === 'alto'` | "Tu cansancio promedio de las últimas 2 semanas fue {x}/10. Podés considerar una semana de descarga." |
| 2 | **R2 · récord de peso** | Hay un evento de `computeRecords` con unidad **kg** y fecha dentro de P; se elige el de fecha más reciente (empate: mayor mejora relativa) | "Récord nuevo en {ejercicio}: {valor} kg (+{delta} kg sobre tu marca anterior de {previo} kg)." |
| 3 | **R3 · mejor tiempo** | Ejercicio en `'secs'` cuyo máximo de segundos por serie dentro de P supera el máximo de todas las sesiones **anteriores a P**, comparando series con el **mismo peso** (o ambas sin peso), con la marca previa > 0. No aplica en `'all'` | "Aguantaste {n} seg en {ejercicio}{ con {peso} kg}, tu mejor marca (antes {m} seg)." |
| 4 | **R4 · variación de volumen** | P ≠ 'all'; ≥ 2 sesiones de fuerza con volumen > 0 en P **y** ≥ 2 en A; volumen(A) > 0; `abs(Δ%) ≥ 10` | "Tu volumen de fuerza {subió/bajó} un {abs(Δ%)} % frente a las {N} semanas anteriores{ (incluye semana de descarga)}." (con Δ% > 200: "más de un 200 %"; sufijo si alguna sesión de P tiene `deload: true`, o "(incluye una sesión de regreso)" si tiene `regreso: true`) |
| 5 | **R5 · constancia** | `weeksEvaluated ≥ 4` y `weeksMet ≥ 1` (la semana en curso entra solo si ya cumplió, así que en '4w' solo dispara cuando la semana en curso ya se cumplió) | "¡Cumpliste tu objetivo de {d} días las {n} semanas!" (si k = n) o "Cumpliste tu objetivo de {d} días en {k} de {n} semanas." |

Los números usan coma decimal (es-AR) y hasta 2 decimales. Mismos datos ⇒ misma frase (sin azar).

### Cambios en pantallas existentes (solo estos)

- **Inicio:** la tarjeta de la derecha es "Racha semanal 3+" (`WeeklyStreakCard`, con el resumen del mes en el dorso); el anillo semanal se llena con **`profile.diasSemana`** (`getWeeklyGoal`, respaldo 3) en lugar del tope fijo de 4: el color depende de la proporción días/objetivo y los mensajes "Semana óptima" / "ideal" se dan al llegar al objetivo / pasarlo. `computeStreakStats` también se memoiza.
- **Logro "Superaste 3 PRs"** (y `primerAumento`, `diezPRs`): leen `computeRecords`.
- **Progreso (pantalla actual):** el nombre en "+N kg en …" se muestra **completo** (antes se recortaba a 2 palabras); los rótulos "reps" pasan a "seg" en los ejercicios en segundos (`ProgresoPage`: eventos de "Principales progresiones"; `ExerciseProgress`: "Última serie", que además deja de mostrar "· 0kg"; `GeneradorTab` y el generador de `FuerzaFlow`: el esquema de una rutina generada dice "3×30 seg" en vez de "3×12"). "PRs históricos" usa `computeRecords`.
- **Descarga** (`ConfigPage`, `useDeload`): usan `getFatigueStatus`.

### Pruebas (`npm test`)

`vitest run` con `vitest.config.js` (entorno Node, sin plugins de la app). Cubren: períodos y comparación (4w, 12w, all, variación con anterior 0), semana en curso (incompleta y cumplida), total de semanas de la racha 3+ con huecos y parates largos, semana en curso con menos de 3 días y con 3, promedio de días por semana el día 1 / a mitad / a fin de mes, porcentajes que suman 100, mes vacío, récords en kg / segundos / reps y con primera sesión, mayor progreso con menos de 3 sesiones, alternativas `alt-…`, workouts sin `durationSeconds`, clase con duración, cardio sin tiempo, cansancio con pocos registros, y las 5 reglas del dato clave (y su prioridad).

---

## 27. ALIAS DE EJERCICIOS FUSIONADOS (`EXERCISE_ALIASES`, noviembre 2026)

### Qué se fusionó y por qué con alias

Seis pares del catálogo eran el mismo movimiento con dos ids (los detectó la consulta de la sección 11, punto 6). Se dejó **un solo ejercicio** en `src/data/exercises.js` y los ids eliminados quedaron como alias:

```js
export const EXERCISE_ALIASES = {
  glut_11: 'glut_02',   // Hip Thrust unilateral            → Hip Thrust a una pierna
  glut_12: 'glut_05',   // Step-ups con mancuernas al cajón alto → Step-ups al cajón alto
  hom_07:  'hom_03',    // Vuelos posteriores con mancuerna → Vuelo posterior
  bic_05:  'bic_02',    // Curl de bíceps con mancuerna     → Curl mancuernas
  isq_07:  'isq_06',    // Curl de Isquiotibiales en máquina → Curl femoral acostado
  hom_04:  'esp_07',    // Face Pull (Hombros)              → Face Pull (Espalda)
}
export function canonicalExerciseId(id)  // el id canónico, o el mismo id si no tiene alias
```

**Por qué alias al leer y no una migración en Firestore:** el historial de cada usuaria (`users/{uid}/workouts`, favoritos, lista "never", rutinas propias, entrenamiento en curso, caché local, borradores sin subir) ya tiene guardados los ids viejos. Reescribirlos exigiría recorrer y modificar documentos de todas las cuentas (lecturas y escrituras masivas, riesgo de dejar el historial a medias si se corta, y no hay forma barata de deshacerlo). Con el alias, **nada guardado se toca**: los datos conservan el id con el que se registraron y la traducción ocurre en memoria, cada vez que se leen. Si algún día se quiere migrar, el alias sigue siendo válido (idempotente).

### Dónde se aplica (todo en `src/utils/exerciseAliases.js`, funciones puras)

| Dato | Punto de lectura | Función |
|---|---|---|
| Historial de workouts (Firestore, caché local `workouts_cache_{uid}` y borradores sin subir `workout_draft_{uid}`) | `WorkoutsContext.jsx`: el estado interno queda **crudo**, y el valor que entrega el proveedor (`workouts`, memoizado) pasa por la normalización. Es el único punto por el que las pantallas leen el historial (`useWorkouts`, `prUtils`, `progressStats`, `ExerciseProgress`, `BibliotecaTab`, `historyScore`, `reentry`, `returnRoutine`, logros, etc.). | `normalizeWorkouts` → `normalizeWorkoutExercises` → `normalizeExerciseEntry` |
| Favoritos y lista "never" | `db.js`: `getFavorites`, `getNeverList` (y `toggleFavorite`/`toggleNever` traducen el id y la lista antes de escribir) | `normalizeIdList` (ids canónicos, sin duplicados, mismo orden) |
| Rutinas personalizadas | `db.js`: `getCustomRoutines` | `normalizeRoutine` (traduce `id`/`exerciseId`, pone el nombre canónico y no duplica el ejercicio si la rutina tenía los dos del par) |
| Entrenamiento en curso | `db.js`: `getWorkoutInProgress` (nube) y `WorkoutDraftContext.jsx`: `readLocal` (local) | `normalizeInProgress` (`detail.exercises[]` y `detail.pendingGeneratedIds`) |
| Sugerencia del día cacheada en `localStorage` (`daily_suggestion_{uid}`) y ids pendientes del generador | `Inicio.jsx` al leer el caché; `FuerzaFlow.jsx` al cargar `pendingGeneratedIds` | `normalizeIdList` |

Qué hace `normalizeExerciseEntry` en cada ejercicio de un workout: `exerciseId` y `originalExerciseId` pasan a su id canónico; si cambió el `exerciseId`, `name` pasa al nombre del catálogo. No toca `muscle`/`originalMuscle` (la sesión conserva el músculo con el que se registró, que es lo que usa la sugerencia diaria para saber qué se entrenó), ni `unit`, ni las series. Si una sesión vieja tiene **los dos ejercicios del par**, quedan **dos entradas** con el mismo id canónico (las series no se fusionan); los lectores que buscan "el ejercicio X dentro del workout" con `find` ven la primera, y los que recorren todas (récords, pesos aprendidos, `progressStats.groupExercises`, que suma las entradas de un mismo workout en una sola sesión) ven las dos. `progressStats.groupExercises` además traduce por su cuenta un id con alias que no esté en el catálogo, como defensa.

**Lo que NO hace:** no escribe nada. El caché local y los borradores se guardan tal cual vinieron; un borrador pendiente se sube a Firestore con los ids con los que se registró. Lo nuevo que se guarda ya usa ids canónicos, porque el catálogo ya no ofrece los viejos.

### Cómo sumar un alias en el futuro

1. En `exercises.js`, borrar la entrada duplicada y mejorar la que queda (nombre, nivel, equipo, `alt`…).
2. Sumar `id_viejo: 'id_que_queda'` a `EXERCISE_ALIASES`. El destino tiene que existir en el catálogo y no ser a su vez un alias (hay un test).
3. Reemplazar el id viejo en `src/data/routines.js` (y en los `alt` que nombren al ejercicio eliminado). Hay tests que fallan si una rutina pre-armada o un alias apuntan a un id que no existe, o si queda un `alt` con un nombre viejo.
4. **No** cambiar el nombre del ejercicio que queda sin revisar `getExerciseUnit`, que cae a buscar por nombre exacto cuando no encuentra el id.

### Reorganización del catálogo de noviembre 2026

- **Fusiones** (los 6 alias). Quedaron: `glut_02` Hip Thrust a una pierna (nivel B, equipo Barra/Mancuerna), `glut_05` Step-ups al cajón alto (B, Cajón / Cajón + Mancuernas), `hom_03` Vuelo posterior, `bic_02` Curl mancuernas, `isq_06` Curl femoral acostado (C, Máquina, secundario Gemelos) y `esp_07` Face Pull (solo en Espalda, Polea/Banda elástica). En `routines.js` se reemplazaron los ids y la entrada de `isq_06` quedó en nivel C. Los campos `alt` se revisaron: ninguno nombraba un ejercicio eliminado.
- **Clasificaciones corregidas**: `isq_03` Sentadilla punta pies elevados pasó a músculo Glúteos (grupo Glúteo mayor, secundario Cuádriceps; mantiene su id y su patrón `sentadilla`); `isq_08` Nordic Curl pasó a nivel B; `gem_01` Salto a la soga a nivel C. `glut_08` Abducción con banda, `glut_09` Clamshell, `glut_patada_lateral` y `glut_abd_pausa` pasaron al músculo **Abductores** (mantienen su id). En `routines.js` el campo `muscle` de esas entradas pasó a 'Abductores' pero **los arrays `muscles` de las rutinas no cambiaron**: `dailySuggestion` los compara de forma exacta, y `rutina-empuje-horizontal` (Pecho y Glúteos) tiene que seguir pudiendo sugerirse (hay un test en `dailySuggestion.test.js`). El historial viejo conserva `muscle: 'Glúteos'` en esos ejercicios: cuenta como Glúteos en la sugerencia diaria y en los logros, y nuevos registros cuentan como Abductores.
- **Músculo Aductores** (`MUSCLE_GROUPS`, justo después de Abductores) con 4 ejercicios (`adu_01`–`adu_04`), y 2 ejercicios de patrón `carga` en Core & Estabilidad (`cor_05` Paseo del granjero, `cor_06` Paseo de maleta). Detalle de patrones en la sección 16.
- Totales: 90 ejercicios (6 eliminados, 6 agregados). `DEPRECATED` de `FuerzaFlow.jsx` (Reverse Frog y Abducción con pausa, que sigue siendo solo para borrar copias personalizadas) no se tocó: ambos siguen en el catálogo.

---

## Documentación técnica extendida

Este archivo es la fuente de verdad para lógicas complejas, decisiones de producto y bugs conocidos del proyecto. **Debe actualizarse** cada vez que se modifique alguna de las lógicas acá documentadas (racha, pausa, medallas, PRs, fechas, offline/auth, estructura de datos). Ver también `CONTEXTO.md` para arquitectura general, stack, y convenciones de código.
