# Análisis completo — My Workout App

---

## 1. Descripción general

**My Workout** es una Progressive Web App (PWA) de registro y seguimiento de entrenamientos personales, diseñada exclusivamente para uso móvil. Está construida para una sola usuaria (o un número muy reducido), con autenticación via Google y datos almacenados en Firestore por usuario.

**Propósito:** Reemplazar el registro manual en papel o apps genéricas, ofreciendo:
- Registro rápido de sesiones de fuerza, cardio y clases
- Seguimiento inteligente de la progresión de carga (cuándo subir peso)
- Sugerencias diarias de qué entrenar según el historial
- Sistema de logros para mantener la motivación
- Protocolos Tabata con timer integrado

**Para quién:** Una persona que entrena de forma regular en gimnasio, con equipamiento completo (mancuernas, barras, máquinas), que sigue un programa de 3-5 días semanales con foco en fuerza y quiere ver progreso a lo largo del tiempo.

---

## 2. Funcionalidades actuales

### 2.1 Autenticación y perfil
- Login con Google (Firebase Auth)
- Onboarding de 8 pasos al registrarse por primera vez:
  - Género (femenino / masculino / otro)
  - Nombre
  - Objetivos múltiples (Ganar fuerza, Masa muscular, Tonificar, Resistencia, Bienestar)
  - Nivel de experiencia (principiante / intermedio / avanzado)
  - Días disponibles por semana (2-6)
  - Tipos de entrenamiento preferidos (Fuerza, Cardio, Clases, Tabata, Mixto)
  - Pausa reciente ("¿Hace cuánto no entrenás?")
  - Lesiones o limitaciones (texto libre)
  - Equipamiento disponible
- Edición de perfil desde Configuración
- Datos guardados en Firestore en `users/{uid}/data/profile`

### 2.2 Registro de entrenamientos

**Flujo de 3 pasos** (WorkoutWizard):
1. Elegir tipo: Fuerza / Cardio / Clase
2. Completar detalle específico del tipo
3. Calificar cansancio (1-10) + nota opcional → Guardar

**Características transversales:**
- Selector de fecha (permite registrar entrenamientos pasados)
- Timer de sesión visible en el header desde que arranca el step 2
- Draft auto-guardado en localStorage: si se cierra la app, retoma donde estaba
- Múltiples entrenamientos por día (cada uno es un documento independiente en Firestore)
- Semana de descarga: si está activa, se muestra badge y ajusta sugerencias de peso

**Sesión de Fuerza (FuerzaFlow):**
- Dos modos de inicio:
  - **Rutina pre-armada**: carga ejercicios desde una rutina builtin o custom
  - **Modo libre**: el usuario elige músculos y se genera una lista intercalada
- Cada ejercicio muestra:
  - Nombre (con zona entre paréntesis para abdominales: "Crunch (Superior)")
  - Series × reps × peso (editable)
  - Sugerencia de peso basada en historial (automática)
  - Flecha de progresión con mensaje motivacional ("💪 Subí el peso", "✓ Mantené este peso", etc.)
  - Botón de alternativa: toggle O→Alt→O sin cadenas
  - Botón "Cambiar" (morado) para reemplazar el ejercicio por otro del mismo músculo
  - Timer de descanso automático al completar una serie (configurable: 30-180s)
  - Timer especial para ejercicios isométricos/tiempo (Plancha, Bird Dog, etc.)
  - PR personal mostrado si existe historial
  - Sesión anterior expandible para referencia
- Panel de agregar ejercicio al final de la lista (filtro por músculo)
- Intercalación automática: alterna tren inferior y superior, core al final
- Opción de registrar también uso de cinta (tipo, minutos, km/h)
- Deload: reduce peso a 65% y series a máximo 2

**Sesión de Cardio:**
- Actividades predefinidas + "Otra"
- Campos: tiempo (min), distancia (km), ritmo (texto libre)

**Sesión de Clase:**
- Tipos predefinidos: Strong, Spinning, Yoga, Pilates, HIIT, Funcional, Boxing, Zumba, Otra
- Duración en minutos (default 60)

