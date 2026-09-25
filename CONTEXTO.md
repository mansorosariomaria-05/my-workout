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
      GeneradorTab.jsx         # Generador de rutinas por patrón de movimiento (routineGenerator.js)
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
    useDeload.js               # Semana de descarga
    useExercises.js            # Combina exercises.js + ejercicios custom del usuario
    useAuth.js                 # onAuthChange wrapper
    useOnlineStatus.js         # Estado online/offline del navegador

  services/
    db.js                      # Todas las operaciones Firestore
    auth.js                    # Firebase Auth (Google sign-in)

  data/
    exercises.js               # Catálogo de ~75 ejercicios + MUSCLE_GROUPS
    routines.js                # 5 rutinas pre-armadas
    frases.js                  # Frases motivacionales pre/post entrenamiento
    tabatas.js                 # Protocolos Tabata predefinidos

  utils/
    progression.js             # Doble progresión, Epley, bono de reps por salto
    weights.js                 # STANDARD_WEIGHTS, pesos aprendidos, nextWeight, floorWeight, deload
    routineGenerator.js        # generateRoutine(): selección y orden por patrón de movimiento
    dailySuggestion.js         # computeDailySuggestion(): sugerencia diaria (pura, sin fetch)
    streak.js                  # Racha semanal (computeStreak) + REAL_WORKOUT_TYPES
    inactivity.js              # getInactivityInfo(profile) — aviso de inactividad
    reentry.js                 # Vuelta suave: detección y reducción gradual por ejercicio
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
  pattern: 'empuje_cadera',  // patrón de movimiento (usado por el generador de rutinas)
  unilateral: false,         // trabaja un lado del cuerpo por vez
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

## Generador de rutinas (`utils/routineGenerator.js`)

Función única `generateRoutine({ muscles, count, equip, workouts, regenerate })`, usada tanto por el tab "Generador" de Rutinas (`GeneradorTab.jsx`) como por el modo "Generador" inline del wizard de registro (`FuerzaFlow.jsx`) — antes eran dos implementaciones casi idénticas por separado.

- Cada ejercicio del catálogo tiene un `pattern` (patrón de movimiento, ej. `sentadilla`, `zancada`, `bisagra`, `empuje_horizontal`) y un flag `unilateral`. El generador nunca repite `pattern` en ejercicios consecutivos ni encadena dos unilaterales de tren inferior seguidos.
- Por cada músculo elegido, el ejercicio principal (nivel A/B) se elige por historial reciente del usuario (sesiones de ese ejercicio en los últimos 56 días) — esto se mantiene incluso al regenerar, para que la doble progresión (sección de Progresión de carga) tenga sesiones consecutivas del mismo ejercicio para comparar. Los accesorios sí se sortean al azar al regenerar.
- El orden final prioriza compuestos antes que aislados y deja el core siempre al final.
- Solo elige del catálogo base (`exercises.js`), no de ejercicios personalizados del usuario (esos no tienen `pattern`).
- Al usar una rutina generada, `FuerzaFlow.jsx` arma cada ejercicio con `buildEntry` (igual que una rutina prearmada), así que aplican precarga de peso, sugerencias con brillo violeta y vuelta suave — antes el tab standalone armaba los sets a mano sin ninguna precarga.

**Botón "✨ Sugerencia"** (modo libre de `FuerzaFlow.jsx`, debajo de "+ Agregar ejercicio"): recomienda un solo ejercicio a agregar a partir de lo ya cargado en la sesión, con la misma lógica de patrón/historial que el generador pero evaluada ejercicio por ejercicio (`suggestNextExercise`, en el mismo archivo). Prioriza cubrir primero el músculo con menos ejercicios en la sesión, un principal (nivel A/B) por músculo antes que accesorios, evita repetir el patrón del último ejercicio agregado y nunca vuelve a sugerir algo ya en la sesión. "Otra" pide otra opción sin repetir las ya mostradas en la ronda; "Agregar" usa `buildEntry` (misma precarga que cualquier otra vía).

Ver `LOGICA_TECNICA.md` sección 16 para el algoritmo completo y la fundamentación.

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

## Sistema de pesos y progresión de carga

