# Lógica Técnica — My Workout

Documentación técnica permanente para que cualquier instancia de Claude pueda entender las lógicas complejas, decisiones de producto y comportamiento esperado sin necesidad de preguntas adicionales. Complementa a `CONTEXTO.md` y tiene la misma prioridad: **debe mantenerse actualizado** cada vez que se toca alguna de las lógicas documentadas acá.

---

## 1. SISTEMA DE RACHA (`computeStreak()`)

> **Historial**: hasta septiembre 2026 este sistema tenía 4 estados (`active`/`frozen`/`paused`/`broken`) acoplados a las pausas registradas (sección 2). Se reemplazó por completo por una regla única sin estados — ver "Por qué se eliminaron los estados" más abajo. Las pausas **ya no participan** del cálculo de racha.

### Ubicación

`src/utils/streak.js` — función pura `computeStreak(workouts)`, sin dependencias de React ni de Firestore directamente (recibe el array de workouts ya cargado).
Consumida por `getCurrentStreak()` en [useWorkouts.js](src/hooks/useWorkouts.js:154), que es ahora un wrapper de una línea: `const getCurrentStreak = () => computeStreak(workouts)`.

### La regla

- **Semana** = lunes a domingo, usando `weekKey`/`getWeekStartLocal` de [dates.js](src/utils/dates.js) — fechas siempre como strings `YYYY-MM-DD`, nunca `Date`/UTC (ver sección 5).
- **Solo cuentan días de entrenamiento real**: `type` en `REAL_WORKOUT_TYPES = ['fuerza', 'cardio', 'clase', 'tabata']` — constante única exportada desde `streak.js` y reusada en `Logros.jsx` y `achievements.js` (ver "Consumidores" abajo). `'pausa'` y `'descanso'` quedan afuera del cálculo por completo.
- **Semana con ≥3 días únicos de entrenamiento real** → suma **+1** a la racha (`current`).
- **Semana con 1-2 días, o con 0 días** → no suma **ni corta** — es neutra.
- **La racha vuelve a 0 solo si hay 4 semanas calendario COMPLETAS seguidas con 0 días de entrenamiento real.** La semana en curso (la de hoy) **nunca** cuenta como una de esas 4, aunque todavía no tenga ningún entrenamiento — porque todavía puede sumar días antes del domingo.
- **La semana en curso suma +1 en cuanto alcanza 3 días** — no hace falta esperar a que termine (a diferencia del sistema viejo, que solo evaluaba semanas ya cerradas).
- **`record`** = la racha más alta (`current`) alcanzada en cualquier punto de todo el historial, con esta misma regla.

### Código completo

```js
// src/utils/streak.js
import { parseISO } from 'date-fns'
import { weekKey, getWeekStartLocal, dateToLocal } from './dates.js'

export const REAL_WORKOUT_TYPES = ['fuerza', 'cardio', 'clase', 'tabata']

const nextMonday = (mondayStr) => {
  const d = parseISO(mondayStr + 'T12:00:00')
  d.setDate(d.getDate() + 7)
  return dateToLocal(d)
}

export function computeStreak(workouts) {
  const realW = (workouts ?? []).filter(w => w.date && REAL_WORKOUT_TYPES.includes(w.type))
  if (!realW.length) return { current: 0, record: 0 }

  // weekMap: 'YYYY-MM-DD (lunes)' -> Set de fechas entrenadas esa semana
  const weekMap = {}
  realW.forEach(w => {
    const mon = weekKey(parseISO(w.date + 'T12:00:00'))
    if (!weekMap[mon]) weekMap[mon] = new Set()
    weekMap[mon].add(w.date)
  })

  const thisWeekMonday = getWeekStartLocal()
  const earliestMonday = Object.keys(weekMap).sort()[0]

  let current = 0
  let record = 0
  let consecutiveEmpty = 0
  let mon = earliestMonday

  // Camina cronológicamente desde la semana más antigua con datos hasta la semana actual, inclusive.
  while (mon <= thisWeekMonday) {
    const days = weekMap[mon]?.size ?? 0
    const isCurrentWeek = mon === thisWeekMonday

    if (days >= 3) {
      current += 1
      consecutiveEmpty = 0
      record = Math.max(record, current)
    } else if (days >= 1) {
      consecutiveEmpty = 0   // semana floja (1-2 días): no suma, pero tampoco cuenta para el reset de 4
    } else if (!isCurrentWeek) {
      consecutiveEmpty += 1
      if (consecutiveEmpty >= 4) {
        current = 0
        consecutiveEmpty = 0
      }
    }
    // isCurrentWeek && days === 0: la semana en curso nunca cuenta como vacía — no se toca nada.

    mon = nextMonday(mon)
  }

  return { current, record }
}
```

### Por qué camina hacia ADELANTE (no hacia atrás como el sistema viejo)

El sistema anterior caminaba desde hoy hacia atrás, semana por semana, y cortaba apenas encontraba 2 semanas vacías seguidas — porque cada estado (`frozen`/`paused`/`broken`) dependía solo de la semana más reciente relevante. La regla nueva necesita **acumular** un contador (`current`) que crece con cada semana calificada y se resetea solo tras 4 vacías seguidas — eso requiere procesar las semanas en orden cronológico (de la más vieja a la más nueva) para que el contador refleje correctamente rachas que sobrevivieron a semanas flojas o a huecos cortos (<4 semanas) en el medio del historial.

### Casos de ejemplo (los mismos que verifica la implementación)

| Escenario | Resultado |
|---|---|
| 5 semanas seguidas con 3+ días | `current: 5` |
| 3 semanas de 3 días, 1 semana de 2 días, 2 semanas de 3 días | `current: 5` — la semana floja de 2 días no suma ni corta |
| 4 semanas de 3 días, 3 semanas vacías, 1 semana de 3 días | `current: 5` — 3 semanas vacías no alcanzan las 4 que exige el reset |
| 4 semanas de 3 días, **4 semanas completas vacías**, 1 semana de 3 días | `current: 1`, `record: 4` — el reset sí ocurre a la 4ª semana vacía; la racha nueva arranca de cero pero el récord histórico se conserva |
| Semana en curso con 3 días (miércoles, por ejemplo) | Ya suma — no espera al domingo |
| Semana en curso con 0 días (todavía) y la anterior con 3 | No corta la racha — la semana en curso nunca cuenta como vacía |
| Documentos `type: 'pausa'` o `type: 'descanso'` en cualquier fecha | No afectan el resultado — quedan fuera de `REAL_WORKOUT_TYPES` desde el primer filtro |

### Consumidores del resultado

- [useWorkouts.js](src/hooks/useWorkouts.js:154): `getCurrentStreak()` (wrapper de `computeStreak(workouts)`).
- [Inicio.jsx](src/pages/Inicio.jsx): `const { current: semanasRacha } = getCurrentStreak()` para el frente de la tarjeta (`🔥 {semanasRacha}`), y `computeStreakStats(workouts, getTodayLocal())` por separado para el dorso (ver subsección siguiente) — ambos pasados a `<StatsCards diasSemana={diasSemana} semanasRacha={semanasRacha} streakStats={streakStats} />`.
- [ProgresoPage.jsx](src/components/progreso/ProgresoPage.jsx): llama a la **misma** `getCurrentStreak()` del hook (`const { record } = useMemo(() => getCurrentStreak(), [workouts])`) para `CaminoCard`/`VictoriaCard` — **ya no tiene su propio cálculo de `record` duplicado** dentro de `computeAll()` (fue eliminado; antes eran dos implementaciones independientes que podían mostrar números distintos entre Inicio y Progreso — ver sección 9). Ambas pantallas muestran siempre 🔥, sin distinción de color/ícono por estado.
- [Logros.jsx](src/components/inicio/Logros.jsx): la medalla `w_racha_viva` ya no recibe `streakState` como prop — `Logros`/`computeWeeklyMedals` perdieron ese parámetro por completo. Ver sección 4 para el nuevo criterio de `w_racha_viva`.
- [achievements.js](src/utils/achievements.js): `rachaFuego`/`rachaElite` usan `computeStreak(workouts).record` (mismos umbrales: ≥4 y ≥12). `computeMaxStreak()` (usada por `checkPiernasAcero`) y el chequeo inline de `dosSemanas` ahora filtran por `REAL_WORKOUT_TYPES` — antes contaban cualquier `type`, incluyendo `'pausa'`/`'descanso'`, como día "entrenado" (bug histórico, ver sección 9).

