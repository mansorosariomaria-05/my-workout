# ANALISIS-APP.md
## Estado real de la app — Verificado al 2026-06-06

---

## 1. Descripción general

**My Workout** es una PWA (Progressive Web App) móvil de registro y seguimiento de entrenamientos personales. Está construida sobre React 18 + Vite 5 y usa Firebase Auth + Firestore como backend. El diseño es mobile-first con tema oscuro personalizado via Tailwind CSS 3.

El flujo central de la app: el usuario se registra con Google → completa el onboarding → desde el home ve su resumen semanal y la sugerencia del día → registra entrenamientos (fuerza, cardio o clase) → consulta su progreso.

**URL de producción:** https://my-workout-ro.web.app  
**Repositorio:** https://github.com/mansorosariomaria-05/my-workout

---

## 2. Funcionalidades actuales y funcionando

### Autenticación y perfil
- Google Sign-In via Firebase Auth.
- Onboarding de 9 pasos al primer login: género, nombre, objetivos (múltiples), nivel (principiante/intermedio/avanzado), días/semana, tipos preferidos, pausa previa, lesiones (sí/no + texto), equipamiento.
- El perfil se guarda en Firestore. `lesionesYes` y `lesiones` se persisten desde el onboarding.

### Home (Inicio.jsx)
Lo que REALMENTE se renderiza hoy:
- **HeroPortada**: saludo con nombre, fecha de hoy, botón de configuración.
- **Badge de descarga activa**: se muestra condicionalmente si `settings.deloadActive` es true.
- **StatsCards (inline)**: anillo visual con días entrenados esta semana + semanas de racha consecutiva. La racha se calcula inline en Inicio.jsx con `getWeekStreak()`.
- **FraseDiariaCard (inline)**: frase motivacional del día, elegida por índice de día del año desde un array fijo. Se muestra una vez por día via localStorage (`post-frase`).
- **WeekCalendar**: barra semanal L-D con punto de color por tipo de entrenamiento. Solo muestra un entrenamiento por día (último guardado, por `byDate[w.date] = w`).
- **LastAndSuggestion (inline)**: muestra todos los entrenamientos del día más reciente. Si hay fuerza + cardio/clase el mismo día, usa layout de 2 columnas. Muestra "hace X días" junto al título.
- **DailySuggestionCard (inline)**: sugerencia del día con botón "Empezar" que navega a `/registro` con tipo y rutina precargados.
- **Logros** (`compact=true`): vitrina de los 30 logros en modo compacto.
- **WeeklySummaryModal (inline)**: se muestra automáticamente los lunes una vez por semana (via localStorage). Muestra resumen de la semana anterior.

### Registro de entrenamientos
Tres tipos:
1. **Fuerza** (`FuerzaFlow.jsx`): flujo de 3 modos:
   - **Prearmada**: carga una rutina builtin por ID → lista de ejercicios con pesos de la última sesión.
   - **Libre**: el usuario agrega ejercicios manualmente.
   - **Generador**: crea rutina aleatoria (desde `GeneradorTab`) y la pasa como draft.
2. **Cardio**: tiempo + velocidad + tipo (cinta, elíptica, bici, etc.).
3. **Clase**: descripción libre + cansancio.

**Flujo de registro de fuerza:**
- `buildEntry(ex)`: copia los pesos de la última sesión directamente. NO llama a `getSeriesSuggestion`.
- Cada `ExerciseCard` muestra: nombre (con zona si aplica, ej. "Crunch (Superior)"), series, reps, peso. Badges de progresión via `getProgressionAdvice()`.
- Botón alternativa: toggle O→A→O con `originalExerciseId`. Muestra "Alternativa: X" o "↩ Volver: X".
- Botón "Cambiar": reemplaza el ejercicio por otro del mismo músculo. Preserva `originalMuscle`.
- Botón "+": agrega un ejercicio extra al final de la lista.
- Timer de descanso: `InlineRestTimer` integrado en FuerzaFlow (componente inline, no importado de fuera).
- Timer de sesión: `InlineTimer` inline en FuerzaFlow.
- Ejercicios DEPRECATED (`Reverse Frog`, `Abducción con pausa`) se auto-eliminan al cargar la rutina.
- Al guardar: ejercicios con `exercises[]` y cardio con `cinta: { tipo, min, kmh }`.