### 2.3 Pantalla de celebración post-guardado (WorkoutSummary)
- Confetti animado
- Resumen: ejercicios/series (fuerza) o actividad (cardio/clase), cansancio
- Logro semanal dinámico según días entrenados esa semana:
  - 1 día: "Empezaste la semana 💪"
  - 2 días: "Ya van 2 días esta semana 💪"
  - 3 días: "¡Ya entrenaste 3 días esta semana! 💪"
  - 4 días: "¡Óptimo conseguido! 🌟"
  - 5+ días: "¡Semana Ideal! ⭐"
  - Semana pasada: "¡Entrenamiento guardado! 💪"
- Detección de PRs: resalta récords nuevos por ejercicio
- Hitos de cantidad: 10, 20, 30, 50 entrenamientos totales
- Frase motivacional post-entrenamiento (fijada por día, no cambia)
- Botón "Ver inicio" con countdown de 5 segundos (auto-cierre a los 8s)

### 2.4 Rutinas

**Pre-armadas (5 builtin):**
- Isquios y Espalda
- Piernas y Hombros
- Pecho y Glúteos
- Fuerza Accesoria
- Glúteos

Cada rutina muestra: nombre, subtítulo, número de ejercicios, expansión con lista detallada (nombre, músculo, alt), botón "Usar esta rutina" y "Duplicar y editar".

**Rutinas custom:**
- Crear desde cero (nombre + buscar/agregar ejercicios)
- Editar: reordenar ejercicios (↑↓), modificar series, nivel y alt
- Duplicar una builtin para personalizar
- Eliminar
- Guardadas en Firestore: `users/{uid}/customRoutines`
- Muestra "Última vez" (fecha) de uso

**Generador de rutinas:**
- Selección múltiple de músculos
- Cantidad de ejercicios (3-6)
- Equipamiento: "Gym completo" o "Solo básico"
- Genera intercalando tren inferior/superior
- Se puede guardar o usar directamente
- Muestra badge ámbar en músculos entrenados en últimas 72h

**Biblioteca de ejercicios:**
- ~75 ejercicios builtin + ejercicios custom del usuario
- Organizados por grupo muscular (12 grupos, acordeón)
- Búsqueda por nombre o músculo
- Cada ejercicio muestra: equipo, alternativa, músculo secundario, historial de últimas 3 sesiones (fecha + series×reps×kg)
- Ejercicios abdominales muestran zona en paréntesis: "Crunch (Superior)"
- Crear ejercicio propio: nombre, grupo, nivel, equipamiento, alternativa
- Eliminar ejercicios propios

### 2.5 Progreso

**Página con 6 secciones:**
1. **Resumen total**: número de workouts por tipo (Total, Fuerza, Cardio, Clases)
2. **Calendario mensual** (MonthCalendar): cuadrícula con días coloreados por tipo de entrenamiento, con indicador de intensidad por cansancio
3. **Entrenamientos por semana** (WeekChart): gráfico de barras (Recharts) con conteo semanal
4. **Cansancio promedio** (FatigueChart): línea de fatiga promedio por semana
5. **Progresión de ejercicio** (ExerciseProgress): selector de ejercicio → gráfico de peso máximo a lo largo del tiempo, con comparación entre primeras y últimas sesiones
6. **Historial** (WorkoutHistorial): listado expandible de todas las sesiones

### 2.6 Tabata

- 10 protocolos predefinidos con 4-5 estaciones por protocolo
- Timer con beep de audio y vibración en cada transición
- Fases: Preparación → Trabajo (20s) → Descanso (10s) → descanso entre sets (60s)
- Parámetros por defecto: prep 10s / work 20s / rest 10s / 8 sets / 60s entre sets
- Ajuste personalizable de tiempos (guardado en Firestore por tabata)
- Aviso si el deload está activo

### 2.7 Home (Inicio)