### Estadísticas de la tarjeta de racha (`computeStreakStats()`)

La tarjeta de racha de `Inicio.jsx` es ahora una tarjeta que se da vuelta (`FlipCard`, `src/components/ui/FlipCard.jsx` — genérica y reutilizable, envuelve un `<button aria-pressed aria-label>`, reusa las clases `.flip-card`/`.flip-inner`/`.flip-front`/`.flip-back` de `index.css` que ya usaba `TrophyCard` en `Logros.jsx`, y respeta `prefers-reduced-motion` — `.flip-inner` pierde la transición, así el giro es instantáneo en vez de animado). El frente solo muestra `🔥 {current}` + "racha semanal"; el dorso muestra estadísticas calculadas por `computeStreakStats(workouts, today)`, función pura en `src/utils/streak.js`.

**Período**: las últimas 12 semanas **completas** (lunes a domingo), sin incluir la semana en curso — `lastCompleteMonday = mondayOf(today) - 7 días`, y las 12 semanas van desde `lastCompleteMonday - 11×7` hasta `lastCompleteMonday`. Si el primer entrenamiento real del usuario es más reciente que ese inicio nominal, el período se acorta a las semanas desde esa primera semana (`startMonday = max(firstMonday, nominalStartMonday)`) — así un usuario nuevo con 3 semanas de historial ve estadísticas de 3 semanas, no 12 con 9 vacías. Solo cuenta `type` en `REAL_WORKOUT_TYPES` (`'pausa'`/`'descanso'` quedan afuera, igual que en `computeStreak`).

**Buckets**: cantidad de semanas del período con exactamente 1, 2, 3, 4, o 5+ días únicos de entrenamiento real. Las semanas de 0 días no entran en ningún bucket (pero sí cuentan para el promedio).

**`average`**: `(suma de días únicos de todas las semanas del período) / (cantidad de semanas del período, incluyendo las de 0 días)`, redondeado a 1 decimal. La función devuelve un número plano (ej. `3`, `2.5`) — el `,` decimal (`"3,0"`) es formato de UI (`formatAverage()` en `Inicio.jsx`), no de la función pura.

**`typePercents`**: porcentaje de sesiones por `type` (`fuerza`/`cardio`/`clase`/`tabata`) sobre el total de sesiones reales del período — no días, sesiones. Redondeo por **método de restos mayores** (largest remainder): se calcula el porcentaje exacto de cada tipo, se toma el piso de cada uno, y los puntos que faltan para llegar a 100 se reparten de a uno entre los tipos con mayor resto decimal (así 1/1/1 sesiones da `34/33/33`, no `33/33/33` que suma 99 o `33,3/33,3/33,3` con decimales). Empates de resto se desempatan por el orden fijo de `REAL_WORKOUT_TYPES`, para que el resultado sea determinístico.

**`record`**: se reusa directamente `computeStreak(workouts).record` (el récord histórico completo, no acotado a las 12 semanas) — se muestra igual aunque el período de abajo esté vacío.

**Sin sesiones en el período** (`isEmpty: true` — usuario sin ningún entrenamiento real todavía, o cuyo primer entrenamiento cae dentro de la semana en curso, sin ninguna semana completa aún): el dorso muestra "Todavía no hay semanas completas para mostrar" en vez de las barras/promedio/tipos, pero el récord se sigue mostrando igual.

Verificado con corridas sintéticas: 12 semanas con distribución mixta de días (buckets y promedio exactos), reparto de sesiones por tipo con y sin empates, usuario con historial corto (período acortado), la semana en curso sin efecto en el resultado, y documentos `pausa`/`descanso` mezclados sin ningún efecto.

### Por qué se eliminaron los estados (`active`/`frozen`/`paused`/`broken`)

**Simplicidad**: 4 estados + un override post-loop para "descongelar" eran difíciles de razonar y de mantener — cualquier cambio en pausas podía romper silenciosamente el cálculo de racha (ver el bug de `getCurrentStreak()` documentado en versiones anteriores de este archivo). Una sola regla ("3+ días suma, menos no corta, 4 semanas vacías resetea") es más fácil de explicar, de testear y de razonar sobre casos límite.

**No castigar entrenar "un poco" igual que no entrenar nada**: con el sistema viejo, una semana de 1-2 días contaba exactamente igual que una semana de 0 días para efectos de mantener la racha activa post-pausa, y una semana floja dentro de una racha ya rota. Con la regla nueva, una semana floja es explícitamente neutra — ni te hace avanzar, pero tampoco te penaliza como si no hubieras hecho nada. Esto refleja mejor cómo entrena la gente en la vida real: semanas irregulares (viajes, imprevistos, mucho trabajo) no deberían borrar meses de constancia.

**Silverman & Barasch (2023)** — sobre gamificación de rachas: romper una racha larga tiene un efecto desmotivador desproporcionado respecto al beneficio motivador que dio mientras estaba activa; muchos usuarios abandonan el hábito por completo después de "perder" una racha larga, en vez de simplemente retomarla. El diseño con estados (`frozen`/`paused`/`broken`) hacía visible y explícito cada quiebre — la regla nueva evita mostrar una racha "rota" salvo que realmente haya pasado un mes entero (4 semanas) sin ningún entrenamiento, reduciendo la frecuencia con la que el usuario ve ese mensaje desmotivador.

**Lally et al. (2010)** — sobre formación de hábitos: saltear una sola oportunidad de repetir el hábito no tiene un efecto medible en el proceso de automatización del hábito (a diferencia de lo que popularmente se asume). Esto respalda no castigar semanas sueltas de baja actividad: el hábito de entrenar no se "resetea" porque una semana tuvo 2 días en lugar de 3.

**Perdonar la vida real**: 4 semanas (un mes) de tolerancia antes de resetear la racha da margen para vacaciones, enfermedades cortas, viajes de trabajo, mudanzas, etc. sin necesidad de que el sistema sepa *por qué* el usuario no entrenó — no hace falta que registre una pausa ni justifique nada. Esto es lo que reemplaza, de forma mucho más simple, a lo que antes hacían las pausas explícitas con `frozen`/`paused`.

---

## 2. SISTEMA DE PAUSA — ELIMINADO (septiembre 2026)

> **Estado: eliminado del código.** El sistema de pausas (registro, formulario, calendarios con tratamiento visual especial, pantalla de `WorkoutSummary`) fue removido por completo de la app. **Los documentos viejos `type: 'pausa'` y `type: 'descanso'` que ya existen en Firestore NO se borraron** — la app simplemente los ignora en todos lados, vía la constante compartida `REAL_WORKOUT_TYPES` (sección 1, `src/utils/streak.js`). La estructura exacta de esos documentos viejos queda documentada en la sección 7 (Estructura de datos Firebase), por si aparecen en el historial de un usuario.

### Qué existía y ya no existe

- **Registro**: `WorkoutWizard.jsx` ya no ofrece "Semana de pausa" como tipo de registro. Se eliminaron `PausaFlow`, `handleSavePausa`, el selector de motivos (🤒 enfermedad / 🤕 lesión / 🧘 descanso) y el componente `InlineRangePicker` (calendario inline con `date-fns` que solo usaba `PausaFlow` — no tenía otros consumidores, se eliminó entero).
- **Calendarios**: `WeekCalendar.jsx` y el `WeekRow` de `ProgresoPage.jsx` ya no tienen las 3 pasadas de prioridad (real > descanso > pausa) ni la expansión de rango `pausaInicio`–`pausaFin`. Ahora solo pintan días con `REAL_WORKOUT_TYPES.includes(w.type)` — un día sin entrenamiento real queda vacío, sin importar si hay un documento `pausa`/`descanso` viejo en esa fecha. `MonthCalendar.jsx` (Progreso, calendario mensual) tenía el mismo problema mostrando `descanso` con 💤 y `pausa` cayendo al color verde por defecto — ahora filtra `byDate` por `REAL_WORKOUT_TYPES` antes de construir la grilla.
- **`WorkoutSummary.jsx`**: se eliminó la rama `if (workout.type === 'pausa')` y su pantalla alternativa (🧊/⏸, "Que te mejores pronto. Tu racha está a salvo.") — ya no puede crearse un workout de tipo pausa, así que esa rama era inalcanzable.
- **`ProgresoPage.jsx`**: se eliminaron `pausaThisWeek`, `pausaMotivo` y la lógica condicional de `semanaAsideText`/`semanaAsideColor` ("Descansá · La próxima semana volvés 💙" / "Semana de descanso · Volvés más fuerte"). El aside de "Esta semana" ahora siempre muestra el texto normal (`{thisDays} de {diasSemana} días · {semanaMsg}`).
- **`ConfigPage.jsx`**: se eliminó el selector de UI "¿Volvés después de una pausa?" (`profile.pausa`, `PAUSA_OPTIONS`) — el campo no se usaba en ningún cálculo (confirmado por búsqueda). **El campo `pausa` no se borra de los documentos de perfil ya existentes en Firestore**, solo se removió la UI. *(Nota: `Onboarding.jsx` todavía tiene una pregunta equivalente que sigue guardando `profile.pausa` — no se tocó porque quedaba fuera del alcance explícito de este cambio; queda como posible limpieza futura.)*

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

