# Informe: ejercicios por tiempo (temporizador ▶)

Fecha: noviembre 2026 · Código analizado: rama `master`, commit `62f7190` · **No se modificó código de la app** (solo se agregó este informe).

> **Cómo leer este informe.** Todo lo de las secciones 1 a 4 sale de leer el código y de ejecutar pequeñas simulaciones sobre las funciones reales (`getProgressionAdvice`, `detectPRs`, `detectImprovements` y el catálogo). Además se contrastó con un export real de datos de uso (el archivo no se incluye en el repo; acá solo van conclusiones generales) en los puntos 1.6 y 3.3.

## Resumen (lo importante)

1. **Hay 9 ejercicios del catálogo con ▶ por defecto**, activados por una lista de **nombres** (`TIME_EXERCISES`, 6 entradas) comparada con `ex.name.includes(...)`. No hay ningún campo `tiempo`/`duración` en `exercises.js` ni en `routines.js`.
2. **El ▶ está disponible para cualquier ejercicio**: el botón "Reps/Segs" junto al nombre lo activa a mano. Ese estado (`useSeconds`) **no se guarda**.
3. **El temporizador no guarda nada.** Es una cuenta regresiva visual. Los segundos que ves en la fila se guardan **en el campo `reps`** del set (`{ reps: 45, weight: 0 }`). **No existe ninguna marca que diga que ese número son segundos**: el historial no distingue "45 reps" de "45 segundos".
4. **Todas las estadísticas de progreso (mayor progreso, PRs, logros) miran solo `weight`** y descartan los ejercicios con peso 0. Por eso los ejercicios de tiempo sin carga **no aparecen** en esas estadísticas. Lo que sí se ve contaminado son los textos que muestran `reps` (historial, "hiciste N reps más", "Objetivo: 15 reps") y el motor de sugerencias, que trata los segundos como repeticiones.
5. **"Sentadilla isométrica +100 %"** no viene de los segundos (esos van en `reps`): viene de la columna **Peso (kg)**. **Contraste con datos de uso:** el +100 % corresponde a una mejora real de peso, no a un error de carga. Detalle en 3.3.
6. **Tabata no comparte nada con este temporizador**: la sección Tabata es solo de referencia (no tiene temporizador).
7. Eliminar la funcionalidad: **(a) quitar el play** es el cambio más barato y no toca datos; **(b) pasar a repeticiones** deja el historial con segundos mezclados como repeticiones; **(c) solo "completado"** es el más invasivo y deja huecos en varias pantallas. Comparativa en la sección 4.

---

## 1. Inventario de ejercicios por tiempo

### 1.1 Cómo se decide qué ejercicio tiene ▶

`src/components/registro/FuerzaFlow.jsx`:

```js
// línea 16
const TIME_EXERCISES = ['Plancha', 'Sentadilla isométrica', 'Bird Dog', 'Hollow Body Hold', 'Dead Bug', 'Press Pallof']
// línea 229, dentro de ExerciseCard
const defaultSecs = TIME_EXERCISES.some(n => ex.name.includes(n))
const [useSeconds, setUseSeconds] = useState(defaultSecs)   // línea 230
```

- La regla es **por nombre y por substring** (`includes`), no por `id`. Cualquier ejercicio —del catálogo, personalizado o "alternativa" generada— cuyo nombre contenga alguna de esas 6 cadenas arranca en modo "Segs" con el ▶.
- Búsqueda de otras marcas: no existe `isTimed`, `duration`, `tiempo` ni similar en `src/data/exercises.js`, `src/data/routines.js`, `src/data/tabatas.js` ni en `routineGenerator.js`. `TIME_EXERCISES` es la única fuente.
- El botón "Segs/Reps" (líneas 278-285) alterna `useSeconds` para **cualquier** ejercicio (la etiqueta de columna pasa de "Reps" a "Segs" y aparece la columna "Timer" con el ▶).

### 1.2 Tabla: ejercicios del catálogo con ▶ por defecto (9 de 90)

| # | Nombre | id | Músculo / categoría (`muscle` · `zone`/`group`) | Nivel | Equipo | Duración por defecto | Rutinas pre-armadas donde aparece |
|---|---|---|---|---|---|---|---|
| 1 | Sentadilla isométrica | `cua_07` | Cuádriceps · Cuádriceps | C | Pared | **12 s** (precarga sin historial) | — |
| 2 | Plancha con flexión | `abs_02` | Abdominales (zona Superior) · Core | B | Sin equipamiento | **10 s** (nivel B) | — |
| 3 | Plancha lateral | `obl_03` | Abdominales (zona Oblicuos) · Oblicuos | C | Sin equipamiento | 12 s | — |
| 4 | Dead Bug | `obl_04` | Core & Estabilidad · Core profundo | D | Sin equipamiento | 12 s | — |
| 5 | La Plancha | `cor_01` | Core & Estabilidad · Core profundo | D | Sin equipamiento | 12 s | — |
| 6 | Press Pallof | `cor_02` | Core & Estabilidad · Core anti-rotación | D | Banda/Polea | 12 s | — |
| 7 | Bird Dog | `cor_03` | Core & Estabilidad · Core profundo | D | Sin equipamiento | 12 s | — |
| 8 | Hollow Body Hold | `cor_04` | Core & Estabilidad · Core profundo | D | Sin equipamiento | 12 s | — |
| 9 | Plancha con Arrastre de Mancuerna | `plancha-arrastre-mancuerna` | Core & Estabilidad · Core profundo | D | Mancuerna | 12 s | **Piernas y Hombros** (`rutina-empuje-vertical`, 3 series) y **Fuerza Accesoria** (`rutina-fuerza-accesoria`, 3 series) |