**Componentes visibles:**
- **HeroPortada**: saludo personalizado ("Hola {nombre}"), foto de portada configurable
- **WeekCalendar**: calendario semanal interactivo (navegar semanas previas), días entrenados marcados en verde
- **Último entrenamiento**: resumen del entrenamiento más reciente o del día (si hay varios, layout de dos columnas: fuerza izquierda, cardio/clase derecha), con fecha relativa inline ("hace 2 días") y botón "ver nota"
- **Sugerencia diaria**: qué entrenar hoy con botón "Empezar" que navega directo al registro con tipo y rutina precargados; o mensaje "Ya entrenaste" / "Día de descanso" según corresponda
- **Frase del día**: frase pre-entrenamiento rotativa (por día del año) o post-entrenamiento fijada el día de entreno
- **Logros**: card compacto con 4 logros más recientes + barra de progreso + botón "Ver todos"
- **MuscleBalance**: balance de grupos musculares entrenados en la semana
- **Streak**: racha de semanas activas
- **Intención semanal** (Intencion): texto de intención guardado por semana en Firestore
- **Resumen semanal**: modal automático los lunes mostrando estadísticas de la semana anterior (días entrenados, PRs, cansancio promedio, músculos trabajados)
- **ValenciaCountdown**: countdown a un evento específico

### 2.8 Configuración

- Ver y editar perfil (nombre, objetivo, nivel, días, equipamiento, género, lesiones)
- "Pausa del entrenamiento" (actualiza `profile.pausa`)
- Toggle de semana de descarga (con sugerencia automática si promedio fatiga ≥ 7)
- Timer de descanso por defecto (número en segundos)
- Exportar datos como JSON (`profile + settings + workouts`)
- Importar datos desde JSON
- Cerrar sesión

### 2.9 Sistema de logros (30 logros)

**Consistencia (8):**
- Primer paso, Semana activa, Madrugador/a, Fin de semana activo, Racha de fuego (4 sem), Racha élite (12 sem), 50 entrenamientos, Constancia total (100)

**Fuerza (7):**
- Primer aumento, Superaste 3 PRs, Superaste 10 PRs, Doble progresión (2× peso inicial), Piernas de acero (4 sem consecutivas con piernas), Poder isométrico, En racha de fuerza

**Cardio (5):**
- Primera vez 5km (acumulados corriendo), 20km acumulados, Ritmo sólido (<6:00 min/km promedio), Doble rueda (20km rollers en 1 sesión), Tabata master (10 protocolos)

**Balance (5):**
- Primera semana mixta, Balance perfecto (4 sem con cardio), Energía en alza (fatiga bajó 2+ pts en una semana), Guerrer@ del descanso (3 deloads), Resiliencia (vuelta tras 7+ días)

**Especiales (5):**
- Aniversario (1 año), Madrugador/a extremo/a (<6:30 AM), Ave nocturna (>21:00), Dos semanas activas, Cinturón negro

**Vitrina de trofeos:** grid 3 columnas, flip card (frente: ícono, reverso: descripción + fecha de desbloqueo), separación desbloqueados / bloqueados, barra de progreso.

---

## 3. Estructura técnica

### 3.1 Stack

| Tecnología | Versión | Uso |
|---|---|---|
| React | 18.3 | UI |
| Vite | 5.3 | Build tool |
| Tailwind CSS | 3.4 | Estilos |
| Firebase Auth | 10.12 | Autenticación con Google |
| Firestore | 10.12 | Base de datos |
| React Router | 6.23 | Navegación |
| Recharts | 2.12 | Gráficos de progreso |
| date-fns | 3.6 | Manejo de fechas |
| lucide-react | 1.14 | Iconos |
| vite-plugin-pwa | 1.3 | Service worker + manifest |

### 3.2 Organización de archivos

```
src/
  App.jsx                    # Routing, providers, guards de auth/onboarding
  firebase.js                # Config e inicialización Firebase

  pages/                     # Páginas raíz (una por tab)
  components/                # Componentes agrupados por dominio
  context/                   # AuthContext + WorkoutDraftContext
  hooks/                     # useWorkouts, useProgression, useDeload, useExercises
  services/                  # db.js (Firestore) + auth.js (Firebase Auth)
  data/                      # exercises.js, routines.js, tabatas.js, frases.js
  utils/                     # progression.js, weights.js, dates.js, genero.js
```

