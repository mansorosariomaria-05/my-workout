# Changelog

Cambios ordenados del más reciente al más antiguo.

---

## 2025-06 — Reorganización de rutinas y ejercicios

### Nuevas rutinas pre-armadas (routines.js)
- **Rutina 1** renombrada: "Cadena Posterior" → "Isquios y Espalda"
  - Nuevos ejercicios: Peso muerto B-stance (A), Jalón al pecho (A), Curl de Isquiotibiales en máquina (B), Remo con barra (B), Hiperextensiones (C), Face Pull (C)
- **Rutina 2** renombrada: "Empuje Vertical" → "Piernas y Hombros"
  - Subtítulo actualizado a "Cuádriceps · Glúteos · Hombros"
- **Rutina 3** renombrada: "Empuje Horizontal" → "Pecho y Glúteos"
  - Nuevos ejercicios: Hip Thrust (A), Press de Banca (A), Abducción con pausa (B), Remo en polea (B), Step-ups al cajón alto (B), Aperturas con mancuernas (C)
- **Rutina 4** "Fuerza Accesoria": reordenada (Hack Squat → Arnold Press → Gemelos → Bíceps → Tríceps → Plancha)
- **Rutina 5** "Glúteos": sin cambios
- Los IDs de rutinas se mantuvieron para no romper datos guardados en Firestore

### Reorganización de categorías de abdominales (exercises.js)
- Fusionadas las categorías "Abdomen Superior", "Abdomen Inferior" y "Oblicuos" en una sola: **"Abdominales"**
- Añadido campo `zone` a todos los ejercicios abdominales: `'Superior'` | `'Inferior'` | `'Oblicuos'`
- **Dead Bug** (`obl_04`) movido de Oblicuos a **"Core & Estabilidad"**
- `MUSCLE_GROUPS` actualizado (12 grupos en lugar de 14)

### Helpers de display con zona
- `exDisplayName(e)` implementado en FuerzaFlow, BibliotecaTab: muestra `"Crunch (Superior)"` etc.
- Aplicado en: modo libre, panel de agregar ejercicio, modal de reemplazar, biblioteca

### BibliotecaTab.jsx
- `GROUP_COLORS` actualizado: eliminadas entradas de 'Abdomen Superior', 'Abdomen Inferior', 'Oblicuos'; añadida `'Abdominales': '#534AB7'`
- `ExerciseRow` muestra zona entre paréntesis junto al nombre

### GeneradorTab.jsx
- Constante `CORE` actualizada: `['Abdominales', 'Core & Estabilidad']`

---

## 2025-05 — Mejoras de UX en Home y registro

### Home (Inicio.jsx) — "hace X días" inline
- La etiqueta temporal del último entrenamiento se movió al lado del título del card, separada por guión, en texto más pequeño y apagado
- Antes: línea separada; ahora: `ÚLTIMOS ENTRENAMIENTOS — hace 1 día`

### Home (Inicio.jsx) — Entrenamientos múltiples del mismo día
- El card "Último entrenamiento" ahora agrupa todos los workouts de la fecha más reciente
- Si hay fuerza + cardio/clase en el mismo día: layout de dos columnas
- Antes: solo mostraba el primero encontrado con `.find()`

### DailySuggestionCard — Botón "Empezar"
- Añadido botón morado "Empezar" en la card de sugerencia diaria
- Navega directamente a `/registro` con `state: { type, routineId }` precargado
- Solucionado bug de HTML inválido (button anidado en button → outer convertido a div)

### WorkoutSummary.jsx — Mensaje de felicitación con fecha correcta
- `getDayAchievement()` usaba `new Date()` para calcular la semana → error al registrar entrenamientos con fecha pasada
- Corregido: ahora usa `workout.date` para computar la semana correspondiente
- Añadidas funciones auxiliares `getMondayStr()` y `getSundayStr()` con límite superior de semana

---

## 2025-04/05 — Registro de fuerza: funcionalidades F1-F5

### F1 — Botón de alternativa en ExerciseCard
- Cada ejercicio muestra botón de alternativa si `ex.alt` existe
- Lógica de **toggle verdadero** O→A→O usando campo `originalExerciseId`:
  - Al ir al alt: guarda `originalExerciseId` en el entry
  - Al volver: restaura el ejercicio original y limpia `originalExerciseId`
- Botón muestra: `"Alternativa: {alt}"` cuando en original / `"↩ Volver: {nombre}"` cuando en alt

### F4 — Botón "Cambiar" (reemplazar ejercicio)
- Botón morado con icono + texto "Cambiar" en cada ExerciseCard
- Abre modal con buscador filtrado por `originalMuscle` del ejercicio
- `replaceWithExercise()` preserva `originalMuscle` para futuros reemplazos
- Campo `originalMuscle` guardado en `buildEntry()` para persistir el músculo original

### F5 — Panel para agregar ejercicio
- Botón "+" al final de la lista de ejercicios en FuerzaFlow
- Chips de selección por músculo + lista filtrada
- Agrega al final de la lista de ejercicios activos