**WorkoutSummary.jsx** (post-registro):
- Confetti, detección de PRs, logro del día, milestone (10/20/30/50 entrenamientos), frase post-entreno.
- Auto-cierre a los 8 segundos (el botón se habilita a los 5s).

### Rutinas
Tres tabs en `RutinasPage`:
- **Pre-armadas**: lista de rutinas builtin (5) + rutinas custom del usuario. Botón "Usar esta rutina".
- **Biblioteca**: lista de ejercicios con historial. Permite crear/eliminar ejercicios custom.
- **Generador**: genera rutina aleatoria por grupos musculares. Navega a `/registro` pasando el draft.

### Tabata
- 10 protocolos predefinidos en `tabatas.js`.
- Timer work/rest con beep y vibración.
- Configuración custom por tabata guardada en Firestore.

### Progreso
6 secciones en `ProgresoPage`:
- **Totales**: entrenamientos, PRs, semanas activas.
- **MonthCalendar**: calendario mensual coloreado por tipo.
- **WeekChart**: entrenamientos por semana (Recharts BarChart).
- **FatigueChart**: cansancio promedio semanal.
- **ExerciseProgress**: evolución de peso para un ejercicio seleccionado. Usa `getSeriesSuggestion()` para mostrar sugerencia de próxima sesión.
- **WorkoutHistorial**: listado de sesiones con detalle expandible.

### Configuración
- Toggle de descarga activa (deload): actualiza `settings.deloadActive`.
- Timer de descanso: segundos de pausa entre series.
- Edición de perfil (nombre, nivel, objetivo —string—, días/semana).
- Exportar/importar datos: exportar genera JSON; importar solo restaura `profile`, NO restaura `settings` ni `workouts`.
- Cerrar sesión.

### Logros (30 en total)
Sistema client-side calculado al cargar el home. Los 30 logros verificados como chequeables:
- **Consistencia**: primerPaso, semanaActiva, madrugadora, madrugadoraExtrema, aveNocturna, finDeSeActivo, rachaFuego, rachaElite, cincuenta, constanciaTotal, dosSemanas.
- **Fuerza**: primerAumento, tresPRs, diezPRs, dobleProg, piernasAcero.
- **Cardio**: cinco5km, veinte20km, ritmoSolido, dobleRueda.
- **Balance**: semanaMixta, balancePerfecto, energiaAlza, resiliencia.
- **Especiales**: aniversario.
- **Que se muestran pero nunca desbloquean** (ver sección 7): guerreraDescanso, poderIsometrico, rachaFuerza, tabataMaster, cinturonNegro.

---

## 3. Estructura técnica