### 3.3 Componentes más importantes

**WorkoutWizard** — orquesta el flujo de 3 pasos, maneja draft, timer, save y navegación
**FuerzaFlow** — flujo de registro de fuerza; contiene ExerciseCard, InlineRestTimer, InlineTimer, modal de reemplazo, panel de agregar ejercicios
**Logros** — computa los 30 logros contra workouts y los guarda en Firestore; tiene VitrinaTrofeos con flip cards
**Inicio (página)** — compone todos los componentes del home, lanza getDailySuggestion, muestra WeeklySummaryModal los lunes

### 3.4 Estado y persistencia

| Qué | Dónde |
|---|---|
| Usuario, perfil, settings | AuthContext → Firestore |
| Lista de workouts | useWorkouts → Firestore + caché localStorage |
| Draft de sesión en curso | WorkoutDraftContext → localStorage |
| Timer de sesión | localStorage (`workout_start_ts`) |
| Frase post-entrenamiento del día | localStorage (`post_frase_YYYY-MM-DD`) |
| Logros desbloqueados | Firestore `users/{uid}/data/achievements` |
| Rutinas custom | Firestore `users/{uid}/customRoutines` |
| Ejercicios custom | Firestore `users/{uid}/customExercises` |
| Intenciones semanales | Firestore `users/{uid}/intentions/{weekKey}` |
| Configuración tabata | Firestore `users/{uid}/tabataSettings/{tabataId}` |

---

## 4. Flujos de usuario

### 4.1 Primer uso
1. Usuario abre la app → AuthScreen (Login con Google)
2. Primer ingreso → Onboarding (8 pasos)
3. Al finalizar onboarding: `updateProfile({ ...data, onboardingDone: true })`
4. Redirección a Home

### 4.2 Registrar una sesión de fuerza con rutina
1. Home → botón "Empezar" en sugerencia diaria (precarga tipo + routineId) **o** tab Registro
2. Step 0: elegir "Fuerza" (si no vino precargado)
3. Step 1: FuerzaFlow carga automáticamente la rutina → lista de ejercicios con sugerencias de peso
4. Usuario completa series: ingresa reps y peso → timer de descanso automático → siguiente serie
5. Puede usar alt, cambiar ejercicio, agregar ejercicio
6. Botón "Continuar" → Step 2
7. Slider de cansancio + nota → "Guardar entrenamiento"
8. WorkoutSummary: celebración, PRs, logros semanales, frase → "Ver inicio" (o auto en 8s)

### 4.3 Registrar cardio o clase
1. Step 0: elegir "Cardio" o "Clase"
2. Step 1: CardioFlow (actividad, tiempo, distancia, ritmo) o ClaseFlow (clase, duración)
3. Step 2: cansancio + nota → Guardar
4. WorkoutSummary simplificado

### 4.4 Hacer un Tabata
1. Tab Tabata → lista de 10 protocolos
2. Expandir protocolo → ver estaciones, tiempos, alts
3. Ajustar tiempos si se quiere (se persiste en Firestore)
4. "Empezar" → timer round-robin por estaciones: preparación → trabajo → descanso → (siguiente estación) → (descanso entre sets)
5. Audio beep + vibración en cada transición
6. Al terminar: registro en Firestore (tabataRecords)

### 4.5 Ver y gestionar rutinas
1. Tab Rutinas → 3 sub-tabs: Pre-armadas, Generador, Biblioteca
2. **Pre-armadas**: ver lista → expandir → "Usar esta rutina" (navega a Registro con routineId) o "Duplicar y editar"
3. **Generador**: elegir músculos → cantidad → equipamiento → "Generar" → "Usar ahora" o "Guardar"
4. **Biblioteca**: buscar → expandir por categoría → ver detalle con historial de uso