### F6 — Múltiples entrenamientos por día en Home
- Firestore ya usaba `addDoc` (múltiples docs por día), pero el home solo mostraba uno
- Corregido en `LastAndSuggestion`: agrupa por `real[0].date` y muestra todos

---

## 2025-04 — Fixes de alternativas en exercises.js

Correcciones de alts incorrectos o faltantes:
- `cua_07` (Sentadilla isométrica) → alt: `'Sentadilla Goblet'`
- `esp_05` (Remo con Mancuerna) → alt: `'Remo en polea'`
- `abs_02` (Plancha con flexión) → alt: `'La Plancha'`
- `abs_03` (Crunch) → alt: `'Bicycle Crunch'`
- `abs_05` (One arm toe touch) → alt: `'Scissors Abs'`
- `abi_03` (Reverse Crunch) → alt: `'Elevación de piernas colgado'`
- `glut_07` (Puente de Glúteo) → alt: `'Hip Thrust con mancuerna'`
- `isq_02` (Peso muerto B-stance) → alt: `'Landmine RDL'`
- `landmine-rdl` (nuevo ejercicio) → alt: `'Peso muerto B-stance'`

### Nuevo ejercicio: Landmine RDL
```js
{ id: 'landmine-rdl', name: 'Landmine RDL', muscle: 'Isquios', level: 'B',
  equip: 'Barra + soporte landmine', alt: 'Peso muerto B-stance', secondary: 'Glúteos' }
```

---

## 2025-03/04 — Features iniciales

### Sistema de múltiples objetivos
- El onboarding acepta múltiples objetivos (`objectives[]`)
- `getObjetivoForLevel()` en progression.js asigna el objetivo según nivel del ejercicio:
  - A/B → objetivo de mayor prioridad
  - C/D → segundo objetivo (si hay)
- Compatibilidad hacia atrás: si no hay `objectives[]`, usa `objetivo` string

### Progresión de carga — sistema completo
- `getSeriesSuggestion()`: doble progresión con acción up/down/maintain/first
- `getProgressionAdvice()`: análisis de dos últimas sesiones con detección de patrón pirámide vs fijo
- `PYRAMID` con esquemas de reps descendentes y delta de peso por serie
- `GYM_WEIGHTS` array canónico para snap de pesos

### Deload
- `useDeload` hook: peso × 0.65, series -1
- `shouldSuggestDeload()`: promedio fatiga últimas 40 sesiones >= 7
- Estado guardado en Firestore settings

### Sistema de logros — 30 logros
- Consistencia: Primer paso, Semana activa, Madrugador/a, Fin de semana activo, Racha de fuego, Racha élite, 50 entrenamientos, 100 entrenamientos
- Fuerza: Primer aumento, 3 PRs, 10 PRs, Doble progresión, Piernas de acero, Poder isométrico, En racha de fuerza
- Cardio: Primera vez 5km, 20km acumulados, Ritmo sólido, Doble rueda, Tabata master
- Balance: Semana mixta, Balance perfecto, Energía en alza, Guerrer@ del descanso, Resiliencia
- Especiales: Aniversario, Madrugador/a extremo/a, Ave nocturna, Dos semanas activas, Cinturón negro
- Vitrina con flip cards, grid 3 columnas, barra de progreso

### Rutinas pre-armadas (versión inicial)
- 5 rutinas: Cadena Posterior, Empuje Vertical, Empuje Horizontal, Fuerza Accesoria, Glúteos
- Generador aleatorio con intercalación tren inferior/superior
- Rutinas custom: crear, editar, duplicar, eliminar desde PreArmadasTab
- Ejercicios custom: agregar/eliminar desde BibliotecaTab

### Sugerencia diaria
- Algoritmo por prioridad: descanso domingo, ya entrenó, sin historial, balance cardio/fuerza, rutina de fuerza más descansada
- Puntuación por días sin trabajar los músculos de cada rutina

### App shell
- Splash screen animado
- BottomNav con 5 tabs: Inicio, Registro, Rutinas, Tabata, Progreso
- AuthScreen con Google Sign-In
- Onboarding de 8 pasos (género, nombre, objetivos, nivel, días/semana, tipos, pausa, lesiones, equipamiento)
- ConfigPage: deload toggle, timer de descanso, foto de portada, cerrar sesión

### Páginas de progreso
- WeekChart: entrenamientos por semana (Recharts BarChart)
- FatigueChart: cansancio promedio por semana
- MonthCalendar: calendario mensual coloreado por tipo
- ExerciseProgress: progresión de peso para un ejercicio
- WorkoutHistorial: listado de sesiones con detalle expandible

### Tabata
- Protocolos predefinidos en tabatas.js
- Timer work/rest con beep y vibración
- Registro de records en Firestore

---

## 2025-05 — GitHub y documentación

- Repositorio inicializado: https://github.com/mansorosariomaria-05/my-workout
- `dist/` agregada a `.gitignore`
- Primer commit con 79 archivos
- Creados CONTEXTO.md, CHANGELOG.md, README.md
