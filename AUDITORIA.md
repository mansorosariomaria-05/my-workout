# Auditoría de My Workout

Fecha: 2026-10-02 · Solo lectura: no se modificó código · Estado revisado: commit `20cb3f2` (más `AUDITORIA.md`).

**Cómo leer este informe.** Cada hallazgo dice qué pasa en lenguaje simple, dónde está (`archivo:línea`), cómo afecta a Ro y qué haría. **CONFIRMADO** = lo verifiqué leyendo el código (o ejecutando un script de lectura sobre `exercises.js`). **SOSPECHA** = el código apunta a eso, pero depende de cómo se comporta Firestore/el dispositivo y hay que probarlo.

**Limitaciones declaradas.** (1) No hay sesión de login en este entorno, así que nada se probó en la app corriendo: todo es análisis de código. (2) El repo **no tiene `firestore.rules`** ni la clave `firestore` en `firebase.json`; no pude leer las reglas reales (ver H1). (3) Un agente de revisión de Progreso/Logros se cortó por límite de uso; esa parte la revisé yo directamente, con menos profundidad que FuerzaFlow o Onboarding.

---

## 1. Resumen ejecutivo — los 10 hallazgos más importantes

1. **La app solo lee los últimos 100 entrenamientos** (`useWorkouts.js:32`). Pasados ~6 meses de uso, "Aniversario" y "Medio año" no se pueden desbloquear, y récords, historial y precargas se calculan con historia recortada. *(B1, CONFIRMADO)*
2. **Guardar un entrenamiento sin red podría quedar colgado en "Guardando…"** y la cola offline propia (`draftQueue.js`) probablemente nunca se active; con el nuevo "entrenamiento en curso" eso puede terminar en un entrenamiento duplicado. *(G1, SOSPECHA — probar en modo avión)*
3. **Tabata no funciona y nadie lo puede usar:** no tiene temporizador ni botón de "terminé", `saveTabataRecord` no se llama en ningún lado, y el logro "Tabata master" es imposible. **Recomendación: sacarla.** *(sección 2)*
4. **El botón "Alternativa" crea un ejercicio sin historial en 47 de 90 ejercicios**, así que la precarga queda vacía justo cuando se cambia de ejercicio. *(A1, CONFIRMADO)*
5. **Dos avisos distintos para el mismo entrenamiento en curso**: la barra violeta de `Layout.jsx` (nueva persistencia de 7 días → ahora aparece en todas las pantallas durante días) y el modal "¿Continuás donde lo dejaste?" de Inicio. *(A2, CONFIRMADO)*
6. **Se borran solos los ejercicios personalizados** llamados "Reverse Frog" o "Abducción con pausa" cada vez que se abre Fuerza. *(A3, CONFIRMADO)*
7. **Se puede perder un ejercicio con todas sus series de un toque**: X de ~24 px, sin confirmar, al lado del botón "Cambiar". *(A4, CONFIRMADO)*
8. **Lag al tipear en el gimnasio:** cada tecla en peso/reps recorre el historial completo ~5 veces por ejercicio. *(D1, CONFIRMADO en código; el impacto real depende del teléfono)*
9. **Onboarding de 10 pasos con 4 respuestas que no hacen nada** (equipamiento, tipos preferidos, sesiones de fuerza, nivel) y un `nivel` que Configuración guarda en otro formato. *(B2/A5, CONFIRMADO)*
10. **Accesibilidad:** 3 `aria-label` para 123 botones (el "+" principal, cerrar modal y volver no tienen nombre) y animaciones sin `prefers-reduced-motion`. *(F1/F2, CONFIRMADO)*

Mención aparte: **H1** — las reglas de Firestore no están en el repo, así que "cada usuario solo lee lo suyo" no se puede verificar desde acá.

---

## 2. Qué sacaría o fusionaría

### 2.1 Tabata — **recomendación: SACAR**

**Qué es hoy.** Pestaña "Tabata" en la barra inferior (`BottomNav.jsx:35`) → ruta `/tabata` (`App.jsx:57`) → `TabataPage` (54 líneas) / `TabataCard` (29) / `TabataDetail` (117) / `data/tabatas.js` (125 líneas, 10 circuitos fijos). Se pueden ver los circuitos, ajustar tiempos y "Guardar tiempos".

**Cuánto se usa según el código (CONFIRMADO).**
- No existe temporizador: `grep` de `timer|countdown|setInterval` en `components/tabata` → 0 resultados. No hay botón "Empezar" ni "Terminé".
- `saveTabataRecord` (`db.js:208`) está definida pero **no se llama desde ningún archivo**. Por lo tanto la app actual **no puede crear** documentos de Tabata (ni en `tabataRecords` ni como workout `type:'tabata'`).
- Consecuencia: el logro `tabataMaster` (10 sesiones, `achievements.js:36,408-412`) es imposible, y cada chequeo de logros hace una lectura extra a Firestore (`getTabataRecordCount`) para siempre.
- Además, `saveTabataRecord` escribe en la colección aparte `tabataRecords`, mientras que todo el código de historial/calendario/racha lee solo `workouts`: las ramas que muestran `type === 'tabata'` (listadas abajo) no tienen cómo recibir datos de la app actual. *(Si en una versión vieja se guardaron `type:'tabata'` dentro de `workouts`, no puedo saberlo desde el código → ver paso 1 del plan.)*