`REAL_WORKOUT_TYPES` se importa desde [streak.js](src/utils/streak.js) (`import { REAL_WORKOUT_TYPES } from '../../utils/streak'`) — es la misma constante que usa `computeStreak()` para la racha, ya no hay una copia local `REAL_TYPES` redefinida dentro de `Logros.jsx`.

### Reglas de exclusión por contexto

- `w_mas_fuerte`, `w_supero_pr`, `w_volumen_alto`: excluidas si `!hasFuerzaHistory` (no hay ningún workout de fuerza **anterior** a esta semana — sin historial no hay nada contra qué comparar para un PR).
- `w_hamburguesa`: excluida si `diasObjetivo < 4` (el objetivo de días/semana del perfil es menor a 4 → nunca se podría cumplir el criterio de ≥4 días).
- `w_racha_viva` **ya no tiene ninguna regla de exclusión** — está siempre disponible en el pool, sin importar el estado de la racha (ver más abajo).

### Medalla `w_racha_viva`: significado nuevo

Desde que se eliminaron los estados de racha (sección 1), `w_racha_viva` pasó a significar simplemente **"esta semana ya suma a la racha"**:
- `completed = new Set(thisWeek.map(w => w.date)).size >= 3` — el mismo umbral de 3 días que usa `computeStreak()` para calificar una semana.
- **Ya no se excluye del pool en ningún caso** — antes desaparecía por completo si la racha estaba `frozen`/`paused`/`broken`; ahora siempre es una opción posible dentro de la categoría `libre`, completada o no según si la semana en curso ya llegó a 3 días.

### Cadena completa de datos

```
useWorkouts.js: getCurrentStreak() → computeStreak(workouts) → { current, record }
    ↓
Inicio.jsx: const { current: semanasRacha, record: rachaRecord } = getCurrentStreak()
    ↓
Inicio.jsx: <Logros workouts={workouts} compact />
    ↓
Logros.jsx: computeWeeklyMedals(workouts, profile)
            → dentro del switch: case 'w_racha_viva': completed = días reales de esta semana >= 3
```

**Nota importante**: `Logros.jsx` **no llama `getCurrentStreak()` ni `computeStreak()` directamente** — calcula `w_racha_viva` de forma independiente, filtrando `workouts` por fecha ≥ lunes de esta semana (mismo criterio que `computeStreak` usaría para la semana en curso, pero sin pasar por esa función). Ya no recibe ningún prop de racha desde `Inicio.jsx` — el componente `Logros` perdió por completo la prop `streakState`.

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

**Qué compara**: peso máximo / reps de la sesión actual vs. la **sesión inmediatamente anterior** de ese mismo ejercicio (no el máximo histórico).

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

El patrón `parseISO(date + 'T12:00:00')` es la convención en todo el codebase (aparece en `computeStreak()` de `streak.js`, `achievements.js`, `WeekCalendar.jsx`, `ProgresoPage.jsx`, `InlineRangePicker`) cuando se necesita un objeto `Date` a partir de un string `YYYY-MM-DD` para hacer aritmética de fechas. El mediodía local da suficiente margen para que cambios de DST o desfases de timezone nunca desplacen el día calculado.

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
getWeekDays(date)      // → array de 7 Dates, lunes a domingo, de la semana del date dado
getMonthDays(date)     // → array de Dates del mes del date dado (para MonthCalendar)
getLast12Weeks()       // → array de Dates de los últimos 12 lunes (para gráficos de progreso)
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
| objeto `FirebaseUser` | Sesión activa confirmada | Cargar perfil y mostrar la app |

```js
// src/App.jsx — AppRoutes
if (loading) return <LoadingScreen />
if (authTimedOut && user === undefined) {
  return <LoadingScreen message="No pudimos verificar tu sesión. Revisá tu conexión." showRetry />
}
if (user === null) return <AuthScreen />
if (!profile?.onboardingDone) return <Onboarding />
// → rutas normales
```

### Sistema de borrador local — `src/utils/draftQueue.js`

Cuando el usuario guarda un workout sin conexión:

```js
const DRAFT_KEY_PREFIX = 'workout_draft_'

// Guardar draft en localStorage
export function saveDraft(uid, workout) {
  const drafts = getDrafts(uid)
  const draftWithMeta = {
    ...workout,
    _draftId: crypto.randomUUID(),
    _pendingSync: true,           // flag: no está guardado en Firestore todavía
    _draftCreatedAt: Date.now(),
  }
  drafts.push(draftWithMeta)
  localStorage.setItem(DRAFT_KEY_PREFIX + uid, JSON.stringify(drafts))
  return draftWithMeta
}

// Leer todos los drafts pendientes de un usuario
export function getDrafts(uid) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + uid)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// Eliminar un draft específico (por _draftId) tras sincronizarlo
export function removeDraft(uid, draftId) {
  const drafts = getDrafts(uid).filter(d => d._draftId !== draftId)
  localStorage.setItem(DRAFT_KEY_PREFIX + uid, JSON.stringify(drafts))
}

// Sincronizar todos los drafts pendientes con Firestore
export async function syncDrafts(uid, saveWorkoutFn) {
  const drafts = getDrafts(uid)
  if (!drafts.length) return { synced: 0, failed: 0 }
  let synced = 0, failed = 0
  for (const draft of drafts) {
    try {
      const { _draftId, _pendingSync, _draftCreatedAt, ...workoutData } = draft
      await saveWorkoutFn(workoutData)   // se despoja la metadata del draft antes de guardar
      removeDraft(uid, _draftId)
      synced++
    } catch { failed++ }
  }
  return { synced, failed }
}
```

*(Firmas y comportamiento verificados contra el código real de `draftQueue.js`; los nombres de campo `_draftId`, `_pendingSync`, `_draftCreatedAt` son exactos.)*

### Activación automática de la sincronización al volver la conexión

```js
// src/hooks/useWorkouts.js
useEffect(() => {
  if (!uid) return
  const handleOnline = async () => {
    const { synced } = await syncDrafts(uid, (w) => dbSaveWorkout(uid, w))
    if (synced > 0) await load(true)  // recarga silenciosa para reflejar los datos ya sincronizados
  }
  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}, [uid, load])
```

El listener de `window.online` está registrado dentro del propio hook `useWorkouts` — cada instancia del hook (hay instancias separadas en `Inicio.jsx` y en `WorkoutWizard.jsx`) registra su propio listener.

### Indicador visual de workout pendiente de sync

```jsx
import { CloudUpload } from 'lucide-react'
// Se muestra cuando workout._pendingSync === true
{workout._pendingSync && <CloudUpload size={12} color="#94A3B8" title="Pendiente de sincronizar" />}
```

12px, color `#94A3B8`. Aparece en las vistas que listan workouts históricos (`WorkoutHistorial.jsx`, `Inicio.jsx`, `ProgresoPage.jsx`) junto a cualquier entrada que todavía sea un draft local no confirmado en Firestore.

### Optimistic update en `saveWorkout` (fix de race condition)