**Parámetros por objetivo** (`OBJETIVO_PARAMS` en `progression.js`):
| Objetivo | Series | Reps min-max | Descanso |
|---|---|---|---|
| Tonificar | 3 | 12-15 | 75s |
| Ganar masa muscular | 4 | 8-12 | 105s |
| Ganar fuerza | 4 | 4-6 | 210s |
| Mejorar resistencia | 3 | 15-20 | 52s |
| Bienestar general | 3 | 10-15 | 75s |

### Pesos disponibles y aprendidos (`utils/weights.js`)

- `STANDARD_WEIGHTS`: unión de los pesos disponibles en los gimnasios del usuario (placas/mancuernas fijas).
- Además de esos valores fijos, el sistema **aprende** qué pesos usó realmente el usuario en cada ejercicio (`getLearnedWeights` en `useWorkouts.js`) y los suma al pool de candidatos, así las sugerencias respetan las variantes propias de cada gimnasio/equipo y no solo la tabla estándar.
- `getNextWeight(current, learnedWeights, equipCategory)`: prioriza el salto más chico disponible en el pool dentro de un tope de +25% (o +2.5kg); si no hay ninguno en rango, usa el salto típico histórico del usuario o un default por tipo de equipo.
- `floorWeight(target, learnedWeights)`: redondea hacia el valor del pool más cercano por abajo (usado en deload y en vuelta suave).

### Doble progresión (`getProgressionAdvice` en `progression.js`)

Compara las dos últimas sesiones reales de cada ejercicio (ver "historial efectivo" en la sección de vuelta suave más abajo):
- Sube el peso solo si **ambas** sesiones llegaron al umbral de reps del nivel del ejercicio (`REP_RANGES`: A/B 6-10, C/D 10-15) al mismo peso.
- Al sugerir subir peso, las reps de la próxima sesión se recalculan con la **fórmula de Epley** (`estimateRepsAtWeight`) en vez de reiniciar al mínimo del rango, para que la sugerencia sea realista al nuevo peso.
- **Bono de reps por salto** (`getJumpRepBonus`): si el próximo peso disponible implica un salto proporcionalmente grande respecto al actual (típico con mancuernas livianas), exige 2-4 reps extra antes de subir, para no forzar un salto demasiado grande.
- Ejercicios de peso corporal (equipo "Sin equipamiento", peso actual 0): en vez de sugerir peso, sugiere sumar reps.

### Sugerencias precargadas (`FuerzaFlow.jsx`)

Al armar la sesión (`buildEntry`), las series se precargan directamente con la sugerencia de progresión cuando corresponde, marcadas con un **brillo violeta** (campo `_suggested`, solo UI — se limpia antes de guardar en Firestore). El botón de cada serie muestra una pequeña **cruz roja** cuando hay más de una serie cargada, para indicar que al tocarlo la elimina.

---

## Deload (useDeload.js)

- `isActive` → `settings.deloadActive`
- `shouldSuggestDeload()` → promedio de fatiga de últimas 40 sesiones >= 7
- Cuando activo: peso × 0.65 (redondeado al más cercano), series -1 (mínimo 2)
- El estado se guarda en Firestore (`settings.deloadActive`)
- Si además un ejercicio está en vuelta suave (ver abajo), no se suman las dos reducciones: se usa el peso menor entre las dos.

---

## Aviso de inactividad y vuelta suave

- **Aviso de inactividad** (`Inicio.jsx` + `utils/inactivity.js`): si pasaron 14+ días desde el último entrenamiento real, al abrir la app se pregunta el motivo (enfermedad, lesión, estrés, descanso) y se guarda en `profile.inactividad`. Es puramente informativo: no crea workouts, no crea documentos de pausa, no afecta la racha.
- **Vuelta suave** (`utils/reentry.js`, integrada en `FuerzaFlow.jsx`): es **por ejercicio**, no global. Si pasaron 14+ días sin hacer ese ejercicio puntual, la precarga de la próxima sesión reduce peso (10-25% según el largo del parate, +5% y +1 sesión si el motivo fue enfermedad/lesión) y series (mínimo 2, partiendo de la última sesión antes del parate), y va subiendo gradualmente en 2-4 sesiones hasta volver a la carga normal. Se detecta 100% a partir de las fechas del historial de ese ejercicio, sin guardar ningún estado nuevo en Firestore. Mientras dura, no hay sugerencias de progresión (sin brillo violeta) para ese ejercicio.
- Ver `LOGICA_TECNICA.md` sección 15 para el detalle completo (fórmulas, casos borde, justificación).

---

