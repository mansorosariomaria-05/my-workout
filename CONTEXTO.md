# Contexto técnico — My Workout

Este documento describe la app completa para que cualquier instancia de Claude Code pueda retomar el trabajo sin explicaciones adicionales.

---

## Qué hace la app

PWA de registro de entrenamientos personales para uso móvil. El usuario puede:
- Registrar sesiones de **Fuerza** (ejercicios, series, reps, peso), **Cardio** y **Clase**
- Seguir un sistema de **progresión de carga** adaptado a su objetivo
- Ver **sugerencias diarias** de qué entrenar
- Consultar su **historial** y gráficos de progreso
- Desbloquear **logros** automáticamente
- Usar una **biblioteca de ejercicios** y **rutinas pre-armadas**
- Crear rutinas personalizadas y ejercicios propios
- Ejecutar **protocolos Tabata**

---

## Arquitectura de archivos

```
src/
  App.jsx                      # Raíz: routing, providers, splash screen
  firebase.js                  # Inicialización Firebase (auth + firestore)
  main.jsx                     # Entry point React

  pages/
    Inicio.jsx                 # Home: hero, sugerencia diaria, últimos entrenamientos, logros, frase
    Registro.jsx               # Wrapper de WorkoutWizard (lee location.state)
    Rutinas.jsx                # Página de rutinas (tabs: Pre-armadas, Generador, Biblioteca)
    Progreso.jsx               # Página de progreso
    Tabata.jsx                 # Página de Tabata

  components/
    registro/
      WorkoutWizard.jsx        # Flujo de 3 pasos: tipo → detalle → sensación → guardar
      FuerzaFlow.jsx           # Detalle de sesión de fuerza (corazón de la app)
      CardioFlow.jsx           # Detalle de sesión de cardio
      ClaseFlow.jsx            # Detalle de sesión de clase
      WorkoutSummary.jsx       # Pantalla de celebración post-guardado

    rutinas/
      PreArmadasTab.jsx        # Listado y uso de rutinas (builtin + custom)
      GeneradorTab.jsx         # Generador aleatorio de rutinas
      BibliotecaTab.jsx        # Biblioteca de ejercicios con historial

    inicio/
      HeroPortada.jsx          # Hero con saludo y foto de portada
      Logros.jsx               # Sistema de logros (compact en home, vitrina completa)
      WeekCalendar.jsx         # Calendario semanal de entrenamientos
      MuscleBalance.jsx        # Balance muscular semanal
      Streak.jsx               # Racha semanal
      ValenciaCountdown.jsx    # Countdown especial
      Intencion.jsx            # Intención semanal

    progreso/
      ProgresoPage.jsx         # Contenedor de tabs de progreso
      ExerciseProgress.jsx     # Progresión de peso por ejercicio
      WeekChart.jsx            # Gráfico de entrenamientos por semana
      FatigueChart.jsx         # Gráfico de cansancio
      MonthCalendar.jsx        # Calendario mensual
      WorkoutHistorial.jsx     # Historial de sesiones

    tabata/
      TabataPage.jsx / TabataCard.jsx / TabataDetail.jsx

    ui/
      Button.jsx / Card.jsx / Modal.jsx / RestTimer.jsx

    layout/
      Layout.jsx               # Shell con BottomNav
      BottomNav.jsx            # Barra de navegación inferior

    auth/AuthScreen.jsx        # Login con Google
    onboarding/Onboarding.jsx  # Configuración inicial (8 pasos)
    configuracion/ConfigPage.jsx
    SplashScreen.jsx

  context/
    AuthContext.jsx            # user, profile, settings, updateProfile, updateSettings
    WorkoutDraftContext.jsx    # Draft en localStorage para continuar sesión interrumpida

  hooks/
    useWorkouts.js             # Carga/guarda workouts con caché en localStorage
    useProgression.js          # Wrapper de getProgressionSuggestion
    useDeload.js               # Semana de descarga
    useExercises.js            # Combina exercises.js + ejercicios custom del usuario
    useAuth.js                 # onAuthChange wrapper

  services/
    db.js                      # Todas las operaciones Firestore
    auth.js                    # Firebase Auth (Google sign-in)

  data/
    exercises.js               # Catálogo de ~75 ejercicios + MUSCLE_GROUPS
    routines.js                # 5 rutinas pre-armadas
    frases.js                  # Frases motivacionales pre/post entrenamiento
    tabatas.js                 # Protocolos Tabata predefinidos

  utils/
    progression.js             # Lógica de progresión de carga
    weights.js                 # GYM_WEIGHTS array, nextWeight, prevWeight, deload
    dates.js                   # Helpers de fechas locales
    genero.js                  # textoGenero() para acordar género en textos
```