**Dependencias (todas verificadas por búsqueda).**

| Parte | Dónde |
|---|---|
| Ruta y página | `App.jsx:11,57`, `pages/Tabata.jsx`, `components/tabata/*` |
| Datos | `data/tabatas.js` |
| Firestore | `db.js` funciones `saveTabataRecord`, `getTabataRecordCount`, `getTabataSettings`, `saveTabataSettings`; colecciones `tabataRecords`, `tabataSettings` |
| Navegación | `BottomNav.jsx:35` + `TimerIcon` |
| Logro | `achievements.js:1,36,408-412`, ícono en `Logros.jsx:46` |
| Ícono | `WorkoutIcons.jsx:44,73` |
| Tipo en racha | `streak.js:5` (`REAL_WORKOUT_TYPES`) |
| Ramas de visualización | `Inicio.jsx:35,318,749`, `WeekCalendar.jsx:17,90`, `ProgresoPage.jsx:229,287`, `MonthCalendar.jsx:12`, `WorkoutHistorial.jsx:14` |
| Textos y opciones | `Onboarding.jsx:41` (opción "Tabata"), `ConfigPage.jsx:274`, `ClaseFlow`/`TabataDetail` (aviso de descarga), comentario en `useDeload.js:3` |
| Docs | `CONTEXTO.md`, `LOGICA_TECNICA.md` (secciones 1, 3, 7, 8, 9, 10) |

**Qué se gana.** Un lugar en la barra inferior; ~330 líneas de UI/datos; 4 funciones de Firestore; 1 logro imposible; una lectura de Firestore menos en cada chequeo de logros; una pestaña que hoy promete algo que no entrega.
**Qué se pierde.** Nada que funcione hoy: los circuitos son una lista de lectura. Lo único "valioso" son las 10 listas de estaciones; si a Ro le sirven como inspiración, se pueden dejar como rutinas de texto o pasar al generador (no hace falta código).

**Plan de salida sin romper datos (en un solo prompt, orden recomendado).**
1. *Antes de borrar*: en la consola de Firebase, mirar si existen documentos con `type == 'tabata'` en `users/{uid}/workouts` y cuántos hay en `tabataRecords`. (Es solo mirar.)
2. Sacar ruta, página, componentes, `tabatas.js`, pestaña de la barra, funciones `*Tabata*` de `db.js`, el logro `tabataMaster` (y su ícono `Play`) y los textos sueltos.
3. **Dejar** `'tabata'` en `REAL_WORKOUT_TYPES` y las ramas de visualización de 1 línea: así, si existe algún workout viejo con ese tipo, sigue contando en racha, calendario e historial. Es costo casi cero y evita riesgo.
4. **No borrar** datos de Firestore (`tabataRecords`, `tabataSettings`): quedan inertes. Si el logro ya estaba desbloqueado, el documento `achievements` conserva la entrada; hay que verificar que `ACHIEVEMENTS_META` no rompa si la clave desaparece (el texto "30 logros" de `CONTEXTO.md:384` ya está desactualizado: son 35).
5. Actualizar `CONTEXTO.md` y `LOGICA_TECNICA.md`.

**Qué pondría en la barra.** Hoy: Inicio · Biblioteca · **[+]** · Tabata · Progreso. Opciones:
- **A (recomendada):** Inicio · Rutinas · [+] · Progreso · **Ajustes** — Configuración hoy solo se llega por un ícono del encabezado de Inicio (`HeroPortada.jsx:31`) y queda escondida. Además renombrar "Biblioteca" a "Rutinas": esa pestaña lleva a la pantalla `/rutinas`, que adentro tiene sus propias pestañas Pre-armadas / Generador / Biblioteca (`RutinasPage.jsx`), y el mismo nombre dos veces confunde.
- **B:** dejar solo 3 pestañas + "+" (queda asimétrica).
- No agregaría una pestaña nueva de contenido: no hay una función que lo justifique y el principio 4 es "menos".

### 2.2 Otros candidatos