```js
// src/hooks/useWorkouts.js
const saveWorkout = async (workout) => {
  try {
    const id = await dbSaveWorkout(uid, workout)
    // Root cause fix: escribir al cache y al estado local inmediatamente después de que
    // el write a Firestore confirma. Antes se esperaba (await) un load(true) acá — pero si
    // el usuario navegaba de vuelta a Inicio antes de que ese re-fetch a Firestore terminara,
    // Inicio montaba con un cache desactualizado que no incluía este workout, causando que
    // getCurrentStreak() devolviera un valor desactualizado. El optimistic update garantiza
    // que el cache esté siempre al día en el momento de la navegación.
    const fresh = { ...workout, id }
    writeCache(uid, [fresh, ...(readCache(uid) ?? [])])
    setWorkouts(prev => [fresh, ...prev])
    load(true) // sync en background desde Firestore (no se espera/await)
    return id
  } catch (err) {
    // Sin red → guardar como borrador local
    const draft = saveDraft(uid, workout)
    setWorkouts(prev => [draft, ...prev])
    return draft._draftId
  }
}
```

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
    sets: [{ reps: 12, weight: 20 }],
    fatigue: null,               // fatigue por ejercicio individual, si se usó ExerciseCard
  }],
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

Estos mismos valores hex se repiten (no están centralizados en un único archivo de tema) en `App.jsx`, `Inicio.jsx`, `FatigueChart.jsx`, `Logros.jsx`, `BibliotecaTab.jsx` y `FuerzaFlow.jsx` para el morado `#9B7FD4`. **Si se cambia la paleta de un tipo de workout, hay que actualizar cada uno de estos archivos individualmente** — no hay una constante compartida (ej. un `theme.js`) que centralice estos colores.

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
**Decisión** (septiembre 2026, en dos pasos): primero se desconectaron las pausas del cálculo de racha — ni la congelaban, ni la pausaban, ni la descongelaban, pero el sistema de registro seguía existiendo. Después se eliminó el sistema entero: formulario de registro (`PausaFlow`, `InlineRangePicker`), tratamiento visual especial en los 3 calendarios (`WeekCalendar.jsx`, `MonthCalendar.jsx`, `WeekRow` de `ProgresoPage.jsx`), pantalla especial en `WorkoutSummary.jsx`, y el aside de "semana de pausa" en `ProgresoPage.jsx`. Los documentos viejos `type: 'pausa'`/`'descanso'` en Firestore no se tocaron — la app los ignora vía `REAL_WORKOUT_TYPES` (sección 2 para el detalle completo).
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
**Por qué es crítico**: cualquier cambio en la lógica de carga o guardado pasa por acá. Tiene estado propio por instancia — `Inicio.jsx` y `WorkoutWizard.jsx` crean instancias separadas del hook, lo cual fue la causa raíz del bug de race condition documentado en la sección 6 (el fix fue el optimistic update en `saveWorkout`).

### `src/utils/streak.js`
**Qué hace**: única fuente de verdad del cálculo de racha (`computeStreak(workouts)`, sección 1) y de la constante `REAL_WORKOUT_TYPES` (los 4 tipos que cuentan como entrenamiento real: `fuerza`, `cardio`, `clase`, `tabata`).
**Por qué es crítico**: función pura, sin dependencias de React/Firestore — se puede testear de forma aislada. `useWorkouts.js`, `Logros.jsx` y `achievements.js` importan de acá; no debería volver a haber una copia local de la lógica de semanas/racha en ningún otro archivo.

### `src/context/AuthContext.jsx`
**Qué hace**: provee `user`, `profile`, `settings`, `loading`, `authTimedOut`, `updateProfile`, `updateSettings` vía Context. Maneja el timeout de 15s de Auth. Distingue `user === undefined` de `user === null`. `updateProfile` es optimista desde septiembre 2026 (sección 14): actualiza `profile` en memoria antes de esperar la escritura a Firestore.
**Por qué es crítico**: modificarlo sin entender la distinción `undefined`/`null` puede mostrar la pantalla de login a usuarios offline que en realidad tienen una sesión válida. `updateProfile` hace merge superficial (`{ ...(profile ?? {}), ...data }`) — pasarle un objeto anidado (como `inactividad`) reemplaza ese campo entero, no lo mergea a su vez.

### `src/pages/Inicio.jsx`
**Qué hace**: home de la app. Llama `getCurrentStreak()` y pasa `semanasRacha`/`rachaRecord` a `StatsCards`. Ya no le pasa nada de racha a `Logros` — `Logros` calcula `w_racha_viva` de forma independiente (sección 3). Contiene `computeWeeklyStats()` (resumen semanal), `getDailySuggestion()` y `computeInactivityInfo()` (aviso de inactividad, sección 14).
**Por qué es crítico**: `ProgresoPage.jsx` también llama a `getCurrentStreak()` por su cuenta (misma función, instancia de hook separada) — ambas pantallas deben mostrar siempre los mismos números de racha, ya que las dos consumen exactamente `computeStreak()` sin ninguna lógica propia adicional. También es donde se decide la prioridad entre el modal de inactividad y el `WeeklySummaryModal` cuando ambos podrían corresponder el mismo día (sección 14).

### `src/utils/inactivity.js`
**Qué hace**: exporta `getInactivityInfo(profile)` — helper puro de una línea (`profile?.inactividad ?? null`) para leer el aviso de inactividad ya respondido. La detección/guardado en sí vive en `Inicio.jsx` (sección 14).
**Por qué es crítico**: pensado para reutilizarse en cualquier feature futura que necesite saber "¿este usuario está/estuvo inactivo?" sin duplicar el acceso al campo `profile.inactividad`.

### `src/components/inicio/WeekCalendar.jsx`
**Qué hace**: calendario semanal con puntos de color por tipo de workout real. Desde septiembre 2026 ya no tiene tratamiento especial para pausa/descanso (sección 2) — un solo filtro por `REAL_WORKOUT_TYPES`, sin pasadas de prioridad ni leyenda.
**Por qué es crítico**: es la referencia de cómo debería verse cualquier otro calendario de la app (`MonthCalendar.jsx`, `WeekRow` de `ProgresoPage.jsx`) — los tres deberían idealmente compartir esta lógica en vez de reimplementarla cada uno por su cuenta (deuda técnica pendiente, no se consolidó en este cambio).

### `src/components/inicio/Logros.jsx`
**Qué hace**: sistema de logros permanentes (35, `ACHIEVEMENTS_META`) y medallas semanales (4 de un pool de 12, `MEDAL_POOL`). Ya no recibe ninguna prop de racha — `w_racha_viva` calcula "¿esta semana ya tiene 3+ días reales?" de forma independiente, sin llamar `getCurrentStreak()`/`computeStreak()`.
**Por qué es crítico**: `computeWeeklyMedals` y el algoritmo de selección 1-por-categoría con rotación semanal (`weekNum % pool.length`) es delicado — cambiar criterios de medallas acá requiere entender las reglas de exclusión (sección 3) y la prioridad de completadas sobre no completadas dentro de cada categoría.

### `src/components/registro/WorkoutWizard.jsx`
**Qué hace**: flujo de pasos para registrar un workout (tipo → detalle → sensación). Solo ofrece `fuerza`/`cardio`/`clase` como tipos — el flujo de pausa (`PausaFlow` + `InlineRangePicker`) se eliminó por completo (sección 2). Llama `workoutsHook.saveWorkout()` y muestra `WorkoutSummary`. Maneja el draft persistente del formulario (distinto del draft offline de `draftQueue.js`) y el timer de sesión.
**Por qué es crítico**: el orden de operaciones al guardar (save a Firestore → optimistic update de cache → navegación) afecta directamente lo que ve `getCurrentStreak()` cuando el usuario llega a `Inicio` inmediatamente después de guardar.

### `src/components/registro/WorkoutSummary.jsx`
**Qué hace**: pantalla post-guardado con confetti, stats, PRs (`detectPRs`), mejoras vs. sesión anterior (`detectImprovements`, filtrando duplicados con `prs`), logros nuevos y frase del día. Auto-cierra a los 8s.
**Por qué es crítico**: es el único lugar donde se muestran mejoras incrementales vs. la sesión anterior. Los `workouts` que recibe como prop son los del hook de `WorkoutWizard` capturados antes de que se agregue el workout recién guardado — por eso `detectPRs`/`detectImprovements` comparan correctamente contra el historial previo y no contra sí mismos.