### 4.6 Ver progreso
1. Tab Progreso → carga últimos 100 workouts
2. Resumen de totales, calendario mensual, gráficos de barras y fatiga, selector de ejercicio para ver progresión, historial

### 4.7 Desbloquear logros
- Automático al entrar al Home si hay nuevos workouts
- El hook `useEffect` en Logros.jsx compara workouts contra logros ya guardados en Firestore
- Los nuevos logros se escriben en Firestore y se muestran de inmediato
- El usuario ve la vitrina completa desde el card de logros en Home

---

## 5. Lógica de negocio

### 5.1 Sugerencia diaria (getDailySuggestion)

Algoritmo con prioridad estricta:

```
1. ¿Es domingo?                          → Descanso
2. ¿Ya entrenó hoy?                      → "Ya entrenaste"
3. ¿Sin historial?                        → Rutina 1 (Isquios y Espalda)
4. Balance cardio/fuerza de la semana:
   - 0 cardio y ≥2 fuerza                → Sugerir Cardio
   - 1 cardio y quedan ≤2 días hábiles   → Sugerir Cardio
5. Elegir rutina de fuerza:
   - Excluir rutinas con músculos trabajados en ≤48h
   - Fallback: usar todas si quedan 0
   - Puntuar por días sin trabajar esos músculos
   - Ganar la rutina más descansada
```

La sugerencia devuelve `routineId`, que el botón "Empezar" usa para precargar la sesión.

### 5.2 Progresión de carga

**Sistema principal** (`getSeriesSuggestion`): doble progresión por objetivo

El algoritmo evalúa las últimas 2 sesiones con ese ejercicio:
- `up`: ambas sesiones completaron TODOS los sets en `repsMax` y última fatiga ≤7
- `down`: última sesión tuvo 2+ sets con menos de `repsMin` reps
- `maintain`: en el medio
- `first`: sin historial

Tablas de parámetros:
| Objetivo | Sets | Reps | Descanso |
|---|---|---|---|
| Tonificar | 3 | 12-15 | 75s |
| Masa muscular | 4 | 8-12 | 105s |
| Fuerza | 4 | 4-6 | 210s |
| Resistencia | 3 | 15-20 | 52s |
| Bienestar | 3 | 10-15 | 75s |

Pirámide intrasesión: cada serie aumenta reps descendentes y peso ligeramente.

Para el usuario con **múltiples objetivos**, ejercicios A/B usan el objetivo de mayor prioridad y C/D usan el segundo.

**Sistema secundario** (`getProgressionAdvice`): análisis comparando 2 últimas sesiones
- Patrón pirámide: compara pesos máximos y reps de última serie
- Patrón fijo: compara promedios de reps y peso
- Threshold: nivel A/B → 10 reps, nivel C/D → 15 reps
- Incremento: piernas → +5kg, grandes de superior → +2.5kg, resto → +2kg

**Pesos disponibles (snap):**
`[2, 4, 5, 6, 7.5, 8, 9, 10, 12, 12.5, 14, 15, 17.5, 20, 25]` kg

### 5.3 Deload

- Activo/inactivo: `settings.deloadActive` (bool, guardado en Firestore)
- Auto-sugerencia: si promedio fatiga de últimas 40 sesiones ≥ 7 → aviso en ConfigPage
- Efecto en ejercicios: peso × 0.65 (redondeado a peso disponible más cercano), series reducidas en 1 (mínimo 2)
- Tabla en Configuración muestra reglas para cardio y Tabata (informativas solamente)
- `deloadsCompleted` counter en settings (para el logro "Guerrera del descanso") — **ver sección 7**

### 5.4 Streak semanal

Se cuenta hacia atrás desde la semana PASADA (no la actual):
- Una semana califica si tiene 3+ días distintos entrenados
- La racha crece mientras las semanas son consecutivas
- Implementado en `useWorkouts.getCurrentStreak()` y en Logros.jsx `computeMaxStreak()`
- Display en `Streak.jsx` en el home

### 5.5 Logros — condiciones de desbloqueo