```
src/
├── App.jsx                    # Rutas: /, /registro, /rutinas, /tabata, /progreso, /configuracion
├── context/
│   └── AuthContext.jsx         # Google Auth, updateProfile, perfil de usuario
├── pages/
│   └── Inicio.jsx              # Home — contiene StatsCards, FraseDiariaCard, LastAndSuggestion, DailySuggestionCard, WeeklySummaryModal como componentes inline
├── components/
│   ├── auth/                   # AuthScreen (Google Sign-In)
│   ├── onboarding/             # Onboarding (9 pasos)
│   ├── inicio/
│   │   ├── HeroPortada.jsx     # Saludo + fecha + botón config
│   │   ├── WeekCalendar.jsx    # Barra semanal L-D
│   │   └── Logros.jsx          # 30 logros con flip cards
│   ├── registro/
│   │   ├── WorkoutWizard.jsx   # Selector de tipo (fuerza/cardio/clase) + handleSave
│   │   ├── FuerzaFlow.jsx      # Flujo completo de fuerza (modos: prearmada/libre/generador)
│   │   └── WorkoutSummary.jsx  # Pantalla post-registro
│   ├── rutinas/
│   │   ├── RutinasPage.jsx     # Contenedor con 3 tabs
│   │   ├── PreArmadasTab.jsx   # Rutinas builtin + custom
│   │   ├── BibliotecaTab.jsx   # Ejercicios con historial
│   │   └── GeneradorTab.jsx    # Generador aleatorio
│   ├── tabata/
│   │   └── TabataPage.jsx      # 10 protocolos + timer
│   ├── progreso/
│   │   └── ProgresoPage.jsx    # 6 secciones de progreso
│   ├── configuracion/
│   │   └── ConfigPage.jsx      # Settings + perfil + export/import
│   └── ui/
│       ├── Button.jsx
│       ├── Modal.jsx
│       └── BottomNav.jsx       # Navegación: Inicio / Registro / Rutinas / Tabata / Progreso
├── hooks/
│   └── useWorkouts.js          # Cache-first: workouts en localStorage + Firestore
├── services/
│   └── db.js                   # Firestore: saveWorkout (addDoc), getWorkouts, perfil, settings
├── utils/
│   ├── exercises.js            # Array de ejercicios builtin con zona, músculo, nivel, alt
│   ├── routines.js             # 5 rutinas builtin (builtinRoutines[])
│   ├── tabatas.js              # 10 protocolos Tabata builtin
│   ├── progression.js          # getProgressionAdvice, getSeriesSuggestion, getRestTimer, determineAction
│   ├── dates.js                # Helpers de fechas (formatDate, getWeekDays, etc.)
│   └── weights.js              # GYM_WEIGHTS = [2,4,5,6,7.5,8,9,10,12,12.5,14,15,17.5,20,25]
```

**Stack:**
- React 18 + Vite 5 (PWA via vite-plugin-pwa)
- Tailwind CSS 3 con tokens `app.*` (app-bg, app-surface, app-purple, app-text, app-muted)
- Firebase Auth (Google Sign-In) + Firestore
- React Router DOM v6
- Recharts (gráficos en ProgresoPage)
- Lucide React (iconos)
- localStorage: `workouts-{uid}`, `draft`, `timer-*`, `weekly-summary-{week}`, `post-frase-{date}`

---

## 4. Flujos de usuario

### Primer uso
1. Splash screen → AuthScreen → Google Sign-In.
2. Si `profile.onboardingDone` es false → Onboarding (9 pasos).
3. Al completar onboarding → Inicio.

### Registrar entrenamiento de fuerza (modo prearmada)
1. Home → DailySuggestionCard → "Empezar" (navega con `type: 'fuerza'`, `routineId: 'rutina-1'`).
2. WorkoutWizard detecta el routineId → abre FuerzaFlow en modo `prearmada`.
3. FuerzaFlow busca en `builtinRoutines` por ID → carga ejercicios con `buildEntry()` (pesos de última sesión).
4. Usuario ajusta series/reps/peso, usa timer de descanso, agrega notas, marca cansancio.
5. "Guardar" → WorkoutWizard.handleSave → `saveWorkout()` en Firestore (`addDoc`).
6. WorkoutSummary: confetti, PRs, milestones → "Volver al inicio".

### Registrar entrenamiento de fuerza (modo libre)
1. /registro → seleccionar "Fuerza" → FuerzaFlow sin routineId.
2. Agregar ejercicios manualmente con el panel "+".
3. Mismo flujo de guardado.

### Ver progreso de un ejercicio
1. /progreso → tab ExerciseProgress → seleccionar ejercicio.
2. `getSeriesSuggestion()` calcula la sugerencia de próxima sesión (doble progresión).
3. Gráfico de peso histórico.

### Configurar deload
1. /configuracion → toggle "Semana de descarga".
2. `settings.deloadActive` se actualiza en Firestore.
3. En el home aparece el badge "Semana de descarga activa".
4. En FuerzaFlow los pesos sugeridos se calculan con ×0.65 y -1 serie.

---

## 5. Lógica de negocio