| Candidato | Qué es / por qué | Recomendación |
|---|---|---|
| **Pasos del onboarding sin efecto** | `tiposPreferidos`, `sesionesFuerzaObjetivo`, `equipamiento` y `nivel` se preguntan (y se muestran/editan en Configuración) pero ninguna lógica los usa (`grep` fuera de Onboarding/Config: solo mostrar/editar). `tipoRutina` **sí** se usa (`useWorkouts.js:153`). El onboarding tiene 10 pasos (`Onboarding.jsx:26-37`), no 8 como dice la doc. | **Sacar** los 4 pasos (o hacerlos opcionales y a futuro, cuando algo los use). Quedarían ~6 pasos. |
| **GeneradorTab vs. modo "libre" de FuerzaFlow** | Dos pantallas que hacen casi lo mismo (elegir músculos → cantidad → equipo → generar), ambas con `generateRoutine`. La diferencia real: GeneradorTab permite *guardar como rutina propia sin entrenar ahora* (`GeneradorTab.jsx:58-62`). | **Fusionar** la UI en un solo componente compartido; no hace falta sacar la función de guardar. |
| **Medallas `w_mas_fuerte` y `w_supero_pr`** | Misma condición exacta (mismo `case`, `Logros.jsx:120-121`): la usuaria ve dos medallas distintas que se ganan por lo mismo. | **Sacar una** (dejar "Nuevo récord"). |
| **`WeekRow` de Progreso** | Reimplementa la "semana" que ya muestra Inicio con `WeekCalendar` (3 calendarios con 3 criterios distintos, ver A6). | **Fusionar** en un único componente de calendario. |
| **Backend sin UI: favoritos y "nunca sugerir"** | `getFavorites/toggleFavorite/getNeverList/toggleNever` (`db.js`) sin ningún llamador (CONFIRMADO). Ya figuraba como pendiente. | **Dejar** solo si hay planes cercanos; si no, borrar (no hay datos huérfanos porque nunca se escribe). |
| **Código muerto de funciones sueltas** | Sin ningún uso: `getIntention/saveIntention/getIntentionHistory`, `getWorkoutsByDateRange`, `getWorkoutsForExercise` (`db.js`), `daysUntilValencia`, `isAfterValencia`, `getLocalTimezone`, `formatDate` (`dates.js`). Dependencia `canvas-confetti` (`package.json:12`) sin importar en ningún archivo (el confeti es CSS propio). | **Sacar**. |
| **Cola offline `draftQueue.js`** | Posiblemente nunca se activa (ver G1). Si se confirma, es un mecanismo entero (+ ícono "pendiente de sync") que no hace lo que dice. | **Decidir tras probar G1**: reemplazar por la cola nativa de Firestore. |
| **Pantalla "¿Cómo te sentiste?" (paso 3 del registro)** | Una pantalla entera por entrenamiento solo para cansancio (1-10) y nota. Se usa (medalla "Cuerpo sabio", sugerencia de descarga, gráfico). | **Fusionar** al final del paso 2 (cansancio como chips opcionales, "Guardar" visible): un toque menos por entrenamiento. |
| **Sección Biblioteca / Pre-armadas** | Se usan y no se solapan con otra cosa. | **Dejar**. |

---

## 3. Hallazgos detallados

Severidad: alta / media / baja · Esfuerzo: S (≤1 h), M (media jornada), L (varios días).

### A. Lógica y bugs

| ID | Sección | Qué pasa (simple) | Evidencia | Impacto para Ro | Propuesta | Sev. | Esf. | Estado |
|---|---|---|---|---|---|---|---|---|
| A1 | Registro fuerza | "Alternativa" busca el nombre de la alternativa en el catálogo; si no está, crea un ejercicio nuevo con id inventado (`alt-i-fecha`) sin historial. **47 de 90 ejercicios** tienen una `alt` que no coincide con ningún ejercicio. | `FuerzaFlow.jsx:641-646`; script de lectura sobre `exercises.js` | Al tocar "Alternativa" la precarga vuelve a "12 reps, sin peso": rompe el principio "precarga = última sesión", y esos ejercicios nunca acumulan progresión. | Que el botón solo ofrezca alternativas que existen en el catálogo (o completar el catálogo con las 47); no inventar ids. | alta | M | CONFIRMADO |
| A2 | Inicio / Layout | Hay **dos avisos** de entrenamiento en curso: barra violeta "Tenés un entrenamiento en curso · Continuar →" (aparece en todas las páginas mientras haya borrador) y el modal nuevo en Inicio. Desde que el borrador dura 7 días, la barra puede quedar días visible; cerrar el modal con la X no descarta, así que la barra sigue ahí. | `Layout.jsx:12,48-65`; `Inicio.jsx` (modal `ResumeDraftModal`) | Doble mensaje por lo mismo, ruido permanente en pantalla; consecuencia de mi cambio anterior. | Unificar en uno: dejar la barra (1 toque, siempre visible) mostrando el resumen "Fuerza · 3 ejercicios · ayer 18:40", o dejar el modal y ocultar la barra hasta que se elija. | media | S | CONFIRMADO |
| A3 | Registro fuerza | Cada vez que se abre Fuerza, se **borran de Firestore** los ejercicios personalizados cuyo nombre sea "Reverse Frog" o "Abducción con pausa" (migración vieja que quedó permanente). | `FuerzaFlow.jsx:517-527` | Si Ro crea un ejercicio propio con ese nombre, desaparece sin avisar (rompe "nunca modificar sin preguntar"); además es una consulta + borrado en cada apertura. | Quitar el bloque (la migración ya se cumplió). | alta | S | CONFIRMADO |
| A4 | Registro fuerza | Quitar un ejercicio es un toque en una X de ~24 px junto a "Cambiar", sin confirmación; borra el ejercicio y sus series y el borrador lo guarda al instante. | `FuerzaFlow.jsx:305,624` | Una pulsación accidental con la mano húmeda pierde lo cargado. | Zona táctil ≥44 px separada de "Cambiar" + "Deshacer" de 5 s (más rápido que confirmar). | media | S | CONFIRMADO |
| A5 | Perfil | Onboarding guarda `nivel` como `principiante/intermedio/avanzado`; Configuración usa otras cadenas (`'Principiante (<1 año)'`…). Al abrir "Editar" el selector no coincide con nada, y al guardar queda otro formato. Además la pantalla de Configuración muestra el valor crudo ("principiante"). | `Onboarding.jsx:14-18`; `ConfigPage.jsx:13,141,181-183` | Dato inconsistente; hoy nada lo lee, pero es una trampa para el día que se use. | Un solo vocabulario (y mostrar la etiqueta, no la clave); o sacar la pregunta (sección 2.2). | media | S | CONFIRMADO |
| A6 | Calendarios | Si hay **dos entrenamientos el mismo día**, los tres calendarios muestran cosas distintas: `WeekCalendar` guarda todos, `MonthCalendar` se queda con el último y `WeekRow` con el primero. | `WeekCalendar.jsx:130-135`; `MonthCalendar.jsx:54-56`; `ProgresoPage.jsx:235-239` | El mismo día se ve como "fuerza" en Inicio, "cardio" en el mes y "fuerza" en la fila de Progreso. Con el entrenamiento híbrido (pendiente conocido) empeora. | Un único helper `groupByDate` compartido (fusión de calendarios). | media | M | CONFIRMADO |
| A7 | Registro fuerza | `useSeconds` (modo segundos/reps) se decide una sola vez al crear la tarjeta; al usar "Alternativa"/"Cambiar" el componente no se vuelve a montar (`key={i}`), así que una plancha convertida en sentadilla sigue pidiendo segundos. También: `Rolling Plank` no está en `TIME_EXERCISES`, y "+2 reps" se bloquea a 25 aunque en ejercicios de tiempo "reps" son segundos. | `FuerzaFlow.jsx:15,178,207,228-229,1095` | Confusión al cambiar ejercicios; sugerencia de progresión que desaparece sin explicación en isométricos. | `key={entry.exerciseId}` y marcar el modo de tiempo en el catálogo (campo, no lista de nombres). | media | S | CONFIRMADO |
| A8 | Onboarding / Rutinas | Se pregunta el equipamiento diciendo "Filtramos ejercicios según esto", pero la respuesta no se lee nunca; el generador tiene su propio selector ("Gym completo"/"Solo básico") que no existe en el onboarding. | `Onboarding.jsx:36`; `routineGenerator.js:29-31`; `GeneradorTab.jsx:12`; `FuerzaFlow.jsx:1018` | Promesa incumplida y una elección repetida cada vez. | Sacar la pregunta o que el selector arranque con esa respuesta. | media | S | CONFIRMADO |
| A9 | Registro fuerza | Al agregar un ejercicio personalizado, si falla guardarlo en Firestore se ignora el error y el ejercicio queda solo en pantalla. | `FuerzaFlow.jsx:559-560` | Desaparece de "Mis ejercicios" después, sin aviso. | Mostrar un aviso discreto ante error. | baja | S | SOSPECHA (no probé sin red) |
| A10 | Perfil | `saveProfile` mezcla etiquetas humanas con claves internas en `objectives` (`'Ganar fuerza'` junto a `'fuerza'`). | `ConfigPage.jsx:54-55`; `Onboarding.jsx:5-11` | Hoy inofensivo (nada lo lee). | Un solo formato. | baja | S | CONFIRMADO |