| Logro | Condición |
|---|---|
| Primer paso | workouts.length ≥ 1 |
| Semana activa | Alguna semana con ≥3 días distintos |
| Madrugador/a | 5+ workouts con createdAt antes de las 8:00 |
| Madrugador/a extremo/a | Algún workout con createdAt antes de las 6:30 |
| Ave nocturna | Algún workout con createdAt después de las 21:00 |
| Fin de semana activo | Una semana con workouts tanto el sábado como el domingo |
| Racha de fuego | 4+ semanas consecutivas con ≥3 días |
| Racha élite | 12+ semanas consecutivas con ≥3 días |
| 50 entrenamientos | workouts.length ≥ 50 |
| Constancia total | workouts.length ≥ 100 |
| Primer aumento | ≥1 PR histórico en ejercicios de fuerza |
| Superaste 3 PRs | ≥3 PRs históricos |
| Superaste 10 PRs | ≥10 PRs históricos |
| Doble progresión | Algún ejercicio con peso actual ≥ 2× peso inicial |
| Piernas de acero | 4+ semanas consecutivas con ejercicio de pierna |
| Primera vez 5km | ≥5km corriendo acumulados |
| 20km acumulados | ≥20km corriendo acumulados |
| Ritmo sólido | Promedio <6:00 min/km en últimas 3 sesiones de running |
| Doble rueda | Alguna sesión de rollers con ≥20km |
| Primera semana mixta | Una semana con fuerza + (cardio o clase) |
| Balance perfecto | 4+ semanas consecutivas con cardio o clase incluido |
| Energía en alza | Fatiga promedio bajó ≥2 puntos en una semana consecutiva |
| Guerrer@ del descanso | settings.deloadsCompleted ≥ 3 |
| Resiliencia | Algún gap de ≥7 días entre workouts consecutivos |
| Aniversario | ≥365 días desde el primer workout |
| Dos semanas activas | 2 semanas consecutivas con ≥3 días cada una |

### 5.6 PR detection (WorkoutSummary)

Al guardar un workout de fuerza, compara para cada ejercicio:
- Peso máximo de la sesión actual vs. máximo histórico de todas las sesiones previas
- Si `maxThisSession > prevMax && prevMax > 0` → es PR
- Resultado se muestra en la pantalla de celebración

### 5.7 Resumen semanal (WeeklySummaryModal)

Se muestra automáticamente al cargar el home si:
- Es lunes (o el primer día de la semana)
- La semana anterior tuvo al menos 1 entrenamiento
- No fue ya mostrado (clave en localStorage: `weekly_summary_{weekKey}`)

Contenido: días entrenados, calidad (Ideal/Óptimo/Aceptable/Seguí sumando), sesiones por tipo, músculos trabajados, PRs nuevos, cansancio promedio.

---

## 6. Base de datos — Firestore

### Estructura completa

```
users/{uid}/
  data/
    profile       → perfil del usuario
    settings      → configuración
    achievements  → logros desbloqueados
    favorites     → { ids: [exerciseId, ...] }
    never         → { ids: [exerciseId, ...] } (nunca usado actualmente)

  workouts/{id}   → documentos de entrenamiento (addDoc, no merge)
  customRoutines/{id}
  customExercises/{id}
  intentions/{weekKey}   → weekKey = lunes de la semana como 'YYYY-MM-DD'
  tabataRecords/{id}
  tabataSettings/{tabataId}
```

### Profile (`data/profile`)

```js
{
  name: string,
  genero: 'femenino' | 'masculino' | 'otro',
  objectives: string[],          // ['masa', 'tonificar', ...]
  objetivo: string,              // objetivo primario como string legible
  nivel: string,                 // 'principiante' | 'intermedio' | 'avanzado'
  diasSemana: number,
  tiposPreferidos: string[],
  pausa: string,
  lesiones: string,
  equipamiento: string,
  onboardingDone: boolean,
}
```

### Settings (`data/settings`)

```js
{
  deloadActive: boolean,
  restTimerSeconds: number,      // default 90
  coverUrl: string,              // URL foto de portada del hero
  deloadsCompleted: number,      // counter (ver sección 7 — problema)
}
```