### Progresión de cargas (doble progresión)
- **`getProgressionAdvice(history, ex)`** (usado en ExerciseCard badges): analiza las últimas 2 sesiones. Detecta patrón pirámide vs fijo. Devuelve una recomendación en texto (ej. "Subí el peso").
- **`getSeriesSuggestion(history, ex, profile)`** (usado en ExerciseProgress): sistema completo de doble progresión. Acción `up` solo cuando las últimas 2 sesiones alcanzan `repsMax` y fatiga ≤7. `down` cuando quedan bajo `repsMin`. `maintain` en el resto de casos.
- **`buildEntry(ex)`**: al cargar FuerzaFlow, copia los pesos de la última sesión DIRECTAMENTE. No llama a `getSeriesSuggestion`. El usuario ve los mismos pesos que usó la última vez.
- **Deload**: peso ×0.65, sets -1 (mínimo 2).
- **`GYM_WEIGHTS`**: pesos de gym canónicos. Los incrementos se redondean al valor más cercano en este array.

### Sugerencia diaria (`getDailySuggestion` en Inicio.jsx)
Por orden de prioridad:
1. Si es domingo → sugerir descanso.
2. Si ya entrenó hoy → sugerir descanso o segunda sesión.
3. Sin historial → primer entrenamiento.
4. Balance cardio/fuerza → cardio si hace más de X días.
5. Rutina de fuerza más descansada (la que más días lleva sin entrenar sus músculos).

### Racha semanal (`getWeekStreak` en Inicio.jsx)
Cuenta semanas consecutivas hacia atrás con al menos un entrenamiento. Se compara por semanas ISO en formato `YYYY-MM-DD`.

### Ejercicios y zona
- `exDisplayName(e)`: `e.zone ? \`${e.name} (${e.zone})\` : e.name`. Aplica a abdominales: "Crunch (Superior)", "Bicycle Crunch (Oblicuos)", etc.
- Ejercicios con `zone` están en el grupo "Abdominales" (12 grupos musculares en total).

### Alternativas y reemplazos
- **Toggle O→A→O**: `originalExerciseId` guardado en el entry. El botón alternativa alterna entre el original y el alt.
- **Reemplazar**: `replaceWithExercise()` preserva `originalMuscle` en el entry para mantener el músculo original en futuros reemplazos.

### Lesiones
- Si `profile.lesionesYes` es true (seteado en el onboarding), FuerzaFlow muestra un recordatorio con el texto de `profile.lesiones` en los ejercicios.

### Logros — lógica de desbloqueo
- Calculados client-side al cargar Inicio.jsx.
- Comparan fechas como strings `YYYY-MM-DD`.
- `check(id)` retorna `{ unlocked: bool, progress: number, total: number }`.

---

## 6. Base de datos

### Firestore — colecciones activas

**`users/{uid}/profile`** (documento único)
```
name, genero, nivel, objetivo (string), objectives[] (array),
diasSemana, tiposPreferidos[], pausa, lesionesYes, lesiones,
equipamiento, onboardingDone
```

**`users/{uid}/settings`** (documento único)
```
deloadActive (bool), restTimer (segundos), deloadsCompleted (number — nunca se incrementa)
```

**`users/{uid}/workouts`** (colección, addDoc → múltiples docs)
```
date (YYYY-MM-DD), type ('fuerza' | 'cardio' | 'clase'),
// Si type === 'fuerza':
  exercises[]: { id, name, muscle, level, sets, reps, weight,
                 repsMax, repsMin, zone?, alt?, originalExerciseId?,
                 originalMuscle?, weight2?, weight3?, weight4?,
                 reps2?, reps3?, reps4?, pr? }
  cinta: { tipo, min, kmh }   // solo si hay cinta (inclinación no se persiste)
  fatigue: 1-10
  notes: string
// Si type === 'cardio':
  cardio: { tipo, min, kmh, km }
  fatigue, notes
// Si type === 'clase':
  clase: { nombre }
  fatigue, notes
createdAt: serverTimestamp()
```

**`users/{uid}/customRoutines`**
```
name, exercises[], createdAt
```

**`users/{uid}/customExercises`**
```
name, muscle, level, equip, alt?, zone?
```