### B. Datos

| ID | Sección | Qué pasa | Evidencia | Impacto | Propuesta | Sev. | Esf. | Estado |
|---|---|---|---|---|---|---|---|---|
| B1 | Todo | La app trae solo los **100 entrenamientos más recientes** y calcula todo con eso (racha, récords, logros, historial, pesos aprendidos, modo regreso). Los logros "Medio año" y **"Aniversario"** miran el entrenamiento más viejo *de esos 100*; "100 entrenamientos" sale justo en el límite. A ~4 entrenamientos por semana, 100 ≈ 6 meses. | `useWorkouts.js:32`; `db.js:71`; `achievements.js:318-322,432-436`; `achievements.js:316` | Pasados ~6 meses, "Aniversario" no se desbloquea nunca y el resto de las estadísticas "olvida" el pasado. | Guardar un resumen aparte (fecha del primer entrenamiento, cantidad total, récords por ejercicio) y/o pedir más historia con paginación; mínimo: calcular "primer entrenamiento" con una consulta propia (1 documento, orden ascendente). | alta | M | CONFIRMADO |
| B2 | Perfil | 4 respuestas del onboarding no se usan en ninguna lógica (`tiposPreferidos`, `sesionesFuerzaObjetivo`, `equipamiento`, `nivel` solo se muestra). | `Onboarding.jsx:32-36`; grep en `src` | Preguntas obligatorias sin efecto (contra "nada extra"). | Ver sección 2.2. | media | S | CONFIRMADO |
| B3 | Registro | Mismo concepto "vacío" guardado de tres formas: `''` (`activity`, `clase`), `null` (`cinta`, cardio derivado) y `60` por defecto (`duracion` de clase). | `WorkoutWizard.jsx:136,149,153-157,161-162` | No rompe pantallas (se leen con chequeos "truthy"), pero cualquier validación futura falla. | Convención única (`null`). | baja | S | CONFIRMADO |
| B4 | Registro | `sanitizeWorkout` convierte `undefined`→`null` en el nivel raíz y objetos, pero no dentro de listas (`exercises`, `sets`); Firestore rechaza `undefined`. Hoy no falla porque todos los campos tienen valor por defecto. | `WorkoutWizard.jsx:113-121`; `firebase.js:18-22` | Un campo nuevo sin valor por defecto rompería el guardado con un error poco claro. | Activar `ignoreUndefinedProperties: true` al inicializar Firestore (una línea). | baja | S | SOSPECHA (riesgo latente) |
| B5 | Datos | Colecciones `tabataRecords`/`tabataSettings` sin escritores útiles; ver 2.1. | `db.js:207-228` | — | Con la salida de Tabata. | baja | S | CONFIRMADO |