### Workout — Fuerza

```js
{
  type: 'fuerza',
  date: 'YYYY-MM-DD',
  fatigue: number,               // 1-10
  notes: string,
  deload: boolean,
  muscleGroups: string[],
  exercises: [{
    exerciseId: string,
    name: string,
    muscle: string,
    originalMuscle: string,      // músculo del ejercicio original pre-replace
    originalExerciseId: string | null,  // ID del ejercicio original pre-alt
    level: string,               // A/B/C/D
    sets: [{ reps: number, weight: number }],
    fatigue: null | number,
  }],
  cinta: null | { tipo, min, kmh },
  createdAt: Timestamp,
}
```

### Workout — Cardio

```js
{
  type: 'cardio',
  date: 'YYYY-MM-DD',
  fatigue: number,
  notes: string,
  activity: string,
  tiempo: number | null,
  distancia: number | null,
  ritmo: string | null,
  createdAt: Timestamp,
}
```

### Workout — Clase

```js
{
  type: 'clase',
  date: 'YYYY-MM-DD',
  fatigue: number,
  notes: string,
  clase: string,
  duracion: number,
  createdAt: Timestamp,
}
```

### Consultas frecuentes

- `getWorkouts(uid, 100)`: query `orderBy('date', 'desc') limit(100)` → el primer elemento siempre es el más reciente
- `getWorkouts` se usa para el hook principal; el array cacheado en localStorage evita spinners
- No hay índices adicionales configurados (Firestore genera los necesarios automáticamente para esta query simple)

---

## 7. Lo que falta o está incompleto

### 7.1 Logros que nunca se desbloquean

**Cuatro logros definidos en `ACHIEVEMENTS` pero que no tienen lógica de comprobación en la función `check()` de Logros.jsx:**

| Logro | Key | Razón por la que no funciona |
|---|---|---|
| Poder isométrico | `poderIsometrico` | Requeriría que el timer de plancha registre la duración y la app la guarde; esto no se implementa. La función `check()` no lo evalúa. |
| En racha de fuerza | `rachaFuerza` | La función `check()` no tiene código para evaluar "3 subidas de peso en la misma semana". |
| Tabata master | `tabataMaster` | Aunque `tabataRecords` se guarda en Firestore, `check()` no consulta esa colección ni verifica si hay ≥10 registros. |
| Cinturón negro | `cinturonNegro` | Requeriría trackear qué páginas visitó el usuario en un día (Tabata + Biblioteca + Progreso). No existe esa lógica. |

**Un logro con lógica de conteo deficiente:**

- **Guerrer@ del descanso** (`guerreraDescanso`): depende de `settings.deloadsCompleted ≥ 3`, pero **`deloadsCompleted` nunca se incrementa en ningún lugar del código**. El toggle de deload activa/desactiva pero no cuenta cuántas semanas se completaron.

### 7.2 Import de datos incompleto

En ConfigPage, la función `importData()` solo restaura el `profile`:
```js
if (data.profile) updateProfile(data.profile)
```
Los `settings` y `workouts` del JSON exportado son ignorados. El usuario exporta todo pero solo puede reimportar una parte.

### 7.3 WeekCalendar solo muestra un workout por día

El objeto `byDate` se construye así:
```js
workouts.forEach(w => { byDate[w.date] = w })
```
Si hay dos workouts en el mismo día, el primero es sobreescrito por el segundo. El calendario no muestra que hubo dos sesiones ese día.

### 7.4 ConfigPage no edita `objectives[]`

El formulario de edición de perfil solo permite cambiar `objetivo` (string, un solo objetivo). La app usa `objectives[]` (array con prioridades) en toda la lógica de progresión. Si el usuario edita su perfil desde ConfigPage, el array `objectives` no se actualiza, lo que puede causar inconsistencias en las sugerencias de peso.

### 7.5 `getCurrentStreak` devuelve `record = current` siempre