**`users/{uid}/tabataSettings/{tabataId}`**
```
workTime, restTime, rounds
```

### localStorage (complemento a Firestore)
- `workouts-{uid}`: cache de workouts (TTL 30 min).
- `draft`: datos del generador de rutinas pasados a FuerzaFlow.
- `timer-*`: estado del timer de sesión.
- `weekly-summary-{semana}`: controla si el modal del lunes ya se mostró.
- `post-frase-{fecha}`: controla si la frase del día ya se vio.

### Cache strategy (`useWorkouts.js`)
- Cache-first: lee de localStorage si existe y no expiró.
- Si no hay cache o expiró → consulta Firestore `orderBy('createdAt', 'desc')`.
- `reload()` fuerza refresh desde Firestore.

---

## 7. Lo que falta o está incompleto

### Bugs conocidos
1. **Rutinas custom no se pueden usar**: "Usar esta rutina" en una rutina custom de `PreArmadasTab` navega con `routineId: routine.id` (ID de Firestore). Pero `loadRoutine` en FuerzaFlow solo busca en `builtinRoutines.find(r => r.id === routineId)` → devuelve `undefined` → la rutina se abre vacía. Las rutinas custom solo pueden usarse si el usuario las pasa como draft desde el generador.

2. **Inclinación de cinta no se guarda**: FuerzaFlow tiene campos UI para `cintaConInclinacion` y `cintaInclinacion`, pero `WorkoutWizard.handleSave` solo persiste `cinta: { tipo, min, kmh }`. Los datos de inclinación se pierden al guardar.

3. **5 logros que nunca desbloquean**:
   - `guerreraDescanso`: requiere `deloadsCompleted >= 3`, pero ese contador nunca se incrementa (ni en el toggle de ConfigPage ni en ningún otro flujo).
   - `poderIsometrico`, `rachaFuerza`, `tabataMaster`, `cinturonNegro`: definidos en el array de logros pero sus `id` no están en el `switch` de `check()`.

4. **Importar datos solo restaura el perfil**: el botón "Importar datos" en ConfigPage solo restaura `profile`. Los `workouts` y `settings` del JSON son ignorados.

### Funciones implementadas sin UI
- **Favoritos**: `getFavorites`, `toggleFavorite` en `db.js` existen y escriben a Firestore, pero no hay UI que los llame.
- **Lista negra de ejercicios**: `getNeverList`, `toggleNever` en `db.js` existen sin UI.
- **Edición de lesiones post-onboarding**: ConfigPage no permite editar `lesionesYes` ni `lesiones` después del onboarding.

### Inconsistencias de datos
- `WeekCalendar` muestra un solo entrenamiento por día (last-write-wins en `byDate[w.date] = w`), pero Firestore puede tener múltiples por día.
- `useWorkouts.getCurrentStreak` siempre retorna `{ current: N, record: N }` (record = current), nunca calcula el record histórico real.
- La función `getTrainedMusclesLast48h` en `useWorkouts.js` usa un cutoff de 72h a pesar del nombre.
- `profile.objectives[]` no se actualiza al editar el perfil en ConfigPage (solo se actualiza el `objetivo` string).

### Código muerto eliminado en esta versión
Los siguientes archivos existían en el repositorio pero no eran importados por ningún componente activo. Fueron eliminados:
- `src/components/inicio/ValenciaCountdown.jsx`
- `src/components/inicio/MuscleBalance.jsx`
- `src/components/inicio/Streak.jsx`
- `src/components/inicio/Intencion.jsx`
- `src/hooks/useProgression.js`
- `src/components/ui/RestTimer.jsx`

Las funciones `daysUntilValencia` e `isAfterValencia` en `dates.js`, y las funciones `getProgressionSuggestion`, `getPauseSeriesReduction`, `getSuggestedSetsReps`, `getProgressionMessage` en `progression.js`, son exports sin consumers activos. No se eliminaron para no alterar los archivos base, pero no afectan la app en producción.

---

*Generado el 2026-06-06 — basado en lectura directa de código fuente, no en documentación previa.*