Aclaraciones sobre la columna "Duración por defecto":

- **No hay una duración definida por ejercicio.** Lo que se ve es el valor de precarga genérico de `buildEntry` (`FuerzaFlow.jsx:581-593`): sin historial se crean **3 series con `reps: 10` si el nivel es A/B y `reps: 12` si es C/D**, y ese número es el que el ▶ usa como segundos de trabajo. Con historial se precarga la última sesión tal cual (los segundos de la vez anterior).
- El valor **30** aparece solo como respaldo del temporizador (`Number(s.reps) || 30`, línea 426): se usa si el campo está vacío o en 0.
- Las rutinas pre-armadas guardan solo `sets` (cantidad de series), nunca repeticiones ni segundos. El `repsScheme: '12'` que ves en el generador es solo texto (`FuerzaFlow.jsx:739`, `GeneradorTab.jsx:49`).
- Solo **1 de los 9** ejercicios (`plancha-arrastre-mancuerna`) está en las rutinas pre-armadas. Los otros 8 llegan por modo libre, por **rutinas personalizadas** (Firestore `customRoutines`, que pueden contener cualquier ejercicio) o por los generadores (ver 3.12).

### 1.3 Nombres "alternativa" que también activan ▶ pero no son ejercicios del catálogo

El botón "Alternativa: …" (`swapToAlt`, `FuerzaFlow.jsx:638-655`) busca el nombre de la alternativa en el catálogo; si no lo encuentra, **crea una entrada con un id falso** (`alt-{índice}-{timestamp}`, 3 series de 12 reps). Si el nombre contiene una de las 6 cadenas, esa entrada también arranca con ▶:

| Alternativa (texto en `alt`) | Sale de | Está en el catálogo | ¿Activa ▶? |
|---|---|---|---|
| Plancha en rodillas | `cor_01` La Plancha | No | Sí (contiene "Plancha") |
| Plancha lateral rodilla | `obl_03` Plancha lateral | No | Sí |
| Plancha lateral estática | `obl_02` Rolling Plank | No | Sí |
| Dead Bug simplificado | `obl_04` Dead Bug | No | Sí |
| Bird Dog simplificado | `cor_03` Bird Dog | No | Sí |
| La Plancha | `cor_04` Hollow Body Hold, `plancha-arrastre-mancuerna` | Sí (`cor_01`) | Sí |
| Plancha lateral | `cor_02` Press Pallof | Sí (`obl_03`) | Sí |
| Plancha con flexión | `abs_01` Rueda abdominal | Sí (`abs_02`) | Sí |
| Sentadilla isométrica | `cua_08` Extensión Cuádriceps | Sí (`cua_07`) | Sí |

Consecuencia: los ejercicios `alt-…` tienen un **id distinto en cada uso**, así que **no tienen historial** (no se precarga lo anterior) y aparecen como ejercicios separados en "Análisis por ejercicio" de Progreso.

### 1.4 Desajustes entre la lista, el catálogo y lo que "parece" de tiempo

**(A) Tienen ▶ por defecto por coincidencia de nombre, pero se discute que sean "por tiempo":**

| Ejercicio | Observación |
|---|---|
| Dead Bug (`obl_04`), Bird Dog (`cor_03`), Press Pallof (`cor_02`) | Habitualmente se hacen por repeticiones (por lado). Están en `TIME_EXERCISES` igualmente. |
| Plancha con Arrastre de Mancuerna (`plancha-arrastre-mancuerna`) | Entra por contener "Plancha"; lleva carga (mancuerna), así que normalmente tiene peso > 0 **y** un número en `reps` que acá se lee como segundos. |

**(B) Parecen de tiempo/isométricos y NO tienen ▶ por defecto** (se pueden activar a mano con "Reps/Segs"):

| Ejercicio | id | Por qué |
|---|---|---|
| Rolling Plank | `obl_02` | Es una plancha dinámica; el nombre en inglés ("Plank") no coincide con "Plancha". |
| Mountain Climber | `abi_01` | Se suele hacer por tiempo. |
| Elevación de piernas colgado | `abi_02` | Normalmente repeticiones — se lista solo por completitud (no es de tiempo). |
| Abducción con pausa | `glut_abd_pausa` | La "pausa" es isométrica pero se cuenta en repeticiones (no es de tiempo). |

**(C) Tienen ▶ pero no están en `TIME_EXERCISES`:** no hay ninguno de forma fija. Sí ocurre **dinámicamente** en estos casos:

1. **Activación manual** con el botón "Reps/Segs" (no se guarda: al recargar o reabrir el borrador, la tarjeta vuelve a decidir por nombre).
2. **Estado pegado al reemplazar el ejercicio.** `ExerciseCard` se renderiza con `key={i}` (índice) y `useSeconds` se calcula **solo al montar** (`useState(defaultSecs)`). Si en la posición 2 había "La Plancha" (▶ activo) y tocás **"Cambiar"** por "Prensa", la tarjeta sigue montada y **la Prensa queda con ▶ y "Segs"**; al revés, cambiar "Prensa" por "La Plancha" deja la Plancha **sin ▶**. (Lectura del código; no reproducido en pantalla.)
3. **Ejercicios personalizados** cuyo nombre contenga una de las 6 cadenas.

**(D) En `TIME_EXERCISES` pero sin coincidencia exacta de nombre:** las 6 entradas coinciden con al menos un ejercicio del catálogo. Todas las coincidencias están en la tabla 1.2 (`Plancha` → 4: `cor_01`, `abs_02`, `obl_03`, `plancha-arrastre-mancuerna`).

### 1.5 Rutinas pre-armadas (5) y presencia de ejercicios de tiempo

| Rutina | id | ¿Tiene ejercicios con ▶? |
|---|---|---|
| Isquios y Espalda | `rutina-cadena-posterior` | No |
| Piernas y Hombros | `rutina-empuje-vertical` | Sí: Plancha con Arrastre de Mancuerna (3 series) |
| Pecho y Glúteos | `rutina-empuje-horizontal` | No |
| Fuerza Accesoria | `rutina-fuerza-accesoria` | Sí: Plancha con Arrastre de Mancuerna (3 series) |
| Glúteos | `rutina-gluteos` | No |

### 1.6 Contraste con datos de uso reales

Se leyó un export de **Configuración → Exportar** con el script del Apéndice A (solo lectura). Por privacidad, el archivo no se incluye en el repo y este informe no reproduce fechas, pesos ni valores concretos; solo conclusiones generales.

- **Cobertura:** algunos de los ejercicios con play tienen registros y otros nunca se usaron, así que el impacto de cualquier cambio se concentra en pocos ejercicios.
- **Los valores guardados en `reps` se corresponden con segundos en casi todos los casos**, tal como asume el modo "Segs". Pero el archivo no guarda ninguna unidad: solo se deduce por el tamaño del número, y en algún caso no hay forma de saber si es tiempo o repeticiones.
- **Un ejercicio tiene registros con unidades mezcladas:** en una sesión el valor parece segundos y en otra, repeticiones. La progresión y las comparaciones entre sesiones lo leen como una caída. Es el caso real del riesgo descripto en 3.2.
- **Formatos distintos dentro del campo de peso:** en algunos ejercicios sin carga el peso se guarda como texto vacío y no como 0. Los cálculos lo tratan como 0, así que no rompe nada.
- **Ejercicios con peso real:** varios ejercicios de tiempo combinan segundos con carga real (mancuerna o disco), por lo que ahí `weight` sí es peso verdadero y los segundos y el peso evolucionaron en el sentido esperado.

---

## 2. Implementación del temporizador

### 2.1 Componentes y archivos

Todo vive en `src/components/registro/FuerzaFlow.jsx`:

| Pieza | Líneas | Qué hace |
|---|---|---|
| `TIME_EXERCISES` | 16 | Lista de nombres que activan modo "Segs" por defecto. |
| `playBeep()` / `doVibrate()` | 45-57 | Beep (Web Audio) y vibración. **Compartidos** con el temporizador de descanso. |
| `InlineTimer` | 59-99 | **El temporizador del ▶.** Cuenta regresiva de `workSecs` ("Trabajo", verde) y, al terminar, otra de `restSecs` ("Descanso", rojo); beep + vibración al final de cada fase. Botón ✕ para cancelar. No escribe en el estado ni en Firestore. |
| `InlineRestTimer` | 101-141 | **Otro** temporizador, el de descanso entre series (botón ⏱ por ejercicio). Es independiente y funciona igual para ejercicios con o sin ▶. |
| `ExerciseCard` | 227-490 | Estado local `useSeconds`, `activeTimerIdx` (qué serie está contando). |
| Botón "Reps/Segs" | 278-285 | Alterna `useSeconds`. |
| Tabla de series y botón ▶/⏹ | 383-431 | Con `useSeconds`: grilla de 4 columnas (Serie · Segs · Peso · Timer). El ▶ (líneas 416-423) alterna `activeTimerIdx`. |
| Montaje del contador | 425-429 | `<InlineTimer workSecs={Number(s.reps) \|\| 30} restSecs={currentRestSecs} …/>` |

- **Segundos de trabajo** = el valor del campo `reps` de esa serie (o 30 si está vacío/0).
- **Segundos de descanso** = `exData.restSecs ?? restSec`, donde `restSec = getRestTimer(profile.objetivo)` (75 s Tonificar, 105 Masa, 210 Fuerza, 52 Resistencia, 75 Bienestar; `progression.js:3-12`) y se puede cambiar por ejercicio con el ✏️ (opciones 30-180 s).
- `useSeconds` **no se persiste** ni en el borrador ni en el workout; solo `restSecs` (si se cambió) se guarda dentro del ejercicio.

### 2.2 Qué se guarda en Firestore

Se guarda el workout completo (`users/{uid}/workouts/{id}`) desde `WorkoutWizard.handleSave`. Para un ejercicio de tiempo la estructura exacta es:

```js
{
  type: 'fuerza',
  date: '2026-11-09',
  exercises: [
    {
      exerciseId: 'cor_01',            // o 'alt-2-1731100000000' si vino de "Alternativa" sin catálogo
      name: 'La Plancha',
      muscle: 'Core & Estabilidad',
      originalMuscle: 'Core & Estabilidad',
      // originalExerciseId: '…'       // solo si se usó "Alternativa"/"Volver"
      // restSecs: 60                  // solo si se cambió el descanso de ese ejercicio
      sets: [
        { reps: 45, weight: '' },      // ← los SEGUNDOS van en "reps"; peso '' (o 0 / un número si lo cargaste)
        { reps: 45, weight: '' },
        { reps: 40, weight: '' }
      ]
    }
  ],
  fatigue: 5, notes: '', deload: false, muscleGroups: ['Core & Estabilidad'],
  createdAt: Timestamp
}
```

- `sanitizeWorkout` convierte `undefined` en `null`, pero un `weight` vacío (`''`) se guarda como `''` (no `null`). Al editar el campo se convierte a número (`Number(val)`), así que quedan `''` (nunca tocado) o un número.
- `stripSuggestedFlags` quita `_suggested` de cada set y `suggestionDismissed` del ejercicio antes de guardar. **No se guarda ninguna marca de unidad** (`unit`, `secs`, `timed`…).
- `buildEntry` precarga `weight: ''` si no hay historial, o el `weight` de la última sesión.

### 2.3 ¿Comparte lógica con Tabata?

**No.** Verificado:

- `src/components/tabata/*` (`TabataPage`, `TabataCard`, `TabataDetail`, 199 líneas en total) no contiene ningún temporizador, intervalo, beep ni vibración. Es una pantalla **de referencia**: muestra las estaciones de cada Tabata y "Tiempos de referencia" (trabajo/descanso/rondas) que se pueden guardar como ajustes (`saveTabataSettings`), y calcula el tiempo total con `calcTabataTime` (`data/tabatas.js:119`).
- `InlineTimer`/`playBeep` no se exportan ni se importan fuera de `FuerzaFlow.jsx`.
- Tampoco comparte lógica con **Cardio**: `CardioFlow` usa su propio campo h:m:s y guarda `durationSeconds` (`utils/cardio.js`); es un registro manual, sin cuenta regresiva.