### `src/components/progreso/ProgresoPage.jsx`
**Qué hace**: página de progreso con múltiples bloques — "Tu camino" (stats agregadas), "Tus victorias", historial en calendario mensual, progresión de ejercicios, gráficos de fatiga y volumen, "Últimas Sesiones" (usa `WorkoutIcon` + `TYPE_COLORS` + `detectPRs`).
**Por qué es crítico**: llama `getCurrentStreak()` propia (instancia distinta del hook, no comparte estado con `Inicio.jsx`) — pero desde septiembre 2026 ya no tiene su propio cálculo de `record` duplicado dentro de `computeAll()`, usa directamente el `record` de `getCurrentStreak()` para que ambas pantallas siempre coincidan (sección 1). `MonthCalendar.jsx` (calendario mensual) y `WeekRow` (fila de "esta semana", dentro de este mismo archivo) ya no tienen tratamiento especial de pausa — ambos filtran por `REAL_WORKOUT_TYPES` como `WeekCalendar.jsx` (sección 2).

### `src/utils/prUtils.js`
**Qué hace**: exporta `detectPRs` (vs. máximo histórico absoluto) y `detectImprovements` (vs. sesión inmediatamente anterior). Archivo pequeño pero crítico para no confundir ambas semánticas.
**Por qué es crítico**: las dos funciones parecen similares a simple vista pero comparan contra bases distintas — ver sección 4 antes de modificar cualquiera de las dos.

### `src/utils/draftQueue.js`
**Qué hace**: sistema de borrador local para guardado offline. `saveDraft`, `getDrafts`, `removeDraft`, `syncDrafts`. Usa `localStorage` con prefijo `workout_draft_{uid}`.
**Por qué es crítico**: los workouts con `_pendingSync: true` en el array de `workouts` **no están en Firestore todavía**. Cualquier operación que asuma que todos los workouts tienen un ID válido de Firestore puede fallar silenciosamente con drafts sin sincronizar.

### `src/utils/dates.js`
**Qué hace**: helpers de fechas timezone-safe — `getTodayLocal`, `getWeekStartLocal`, `dateToLocal`, `parseLocalDate`, `toDateStr`, `weekKey`, `getWeekDays`, `getMonthDays`, `getLast12Weeks`. Ver sección 5 para el razonamiento completo.
**Por qué es crítico**: usar `new Date().toISOString().split('T')[0]` en vez de `getTodayLocal()` produce bugs de timezone reales en dispositivos con UTC negativo (verificado en iOS UTC-3).

### `src/services/db.js`
**Qué hace**: todas las operaciones de lectura/escritura a Firestore — `getWorkouts`, `saveWorkout`, `getCustomExercises`, `saveCustomExercise`, `getUserProfile`, `getSettings`, `getFavorites`/`toggleFavorite`, `getNeverList`/`toggleNever`, `getCustomRoutines` y CRUD relacionado, `saveTabataRecord`/`getTabataRecordCount`, etc.
**Por qué es crítico**: `getWorkouts` limita a los últimos 100 documentos (`limitN = 50` default en la firma, pero se llama con `100` desde `useWorkouts.js`). Agregar campos nuevos a los documentos puede requerir índices compuestos nuevos en Firestore si se combinan con `where`/`orderBy` adicionales.

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

5. **Consolidar la lógica de calendario duplicada en 3 archivos** (`WeekCalendar.jsx`, `MonthCalendar.jsx`, `WeekRow` de `ProgresoPage.jsx`) — los tres filtran por `REAL_WORKOUT_TYPES` y pintan días de forma casi idéntica, pero son implementaciones separadas. Podrían compartir un solo helper.

6. **Unificar ejercicios casi duplicados del catálogo** (`src/data/exercises.js`) — pares/grupos que representan esencialmente el mismo movimiento con nombres separados, detectados al etiquetar `pattern` para el generador de rutinas (sección 16): `glut_02`/`glut_11` (Hip Thrust a una pierna / unilateral), `esp_07`/`hom_04` (Face Pull, duplicado exacto en dos músculos distintos), `hom_03`/`hom_07` (Vuelo posterior / Vuelos posteriores con mancuerna), `bic_02`/`bic_05` (Curl mancuernas / Curl de bíceps con mancuerna), `isq_06`/`isq_07` (Curl Femoral Máquina / Curl de Isquiotibiales en máquina), `glut_05`/`glut_12` (Step-ups altos / Step-ups con mancuernas al cajón alto). Mientras existan como ids separados, el generador los trata como ejercicios distintos con el mismo `pattern`, así que la regla "sin pattern repetido" ya evita que aparezcan juntos en una rutina generada — pero conviene evaluar fusionarlos o diferenciarlos más claramente (equipo/variante) para no inflar el catálogo con duplicados.

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

## 13. SUGERENCIAS PRECARGADAS (`src/components/registro/FuerzaFlow.jsx`)

La sugerencia de progresión dejó de ser solo un texto informativo: cuando corresponde, se **precarga directamente** en las cajas de series/reps/peso, resaltada con un brillo violeta. La lógica vive en dos funciones puras al inicio de `FuerzaFlow.jsx` (antes de `ExerciseCard`), compartidas entre el armado del ejercicio (`buildEntry`) y el texto que se muestra (`ExerciseCard`).

### `computeSuggestionPlan(advice, lastSets)` — reglas a-e

```js
function computeSuggestionPlan(advice, lastSets) {
  if (!advice?.hasHistory || !lastSets?.length) return null
  const pyramid = advice.pattern === 'pyramid'

  if (advice.suggest && advice.suggestType === 'weight') {
    // Series donde se aplica newWeight: pyramid → solo la última, fixed → todas.
    // Sus reps bajan a un valor realista (Epley), acotado entre repsMin del nivel y las reps que hizo esa serie la última vez.
    const idxList = pyramid ? [lastSets.length - 1] : lastSets.map((_, i) => i)
    const reps = {}
    idxList.forEach(i => {
      const prevWeight = Number(lastSets[i]?.weight) || 0
      const prevReps   = Number(lastSets[i]?.reps) || 0
      reps[i] = clamp(estimateRepsAtWeight(prevWeight, prevReps, advice.newWeight), advice.repsMin, prevReps)
    })
    return { type: 'weight', pyramid, value: advice.newWeight, reps }
  }
  if (advice.suggest && advice.suggestType === 'reps') {
    return { type: 'reps-target', pyramid, value: advice.suggestedReps }
  }
  if (!advice.suggest && advice.repsThreshold != null) {
    const threshold = advice.repsThreshold
    const under = (s) => (Number(s.reps) || 0) < threshold
    const applies = pyramid ? under(lastSets[lastSets.length - 1]) : lastSets.some(under)
    if (applies) return { type: 'reps-bump', pyramid, threshold }
  }
  return null
}
```

Traduce el resultado de `getProgressionAdvice()` (sección "Sistema de pesos") en un **plan** describiendo qué campo tocar y en qué series:

| Regla | Condición | `plan.type` | Qué se precarga |
|---|---|---|---|
| **a** | Descarga activa (`deloadActive`) | — (nunca se llama, `plan` se fuerza a `null`) | Nada — solo la reducción de deload existente, sin brillo |
| **b** | `advice.suggest && suggestType === 'weight'` | `'weight'` | `pyramid` → `newWeight` solo en la **última** serie. `fixed` → `newWeight` en **todas**. En las series donde cambia el peso, las **reps también bajan** a un valor realista (Epley — ver subsección abajo); las series donde no cambia el peso no se tocan |
| **c** | `advice.suggest && suggestType === 'reps'` (peso corporal) | `'reps-target'` | `pyramid` → `suggestedReps` solo en la última serie. `fixed` → en todas |
| **d** | `!advice.suggest` pero `hasHistory` y alguna serie no llegó a `effectiveThreshold` (`repsThreshold` + bono por salto de peso, ver subsección abajo) | `'reps-bump'` | `pyramid` → +1 rep solo si la **última** serie no llegó. `fixed` → +1 rep en **cada** serie individual que no llegó (las que ya llegaron quedan intactas) |
| **e** | `!advice.hasHistory` (sin historial) o sin `lastSets` | `null` | Nada — comportamiento sin cambios, ninguna caja brilla |

Nota sobre la regla **d**: puede no aplicar ningún cambio aunque `advice.suggest === false` — por ejemplo, si las reps de ambas sesiones ya llegaron al umbral pero el peso varió entre sesiones (por lo que `getProgressionAdvice` no dispara `suggest: true`), no hay ninguna serie "por debajo del umbral" para sumarle una rep, y `computeSuggestionPlan` devuelve `null` (sin brillo).

### Rangos de reps por nivel y ajuste con Epley (regla b)

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