### C. Código

| ID | Sección | Qué pasa | Evidencia | Impacto | Propuesta | Sev. | Esf. | Estado |
|---|---|---|---|---|---|---|---|---|
| C1 | Registro fuerza | `FuerzaFlow.jsx` tiene **1334 líneas** y mezcla ≥6 responsabilidades: temporizadores, tarjeta de ejercicio, sugerencias, carga de rutinas, generador y alta de ejercicios propios. | `FuerzaFlow.jsx` (58-142, 185-224, 226-489, 554-566, 658-693, 965-1076) | Difícil de tocar sin romper algo; es el archivo donde pasan la mayoría de los bugs. | Dividir en `ExerciseCard.jsx`, `suggestions.js`, `useGeneratedRoutine.js`, `AddExercisePanel.jsx` (sin cambiar comportamiento). | media | L | CONFIRMADO |
| C2 | Registro fuerza | El mini-formulario "Ejercicio nuevo" está copiado casi igual en dos lugares. | `FuerzaFlow.jsx:917-959` y `1161-1204` | Cualquier arreglo hay que hacerlo dos veces. | Un componente. | baja | S | CONFIRMADO |
| C3 | Rutinas | El buscador de ejercicios (mismo filtro por nombre/músculo) está repetido en `PreArmadasTab` y `BibliotecaTab`. | `PreArmadasTab.jsx:121-128,203-243`; `BibliotecaTab.jsx:124-140` | Duplicación. | `<ExercisePicker>` compartido. | media | M | CONFIRMADO |
| C4 | Resumen | `WorkoutSummary.jsx` reimplementa a mano fechas locales y "lunes de la semana" que ya existen en `dates.js`. | `WorkoutSummary.jsx:36-48,79-81` | Tres formas de calcular la semana en la app = riesgo de resultados distintos. | Usar `dateToLocal`, `weekKey`, `getTodayLocal`. | baja | S | CONFIRMADO |
| C5 | Varios | Código muerto y dependencia sin uso (ver 2.2). | `db.js`, `dates.js`, `package.json:12` | Ruido. | Borrar. | baja | S | CONFIRMADO |
| C6 | Catálogo | Además de los 6 pares conocidos, hay un **trío** casi igual: `tri_02`/`tri_04`/`tri_06` (3 aislamientos nivel C del mismo patrón `triceps`). Y "Face Pull" existe 2 veces con el mismo nombre (`esp_07`, `hom_04`). | `exercises.js:87,89,91,67,80` | Para el pendiente conocido: sube un poco su prioridad solo por el nombre repetido (se ve duplicado en listas y confunde el historial). | Incluirlo en esa tanda. | baja | S | CONFIRMADO |

### D. Rendimiento

| ID | Sección | Qué pasa | Evidencia | Impacto | Propuesta | Sev. | Esf. | Estado |
|---|---|---|---|---|---|---|---|---|
| D1 | Registro fuerza | En cada render, por **cada ejercicio** de la sesión se llaman `getLastWeightsForExercise`, `getPRForExercise`, `getLearnedWeights`, `getExerciseSessions` y `getProgressionAdvice`, todas recorriendo (y ordenando) el historial completo, sin `useMemo`. Cada dígito que se tipea re-renderiza todo. | `FuerzaFlow.jsx:566-574,1084-1088`; `useWorkouts.js` (funciones de consulta) | Con 100 entrenamientos × 6 ejercicios, cada tecla repite ~30 escaneos: lag en teléfonos modestos. | Calcular por ejercicio con `useMemo` según `exerciseId` + `workouts` (no depende de lo que se tipea) o precalcular un índice por ejercicio una vez. | alta | M | CONFIRMADO (código); impacto medible solo en el dispositivo |
| D2 | Bundle | Un solo archivo JS de **1,42 MB** (377 kB comprimido): sin carga diferida de rutas. Recharts, Firebase y la lista de íconos entran todos al arranque. | `vite build`; no hay `lazy(`/`Suspense` en `src` | Arranque más lento con mala conexión. | `React.lazy` para Progreso y Rutinas (los que traen Recharts y la biblioteca). Se espera sacar el aviso de >500 kB. | media | S | CONFIRMADO |
| D3 | Logros | `runAchievementCheck` hace 1–2 lecturas a Firestore (`getAchievements` + `getTabataRecordCount`) cada vez que cambia la lista de entrenamientos de Inicio, y Inicio recarga al volver a primer plano. | `Logros.jsx:390-406`; `achievements.js:265-267,408-412`; `Inicio.jsx` (`visibilitychange → reload()`) | Lecturas extra y trabajo en cada apertura. | Quitar la lectura de Tabata (al sacarla) y chequear solo tras guardar un entrenamiento. | baja | S | CONFIRMADO |
| D4 | Rutinas | `GeneradorTab` recalcula `recentMuscles` en cada render. | `GeneradorTab.jsx:24-32` | Menor. | `useMemo`. | baja | S | CONFIRMADO |

### E. Visual y UX (celular ~390 px, tema oscuro)