```js
return { current: streak, record: streak }
```
El récord de racha máxima nunca se calcula separado del actual. Si la racha actual es 3 semanas pero el máximo histórico fue 8, ambas muestran 3. No hay memoria del máximo histórico real.

### 7.6 Pausa en ConfigPage tiene efecto limitado

La sección "Pausa del entrenamiento" en ConfigPage actualiza `profile.pausa`, pero `applyPauseMultiplier` nunca se llama durante la sesión de entrenamiento. Era pensado para ajustar pesos al volver de un descanso, pero actualmente solo lo haría si se reimplementa el onboarding o si FuerzaFlow lo considera (lo cual no hace actualmente).

### 7.7 ValenciaCountdown es un componente hardcoded

`ValenciaCountdown.jsx` tiene una fecha fija de evento (Maratón de Valencia). Si el evento ya pasó o la fecha cambia, el componente sigue mostrando un countdown que puede ser negativo o irrelevante. No hay forma de configurar la fecha desde la app.

### 7.8 Favoritos y "Never" no tienen UI

`getFavorites`, `toggleFavorite`, `getNeverList`, `toggleNever` están implementados en `db.js`, pero **no existe ningún componente que los use o muestre**. El usuario no puede marcar ejercicios como favoritos ni excluirlos desde ninguna pantalla.

### 7.9 `TIME_EXERCISES` hardcodeado en inglés

```js
const TIME_EXERCISES = ['Plancha', 'Sentadilla isométrica', 'Bird Dog', 'Hollow Body Hold', 'Dead Bug', 'Press Pallof']
```
La detección de ejercicios de tiempo se hace por coincidencia exacta de nombre en español. Si el nombre de un ejercicio tiene alguna variación (capitalización, tilde), no se detecta como ejercicio de tiempo y pide peso en vez de segundos.

### 7.10 El historial de Progreso está limitado a 100 workouts

`getWorkouts(uid, 100)` carga solo los últimos 100. Para el historial en Progreso, `WorkoutHistorial` muestra todos los que están en el array de `workouts`. Si el usuario tiene más de 100 sesiones, las más antiguas no aparecen en los gráficos ni en el historial. No hay paginación ni carga infinita.

### 7.11 Sesión de fuerza no soporta superset ni circuito

Todos los ejercicios son lineales (A → B → C). No hay forma de agrupar ejercicios en supersets, circuitos o alternadas, que son modalidades comunes de entrenamiento.

### 7.12 Sin notificaciones push

La app no tiene notificaciones de recordatorio (ej: "No entrenaste ayer, ¿todo bien?"). Aunque es PWA, no está implementado un service worker que envíe notificaciones.

### 7.13 Frases post-entrenamiento no sincronizadas entre dispositivos

La frase del día post-entrenamiento se cachea en `localStorage` con clave `post_frase_YYYY-MM-DD`. Si el usuario abre la app en otro dispositivo (o en modo incógnito), verá una frase diferente porque el localStorage es local.

### 7.14 Timer de Tabata no persiste en segundo plano

Si el usuario cierra la pantalla del timer de Tabata (minimiza la app, va a otra tab), el timer se pausa o desincroniza porque depende de `setInterval`. No usa Web Workers ni la API de Background Sync.

### 7.15 Puntos menores de UX

- **Historial en Biblioteca**: muestra fechas en formato `YYYY-MM-DD` crudo, no localizado (ej: "2025-04-21" en vez de "21 abr")
- **No hay confirmación al eliminar ejercicio custom** desde la Biblioteca (solo hay ✕ directo)
- **El resumen semanal** se muestra automáticamente los lunes pero si el usuario lo cierra y vuelve a abrir la app el mismo lunes, no vuelve a aparecer (bien intencionado, pero podría perderse si se cierra por accidente)
- **Editar rutina custom**: cambiar el nombre de una rutina custom no actualiza el título en el encabezado del modal de edición (muestra el nombre anterior hasta que se guarda)
- **Intencion.jsx**: la intención semanal se guarda correctamente pero no hay forma de editar o borrar una intención pasada desde la UI