> **Corrección a un informe anterior:** en la sección 21 de `LOGICA_TECNICA.md` (hallazgo #10) y en mis mensajes dije que "el Tabata es un temporizador". Es incorrecto: es una pantalla de referencia y no tiene temporizador. La conclusión de ese hallazgo (el logro "Tabata master" es inalcanzable porque nada guarda `tabataRecords`) sigue siendo válida.

---

## 3. Dónde se usan los datos de tiempo y cómo se tratan los segundos

Premisa clave: **los segundos viven en `set.reps`**, el peso en `set.weight`, y **nada indica la unidad**. Para cada lector:

### 3.1 Resumen

| # | Lugar | Qué lee | ¿Cómo trata los segundos? |
|---|---|---|---|
| 1 | Doble progresión / sugerencias — `utils/progression.js` (`getProgressionAdvice`, 57-137) | `reps` y `weight` de las últimas sesiones | **Los trata como repeticiones.** Compara con el umbral de reps del nivel (C/D: 15; A/B: 10) |
| 2 | Tarjeta "¡Podés superarte!" — `FuerzaFlow.jsx:186-225, 333-373` | resultado de (1) | **Mezcla/distorsiona** (ver 3.2) |
| 3 | `detectImprovements` — `utils/prUtils.js:20-44` → `WorkoutSummary.jsx:207-212` | `reps` a igual peso | **Mensaje en unidad equivocada**: "¡Hiciste 10 reps más en La Plancha! 🎯" |
| 4 | `detectPRs` — `prUtils.js:1-18` | solo `weight` | Ignora ejercicios con peso 0; los segundos no cuentan |
| 5 | "Mayor progreso" / "Mejor marca" / "Más entrenado" / PRs totales — `ProgresoPage.jsx:39-123` | solo `weight` (máx. por sesión) | **Ignora los ejercicios con peso 0** (ni suman en "más entrenado") |
| 6 | "Principales progresiones" — `ProgresoPage.jsx:126-167` (render en 480-495) | `weight` y `reps` al mismo peso | Solo con peso > 0; muestra "+N reps" si no cambió el peso |
| 7 | "Análisis por ejercicio" — `ExerciseProgress.jsx:51-82, 145` | gráfico: máx. `weight`; resumen: `{series}×{reps} · {weight}kg` | Segundos aparecen como "reps"; gráfico plano en 0 si no hay peso |
| 8 | Historiales: `WorkoutHistorial.jsx:104`, `WeekCalendar.jsx:22-27`, `ExerciseHistoryModal` (`FuerzaFlow.jsx:143-175`), `BibliotecaTab.jsx:73`, `ProgresoPage.jsx:491` | `reps`, `weight` | Muestran segundos como "reps" ("Serie 1: 45 reps · 0 kg") |
| 9 | Logros — `utils/achievements.js:92-122, 232-262, 342-358` | solo `weight` | Ignoran peso 0. Con peso > 0 cuentan como cualquier ejercicio (ver 3.7) |
| 10 | Medallas semanales — `Logros.jsx:128-136` | `detectPRs` y cantidad de ejercicios | PR solo por peso; "volumen alto" = ≥ 5 ejercicios (no mira series/reps) |
| 11 | Resumen semanal — `Inicio.jsx:123-156` (`computeWeeklyStats`) | máx. `weight` | Solo peso |
| 12 | Generador / sugerencia diaria / rutina de regreso — `routineGenerator.js`, `dailySuggestion.js`, `returnRoutine.js` | músculo, nivel, patrón, historial de sesiones | **No miran reps ni segundos**; los ejercicios de tiempo son ejercicios comunes |
| 13 | Pesos aprendidos / PR por ejercicio / precarga — `hooks/useWorkouts.js:17-70` | `weight` (PR, aprendidos) y `sets` completos (precarga) | Precarga copia los segundos como "reps"; PR y pesos aprendidos solo peso |
| 14 | Modo regreso — `utils/reentry.js` | último peso de cada sesión | Solo peso: con peso 0 queda inactivo |
| 15 | Rutina de regreso — `returnRoutine.reduceWeight` | `weight` | Reduce solo el peso; `reps` (segundos) intactos |
| 16 | Cardio / `utils/cardio.js` | `durationSeconds` propio de workouts de cardio | **No relacionado**: otro campo, otro tipo de workout |
| 17 | Volumen total (toneladas, series totales) | — | **No existe** un cálculo de volumen por reps×peso en la app. `WorkoutSummary` solo suma cantidad de series (`totalSets`) |

### 3.2 Doble progresión y sugerencias (simulación real)

Ejecuté las funciones reales con 2 sesiones iguales de 3 series:

| Caso | Resultado de `getProgressionAdvice` | Lo que ve la usuaria |
|---|---|---|
| La Plancha, 12 s × 3 (valor de precarga) | `suggest: false`, umbral 15 | "Objetivo: **15 reps** por serie" (unidad equivocada) |
| La Plancha, 45 s × 3, sin peso | `suggest: true`, `suggestType: 'reps'` | `buildRepsOption` ofrece "+2 reps" solo si el resultado ≤ 25 (`REPS_CAP`); 45 + 2 = 47 > 25 → **no hay opción** → como `suggest` es verdadero, se muestra **"✓ Ya definiste tu progresión para hoy."** sin haber definido nada |
| Sentadilla isométrica, 45 s × 3, sin peso | igual que el anterior | igual |
| Sentadilla isométrica, 45 s × 3 con 10 kg | `suggestType: 'weight'`, `newWeight: 12`, umbral efectivo 17 | Ofrece "+ peso: 12 kg × N": las "reps" se estiman con **Epley sobre los segundos** (`estimateRepsAtWeight`) y se fuerzan a un mínimo de 10 (`repsMin`), es decir, puede **bajar los segundos** al subir el peso |
| Press Pallof, 30 s × 3 con 5 kg | `suggestType: 'weight'`, `newWeight: 6` | igual que el anterior |

Es decir: para ejercicios de tiempo, la doble progresión **funciona como si los segundos fueran repeticiones**: se "cumple" el umbral con valores de tiempo normales (30-60), la sugerencia de reps casi nunca se puede mostrar y la de peso modifica los segundos con una fórmula pensada para repeticiones.

### 3.3 "Mayor progreso": la "Sentadilla isométrica +100 %"

Código (`ProgresoPage.jsx:60-84`):

```js
const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
if (maxW <= 0) return                          // ← descarta peso 0
…
if (exFirst[id] == null) exFirst[id] = maxW     // peso máx. de la PRIMERA sesión
exLast[id] = maxW                               // peso máx. de la ÚLTIMA sesión
pct = (exLast - exFirst) / exFirst * 100        // se queda con el mayor %
```

- La métrica compara **el peso máximo de la primera sesión con el de la última** (no el mejor histórico) y solo para ejercicios con peso > 0.
- Los segundos del modo "Segs" van a `reps`, que esta cuenta **nunca lee**. Por lo tanto **"+100 %" significa que el peso máximo registrado en Sentadilla isométrica se duplicó entre la primera y la última sesión** (por ejemplo, el doble de carga, o un valor de tiempo escrito por error en "Peso (kg)").
- **Contraste con datos de uso:** el +100 % de Sentadilla isométrica corresponde a una mejora real de peso (carga real que subió entre la primera y la última sesión con peso), no a un error de columna. Los segundos no intervienen en el porcentaje.
- Consecuencia: la métrica ignora las sesiones sin peso, aunque ahí haya empezado el ejercicio; el progreso en tiempo no se refleja como porcentaje.
- Es una métrica frágil por diseño: un primer registro de peso chico y cualquier aumento razonable produce porcentajes enormes, y la misma lógica alimenta los logros `primerSalto` (+25 %), `dobleProg` (×2) y `transformacion` (3 ejercicios ×2) — ver 3.7.

### 3.4 `detectImprovements` (resumen post-entrenamiento)

Simulación: La Plancha 40 s × 3 contra 30 s × 3 (sin peso):

```
detectImprovements → [{ name: 'La Plancha', type: 'reps', deltaR: 10, reps: 40 }]
```
`WorkoutSummary.jsx:207-212` lo muestra como **"¡Hiciste 10 reps más en La Plancha! 🎯"**: mejora real, unidad equivocada. En cambio `detectPRs` devuelve `[]` para ejercicios sin peso (los PR son solo de peso). Con peso (Sentadilla isométrica con más kilos que en la sesión anterior) sí da PR.

### 3.5 Pantallas de historial

Todas imprimen `reps` literal con la palabra "reps" o con "×": `WorkoutHistorial.jsx:104` ("Serie 1: 45 reps · 0 kg"), `WeekCalendar.jsx:22-27` (`45 reps` si no hay peso, `45×10 kg` si hay), `ExerciseHistoryModal` (`45 × 0kg`), `BibliotecaTab.jsx:73`, `ProgresoPage.jsx:491` (`10kg × 45`). No hay formateo especial para tiempo.

### 3.6 Estadísticas de "más trabajado"

"Más entrenado" (`ProgresoPage.jsx:86-91`) cuenta sesiones **solo de ejercicios con peso > 0** (la cuenta está dentro del mismo `if (maxW <= 0) return`). Los ejercicios de tiempo sin carga **nunca pueden aparecer** como "más entrenado".

### 3.7 Logros

| Logro | Lógica | Efecto con ejercicios de tiempo |
|---|---|---|
| Semanal `w_supero_pr`/`w_mas_fuerte` | `detectPRs` por semana | Solo si hay peso > 0 |
| `rachaFuerza` (3 aumentos de peso en una semana) | máx. `weight` por ejercicio | Solo con peso > 0 |
| `primerSalto`, `dobleProg`, `transformacion` | primer vs. actual peso máx. por ejercicio | Un ejercicio de tiempo **con carga** (Sentadilla isométrica con kg, Pallof, Plancha con arrastre) cuenta como cualquier otro |
| PRs (`computePRData`) | máx. `weight` | Idem |
| Volumen alto semanal | ≥ 5 ejercicios en una sesión | Cuenta el ejercicio, sin mirar series/reps/segundos |
| `consistenciaRegistro`, `cienDias`, etc. | notas, días | Sin relación |

### 3.8 Otros lugares sin tratamiento de tiempo

- **Rutina de regreso**: reduce el peso con `floorWeight`; deja `reps` (segundos) como estaban.
- **Deload**: solo vista previa de peso.
- **Generador de rutinas / sugerencia diaria / "Sugerencia" del modo libre**: eligen por músculo, nivel, patrón (`core_antiextension`, `core_rotacion`…) e historial de sesiones; los ejercicios de tiempo caen en el bloque de core al final de la rutina (`tierOf` = 3 para patrones core). `abs_02` (Plancha con flexión, Abdominales nivel B) puede salir como principal de core en la **rutina de regreso** y en la sugerencia diaria.
- **`draftHasRealContent`**: un workout de fuerza cuenta como "con contenido" si tiene ejercicios; no mira valores.

---

## 4. Impacto de eliminar la funcionalidad

Todos los escenarios parten de lo mismo: **el historial existente ya guardado contiene segundos dentro de `reps`** (sin marca de unidad). Lo único que se puede hacer sin migrar datos es leerlos tal cual.

### Escenario (a): quitar solo el botón ▶/temporizador y registrar los segundos a mano

**Qué se cambia (solo `FuerzaFlow.jsx`):**
- Borrar `InlineTimer` (59-99), el estado `activeTimerIdx` (231), la columna "Timer" y el botón ▶/⏹ (388, 416-423) y el montaje del contador (425-429); pasar la grilla a 3 columnas.
- Conservar `playBeep`/`doVibrate` (los usa `InlineRestTimer`).
- Opcional: mantener `TIME_EXERCISES` + el botón "Reps/Segs" solo para rotular la columna como "Segs". Si se quiere un rotulado más honesto, ver la nota de mejora al final.

| Aspecto | Resultado |
|---|---|
| Historial ya guardado | **Intacto y 100 % compatible**: la estructura guardada no cambia (los segundos ya se guardaban a mano en `reps`). |
| Progreso, PRs, logros | **Sin ningún cambio**: ninguno leía el temporizador. "Sentadilla isométrica +100 %" queda igual (depende de `weight`). |
| Lo que se pierde | La cuenta regresiva con beep/vibración (hay que cronometrar aparte) y el descanso automático posterior al trabajo. El temporizador de descanso ⏱ sigue funcionando. |
| Lo que NO se arregla | Los textos en unidad equivocada (3.2, 3.4, 3.5) y el mensaje "Ya definiste tu progresión" siguen igual. |
| Riesgo | Mínimo. Un solo archivo; no hay migración. Hay que actualizar `LOGICA_TECNICA.md` si se documenta el temporizador. |

### Escenario (b): convertir esos ejercicios a repeticiones

**Qué se cambia:**
- `FuerzaFlow.jsx`: quitar `TIME_EXERCISES`, `useSeconds`, `InlineTimer` y el botón "Reps/Segs" (o dejarlo apagado). Los 9 ejercicios pasan a registrar repeticiones como cualquier otro.
- Opcional/recomendado: ajustar nombres/notas del catálogo (`exercises.js`) para que tengan sentido en repeticiones (p. ej. "Plancha" en repeticiones es poco natural: habría que reemplazarla por variantes dinámicas o aceptar la incoherencia).
- **Datos:** hay que decidir qué hacer con los segundos viejos (ver abajo).

| Aspecto | Resultado |
|---|---|
| Historial ya guardado | **Contiene segundos que ahora se leerían como repeticiones.** Valores típicos de 30-60 "reps" en planchas contaminan: la precarga (se precargaría "45 reps"), `getProgressionAdvice` (el umbral de 15 reps queda "superado" desde el día 1, ver 3.2), Epley, los mensajes "N reps más" y los historiales. |
| Opciones para el historial | (1) **Migración de datos** en Firestore: recorrer los workouts y, para los ids de tiempo, vaciar/convertir `reps` o marcarlos (p. ej. `legacySeconds: true`), con backup previo; (2) **filtro en lectura**: ignorar `reps` de esos `exerciseId` en progresión/historial sin tocar Firestore; (3) **no hacer nada** y aceptar la inconsistencia hasta que se acumule historial nuevo. |
| Progreso / PRs / logros | Siguen mirando solo `weight`: **"+100 %" de Sentadilla isométrica no cambia** (viene del peso). Cambia lo que muestra `reps` (principales progresiones por reps, `detectImprovements`) y las sugerencias de progresión de esos ejercicios (empezarían a funcionar "bien" solo con historial nuevo). |
| Riesgo | Medio: cambio de significado de datos existentes. Sin migración o filtro, el historial viejo da sugerencias absurdas. Los ids `alt-…` (1.3) ya eran inconsistentes y seguirían sin historial. |

### Escenario (c): que solo se marquen como completados, sin valor numérico

**Qué se cambia:**
- `FuerzaFlow.jsx`: para los ejercicios de tiempo, reemplazar la tabla de series por un check ("hecho"). Hay que decidir el formato guardado:
  - **c1)** `sets: []` y un campo `done: true` en el ejercicio, o
  - **c2)** un set simbólico `[{ reps: 1, weight: 0, done: true }]`.