Para cada serie donde `computeSuggestionPlan` aplica `newWeight`, las reps sugeridas son:
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
| fijo | A/B | 10kg | 3×10 | 12kg | +2 (salto 20%) | 12 | **No** sugiere subir (10 reps < 12) → regla d: +1 rep, objetivo 12 |
| fijo | A/B | 10kg | 3×12 | 12kg | +2 (salto 20%) | 12 | Sugiere subir a **12kg** (12 reps ≥ 12), con reps ajustadas por Epley + clamp |
| fijo | A/B | 18kg | 3×10 | 20kg | +0 (salto 11%) | 10 | Sugiere subir a **20kg** (10 reps ≥ 10) — sin bono, igual que antes |

**Regla d actualizada**: el objetivo de reps para "+1 rep" pasa a ser `effectiveThreshold` en vez de `repsThreshold` — así la app sigue pidiendo una rep más mientras no se alcance el umbral *efectivo* (el que ya incluye el bono por salto de peso), no el umbral base. El mensaje también cambia cuando corresponde: si `jumpBonus > 0`, `"📈 Hoy: +1 rep (objetivo {effectiveThreshold} para subir a {nextWeight} kg)"`; si `jumpBonus === 0`, se mantiene el mensaje corto `"📈 Hoy: +1 rep"` sin aclaración adicional (el próximo peso está a un salto razonable, no hace falta justificarlo).

### `applySuggestionPlan(setsArr, plan)` — aplicación y marcado

```js
function applySuggestionPlan(setsArr, plan) {
  if (!plan) return
  const lastIdx = setsArr.length - 1
  const mark = (idx, fields) => {
    setsArr[idx] = { ...setsArr[idx], ...fields, _suggested: Object.fromEntries(Object.keys(fields).map(f => [f, true])) }
  }
  if (plan.type === 'weight') {
    const applyIdx = (idx) => mark(idx, { weight: plan.value, reps: plan.reps[idx] })
    if (plan.pyramid) applyIdx(lastIdx)
    else setsArr.forEach((_, i) => applyIdx(i))
  } else if (plan.type === 'reps-target') {
    if (plan.pyramid) mark(lastIdx, { reps: plan.value })
    else setsArr.forEach((_, i) => mark(i, { reps: plan.value }))
  } else if (plan.type === 'reps-bump') {
    if (plan.pyramid) {
      const reps = Number(setsArr[lastIdx].reps) || 0
      if (reps < plan.threshold) mark(lastIdx, { reps: reps + 1 })
    } else {
      setsArr.forEach((s, i) => {
        const reps = Number(s.reps) || 0
        if (reps < plan.threshold) mark(i, { reps: reps + 1 })
      })
    }
  }
}
```

Muta `setsArr` in-place y marca cada campo tocado dentro de `_suggested`. Para `'weight'` marca **ambos** campos a la vez (`_suggested: { weight: true, reps: true }`, ya que la regla b siempre toca peso y reps juntos); para `'reps-target'` y `'reps-bump'` marca solo `{ reps: true }`. `mark()` construye el objeto `_suggested` dinámicamente a partir de las claves que efectivamente cambiaron, así que un set nunca queda con una marca en un campo que no se tocó.

### Dónde se invoca — `buildEntry` en `FuerzaFlow`

```js
if (!deloadActive) {
  const advice = getProgressionAdvice(ex.id, ex.name, ex.level, history, learned, ex.equip)
  applySuggestionPlan(setsArr, computeSuggestionPlan(advice, lastSets))
}
```

`buildEntry(ex)` es el único punto de armado de un ejercicio con series precargadas desde el historial, y **todos** los flujos que arman o rearman un ejercicio pasan por ahí: carga manual (`addExercise`), rutinas pre-armadas y generadas (`loadRoutine`, `useGeneratedRoutine`), `swapToAlt` y `replaceWithExercise` — todos llaman `buildEntry` internamente, así que heredan la precarga de sugerencias automáticamente sin lógica duplicada.

### El campo `_suggested` — solo UI, nunca persiste

- **No se guarda en Firestore.** En [WorkoutWizard.jsx](src/components/registro/WorkoutWizard.jsx), `handleSave()` construye el workout final con `stripSuggestedFlags(detail.exercises)` antes de `sanitizeWorkout()`:
  ```js
  const stripSuggestedFlags = (exs) =>
    (exs ?? []).map(ex => ({
      ...ex,
      sets: (ex.sets ?? []).map(({ _suggested, ...rest }) => rest),
    }))
  ```
  El objeto `workout` resultante (ya sin `_suggested`) es el mismo que se pasa a `saveWorkout()` — por lo tanto tanto el documento de Firestore como la actualización optimista del cache/estado local (`useWorkouts.js`) y la pantalla `WorkoutSummary` quedan limpios. `detectPRs`, `detectImprovements`, `achievements.js` y los gráficos de `ProgresoPage.jsx` nunca ven este campo porque todos leen `workouts` (Firestore/cache), no el estado en vivo del wizard.
- **Sobrevive al borrador de `sessionStorage`.** El draft del wizard (`WorkoutDraftContext`, clave `workoutDraft`) guarda `detail` tal cual — como el stripping solo ocurre sobre una copia al momento de guardar (`stripSuggestedFlags` no muta `detail.exercises`), el borrador conserva `_suggested` intacto, así que si el usuario recarga la pantalla a mitad de un registro, el brillo persiste.
- **Se quita al editar.** `updateSet(i, field, val)` en `ExerciseCard` limpia la marca del campo editado:
  ```js
  if (next._suggested?.[field]) {
    const { [field]: _cleared, ...restFlags } = next._suggested
    if (Object.keys(restFlags).length) next._suggested = restFlags
    else delete next._suggested
  }
  ```
- **`addSet` nunca copia la marca.** Construye un objeto literal nuevo (`{ reps: sets[0]?.reps ?? 10, weight: sets[0]?.weight ?? 0 }`) sin spread del set de origen, así que una serie agregada a mano nunca hereda `_suggested`.

### Estilo del brillo — `.input-suggested` (`src/index.css`)

```css
@keyframes suggestGlow {
  0%, 100% { box-shadow: 0 0 0 1.5px #9B7FD4, 0 0 8px rgba(155, 127, 212, 0.6); }
  50%      { box-shadow: 0 0 0 1.5px #9B7FD4, 0 0 12px rgba(155, 127, 212, 0.85); }
}
.input-suggested {
  border-color: #9B7FD4 !important;
  color: #C9B8ED !important;
  box-shadow: 0 0 0 1.5px #9B7FD4, 0 0 8px rgba(155, 127, 212, 0.6);
  animation: suggestGlow 2.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .input-suggested { animation: none; }
}
```

Usa el violeta de la paleta (`app-purple-light` / `#9B7FD4`). El "borde" de 1.5px es en realidad un `box-shadow: 0 0 0 1.5px` (técnica de anillo sin ancho de borde real) — así no reserva espacio ni desplaza el layout, a diferencia de cambiar el `border-width` del input. El pulso lento (`suggestGlow`, 2.6s) se desactiva completamente bajo `prefers-reduced-motion: reduce`. La clase se aplica condicionalmente en `ExerciseCard`: `s._suggested?.reps ? 'input-suggested' : ''` y `s._suggested?.weight ? 'input-suggested' : ''` en los inputs de reps y peso respectivamente.

### Texto acompañante

Badge y mensaje se derivan del mismo `plan` (recalculado en el render de `ExerciseCard` a partir de `progressionAdvice` y `lastSession.sets`, con `plan` forzado a `null` si `deloadActive`):

| `plan.type` | Badge | Mensaje |
|---|---|---|
| `'weight'` | `📈 Subí el peso` | `📈 Hoy: {value}kg × {reps} en la última serie` si `pyramid`; en `fixed`, `📈 Hoy: {value}kg × {reps}` si las reps quedaron iguales en todas las series, o solo `📈 Hoy: {value}kg` (sin `× reps`) si quedaron distintas entre series |
| `'reps-target'` | `📈 Sumá reps` | `📈 Sumá reps (objetivo {value})` |
| `'reps-bump'` | `📈 +1 rep` | `📈 Hoy: +1 rep (objetivo {effectiveThreshold} para subir a {nextWeight} kg)` si `jumpBonus > 0`; si no, `📈 Hoy: +1 rep` |
| `null` con historial | — | `✓ Mantené el peso, vas bien.` |
| sin historial | — | `💡 Primera vez con este ejercicio...` |