## Sugerencia diaria (`utils/dailySuggestion.js` → `computeDailySuggestion`)

Función **pura** (sin fetch propio a Firestore) evaluada contra el historial ya cargado en memoria por `useWorkouts` — antes hacía su propio `getWorkouts(uid, 500)` y, si fallaba por estar offline, sugería siempre la primera rutina fija como si no hubiera historial. Orden de evaluación:

1. **Ya entrenó hoy** → `trained_today`.
2. **Descanso inteligente**: si ya cumplió `profile.diasSemana` (default 3) días distintos esta semana, o entrenó 3 días seguidos — ya no es un domingo fijo.
3. **Balance cardio/fuerza** de la semana actual (regla sin cambios): 0 cardio y 2+ fuerza, o 1 cardio con ≤2 días para cerrar la semana → sugerir Cardio.
4. **Elegir 2 músculos foco de fuerza**, solo entre `LOWER = [Glúteos, Isquios, Cuádriceps]` y `UPPER = [Espalda, Pecho, Hombros]` (nunca gemelos/abductores/brazos/core): excluye los entrenados ayer/anteayer, prioriza por menos volumen esta semana y más días sin entrenar, con tope de 14 días (así una rutina nunca entrenada no le gana siempre a todo lo demás, como pasaba antes).
5. Si hay una `builtinRoutine` que coincide exactamente con esos 2 músculos y no toca nada reciente → la sugiere. Si no, **genera** una rutina de 5 ejercicios con el mismo generador de rutinas (`routineGenerator.js`, sección de más arriba).

La sugerencia devuelve `{ type, routineId | generatedIds, routineName | title, muscles, reason }`. `Inicio.jsx` cachea el resultado en `localStorage` (`daily_suggestion_{uid}`) por día y por cantidad de entrenamientos reales, para no recalcular en cada render. El botón "Empezar": con `routineId` navega como antes; con `generatedIds` arma un draft con `pendingGeneratedIds` (mismo mecanismo que "Usar ahora" del generador) para que `FuerzaFlow` los arme con `buildEntry`.

Ver `LOGICA_TECNICA.md` sección 17 para el algoritmo completo.

---

## Sistema de logros (Logros.jsx)

30 logros agrupados en: Consistencia, Fuerza, Cardio, Balance, Especiales.

Se computan **en el cliente** al cargar la home, comparando el array `workouts` con los logros ya desbloqueados en Firestore. Solo se graba si el logro no estaba desbloqueado.

Guardado en Firestore: `users/{uid}/data/achievements → { [key]: { unlocked: true, at: Timestamp, detail: string } }`

Display: modo `compact` (4 más recientes en home) y modo vitrina (modal con grid 3 columnas, flip card frente/reverso).

**Racha semanal** (`utils/streak.js` → `computeStreak`): sin estados — no hay racha "congelada" ni "en pausa". Cada semana con 3+ días de entrenamiento real (fuerza/cardio/clase/tabata — `REAL_WORKOUT_TYPES`) suma 1 a la racha; las semanas con 1-2 días no suman ni cortan; la racha vuelve a 0 solo si se completan 4 semanas calendario seguidas sin ningún entrenamiento real. Ver `LOGICA_TECNICA.md` sección 1 para el detalle y la justificación.

---

## Auth y perfil (AuthContext)

`AuthContext` expone: `{ user, profile, settings, loading, updateProfile, updateSettings }`

**Flujo de inicio:**
1. `onAuthChange` → si hay user, carga `profile` y `settings` en paralelo
2. Si `!user` → `AuthScreen` (login con Google)
3. Si `!profile?.onboardingDone` → `Onboarding` (8 pasos)
4. Si todo OK → rutas normales

**Profile** almacena: `name`, `genero` ('femenino'|'masculino'|'otro'), `objectives[]`, `objetivo` (string primario), `nivel`, `diasSemana`, `tiposPreferidos[]`, `tipoRutina`, `sesionesFuerzaObjetivo`, `lesionesYes`, `lesiones`, `equipamiento`, `onboardingDone`, `inactividad` (último parate detectado — ver "Aviso de inactividad y vuelta suave"). Ya no existe el campo `pausa` (el onboarding no lo pregunta desde que se eliminó el sistema de pausas).

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

---

## Documentación técnica extendida

Ver `LOGICA_TECNICA.md` para lógicas complejas, decisiones de producto, bugs conocidos y estructura de datos detallada.