- `buildEntry` (581-593): no precargar 3 series de 12 para esos ids.
- `WorkoutWizard.jsx`: guardar el nuevo campo; `WorkoutSummary.jsx` (`totalSets`), `WorkoutHistorial.jsx`, `WeekCalendar.jsx` (formato de ejercicio) para mostrar "✓ hecho" en vez de series.
- Lectores que asumen `sets` con datos (ver abajo).

| Aspecto | Resultado |
|---|---|
| Historial ya guardado | Los registros viejos siguen con segundos en `reps`; los nuevos no tendrían valores → **historial mixto**. El detalle viejo seguiría mostrándose como "45 reps". |
| Progreso | Los ejercicios sin sets se omiten en casi todas las métricas (`if (!e.exerciseId \|\| !e.sets?.length) return`), lo que es **coherente**. Pero: (i) `ExerciseProgress` los lista en el buscador (`exercisesWithHistory` no mira sets) con gráfico en 0 y sin resumen (`lastSession` devuelve `null` si no hay sets); (ii) **"+100 %" de Sentadilla isométrica persistiría para siempre** (se calcula del historial viejo) salvo que se filtre por id o se corrija el dato. |
| PRs | Sin cambios para el resto; esos ejercicios ya no podrían tener PR (peso 0) — ya no los tenían salvo con carga. Los PR viejos con peso permanecen. |
| Logros | Ninguno depende de segundos. Si el ejercicio tenía carga, `primerSalto`/`dobleProg`/`transformacion` dejarían de recibir datos nuevos de esos ejercicios (se quedan con el historial viejo). `w_volumen_alto` (≥ 5 ejercicios) sigue contando el ejercicio. |
| Sugerencias | `getProgressionAdvice` devuelve `hasHistory: false` para sesiones sin sets → muestra "Primera vez con este ejercicio…" cada vez (el mensaje sería engañoso). `getReturnState` queda inactivo. `getLastWeightsForExercise` devuelve la sesión vacía como la "última", y la precarga cae al valor genérico. |
| Riesgo | Alto relativo: toca el modelo de datos (campo nuevo), 5-6 archivos de UI y varios lectores que asumen `sets`. Para c2, menor impacto en lectores pero con "1 rep" artificial en historiales. |