---

## Firestore — estructura de datos

```
users/{uid}/
  data/profile        → perfil del usuario (name, genero, objectives, nivel, etc.)
  data/settings       → { deloadActive, restTimerSeconds, coverUrl, deloadsCompleted }
  data/achievements   → { [key]: { unlocked, at, detail } }
  data/favorites      → { ids: [exerciseId, ...] }
  data/never          → { ids: [exerciseId, ...] }
  workouts/{id}       → documentos de entrenamiento (addDoc, orderBy date desc)
  customRoutines/{id} → rutinas creadas por el usuario
  customExercises/{id}→ ejercicios creados por el usuario
  intentions/{weekKey}→ intención semanal (clave: 'YYYY-MM-DD' del lunes)
  tabataRecords/{id}  → { tabataId, tabataName, date }
  tabataSettings/{tabataId} → ajustes de tabata por protocolo
```

### Estructura de un workout (Fuerza)

```js
{
  type: 'fuerza',
  date: 'YYYY-MM-DD',
  fatigue: 5,           // 1-10
  notes: '',
  deload: false,
  muscleGroups: ['Glúteos', 'Isquios'],
  exercises: [
    {
      exerciseId: 'glut_01',
      name: 'Hip Thrust',
      muscle: 'Glúteos',
      originalMuscle: 'Glúteos',     // para replace (filtro de músculo original)
      originalExerciseId: null,       // si se hizo swap a alt, apunta al ejercicio original
      sets: [{ reps: 12, weight: 20 }, ...]
    }
  ],
  cinta: null | { tipo, min, kmh },  // cinta caminadora si aplica
  createdAt: serverTimestamp()
}
```

### Estructura de un workout (Cardio)

```js
{ type: 'cardio', date, fatigue, notes, activity, tiempo, distancia, ritmo, createdAt }
```

### Estructura de un workout (Clase)

```js
{ type: 'clase', date, fatigue, notes, clase, duracion, createdAt }
```

---

## Catálogo de ejercicios (exercises.js)

```js
{
  id: 'glut_01',
  name: 'Hip Thrust',
  muscle: 'Glúteos',         // grupo muscular principal (usado en filtros)
  group: 'Glúteo mayor',     // sub-grupo (solo display en detalle)
  level: 'A',                // A=compuesto pesado, B=compuesto sec., C=aislado, D=core
  equip: 'Barra/Mancuerna',
  alt: 'Puente de Glúteo',   // alternativa sin equipo (nombre libre-texto)
  secondary: 'Isquios',
  zone: undefined,           // solo existe en Abdominales: 'Superior'|'Inferior'|'Oblicuos'
}
```

**MUSCLE_GROUPS** (orden canónico):
```
Glúteos, Isquios, Cuádriceps, Abductores, Gemelos,
Espalda, Pecho, Hombros, Tríceps, Bíceps,
Abdominales, Core & Estabilidad
```

**Ejercicios abdominales** tienen campo `zone`:
- `zone: 'Superior'` → abs_01-05
- `zone: 'Inferior'` → abi_01-04
- `zone: 'Oblicuos'` → obl_01-03
- Sin zone → obl_04 (Dead Bug, movido a Core & Estabilidad), cor_01-04, plancha-arrastre-mancuerna