| ID | Sección | Qué pasa | Evidencia | Impacto | Propuesta | Sev. | Esf. | Estado |
|---|---|---|---|---|---|---|---|---|
| E1 | Resumen | Después de guardar, "Ver inicio" está **deshabilitado 5 segundos** y la pantalla se cierra sola a los 8. | `WorkoutSummary.jsx:75,100,115,240-243` | Contra "rapidez": hay que esperar antes de poder salir. | Botón siempre activo; autocierre más largo o ninguno. | media | S | CONFIRMADO |
| E2 | Registro | Cada entrenamiento pasa por 3 pantallas (tipo → detalle → sensación) + resumen. | `WorkoutWizard.jsx:271-346` | Un toque/pantalla más de lo necesario (sección 2.2). | Fusionar "sensación" en el paso de detalle. | media | M | CONFIRMADO |
| E3 | Registro fuerza | Botón "📊 Historial" es texto de 10 px sin relleno (zona táctil ~15 px); la X de eliminar ejercicio ~24 px. | `FuerzaFlow.jsx:290,305` | Difícil de tocar con precisión en pleno entrenamiento. | Zonas táctiles ≥44 px. | media | S | CONFIRMADO |
| E4 | Onboarding | 10 pasos antes de poder usar la app. | `Onboarding.jsx:26-37` | Fricción inicial (una sola vez). | Ver 2.2. | baja | S | CONFIRMADO |
| E5 | Navegación | La pestaña "Biblioteca" abre una pantalla que se llama Rutinas y tiene otra pestaña "Biblioteca" adentro. | `BottomNav.jsx:32`; `RutinasPage.jsx` | Confunde. | Renombrar a "Rutinas". | baja | S | CONFIRMADO |
| E6 | Inicio | La barra de "sin conexión" y la de "entrenamiento en curso" (si coinciden) apilan 84 px arriba de Inicio, que debe entrar sin scroll. | `Layout.jsx:28-30,36-65` | Quita altura útil en la pantalla que debería entrar en una vista. | Resolver con A2. | baja | S | SOSPECHA (no medí la altura en pantalla real) |

*Nota: no pude comprobar visualmente textos cortados ni "Inicio sin scroll" en un teléfono real (no hay sesión en este entorno). Recomiendo una pasada manual a 390 px después de las tandas 1–3.*

### F. Accesibilidad

| ID | Sección | Qué pasa | Evidencia | Impacto | Propuesta | Sev. | Esf. | Estado |
|---|---|---|---|---|---|---|---|---|
| F1 | General | 123 `<button>` y solo 3 `aria-label`. Sin nombre accesible: el botón principal "+" (`BottomNav.jsx:62`), cerrar de todos los modales (`Modal.jsx:18`), "volver" del registro (`WorkoutWizard.jsx:245,274`), cerrar de la barra (`Layout.jsx:54`), ↑/↓/✕ de rutinas (`PreArmadasTab.jsx:150-165`), expandir en Biblioteca (`BibliotecaTab.jsx:58,171`), eliminar ejercicio (`FuerzaFlow.jsx:305`). Los `<input>` de reps/peso no tienen etiqueta. | grep `aria-label` en `src` | Un lector de pantalla no anuncia qué hacen. | Agregar `aria-label` en esos ~10 botones (cambio de una línea cada uno). | media | S | CONFIRMADO |
| F2 | General | `prefers-reduced-motion` solo cubre el brillo de sugerencia y el giro de tarjeta. Quedan sin cubrir `pulse` (animación infinita en cargas), confeti, `fadeIn`/`scaleIn`/`slideUp`. | `index.css:25-49,62-65,102-110` | Personas sensibles al movimiento siguen viendo animación. | Extender el bloque de `@media` a esas clases. | baja | S | CONFIRMADO |
| F3 | General | Contraste: textos `text-[10px]` y `text-app-muted/40` (gris con 40 % de opacidad) sobre fondo casi negro (`FuerzaFlow.jsx:290,305`). | `FuerzaFlow.jsx:290,305` | Difícil de leer con luz del gimnasio. | Subir opacidad/tamaño en los textos de acción. | baja | S | SOSPECHA (no medí los ratios exactos) |

### G. Offline y PWA