### Comparación

| | (a) Solo quitar ▶ | (b) A repeticiones | (c) Solo "hecho" |
|---|---|---|---|
| Archivos principales | `FuerzaFlow.jsx` | `FuerzaFlow.jsx` (+ catálogo, + migración/filtro) | `FuerzaFlow.jsx`, `WorkoutWizard.jsx`, `WorkoutSummary.jsx`, `WorkoutHistorial.jsx`, `WeekCalendar.jsx`, `ExerciseProgress.jsx` (+ docs) |
| Cambia el modelo de datos | No | No (cambia el significado de datos viejos) | Sí (campo nuevo / sets vacíos) |
| Historial existente | Intacto | Hay que migrar o filtrar | Mixto |
| "+100 %" Sentadilla isométrica | Igual | Igual | Persiste (hay que filtrar o corregir el dato) |
| Progreso / PRs / logros | Sin cambios | Sin cambios salvo textos de reps y sugerencias | Se omiten esos ejercicios; buscador de Progreso muestra entradas vacías |
| Esfuerzo / riesgo | Bajo | Medio | Alto |

### Recomendación

Si el objetivo es **simplificar**, **(a)** es la opción segura. Si se quiere mantener la funcionalidad pero ordenarla, la mejora de mayor valor con menor costo sería **registrar la unidad** (un campo `unit: 's'` por ejercicio al guardar) en lugar de eliminarla: permitiría excluir los segundos de la progresión de reps, rotular bien los historiales y corregir "+100 %" sin migrar nada. Eso es un cambio aparte de lo que se pidió; lo dejo solo como nota.