**Helper `exDisplayName(e)`** — definido en FuerzaFlow.jsx, BibliotecaTab.jsx:
```js
const exDisplayName = (e) => e.zone ? `${e.name} (${e.zone})` : e.name
```
Se usa en todos los pickers y listas de ejercicios para mostrar "(Superior)" etc.

---

## Rutinas pre-armadas (routines.js)

5 rutinas con IDs fijos (no cambiar IDs — se almacenan en workouts de Firestore):

| ID | Nombre | Músculos |
|---|---|---|
| `rutina-cadena-posterior` | Isquios y Espalda | Isquios, Espalda |
| `rutina-empuje-vertical` | Piernas y Hombros | Cuádriceps, Glúteos, Hombros |
| `rutina-empuje-horizontal` | Pecho y Glúteos | Glúteos, Pecho |
| `rutina-fuerza-accesoria` | Fuerza Accesoria | Cuádriceps, Hombros, Tríceps, Bíceps, Gemelos |
| `rutina-gluteos` | Glúteos | Glúteos |

Cada entrada de ejercicio en la rutina:
```js
{ id: 'glut_01', level: 'A', sets: 4, muscle: 'Glúteos', alt: 'Alt display' }
```
El campo `alt` en el objeto de rutina es **solo para display** en la pantalla de selección. El alt usado durante la sesión viene de `exercises.js`.

---

## Flujo de registro (WorkoutWizard)

**3 pasos:**
1. **Tipo** (`step=0`) → elige Fuerza / Cardio / Clase
2. **Detalle** (`step=1`) → FuerzaFlow / CardioFlow / ClaseFlow
3. **Sensación** (`step=2`) → slider fatigue 1-10 + nota libre → guardar

**Draft persistente:** `WorkoutDraftContext` guarda el estado en `localStorage` (`workout_draft`). Si el usuario cierra y vuelve, retoma desde donde estaba.

**Timer de sesión:** se guarda `workout_start_ts` en localStorage cuando arranca el step 1. Se muestra en el header durante la sesión.

**Al guardar:** llama a `workoutsHook.saveWorkout(workout)` → `addDoc` en Firestore → `load(true)` (recarga silenciosa del hook) → muestra `WorkoutSummary`.

**Navegación con estado:** desde Inicio o PreArmadasTab se puede navegar a `/registro` con `location.state = { type, routineId }`, lo que precarga el tipo y carga la rutina directamente.

---

## FuerzaFlow — lógica central

**Modos de carga de ejercicios:**
- `prearmada` → carga desde `builtinRoutines` o `customRoutines` por ID
- `libre` → el usuario elige músculos y la app genera una lista intercalada

**`buildEntry(ex)`** → convierte un ejercicio del catálogo en una entrada de sesión:
```js
{
  exerciseId: ex.id,
  name: ex.name,
  muscle: ex.muscle,
  originalMuscle: ex.muscle,
  level: ex.level,
  sets: [{ reps: suggestedReps, weight: lastWeight || 0 }, ...],
  fatigue: null,
}
```

**Intercalación:** `intercalateExercises(list)` ordena alternando tren inferior / superior, core al final.

**Alt swap (botón "Alternativa"):**
- Si `entry.originalExerciseId` está seteado → el ejercicio actual ES el alt → el botón muestra "↩ Volver: {origExName}" → click vuelve al original
- Si no → el ejercicio es el original → click carga el alt (busca por nombre en `exercises.js`) → setea `originalExerciseId`
- Esto garantiza toggle O→A→O sin cadenas

**Reemplazar ejercicio:**
- Botón morado "Cambiar" en cada ExerciseCard
- Abre modal filtrado por `entry.originalMuscle ?? entry.muscle`
- Al seleccionar: `buildEntry(newEx)` + preserva `originalMuscle`