| ID | Sección | Qué pasa | Evidencia | Impacto | Propuesta | Sev. | Esf. | Estado |
|---|---|---|---|---|---|---|---|---|
| G1 | Guardado | La app activa el caché persistente de Firestore (`persistentLocalCache`). Con eso, `addDoc` **no termina (ni falla) mientras no hay conexión**: queda en cola y se confirma al volver la red. Pero `saveWorkout` solo cae a la cola propia (`draftQueue`) si `addDoc` *falla* (`useWorkouts.js:56-75`). Por lo tanto, sin red es probable que se quede en "Guardando…" y la cola local nunca se use. El nuevo entrenamiento en curso quedaría guardado y, al reabrir, se ofrecería continuarlo: si Ro vuelve a guardar, **se duplica** el entrenamiento. | `firebase.js:18-22`; `useWorkouts.js:56-75`; `WorkoutWizard.jsx:165-177`; `draftQueue.js` | Es el escenario "mala conexión en el gimnasio". Riesgo de pantalla colgada y de duplicados. | **Probar primero**: modo avión → registrar y guardar → ver qué pasa. Si se confirma: guardar sin `await` (actualización optimista inmediata, como ya hace el resto) y usar el estado de "pendiente de escritura" de Firestore para el ícono ☁; quitar `draftQueue.js`. | alta | M | SOSPECHA (basada en el comportamiento documentado del SDK; no probado) |
| G2 | Lecturas | `getWorkouts` devuelve `[]` ante cualquier error en vez de fallar; `load()` entonces **sobrescribe el caché local con `[]`**. Su `catch` (que usaría el caché) nunca se ejecuta. | `db.js:49-56`; `useWorkouts.js:32-35` | Un error puntual (permiso, cuota) podría dejar la app "sin historial" y borrar el caché. | Que `getWorkouts` propague el error y `load()` use el caché. | media | S | CONFIRMADO (el código lo hace; que ocurra depende de cuándo falle Firestore) |
| G3 | Lecturas | `getCustomExercises`, `getCustomRoutines`, `getTabataSettings` no atrapan errores; algunas llamadas tampoco tienen `.catch`. | `db.js:170-224`; `FuerzaFlow.jsx:521,672-673`; `BibliotecaTab.jsx:94`; `PreArmadasTab.jsx:272,321,329` | Pantallas que se quedan "cargando" sin red. | Devolver `[]` y/o mostrar mensaje. | media | S | CONFIRMADO |
| G4 | Logros | `getAchievements` en Logros no tiene `.catch`. | `Logros.jsx:392,397` | Error silencioso sin red. | `.catch(() => {})`. | baja | S | CONFIRMADO |
| G5 | PWA | Lo que está bien: manifest completo, íconos presentes, `autoUpdate`, `navigateFallback`, aviso "sin conexión" y de "conexión restaurada". | `vite.config.js`; `Layout.jsx` | — | No tocar. | — | — | CONFIRMADO |

### H. Seguridad

| ID | Sección | Qué pasa | Evidencia | Impacto | Propuesta | Sev. | Esf. | Estado |
|---|---|---|---|---|---|---|---|---|
| H1 | Firestore | **No hay `firestore.rules` en el repo** y `firebase.json` no tiene clave `firestore`. Las reglas viven solo en la consola, sin control de versiones ni forma de revisarlas desde acá. Tampoco pude comprobar que cubran `users/{uid}/data/workoutInProgress` (nuevo). | `firebase.json`; búsqueda de `firestore.rules` | Es la barrera real de seguridad de los datos de Ro, y no se puede auditar. | Copiar las reglas actuales de la consola a `firestore.rules`, versionarlas y agregar `firestore` a `firebase.json`. Regla esperada: `match /users/{uid}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == uid; }`. | alta | S | SOSPECHA (no verificable desde el repo) |
| H2 | Cliente | La clave de Firebase está escrita en `firebase.js:6`. Es normal en apps web de Firebase (no es un secreto: la protección son las reglas y el dominio autorizado). | `firebase.js:5-12` | Ninguno si H1 está bien. | Revisar en la consola que los dominios autorizados sean solo `my-workout-ro.web.app`/`localhost`. | baja | S | CONFIRMADO (normal) |
| H3 | Dependencias | No hay claves de terceros (la de Claude ya se descartó, doc §9). | `package.json` | — | — | — | — | CONFIRMADO |

### I. Documentación

| ID | Sección | Qué pasa | Evidencia | Propuesta | Sev. | Esf. | Estado |
|---|---|---|---|---|---|---|---|
| I1 | LOGICA_TECNICA | Dice que el borrador del wizard vive en `sessionStorage` (clave `workoutDraft`); desde el cambio de "entrenamiento en curso" ya no es así. La sección 19 lo explica bien pero las secciones 13 siguen con la versión vieja. | `LOGICA_TECNICA.md:1236,1327` | Actualizar esas dos frases. | media | S | CONFIRMADO |
| I2 | CONTEXTO | `CONTEXTO.md:346` también menciona "persiste en el draft de `sessionStorage`". | `CONTEXTO.md:346` | Corregir. | media | S | CONFIRMADO |
| I3 | CONTEXTO | Lista archivos que **no existen**: `MuscleBalance.jsx`, `Streak.jsx`, `ValenciaCountdown.jsx`, `Intencion.jsx`, `ui/RestTimer.jsx`. Dice "~75 ejercicios" (son 90), "30 logros" (son 35), "Onboarding 8 pasos" (son 10). | `CONTEXTO.md:53,55,56,70,77,97,384,405`; listado de `src` | Alinear con el código actual. | media | S | CONFIRMADO |
| I4 | LOGICA_TECNICA | La sección 2 (nota al final) dice que Onboarding todavía guarda `profile.pausa`; es falso (la sección 11 lo contradice y el código no tiene `pausa`). Dice que `getWorkouts` limita a 100 con default 50 pero no advierte sus consecuencias (B1). Menciona `tabata` como workout registrado desde `TabataPage`, algo que el código no hace. | `LOGICA_TECNICA.md:157,1020-1021,711`; `Onboarding.jsx` | Corregir y agregar B1 como limitación conocida. | media | S | CONFIRMADO |
| I5 | Raíz | `ANALISIS-APP.md` (junio), `CHANGELOG.md` (junio, último cambio de 2025-06), `README.md` y `REGLAS-PROMPTS.md` no reflejan el estado actual. Hay cuatro fuentes de verdad además de las dos permanentes. | `ls *.md` (fechas) | Archivar o borrar los desactualizados (los que no son `CONTEXTO`/`LOGICA_TECNICA`); que queden dos. | baja | S | CONFIRMADO |