---

## 5. Hallazgos adicionales detectados al revisar (solo reporte)

1. **Mensaje engañoso** "✓ Ya definiste tu progresión para hoy." cuando hay sugerencia pero no hay opción mostrable (3.2). Afecta a cualquier ejercicio con `suggest: true` y `reps+2 > 25`, no solo a los de tiempo.
2. **Estado "Segs" pegado por índice** al usar "Cambiar"/"Alternativa" (1.4-C-2), y no persistido al recargar.
3. **Ids `alt-…` sin historial** (1.3): cada "Alternativa" genera un ejercicio nuevo en los datos y en el buscador de Progreso.
4. **Unidad desconocida en el historial**: sin `unit`, ningún cálculo puede distinguir segundos de repeticiones (causa raíz común de 3.2, 3.4 y 3.5).
5. **Plancha con Arrastre de Mancuerna** mezcla carga (kg) y "segundos" en el mismo set: es el caso donde peso y segundos conviven y donde la doble progresión por peso puede reescribir los segundos (3.2).
6. El 12 de precarga como "12 segundos" suele ser un valor bajo para una plancha: el ▶ arranca contando 12 s la primera vez si no se cambia el número.

---

## Apéndice A: script para analizar tu export (solo lectura)

Guardalo como `analizar-tiempo.mjs` y ejecutalo con `node analizar-tiempo.mjs ruta/al/myworkout-AAAA-MM-DD.json` (el archivo de **Configuración → Exportar**). No modifica nada ni se conecta a ningún servicio; lee el JSON local.

```js
import fs from 'fs'
const TIME = ['Plancha', 'Sentadilla isométrica', 'Bird Dog', 'Hollow Body Hold', 'Dead Bug', 'Press Pallof']
const { workouts = [] } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const rows = {}
for (const w of workouts.filter(w => w.type === 'fuerza').sort((a, b) => a.date.localeCompare(b.date))) {
  for (const e of w.exercises ?? []) {
    if (!TIME.some(n => (e.name ?? '').includes(n))) continue
    const r = (rows[e.name] ??= { ids: new Set(), sesiones: 0, series: 0, conPeso: 0, reps: [], pesos: [], primera: w.date, ultima: w.date })
    r.ids.add(e.exerciseId); r.sesiones++; r.ultima = w.date
    for (const s of e.sets ?? []) {
      r.series++
      if (Number(s.weight) > 0) { r.conPeso++; r.pesos.push(Number(s.weight)) }
      r.reps.push(Number(s.reps) || 0)
    }
  }
}
console.log(`Workouts en el archivo: ${workouts.length} (fuerza: ${workouts.filter(w => w.type === 'fuerza').length})`)
for (const [name, r] of Object.entries(rows).sort((a, b) => b[1].sesiones - a[1].sesiones)) {
  const rng = (a) => a.length ? `${Math.min(...a)}–${Math.max(...a)}` : '—'
  console.log(`${name} [${[...r.ids].join(', ')}]: ${r.sesiones} sesiones, ${r.series} series, valor en "reps"=${rng(r.reps)}, series con peso>0=${r.conPeso} (pesos ${rng(r.pesos)}), ${r.primera} → ${r.ultima}`)
}
```

(Probado con un archivo de ejemplo inventado; no con tus datos.)

## Apéndice B: cómo se verificó

- Lectura de `FuerzaFlow.jsx`, `WorkoutWizard.jsx`, `progression.js`, `prUtils.js`, `ProgresoPage.jsx`, `ExerciseProgress.jsx`, `achievements.js`, `Logros.jsx`, `Inicio.jsx`, `WeekCalendar.jsx`, `WorkoutHistorial.jsx`, `WorkoutSummary.jsx`, `useWorkouts.js`, `reentry.js`, `returnRoutine.js`, `routineGenerator.js`, `dailySuggestion.js`, `components/tabata/*`, `data/exercises.js`, `data/routines.js`.
- Cruce del catálogo (90 ejercicios) con `TIME_EXERCISES` y con las 5 rutinas pre-armadas mediante un script de solo lectura.
- Simulación de `getProgressionAdvice`, `detectImprovements` y `detectPRs` con datos de ejemplo (los resultados de 3.2 y 3.4 son salidas reales de esas funciones).
- Contraste con datos de uso reales hecho con el Apéndice A (solo conclusiones generales): ver 1.6 y 3.3.
- Pendiente: probar en pantalla el caso de "Cambiar" con el estado "Segs" pegado (1.4-C-2).