**Panel "Agregar ejercicio":**
- Se muestra debajo de la lista de ejercicios
- Filtro por músculo (chips), luego lista de ejercicios
- Usa `exDisplayName(e)` para mostrar zona en abdominales

**Timer de descanso (RestTimer):**
- Se activa al completar una serie
- Tiempo configurable desde settings o sobreescrito por usuario

**Ejercicios de tiempo** (`TIME_EXERCISES`): no piden peso, solo duración en segundos.

---

## Progresión de carga (utils/progression.js)

### Sistema principal: `getSeriesSuggestion`

Basado en **doble progresión** (subir peso solo cuando dos sesiones consecutivas completaron todas las reps en el máximo):

```
action = 'up'       → si última Y penúltima sesión: ALL sets >= repsMax Y fatigue <= 7
action = 'down'     → si últimas sesión: 2+ sets fallaron repsMin
action = 'maintain' → mantener peso
action = 'first'    → sin historial
```

**Parámetros por objetivo** (`OBJETIVO_PARAMS`):
| Objetivo | Series | Reps min-max | Descanso |
|---|---|---|---|
| Tonificar | 3 | 12-15 | 75s |
| Ganar masa muscular | 4 | 8-12 | 105s |
| Ganar fuerza | 4 | 4-6 | 210s |
| Mejorar resistencia | 3 | 15-20 | 52s |
| Bienestar general | 3 | 10-15 | 75s |

**Pirámide intrasesión** (`PYRAMID`): reps descienden y peso sube por serie.

**Objetivo por nivel de ejercicio** (`getObjetivoForLevel`):
- Ejercicios A/B → objetivo de mayor prioridad del usuario
- Ejercicios C/D → segundo objetivo si hay varios

### Sistema secundario: `getProgressionAdvice`

Analiza dos últimas sesiones y sugiere si subir peso:
- `pattern = 'pyramid'` → compara maxW entre sesiones + reps de la última serie
- `pattern = 'fixed'` → compara avgReps y avgWeight entre sesiones
- Threshold de reps: nivel A/B → 10, nivel C/D → 15
- Incremento: tren inferior → +5kg, grandes de superior → +2.5kg, resto → +2kg

### Pesos disponibles (weights.js)

```js
GYM_WEIGHTS = [2, 4, 5, 6, 7.5, 8, 9, 10, 12, 12.5, 14, 15, 17.5, 20, 25]
```
Navegación siempre snap al valor más cercano del array.

---

## Deload (useDeload.js)

- `isActive` → `settings.deloadActive`
- `shouldSuggestDeload()` → promedio de fatiga de últimas 40 sesiones >= 7
- Cuando activo: peso × 0.65 (redondeado al más cercano), series -1 (mínimo 2)
- El estado se guarda en Firestore (`settings.deloadActive`)

---

## Sugerencia diaria (Inicio.jsx → `getDailySuggestion`)

Algoritmo en orden de prioridad:

1. **Domingo** → siempre "Descanso"
2. **Ya entrenó hoy** → "¡Ya entrenaste!"
3. **Sin historial** → primera rutina de `builtinRoutines`
4. **Balance cardio/fuerza** de la semana actual:
   - 0 cardio y 2+ fuerza → sugerir Cardio
   - 1 cardio y quedan ≤2 días → sugerir Cardio
5. **Elegir rutina de fuerza:**
   - Excluye rutinas con músculos trabajados en últimas 48h
   - Si todas están excluidas → usa todas (fallback)
   - Puntúa por días desde la última vez que se trabajaron esos músculos
   - La rutina con más días descansados gana

La sugerencia devuelve `{ type, emoji, title, routineId, sub }`. El botón "Empezar" navega a `/registro` con `state: { type, routineId }`.

---

## Sistema de logros (Logros.jsx)

30 logros agrupados en: Consistencia, Fuerza, Cardio, Balance, Especiales.