El mensaje de `'weight'` se arma en `ExerciseCard` a partir de `plan.reps` (el mapa `{ índice: reps }` que ya calculó `computeSuggestionPlan`): en `pyramid` siempre hay un solo valor (la última serie); en `fixed` se compara si todos los valores de `plan.reps` son iguales (`Object.values(plan.reps).every(r => r === repsValues[0])`) para decidir si mostrar `× reps` o solo el peso.

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
  const updated = { ...(profile ?? {}), ...data }
  setProfile(updated) // optimistic
  await saveUserProfile(user.uid, updated)
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

El aviso de inactividad es exclusivamente informativo/UX — no crea ningún workout, no crea ningún documento de pausa, y no toca `computeStreak()` (sección 1) de ninguna manera. `daysSince`/`lastRealDate` se calculan de forma completamente independiente al `weekMap` que usa la racha, aunque ambos parten del mismo array `workouts` filtrado por `REAL_WORKOUT_TYPES`.

---

## 15. VUELTA SUAVE / REENTRADA (`src/utils/reentry.js`, `src/components/registro/FuerzaFlow.jsx`)

Cuando un usuario retoma un ejercicio puntual después de 14+ días sin hacerlo, la app precarga peso y series reducidos y los va subiendo gradualmente en las sesiones siguientes, en vez de asumir que puede arrancar directo donde lo dejó. Es **por ejercicio** (no por usuario ni por sesión global): cada ejercicio tiene su propio historial y su propio parate.

### Por qué (Bosquet 2013 + decisión de producto)

La fuerza máxima se mantiene razonablemente estable durante ~2-3 semanas de inactividad, pero la resistencia a la fuerza (aguantar el mismo volumen/reps a un peso dado) decae antes — por eso volver directo al peso y series de la última sesión puede llevar a fallar series o a una sesión de calidad mucho más baja de lo esperado, sin que el usuario lo anticipe. Se decidió aplicar la reducción también para paretes no fisiológicos (estrés, descanso, "sin_respuesta") y no solo para enfermedad/lesión: el motivo real de una pausa de 2+ semanas es difícil de auto-reportar con precisión, y una vuelta más suave no tiene costo real para quien sí mantuvo la forma, mientras evita una mala sesión para quien no. Por la misma razón (la memoria muscular permite recuperar el nivel previo rápido, no gradualmente en semanas), la reentrada dura solo 2-4 sesiones, no varias semanas.

**Nunca se quitan series** (corregido en septiembre 2026): la versión original descartaba la última serie del baseline cuando tenía 3+, sin ningún fundamento fisiológico — quitar series no reduce el riesgo de una mala sesión, solo reduce el volumen de golpe. La reentrada ahora reduce **exclusivamente el peso**; la cantidad de series del baseline se mantiene intacta.

### 1. Dos gaps, no uno: `exerciseGap` y `muscleGap`

El bug real que motivó este cambio: la reducción se calculaba mirando únicamente cuánto hacía que no se hacía **ese ejercicio puntual** (`exerciseGap`) — así, alguien que dejó de hacer Hip Thrust hace 3 semanas pero sigue entrenando Glúteos con otros ejercicios (Sentadilla búlgara, Puente de glúteo, etc.) recibía la misma reducción abrupta que alguien que no entrenó Glúteos en absoluto, cuando en realidad no hay ningún desentrenamiento muscular — solo se perdió la práctica de ese movimiento específico.

- **`exerciseGap`**: días desde la última sesión de **ese** ejercicio (igual que antes — `gapToToday` o el gap encontrado entre sesiones consecutivas).
- **`muscleGap`** (`computeMuscleGap()`): días desde la última sesión de fuerza (cualquier ejercicio) que trabajó el mismo músculo (`originalMuscle ?? muscle`) **o** la misma `PATTERN_ZONE` (de `routineGenerator.js`, derivada del `pattern` del ejercicio) — recorriendo el historial completo de workouts, no solo el de este ejercicio. El propio ejercicio objetivo también es candidato en este barrido, así que `muscleGap` nunca es mayor que `exerciseGap` (si nada más lo reemplazó, ambos coinciden). Ejercicios sin `pattern` (personalizados) — tanto el objetivo como los del historial — solo matchean por músculo, nunca por zona.

### 2. Vuelta técnica — cuando el músculo sigue entrenado

- `exerciseGap < 14` → sin reentrada, igual que siempre.
- `exerciseGap ≥ 14` y `muscleGap < 14` → **vuelta técnica**: el músculo/zona sigue entrenado por otro ejercicio — no hay desentrenamiento muscular real, solo se perdió la técnica/el peso específico de este movimiento puntual. Escalón fijo y mínimo: `R = 5%`, `N = 1` sesión. Mensaje: `"🌱 Vuelta técnica · −{r}% (venís entrenando {músculo})"`.
- `exerciseGap ≥ 14` y `muscleGap ≥ 14` → tabla normal de escalones (abajo), pero el escalón se elige por `muscleGap`, no por `exerciseGap` — si otro ejercicio mantuvo el músculo más fresco de lo que sugiere este ejercicio solo, la reducción debe reflejar esa frescura real, no la del ejercicio puntual.
- El modificador por motivo (`'enfermedad'`/`'lesion'`: `R += 5`, `N += 1`) se aplica en **ambos** casos — vuelta técnica incluida — con la misma regla de fechas que antes (`lastWorkoutDate` del parate dentro de la ventana `[baseline, returnBoundary)`).

**Fundamento de la vuelta técnica**: si el músculo se sigue estimulando regularmente (aunque sea con otro ejercicio), no hay pérdida de fuerza ni de resistencia muscular que justifique una reducción de peso significativa — el único "desentrenamiento" real es de la coordinación motora específica de ese patrón/agarre/ángulo puntual, que se recupera en una sola sesión con un peso apenas por debajo del habitual, no en 2-3 sesiones graduales.

### 3. Escalones normales — `getReentrySteps(gapDays, motivo)` (usa `muscleGap`)

| Días sin estímulo del músculo/zona | Reducción (R) | Sesiones de reentrada (N) |
|---|---|---|
| 14–20 | 10% | 2 |
| 21–28 | 15% | 2 |
| 29–56 | 20% | 3 |
| 57+   | 25% | 3 |

Cualquier motivo que no sea `'enfermedad'`/`'lesion'` (`estres`, `descanso`, `sin_respuesta`, o sin motivo) usa la tabla tal cual.

### 4. Detección por ejercicio — `getReentryState(exerciseSessions, today, inactividad, muscleContext)`

No hay ningún campo nuevo en Firestore: todo se deriva en cada llamada a partir de las fechas del historial. `muscleContext = { muscle, pattern, allWorkouts }` — `muscle`/`pattern` del ejercicio objetivo (para derivar su `PATTERN_ZONE`) y el array completo de workouts del usuario (para `computeMuscleGap`).

Algoritmo (sesiones del ejercicio ordenadas de más reciente a más vieja):
1. Si `today − sesión[0] ≥ 14` días → el usuario todavía no volvió a este ejercicio: `k = 0`, `baseline = sesión[0]`, `exerciseGap` = esa diferencia.
2. Si no, se busca el gap de 14+ días más reciente entre sesiones consecutivas, mirando hasta 4 sesiones atrás (el N máximo posible es 3+1 por motivo médico): el primer `i` (0..3) tal que `sesión[i+1]` a `sesión[i]` tengan 14+ días de diferencia → `k = i+1`, `baseline = sesión[i+1]`, `exerciseGap` = esa diferencia.
3. Si no se encuentra ningún gap en esa ventana, o `k ≥ N`, no está en reentrada (`inReentry: false`).
4. El `motivo` de `profile.inactividad` solo se usa si su `lastWorkoutDate` cae dentro de la ventana del parate detectado — si no, es de otro parate o está obsoleto y se ignora.
5. Se calcula `muscleGap` (punto 1) y, con él (o con `exerciseGap` en vuelta técnica, ver punto 2), `R`/`N`. `sessionNumber = k + 1`.

Devuelve `{ inReentry, sessionNumber, totalSessions, reduction, baseline, exerciseGap, muscleGap, isTechnical, motivo, reentrySessionDates }` (`gapDays` se mantiene como alias de `exerciseGap` por compatibilidad).

### 5. Reducción gradual

Para la sesión `j` (1..N) del plan de reentrada, la reducción decrece linealmente: primera sesión con la reducción completa, última sesión casi sin reducción, preparando el regreso a la carga normal (en la vuelta técnica, con `N=1`, la sesión única ya se hace con la reducción completa de 5%):