---

## 4. Quick wins (esfuerzo S, impacto visible)

1. **Quitar el bloque que borra ejercicios personalizados** (`FuerzaFlow.jsx:517-527`) — A3.
2. **`aria-label` en los ~10 botones sin nombre** — F1.
3. **"Ver inicio" sin espera de 5 s** (`WorkoutSummary.jsx`) — E1.
4. **Zonas táctiles ≥44 px** en "📊 Historial" y la X de eliminar + "Deshacer" — E3/A4.
5. **`ignoreUndefinedProperties: true`** en `initializeFirestore` — B4.
6. **`.catch` y devolver `[]` en lecturas** (`db.js:170-224`) y que `getWorkouts` no sobrescriba el caché con `[]` — G2/G3.
7. **`React.lazy` en Progreso y Rutinas** para bajar el aviso de 500 kB — D2.
8. **Unificar el aviso de "entrenamiento en curso"** (barra o modal) — A2.
9. **Renombrar "Biblioteca" → "Rutinas"** en la barra — E5.
10. **Borrar código muerto + `canvas-confetti`** — C5.
11. **Pasar el `firestore.rules` actual de la consola al repo** — H1.
12. **Corregir las 4 frases de documentación** — I1–I4.

---

## 5. Lo que funciona bien y NO tocaría

- **Precarga = última sesión real y sugerencias opcionales** ("¡Podés superarte!"): respeta el principio central; la lógica de pesos/progresión (`weights.js`, `progression.js`) está bien separada y tiene fundamentación clara en `LOGICA_TECNICA.md`.
- **Fechas como texto `YYYY-MM-DD` local** y helpers de `dates.js`: evitaron los errores de huso horario que ya habían aparecido.
- **Racha sin estados** (`streak.js`): simple, testeable, una sola fuente de verdad que ahora comparten Inicio y Progreso.
- **Funciones puras con `.js` explícito** (`reentry`, `routineGenerator`, `dailySuggestion`, `draftResolution`…): permiten verificar con scripts de Node sin simular la app. Es una práctica que vale mantener.
- **Caché persistente de Firestore + caché de `workouts` en localStorage + aviso de sin conexión**: la base de lo offline es buena (el problema está en el punto de guardado, G1).
- **Generador de rutinas con backtracking** y sugerencia de siguiente ejercicio: buena calidad y bien documentados.
- **Entrenamiento en curso** (local + nube, con vencimiento de 7 días): funciona como se pidió; solo hay que unificar el aviso (A2) y revisar su interacción con el guardado offline (G1).
- **Configuración de la PWA** (manifest, íconos, actualización automática).

---

## 6. Plan sugerido: orden de implementación (un cambio por prompt)

**Tanda 1 — seguridad de datos (primero, es lo que más duele perder)**
1. Versionar `firestore.rules` (H1) — solo copiar y verificar.
2. Probar G1 en modo avión; según resultado: arreglar el guardado sin conexión (y decidir sobre `draftQueue.js`).
3. Dejar de sobrescribir el caché con `[]` + `.catch` en lecturas (G2/G3/G4).
4. Quitar el borrado de ejercicios personalizados (A3).

**Tanda 2 — que el historial no se recorte**
5. "Primer entrenamiento"/totales sin depender de los últimos 100 (B1).

**Tanda 3 — sacar lo que no sirve**
6. Sacar Tabata (sección 2.1) y, de paso, la barra: Inicio · Rutinas · [+] · Progreso · Ajustes.
7. Sacar los 4 pasos del onboarding sin efecto y renombrar "Biblioteca" (B2/A5/A8/E5).
8. Borrar código muerto y dependencia sin uso (C5); fusionar medallas duplicadas.

**Tanda 4 — rapidez en el gimnasio**
9. Cálculos por ejercicio con `useMemo` (D1).
10. "Alternativa" solo con ejercicios existentes (A1) y `key` por ejercicio (A7).
11. Zonas táctiles + "Deshacer" al quitar ejercicio (A4/E3).
12. Unificar el aviso de "entrenamiento en curso" (A2).
13. "Ver inicio" sin espera (E1); evaluar fusionar el paso 3 en el 2 (E2).

**Tanda 5 — calidad**
14. `aria-label` y reduced-motion (F1/F2).
15. Un único calendario (A6) → después el entrenamiento híbrido (pendiente conocido).
16. `React.lazy` (D2).
17. Dividir `FuerzaFlow.jsx` (C1/C2) — conviene hacerlo *después* de las tandas anteriores para no mover código mientras se arregla.
18. Actualizar documentación (I1–I5) al final de cada tanda, no todo junto.

**Sobre los pendientes ya conocidos.** *Entrenamiento híbrido*: sube de prioridad conceptual por A6 (los calendarios ya se contradicen con dos entrenamientos el mismo día) — conviene unificar calendarios antes. *Ejercicios duplicados*: se suma el trío de tríceps y el nombre repetido "Face Pull" (C6). *Patrón para ejercicios personalizados*: el generador los excluye; y `FuerzaFlow.jsx:559` los guarda sin `pattern` — sin cambios de prioridad. *Imágenes animadas*: aumentarían el tamaño del bundle (D2) — conviene hacerlo después de la carga diferida.