Se computan **en el cliente** al cargar la home, comparando el array `workouts` con los logros ya desbloqueados en Firestore. Solo se graba si el logro no estaba desbloqueado.

Guardado en Firestore: `users/{uid}/data/achievements → { [key]: { unlocked: true, at: Timestamp, detail: string } }`

Display: modo `compact` (4 más recientes en home) y modo vitrina (modal con grid 3 columnas, flip card frente/reverso).

**Streak semanal** se cuenta hacia atrás desde la semana pasada: semana con 3+ días entrenados = 1 semana de racha.

---

## Auth y perfil (AuthContext)

`AuthContext` expone: `{ user, profile, settings, loading, updateProfile, updateSettings }`

**Flujo de inicio:**
1. `onAuthChange` → si hay user, carga `profile` y `settings` en paralelo
2. Si `!user` → `AuthScreen` (login con Google)
3. Si `!profile?.onboardingDone` → `Onboarding` (8 pasos)
4. Si todo OK → rutas normales

**Profile** almacena: `name`, `genero` ('femenino'|'masculino'|'otro'), `objectives[]`, `objetivo` (string primario), `nivel`, `diasSemana`, `tiposPreferidos[]`, `pausa`, `lesiones`, `equipamiento`, `onboardingDone`.

**Settings**: `deloadActive`, `restTimerSeconds` (default 90), `coverUrl`.

---

## Géneros en textos (utils/genero.js)

```js
textoGenero(genero, masc, fem, neutro)
```
Usado en logros, mensajes y saludos para adaptar terminaciones.

---

## Fechas — convención

- Todas las fechas de workouts son strings `'YYYY-MM-DD'` en hora local (no UTC).
- `getTodayLocal()` en `utils/dates.js` devuelve la fecha local correcta (evita bug UTC+offset).
- Las semanas van de **lunes a domingo**.
- `weekKey()` devuelve el lunes de la semana actual como string.

---

## Caché y localStorage

| Key | Contenido |
|---|---|
| `workouts_cache_{uid}` | Array de workouts (evita spinner en recarga) |
| `workout_draft` | Draft de la sesión en curso (WorkoutDraftContext) |
| `workout_start_ts` | Timestamp de inicio de sesión (timer) |
| `post_frase_YYYY-MM-DD` | Frase post-entrenamiento del día (se fija por día) |
| `weekly_summary_{weekKey}` | Estado del modal de resumen semanal |

---

## Diseño visual

- **Paleta** (Tailwind theme `app.*`):
  - Fondos: `bg=#0D0D12`, `surface=#13131A`, `elevated=#1A1A26`
  - Acento: `purple=#7C5CBF`, `purple-light=#9B7FD4`
  - Verde: `green=#2D6A4F`, `green-light=#40916C`
  - Azul: `blue=#1A4A7A`, `blue-light=#4A9EDB`
  - Texto: `text=#F0EEF8`, `muted=#9090A8`
  - Alerta: `coral=#E57373`, `amber=#F59E0B`, `gold=#D4AF37`
- **Mobile-first**, `max-w-mobile=430px`
- **PWA**: manifest + service worker (vite-plugin-pwa, modo `generateSW`)

---

## Convenciones del código

- Los componentes más importantes tienen comentarios de sección `// ─── Nombre ───`
- Los pickers de ejercicios siempre usan `exDisplayName(e)` (nunca `e.name` directo) para mostrar la zona en abdominales
- `originalMuscle` se preserva siempre en `replaceWithExercise` para que el modal de reemplazo filtre por el músculo correcto
- `originalExerciseId` se setea cuando se activa el alt, se limpia cuando se vuelve al original
- Las fechas de workouts nunca se convierten a `Date` para comparaciones — se comparan como strings `'YYYY-MM-DD'`
- El build siempre va a `dist/` (excluida de git), deploy con `firebase deploy --only hosting`