```
r_j = R × (N − j + 1) / N
```

### 6. Precarga — `buildEntry()` en `FuerzaFlow.jsx`

Si `reentry.inReentry`, la precarga se arma desde el **baseline** (la última sesión antes del parate), no desde la última sesión real:
- **Se mantienen exactamente las series del baseline** — ni se agregan ni se quitan.
- Peso por serie: `floorWeight(peso_baseline × (1 − r_j/100), learnedWeights)`.
- Reps: iguales a las del baseline, sin ajuste.
- **Sin sugerencias de progresión** en esta rama: no se llama a `getProgressionAdvice`/`computeSuggestionPlan`, así que no hay glow violeta ni reps recalculadas con Epley.
- Si hay descarga (deload) activa a la vez, se usa el **menor** entre el peso de reentrada y el peso de descarga (`Math.min`), calculados ambos de forma independiente desde el peso original del baseline — las dos reducciones no se suman.

En la tarjeta del ejercicio se muestra una línea sutil (verde, no violeta, para no confundirla con una sugerencia de progresión):
- Vuelta técnica: `"🌱 Vuelta técnica · −{reduction}% (venís entrenando {ex.muscle})"`.
- Vuelta normal: `"🌱 Vuelta suave · sesión {sessionNumber} de {totalSessions} (−{reduction}%)"`.

### 7. Historial efectivo

Las fechas devueltas en `reentry.reentrySessionDates` (las sesiones de la propia reentrada) se excluyen del historial que alimenta la precarga y `getProgressionAdvice`, tanto **durante** como **después** de la reentrada — así, una vez terminada, la siguiente precarga vuelve a partir del baseline en vez de encadenar sobre sesiones ya reducidas, y la doble progresión no cuenta esas sesiones como si fueran a carga normal. Estas fechas **no** se excluyen de PRs, gráficos, logros ni del historial visual (modal "📊 Historial" de cada ejercicio): esas sesiones sí ocurrieron y cuentan como entrenamiento real a todos esos efectos.

`reentrySessionDates` toma las sesiones **más cercanas al baseline** entre las `k` hechas desde la vuelta (no las más cercanas a hoy): así, si en algún momento se acumulan más de `N` sesiones normales después de que la reentrada terminó, la detección de gap dentro de la ventana de 4 sesiones deja de encontrar ese parate por sí sola y el sistema queda "expirado" de forma natural, sin excluir sesiones que ya son de carga normal.

### 8. Qué NO toca

El sistema de pesos, Epley (`estimateRepsAtWeight`), `REP_RANGES`, el bono por salto de peso (`getJumpRepBonus`), las reglas a-e de `computeSuggestionPlan`, el aviso de inactividad (sección 14) y la racha (sección 1) quedan sin cambios — la reentrada es una capa aparte que solo actúa sobre la precarga de peso/series y sobre qué sesiones ve la progresión.

### 9. Orden del historial

Igual que en el resto de la app (ver sección 5), nunca se asume que `workouts` está ordenado: tanto `getReentryState` como `getLastWeightsForExercise`/`getExerciseSessions`/`getLearnedWeights` (`useWorkouts.js`) ordenan explícitamente por fecha descendente (orden estable ante empates) antes de usar el historial, porque los borradores offline (`draftQueue.js`) pueden anteponerse al array sin garantía de orden. `computeMuscleGap` (dentro de `getReentryState`) recorre el array de `workouts` completo sin asumir orden tampoco — busca la fecha máxima entre coincidencias, no depende de que venga ordenado.

---

## 16. GENERADOR DE RUTINAS (`src/utils/routineGenerator.js`)

Reemplaza las dos implementaciones casi idénticas que existían antes (`generate()` en `GeneradorTab.jsx` y `generateForFlow()` en `FuerzaFlow.jsx`, cada una con su propio `intercalateExercises`), que elegían ejercicios al azar por nivel sin ningún criterio de patrón de movimiento — podían poner dos ejercicios del mismo patrón seguidos (ej. Zancadas atrás + Estocada en el lugar, ambos "zancada"). Ahora ambas UI llaman a la misma función `generateRoutine({ muscles, count, equip, workouts, regenerate })`, que devuelve la lista ya ordenada de ejercicios.

### Etiquetas del catálogo (`src/data/exercises.js`)

Cada uno de los 90 ejercicios tiene dos campos nuevos:
- **`pattern`**: patrón de movimiento (21 valores: `sentadilla`, `zancada`, `bisagra`, `empuje_cadera`, `extension_cadera`, `abduccion`, `curl_femoral`, `extension_rodilla`, `gemelos`, `traccion_vertical`, `traccion_horizontal`, `deltoides_posterior`, `empuje_horizontal`, `aperturas`, `empuje_vertical`, `elevacion_lateral`, `triceps`, `biceps`, `core_flexion`, `core_antiextension`, `core_rotacion`).
- **`unilateral`** (boolean): ejercicios que trabajan un lado del cuerpo por vez (ej. Sentadillas búlgaras, Hip Thrust unilateral, Press de hombros unilateral).

### Regiones y zonas de fatiga (`PATTERN_REGION`, `PATTERN_ZONE`)

- `PATTERN_REGION`: agrupa cada `pattern` en `'inferior'` (tren inferior), `'superior'` (tren superior) o `'core'`. Se usa para la regla dura de unilaterales y para que el core siempre quede al final.
- `PATTERN_ZONE`: agrupación más fina (`rodilla`, `posterior`, `abductores`, `gemelos`, `empuje`, `traccion`, `core`), usada solo como preferencia de orden (alternar zona entre ejercicios consecutivos), nunca como regla obligatoria.

### Selección

Por cada músculo elegido, en el orden en que el usuario los seleccionó:
- **Slot principal**: nivel A (si no hay, B) con un `pattern` que todavía no se usó en la sesión (contador global, no por músculo). Entre los candidatos, gana el de mayor `historyScore` (sesiones de tipo `'fuerza'` con ese `exerciseId` en los últimos 56 días, fechas string), con empate al azar. El principal **siempre** sigue el historial, incluso con `regenerate: true`.
- **Slots accesorios**: prioridad de nivel B → C → A → D, también exigiendo `pattern` nuevo. Con `regenerate: false` se elige por `historyScore` igual que el principal; con `regenerate: true` se elige al azar entre los candidatos válidos (solo los accesorios, no el principal).
- Si para un slot no queda ningún candidato con `pattern` nuevo, se permite repetir un patrón ya usado (mejor un ejercicio repetido de patrón que dejar el hueco vacío) — el orden se encarga de separarlos si es posible.
- Nunca se repite el mismo `id` dentro de la misma rutina.

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

`useGeneratedRoutine()` sigue usando `buildEntry()` sobre cada ejercicio generado (igual que las rutinas prearmadas), así que aplica precarga por historial, sugerencias con brillo violeta y vuelta suave si corresponde. El bug que tenía `GeneradorTab.jsx` (`useRoutine()` armaba `sets: { reps, weight: 0 }` a mano, sin ninguna precarga) se corrigió: ahora ese flujo solo guarda los `id` de los ejercicios elegidos en el draft (`detail.pendingGeneratedIds`) y navega a `/registro`; un `useEffect` nuevo en `FuerzaFlow.jsx` detecta ese campo al montar, construye cada entrada con `buildEntry()` y limpia el campo. `saveAsPrearmada()` (guardar como rutina propia) no cambió.

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
const { workouts, loading, ... } = useWorkouts(user?.uid)
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
- `generatedIds` → arma un draft con `pendingGeneratedIds` (mismo mecanismo que `GeneradorTab.useRoutine`, sección 16) y navega a `/registro` sin `state` — `FuerzaFlow.jsx` los detecta al montar y construye cada entrada con `buildEntry` (precarga, sugerencias con brillo, vuelta suave).
- `cardio` → navega a `/registro` con `state: { type: 'cardio' }`.

---

## Documentación técnica extendida

Este archivo es la fuente de verdad para lógicas complejas, decisiones de producto y bugs conocidos del proyecto. **Debe actualizarse** cada vez que se modifique alguna de las lógicas acá documentadas (racha, pausa, medallas, PRs, fechas, offline/auth, estructura de datos). Ver también `CONTEXTO.md` para arquitectura general, stack, y convenciones de código.
