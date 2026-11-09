# Auditoría de la sección Progreso

Fecha: 09-11-2026 · Código analizado: `master` en el commit `0d47bec` · **No se modificó ningún archivo de la app** (solo este informe y `.gitignore`).

> **Alcance y método.** Se leyó el código de la pantalla y de todo lo que la alimenta, y se **ejecutó el código real** de `computeAll`/`computeTopExercises` (extraído tal cual de `ProgresoPage.jsx`), `computeStreak` y `detectPRs` con historiales **sintéticos** (ver el apéndice). Los ejemplos de este documento son inventados: no hay fechas, pesos ni valores de tus entrenamientos. Un "+100 %" que se vio en pantalla ya se confirmó como una mejora real de peso y no se vuelve a investigar.
>
> **Archivos que ya no existen.** `FatigueChart.jsx`, `WeekChart.jsx` y `MonthCalendar.jsx` se eliminaron en la limpieza de noviembre 2026 (commit `bb3b24d`, sin referencias). Hoy lo equivalente es el `WeekRow` (dentro de `ProgresoPage.jsx`) y `WorkoutHistorial.jsx` (calendario mensual). `CaminoCard` y `VictoriaCard` no son archivos propios: son componentes internos de `ProgresoPage.jsx` (líneas 198-226). `pages/Progreso.jsx` es un contenedor de 2 líneas que solo renderiza `ProgresoPage`.

---

## Resumen ejecutivo

1. **"Mayor progreso" y "Mejor marca" comparan la PRIMERA sesión con peso contra la ÚLTIMA (no la mejor)** y solo miran peso. Un ejercicio que mejora en segundos o repeticiones sin cambiar el peso es invisible; uno que subió y bajó puede mostrar un porcentaje menor al real o desaparecer. Ninguna de las dos tarjetas muestra valor inicial ni final.
2. **"mejor marca" no mide la mejor marca**: es el mayor aumento absoluto de kilos entre la primera y la última sesión.
3. **El texto cortado en "mejor marca" ("+N kg en {nombre recortado}") es un bug de datos/código, no de CSS**: el código recorta el nombre del ejercicio a sus 2 primeras palabras (`ProgresoPage.jsx:99`).
4. **La fatiga aparece como "victoria" y contradice la sugerencia de descarga.** Progreso promedia **todo el historial** y usa umbrales distintos a los de la descarga (`> 7` vs `>= 7`), que además promedia las **últimas 40 sesiones**. Un promedio apenas por encima del umbral se muestra redondeado igual que el umbral, pero en rojo y con "Entrenás al límite", mientras Configuración recomienda descarga.
5. **La "racha" no es necesariamente de semanas seguidas**: las semanas con 1-2 días no la cortan, así que "N sem." puede incluir semanas separadas. Se muestra **dos veces** en Progreso (y una tercera, como racha actual, en Inicio).
6. **"PRs históricos" cuenta eventos** (cada aumento de peso de cada ejercicio), no ejercicios distintos como el logro "Superaste 3 PRs". No llama a `detectPRs`. Los ejercicios sin peso (planchas, segundos sin carga) nunca generan PR.
7. **Hay 35 logros** (no 30): `CONTEXTO.md:387` quedó desactualizado; `LOGICA_TECNICA.md` dice 35 y es correcto.
8. **Rotulan "reps" aunque sean segundos** en 5 lugares de Progreso/Rutinas (lista en 3.8).
9. **Los ids `alt-…` fragmentan el historial**: cada vez que se usa una alternativa fuera del catálogo se crea un `exerciseId` único, que cuenta como un ejercicio distinto en todas las métricas.
10. **Diseño:** tipografías de 8-9 px, contraste insuficiente en etiquetas (hasta 1,88:1), tamaños de número desparejos (12-26 px) y tarjetas sin ninguna señal de que se puedan tocar. `FlipCard` se puede reutilizar, pero hay que generalizarlo (sección 4).

---

## 0. Cómo llegan los datos a la pantalla

```
WorkoutsProvider (src/context/WorkoutsContext.jsx)
   └─ useWorkouts()  → workouts: historial completo, fecha descendente, incluye borradores pendientes de sync
        └─ ProgresoPage.jsx
             ├─ computeAll(workouts)           → Tu camino, Tus victorias, encabezado, "Esta semana" (cantidad)
             ├─ computeTopExercises(workouts)  → "Principales progresiones"
             ├─ getCurrentStreak().record      → racha (utils/streak.js → computeStreak)
             ├─ WeekRow / UltimasSesiones      → "Esta semana" / "Últimas sesiones"
             ├─ ExerciseProgress               → "Ejercicios" (análisis por ejercicio)
             └─ WorkoutHistorial               → "Ver todo el historial" (calendario mensual)
```

### Convenciones comunes (valen para casi todos los números)

| Tema | Regla real del código |
|---|---|
| Tipos que cuentan | `REAL_WORKOUT_TYPES` = `fuerza`, `cardio`, `clase`, `tabata` (`utils/streak.js:5`). `pausa` nunca cuenta. `tabata` casi no existe en los datos: `saveTabataRecord` no tiene llamadores (hallazgo #10 de `LOGICA_TECNICA.md`). |
| Peso | `Number(s.weight) \|\| 0`: `""`, `null`, `undefined`, texto no numérico y `0` valen **0**. Un ejercicio en una sesión solo cuenta para las métricas de peso si su peso máximo de esa sesión es **> 0**. |
| "Primera sesión" | La **primera sesión con peso > 0**, no la primera sesión del ejercicio. Si un ejercicio empezó sin peso (peso corporal) y después se le agregó carga, la sesión sin peso se ignora. |
| "Última sesión" | La más reciente por fecha **con peso > 0**. |
| Ejercicios en `'secs'` | Los segundos viven en `reps` y ninguna métrica de Progreso los lee. Un ejercicio en `'secs'` participa **solo si tiene peso**, y solo por ese peso. Sin peso, es invisible. |
| Identidad del ejercicio | `exerciseId`. Las alternativas fuera del catálogo tienen id `alt-{índice}-{timestamp}` (único por uso), así que cada uso es "otro ejercicio". |
| Orden | Se asume `workouts` en fecha descendente (lo garantiza `composeWorkoutList`); `computeAll` reordena ascendente por su cuenta. Con empate de fecha manda el orden del arreglo. |
| Borradores | Los workouts pendientes de sync (`_pendingSync`) se cuentan como cualquier otro. |

---

## 1. Encabezado

| Texto | Cálculo | Veredicto |
|---|---|---|
| "¡Llevas un camino increíble, {nombre}! 🚀" (`ProgresoPage.jsx:421-424`) | `profile?.name ?? 'campeón'/'campeona'`. | ⚠️ **Menor.** "Llevas" no usa el voseo del resto de la app ("Seguí entrenando", "Llevás"). Si el nombre quedó como cadena vacía (el onboarding lo permite), `??` no cae al valor por defecto y queda "¡…, !". El mensaje es siempre festivo, aunque el usuario lleve semanas sin entrenar. |
| "{total} entrenamientos · {months} meses entrenando" (`:425-427`) | `total`, `months`: ver 2.1 y 3.6. | ⚠️ Repite el mismo número de la primera tarjeta de "Tu camino". `months` es una diferencia de meses de calendario (3.6). |

---

## 2. Cada número de "Tu camino" y "Tus victorias"

Todo sale de `computeAll(workouts)` (`ProgresoPage.jsx:39-123`) salvo la racha.

### 2.1 Tu camino

#### 🏋️ "entrenamientos totales" (`total`)
- **Dónde:** `computeAll`, líneas 40-41.
- **Fórmula:** `workouts.filter(w => REAL_TYPES.has(w.type) && w.date).length`.
- **Cuenta:** cada registro de `fuerza`, `cardio`, `clase` y `tabata`. **Dos entrenamientos el mismo día cuentan 2.** Excluye `pausa` y registros sin fecha.
- **secs / peso corporal / 0 kg:** no aplica (no mira ejercicios).
- **Veredicto:** ✅ **Correcto**, pero ⚠️ se repite en el encabezado y no se distingue de "días únicos" (3.6). Ejemplo: 4 registros (2 el mismo día, 1 pausa) → `total = 3`, `uniqueDays = 2`.

#### 🔥 "récord de racha" (`record`)
- **Dónde:** `useWorkouts().getCurrentStreak()` → `computeStreak` (`utils/streak.js:17-59`).
- **Fórmula:** se recorre cada semana (lunes a domingo) desde la primera hasta la actual. Semana con **3 o más días únicos** → `current + 1` y se actualiza `record`; semana con **1-2 días** → ni suma ni corta; semana con 0 días (ya cerrada) → cuenta como vacía y, tras **4 vacías seguidas**, `current = 0`. `record` es el mayor `current` alcanzado.
- **secs / peso:** no aplica. Cuenta cualquier tipo real.
- **Veredicto:** ⚠️ **Engañoso en la etiqueta.** `record` es "la máxima cantidad acumulada de semanas con 3+ días sin cortes largos", no "N semanas seguidas". Con semanas de 3, 1, 3, 2, 3, 1 y 3 días el resultado es **4** aunque no haya dos buenas semanas juntas (comprobado, apéndice caso I). El logro "Racha de fuego" (`achievements.js:14,312`) dice "4 semanas seguidas con 3+ días" y usa este mismo `record`, así que hereda la ambigüedad. Además el umbral de 3 días es fijo y no respeta el objetivo del perfil (`diasSemana`).

#### 🏆 "PRs históricos" (`totalPRs`)
- **Dónde:** `computeAll`, líneas 55-74.
- **Fórmula:** se ordenan los `fuerza` por fecha ascendente; para cada ejercicio de cada sesión, `maxW` = peso máximo de la sesión; si `maxW <= 0` se ignora; si `maxW > bestSoFar[id]` y `bestSoFar[id]` ya existía, `totalPRs++` y se actualiza el mejor. **No llama a `detectPRs`**: reimplementa la misma idea con su propio bucle.
- **Qué cuenta:** **eventos**. Un ejercicio que sube de 5 a 7,5 a 10 a 12,5 kg suma **3 PRs** (comprobado, caso E). El logro "Superaste 3 PRs" (`achievements.js:93-108`, `computePRData`) cuenta ejercicios **distintos** (`prSet.size`), de modo que ambos números no son comparables.
- **secs / peso corporal / 0 kg:** un ejercicio sin peso (plancha, segundos sin carga, peso corporal) **nunca** genera PR; uno en segundos con peso solo cuenta por el peso. La primera sesión con peso fija la base y **no** es PR (correcto). Un récord de segundos o de repeticiones nunca cuenta.
- **Veredicto:** ⚠️ **Engañoso.** Las subidas chicas y frecuentes (típicas de mancuernas livianas) inflan el número, y el nombre sugiere "récords distintos". Es coherente con `detectPRs` sesión por sesión, pero no con los logros.

#### 📅 "días únicos entrenados" (`uniqueDays`)
- **Dónde:** `computeAll`, línea 53.
- **Fórmula:** `new Set(real.map(w => w.date)).size`, sobre los mismos workouts reales de `total`.
- **Veredicto:** ✅ **Correcto.** Es la misma definición que usa el logro "100 días entrenados" (`achievements.js:326-328`). La diferencia con `total` son los días con más de un entrenamiento.

#### 📈 "mayor progreso" (`mayorProgresoVal` + `mayorProgresoName`)
- **Dónde:** `computeAll`, líneas 55-84.
- **Fórmula:** por ejercicio, `exFirst` = peso máximo de su primera sesión con peso > 0; `exLast` = peso máximo de su última sesión con peso > 0 (se sobrescribe en cada sesión). `pct = (exLast − exFirst) / exFirst × 100`. Se muestra el ejercicio con el mayor `pct`, redondeado (`Math.round`); si el mayor `pct` es ≤ 0 muestra "—". Desempate: el primero que se haya encontrado.
- **secs / peso corporal / 0 kg / `""`:** se ignoran por completo las sesiones con peso 0. Un ejercicio **sin peso nunca aparece**; uno que empezó sin peso toma como "inicial" su primera sesión con carga.
- **Primera sesión:** con una sola sesión con peso, `exFirst = exLast` → 0 % → no entra.
- **Veredicto:** ❌/⚠️ **Engañoso** (detalle en 3.1): compara con la **última**, no con la mejor; no ve segundos ni repeticiones; no muestra valor inicial ni final; se dispara con cargas iniciales chicas (2 → 4 kg es "+100 %").

#### ⭐ "más trabajado" (`masEntrenadoVal` + `masEntrenadoName`)
- **Dónde:** `computeAll`, líneas 61-74 y 86-91.
- **Fórmula:** `exSessions[id]++` por **cada sesión `fuerza` en la que ese ejercicio tiene peso máximo > 0**. Se muestra el ejercicio con más sesiones, como "N ses.". Desempate: el primero encontrado.
- **Qué cuenta:** **sesiones**, no series ni repeticiones ni volumen, y **solo sesiones con peso**.
- **secs / peso corporal:** quedan fuera. Una plancha hecha 6 veces sin peso pierde contra un ejercicio con peso hecho 3 veces (comprobado, caso F). Los ids `alt-…` cuentan cada uso por separado.
- **Veredicto:** ⚠️ **Engañoso.** El texto "más trabajado" sugiere volumen o frecuencia total, pero es "ejercicio con carga que más sesiones tuvo".

### 2.2 Tus victorias

#### 🏆 "mejor marca" (`mejorMarcaVal` + `mejorMarcaSub`)
- **Dónde:** `computeAll`, líneas 93-99.
- **Fórmula:** `d = exLast − exFirst` por ejercicio (mismos `exFirst`/`exLast` que "mayor progreso"); se muestra el mayor `d` positivo como "+Nkg" y debajo `en {nombre.split(' ').slice(0, 2).join(' ')}`.
- **secs / peso corporal / 0 kg:** igual que "mayor progreso".
- **Veredicto:** ❌ **Erróneo en el nombre y en el texto.** No es la mejor marca (la mejor marca sería el mayor peso alcanzado); es el mayor aumento absoluto entre la primera y la última sesión. Y el recorte a 2 palabras rompe el nombre (3.4). Además suele coincidir con el ejercicio de "mayor progreso", así que informa casi lo mismo dos veces.

#### 🔥 "récord de racha"
- Mismo `record` que en "Tu camino". Ver 3.3. ⚠️ Duplicado.

#### 💪 Fatiga (valor + subtítulo + "fatiga")
- **Dónde:** `computeAll`, líneas 101-104; color y subtítulo en `ProgresoPage.jsx:398-406`.
- **Fórmula:** promedio simple de `fatigue` de **todos** los workouts reales con `fatigue != null`, **sin ventana de tiempo**; se muestra solo si hay **3 o más**. Valor mostrado: `toFixed(1)`.
- **Color y mensaje:** `<= 5` verde "Recuperación óptima 💪"; `<= 7` ámbar "Carga bien gestionada"; `> 7` rojo "Entrenás al límite 🔥".
- **Veredicto:** ❌/⚠️ **Contradice otras partes de la app** (3.2). El slider del registro arranca en 5 y se guarda tal cual, así que un 5 puede significar "no toqué el control"; esos valores diluyen el promedio.

### 2.3 Otros bloques de la pantalla

| Bloque | Cálculo | Veredicto |
|---|---|---|
| **"Esta semana"** (`:459-471`, `WeekRow` `:231-279`) y el texto "X de Y días · …" | `thisDays` = días únicos reales de lunes a hoy; `Y = profile.diasSemana ?? 3`; `semanaOK = thisDays >= Y × 0.5`; mensaje: 0 → "¡arrancá hoy!", `semanaOK` → "¡vas bien!", si no "¡vamos!". El círculo marca solo el primer workout de cada día. | ⚠️ **Menor.** "¡vamos!" aparece el lunes aunque la semana recién empieza (no mira cuánto falta); con meta 3 alcanza con 2 días para "vas bien" (1,5). Reimplementa el cálculo del lunes (`:106-113`) que ya existe en `utils/dates.js` (`getWeekStartLocal`). |
| **"Principales progresiones"** (`computeTopExercises`, `:126-167`, UI `:475-516`) | Recorre `fuerza` en orden ascendente y emite un **evento** por cada mejora respecto del estado previo del ejercicio: `weight` (subió el peso), `reps` (mismo peso, más repeticiones) o `double`. Se muestran **los 3 eventos más recientes**. | ❌/⚠️ **El título engaña**: no son las principales (mayores), son las **últimas 3**. El mismo ejercicio puede ocupar las 3 filas (comprobado, caso J). Ejercicios sin peso no generan eventos. Los eventos `reps` de ejercicios en segundos con peso se rotulan "reps" (3.8). Un salto grande y antiguo queda afuera por antigüedad. |
| **"Ejercicios"** (`ExerciseProgress.jsx`) | Ver 3.9. | ⚠️ Varias observaciones. |
| **"Últimas sesiones"** (`UltimasSesiones`, `:290-366`) | Las 5 primeras de la lista (se asume orden descendente). Badge **PR** si `detectPRs(w, workouts con fecha estrictamente anterior)` no es vacío (solo `fuerza`). Etiqueta de fatiga por sesión: `<= 3` "liviana", `<= 6` "moderada", si no "alta". Fecha con `formatDistanceToNow` ("hace alrededor de…"). | ✅ El PR usa `detectPRs` correctamente (solo peso). ⚠️ La escala de fatiga por sesión (3/6) es otra distinta de las demás (3.2). ⚠️ La fecha relativa de date-fns ("hace alrededor de 1 mes") no coincide con el formato de "Principales progresiones" ("hace 3 sem."). |
| **"Ver todo el historial"** (`WorkoutHistorial.jsx`) | Calendario mensual; `byDate` guarda **un solo** workout por día (el primero de la lista). | ⚠️ Si hubo dos entrenamientos el mismo día, el segundo no se ve. El detalle muestra "Cansancio: {fatigue}/10" aunque `fatigue` falte (muestra "/10"). Ya muestra "seg" correctamente. |

---

## 3. Revisión puntual

### 3.1 "Mayor progreso" (y "mejor marca")

**¿Qué pasa con un ejercicio que mejora en segundos o repeticiones pero no en peso?**
Nada: es **invisible**. Comprobado (caso B): una plancha sin peso que pasa de 40 a 50 a 60 seg da "—" en mayor progreso, "—" en más trabajado, "—" en mejor marca y 0 PRs. Lo mismo vale para un ejercicio en repeticiones de peso corporal. En un ejercicio en segundos **con** peso, los segundos tampoco intervienen: el porcentaje sale solo del peso (caso C).

**¿Compara la primera sesión con la última o con la mejor?**
**Con la última.** Comprobado (caso A): pesos 10, 20 y 15 kg (mejor = 20, última = 15) dan **+50 %**, no +100 %. Si el último registro es peor que el primero, el ejercicio sale del ranking; si todos los ejercicios retrocedieron, la tarjeta muestra "—" aunque haya habido PRs. Una descarga o una sesión liviana justo antes de mirar la pantalla "borra" el progreso.

**¿Tiene sentido mostrar un % sin el valor inicial y el final?**
No. Un porcentaje solo es comparable entre ejercicios si se conoce la base: **2 → 4 kg y 100 → 200 kg son ambos "+100 %"**, y el primero casi siempre es el de una mancuerna liviana con un salto de un escalón. Tampoco se sabe en cuánto tiempo ocurrió. Recomendación: mostrar siempre "valor inicial → valor final" (con su unidad) y el período, y elegir el ejercicio por mejora **relativa a un mínimo de carga** o por mejor mejora de la mejor marca, no de la última.

### 3.2 Fatiga: "Entrenás al límite" como victoria vs. la sugerencia de descarga

**Qué período promedia cada lugar:**

| Lugar | Datos | Ventana | Tratamiento de faltantes | Umbral |
|---|---|---|---|---|
| Progreso, tarjeta de fatiga (`ProgresoPage.jsx:101-104`) | workouts reales (fuerza, cardio, clase, tabata) con `fatigue != null` | **Todo el historial** | Se excluyen | Rojo y "al límite" si **`> 7`**; ámbar hasta `7` inclusive |
| Configuración, banner de descarga (`ConfigPage.jsx:106-109,254-258`) | los 40 registros más recientes de **cualquier tipo** (incluye `pausa`) | **Últimos 40 registros** (no es un período de tiempo: son ~8 semanas solo si se entrena 5 veces por semana) | `fatigue ?? 5` (un faltante cuenta como 5) | Sugiere descarga si **`>= 7`** y hay al menos 8 registros |
| `useDeload.shouldSuggestDeload` (`hooks/useDeload.js:7-14`) | igual que Configuración (40 más recientes, `?? 5`) | Últimos 40 | `?? 5` y luego `filter(Boolean)` (no hace nada) | `>= 7` |

**La contradicción.**
1. **Mismo dato, dos mensajes:** el promedio histórico de Progreso puede estar en "Carga bien gestionada" (por ejemplo, 6,9) mientras el de los últimos 40 registros llega a 7,2 y Configuración recomienda descarga. Y un promedio apenas por encima del umbral (por ejemplo 7,04) se muestra redondeado a un decimal igual que el umbral exacto (7,0), pero en **rojo** con "Entrenás al límite" (porque `7,04 > 7`), mientras que un promedio exacto de 7 sale ámbar "bien gestionada" y a la vez dispara la descarga (`>= 7`). El redondeo a un decimal oculta el motivo del color (comprobado con 24 sesiones de 7 y una de 8 → promedio 7,04, que `toFixed(1)` muestra como 7,0 y es `> 7`).
2. **Está en el lugar equivocado:** una fatiga alta no es una victoria. "Tus victorias" la presenta con 💪, y a partir de 7 con 🔥 y color de alerta (rojo), lo que alienta justo lo que la app (descarga) intenta moderar.
3. **Ventana equivocada:** promediar toda la historia diluye lo reciente; para decidir descarga importan las últimas semanas, y para celebrar importa una tendencia, no un promedio de vida.
4. **Datos contaminados:** el slider del registro empieza en 5 y se guarda `Number(fatigue) || 5`; `GeneradorTab`/`Inicio` crean borradores con `fatigue: 5`. No se puede distinguir un 5 elegido de un 5 por defecto. Las sesiones de cardio y clase se promedian junto con las de fuerza.
5. **Cuatro escalas distintas para lo mismo:**

| Dónde | Bajo / Medio / Alto |
|---|---|
| Wizard (`WorkoutWizard.jsx:294-314`) | 1-4 / 5-7 / 8-10 |
| Resumen post-guardado y detalle de historial (`WorkoutSummary.jsx:188`, `WorkoutHistorial.jsx:156-158`) | colores: ≤ 4 verde, ≤ 7 ámbar, > 7 coral |
| "Últimas sesiones" (`ProgresoPage.jsx:307-309`) | ≤ 3 liviana, ≤ 6 moderada, > 6 alta |
| Tarjeta de fatiga y descarga | ≤ 5 / ≤ 7 / > 7 (Progreso) y ≥ 7 (descarga) |

**Qué haría falta:** una sola constante de umbrales; promediar una ventana reciente (por ejemplo las últimas 4 semanas, solo con fatiga registrada de verdad); decidir si el dato vive en "victorias" (probablemente no) o en una tarjeta neutra de "Carga/cansancio" con la tendencia; y que Progreso y Configuración usen la misma función (hoy `useDeload.shouldSuggestDeload` está **sin usar**: Configuración reimplementa la cuenta).

### 3.3 La racha duplicada

- Aparece en **"Tu camino"** (`ProgresoPage.jsx:435`) y en **"Tus victorias"** (`:448`) con el mismo valor (`record`) y la misma etiqueta. Es redundante y ocupa una de las 3 tarjetas de victorias.
- En **Inicio** (`pages/Inicio.jsx:640-650`) se muestra la racha **actual** ("racha semanal") con la tarjeta que gira. Progreso muestra el **récord**. Nadie ve en Progreso la racha actual, que es la más motivadora.
- Recomendación: dejarla una sola vez (en Tu camino), mostrar actual **y** récord ("actual N · récord M"), y reemplazar la tarjeta de victorias por otra métrica (por ejemplo "mejor semana" o "último PR").

### 3.4 El texto cortado de "mejor marca" ("+N kg en …")

**Es un bug de datos/código, no de CSS.** Causa (`ProgresoPage.jsx:99`):

```js
const mejorMarcaSub = maxDelta > 0 ? `en ${maxDeltaEx.split(' ').slice(0, 2).join(' ')}` : ''
```

Se queda con las **2 primeras palabras** del nombre y le antepone "en". Para un ejercicio llamado "Press de pecho inclinado" produce "en Press de"; para "Sentadilla búlgara con mancuernas", "en Sentadilla búlgara" (comprobado, caso D). Los nombres cuyas dos primeras palabras terminan en una preposición ("… en el lugar", "… de …", "… con …") quedan sin sentido.

El CSS no corta nada acá: el subtítulo de `VictoriaCard` no tiene `truncate`, se ajusta en varias líneas. (En cambio el nombre de "mayor progreso"/"más trabajado" **sí** se corta con puntos suspensivos por CSS: `CaminoCard` usa `truncate` a 9 px, línea 207.)

**Qué debería decir:** el nombre **completo**, con un recorte visual por CSS (`line-clamp-2`) y, si falta lugar, "+N kg" arriba y debajo "{ejercicio}: {valor inicial} → {valor final} kg". Es decir, sin prefijo "en" y sin truncar por palabras.

### 3.5 "PRs históricos" y `detectPRs()`

- **¿Usa `detectPRs()`?** **No.** `computeAll` (líneas 55-74) tiene su propio bucle. `detectPRs` (`utils/prUtils.js`) se usa en `UltimasSesiones` (badge "🏆 PR" por sesión), `WorkoutSummary` y `Logros`.
- **Coherencia:** ambos usan peso máximo de sesión, exigen peso > 0, estricto `>` y excluyen la primera sesión con peso (la base). Sumando `detectPRs` sesión por sesión daría lo mismo que `totalPRs`; no están acoplados, así que pueden divergir si alguien cambia uno.
- **Distinto del logro:** `achievements.js:93-108` (`computePRData`) cuenta **ejercicios distintos con algún PR**; Progreso cuenta **eventos**.
- **Ejercicios en `'secs'`:** solo producen PR si tienen **peso** (por el peso). Sin peso, nunca; los segundos no cuentan. Un mejor tiempo no es un PR en esta app.

### 3.6 "Días únicos", "entrenamientos totales" y "N meses entrenando"

**Días únicos vs. entrenamientos totales.** Confirmado:
- `total` (`:41`) = cantidad de registros reales (`fuerza`, `cardio`, `clase`, `tabata` con fecha).
- `uniqueDays` (`:53`) = `new Set(fechas).size` sobre esos mismos registros.
- `total >= uniqueDays` siempre; la diferencia son los días con 2 o más entrenamientos (por ejemplo una clase y una sesión de fuerza el mismo día). Ambos números ya usan la misma base que los logros "50/100 entrenamientos" y "100 días entrenados".

**"N meses entrenando".** Confirmado (`ProgresoPage.jsx:43-51`):

```js
months = Math.max(1, (hoy.año − primero.año) × 12 + (hoy.mes − primero.mes))
```

donde `primero` es la fecha del workout real **más antiguo**.
- Es una **diferencia de meses de calendario**, no de meses completos: un primer entrenamiento el 28 del mes pasado da **1** (aunque pasaron dos semanas); uno de hace 7 meses de calendario da 7 (comprobado, caso G).
- **No descuenta parates ni pausas:** "entrenando" incluye meses enteros sin ninguna sesión.
- Mínimo 1 si hay historial, 0 si no hay nada.
- Mejor redacción posible: "desde {mes año}" o "{N} meses desde tu primer entrenamiento".

### 3.7 "Más trabajado"

Cuenta **sesiones** (workouts de fuerza) en las que el ejercicio tuvo peso > 0. **No** cuenta series, repeticiones ni volumen (kg × reps × series), y descarta ejercicios sin peso y en segundos sin carga. Ver 2.1 para el efecto con ids `alt-…` y empates.

### 3.8 Lugares donde se rotula "reps" aunque el ejercicio sea en segundos

| # | Archivo y línea | Texto | Qué pasa con un ejercicio en `'secs'` |
|---|---|---|---|
| 1 | `ProgresoPage.jsx:483` | `+{deltaW}kg · +{deltaR} reps` (evento `double` de "Principales progresiones") | Los segundos se rotulan "reps". |
| 2 | `ProgresoPage.jsx:486` | `+{deltaR} reps` (evento `reps`) | Idem (comprobado, caso J: 40 → 45 → 50 seg a peso fijo salen "+5 reps"). |
| 3 | `ProgresoPage.jsx:491` | `{weight}kg × {reps}` | Muestra "10kg × 45" para 45 segundos. |
| 4 | `ExerciseProgress.jsx:145` | `{count}×{reps} · {weight}kg` ("Última serie") | "3×45" sin unidad; además dice "Última serie" pero resume la **última sesión** (series × repeticiones de la serie con más peso). |
| 5 | `GeneradorTab.jsx:49,163` | `{sets}×{repsScheme}` con `repsScheme: '12'` para todos | Una rutina generada muestra "3×12" también para planchas y otros ejercicios en segundos. |

Fuera de Progreso ya están corregidos (sección 24 de `LOGICA_TECNICA.md`): historiales, calendario semanal, biblioteca, resumen y registro. Además, `ProgresoPage.jsx:125` y `prUtils.js` hablan de "reps" en comentarios y datos internos (no se ven).

### 3.9 `ExerciseProgress` ("Ejercicios")

- **Lista inicial:** sin texto de búsqueda muestra `exercisesWithHistory.slice(0, 5)` (`:35`): los **primeros 5 por orden alfabético**, no los más recientes ni los más usados. Hay que escribir para encontrar el resto.
- **Duplicados:** los ids `alt-…` aparecen como ejercicios separados, posiblemente con el mismo nombre.
- **Gráfico y PR:** `weight` = peso máximo de cada sesión; en ejercicios sin peso es una línea plana en 0 y el encabezado dice "PR histórico 🏆 0kg" (`:149-157`).
- **"Necesitás al menos 2 sesiones":** cuenta sesiones aunque el peso sea 0.
- **Sin unidad:** el eje y el tooltip dicen siempre "kg" (`:11`).
- **Recharts:** el gráfico de 140 px de alto no entra en el dorso de una tarjeta de 108 px (ver 4).

### 3.10 ¿Cuántos logros hay realmente?

**35 permanentes** (`ACHIEVEMENTS_META`, `utils/achievements.js:8-50`: Consistencia 11, Fuerza 9, Cardio 5, Balance 5, Especiales 5; claves únicas, comprobado por script). Además hay **4 medallas semanales** tomadas de un pool de **12** (`MEDAL_POOL`, `Logros.jsx:74`), que no son logros permanentes.
- `LOGICA_TECNICA.md` dice 35 (líneas 637, 888, 920): ✅ correcto.
- `CONTEXTO.md:387` dice **30**: ❌ desactualizado.
- Nota: "Tabata master" es inalcanzable hoy (hallazgo #10 de la sección 21 de `LOGICA_TECNICA.md`).

---

## 4. Futura tarjeta que gira: datos disponibles y qué hay que calcular

### 4.1 Qué se puede mostrar en el dorso de cada tarjeta

Leyenda: ✅ ya está disponible · 🟡 hay que calcularlo con datos existentes · ❌ habría que agregar un dato.

#### Tu camino

| Tarjeta | Valor y fecha inicial | Valor y fecha del mejor registro | Cantidad de sesiones | Evolución | Unidad |
|---|---|---|---|---|---|
| 🏋️ Entrenamientos totales | 🟡 fecha del primer entrenamiento (mínimo de `date`) | 🟡 mejor mes / mejor semana | ✅ `total` | 🟡 conteo por mes (se arma recorriendo `real`) | entrenamientos; 🟡 desglose por tipo (fuerza / cardio / clase / tabata) |
| 🔥 Récord de racha | ❌ `computeStreak` no guarda cuándo empezó/terminó el récord | ❌ idem (hace falta registrar semana de inicio y fin del récord) | 🟡 semanas con 3+ días | ✅ `computeStreakStats(workouts, hoy)` ya devuelve el reparto de las últimas 12 semanas (0, 1-2, 3-4, 5+ días); hoy lo usa el dorso de Inicio | semanas; ✅ racha actual (`current`) |
| 🏆 PRs históricos | 🟡 el primer PR (hay que guardar el evento, hoy solo se incrementa un contador) | 🟡 último PR y mayor salto: el bucle de `computeAll` ya los detecta pero no los conserva | 🟡 cantidad de ejercicios distintos con PR | 🟡 lista de eventos (ejercicio, peso, fecha) | kg |
| 📅 Días únicos | 🟡 primer y último día | 🟡 mes con más días | ✅ `uniqueDays` | 🟡 días por mes / por día de la semana | días |
| 📈 Mayor progreso | 🟡 valor inicial: **ya está** (`exFirst`), falta la **fecha** (no se guarda) | ✅ `bestSoFar` (mejor peso); fecha 🟡 | 🟡 `exSessions` solo cuenta sesiones con peso | ✅ `getExerciseSessions(id)` del hook trae fecha y series de cada sesión | ✅ `getExerciseUnit`; kg (y seg si es `'secs'`) |
| ⭐ Más trabajado | 🟡 primera y última fecha del ejercicio | 🟡 mejor peso | ✅ `exSessions` (sesiones con peso) | ✅ `getExerciseSessions(id)` | ✅ unidad del ejercicio |

#### Tus victorias

| Tarjeta | Valor y fecha inicial | Valor y fecha del mejor registro | Cantidad de sesiones | Evolución | Unidad |
|---|---|---|---|---|---|
| 🏆 Mejor marca | ✅ `exFirst`, fecha 🟡 | ✅ `exLast` y `bestSoFar`; fechas 🟡 | 🟡 sesiones del ejercicio | ✅ `getExerciseSessions(id)` | kg; ✅ `getExerciseUnit` |
| 🔥 Récord de racha | igual que arriba (duplicada) | igual | igual | igual | igual |
| 💪 Fatiga | 🟡 primer registro con fatiga | 🟡 semana más baja / más alta | ✅ cantidad de sesiones con fatiga (`allFatigues.length`) | 🟡 promedio por semana (`checkEnergiaAlza` ya lo calcula para el logro) y tendencia reciente | puntos de 1 a 10 |

**Lo que hace falta calcular, en síntesis:** (a) conservar **fechas** junto a los valores que hoy solo se guardan como número (`exFirst`, `exLast`, `bestSoFar`); (b) un módulo `computeProgressStats(workouts)` fuera del componente que devuelva, por tarjeta, `{ valor, inicial: {valor, fecha}, mejor: {valor, fecha}, sesiones, serie, unidad }`; (c) registrar en `computeStreak` la semana de inicio y fin del récord; (d) una ventana reciente para fatiga; (e) la unidad (`getExerciseUnit`) y el formato `formatSetText` para mostrar segundos y repeticiones correctamente.

### 4.2 ¿Se puede reutilizar `FlipCard.jsx` tal cual?

**Parcialmente.** `FlipCard` (`components/ui/FlipCard.jsx`, 25 líneas) ya resuelve el giro 3D (`.flip-card/.flip-inner/.flipped` en `index.css:68-83`), el `prefers-reduced-motion` y etiquetas de accesibilidad personalizables (`flipLabel`, `unflipLabel`). Solo lo usa Inicio, para la racha (`pages/Inicio.jsx:629-650`, con `height="108px"`). `Logros.jsx:259-273` tiene su propia versión, que no es accesible por teclado (un `div` con `onClick`).

**Se puede usar tal cual si** la tarjeta mide **exactamente** una altura fija conocida (por ejemplo 108 px) y el dorso entra en ella. **No alcanza** para el detalle completo por estas razones:

| Limitación | Efecto | Qué generalizar |
|---|---|---|
| Altura **fija** obligatoria (`height`, por defecto 108 px); las caras son `position: absolute` | Las tarjetas actuales de "Tu camino" tienen altura natural (~90-100 px) y la grilla las iguala. El dorso con valor y fecha inicial, mejor registro, sesiones y evolución no entra en 108 px. | Modo de altura automática: apilar frente y dorso en la **misma celda de una grilla** (`grid-area: 1/1`) para que la altura sea la del más alto; o permitir `min-height` y dorsos con scroll. |
| El contenedor es un `<button>` con `div` adentro | HTML inválido (un botón solo admite contenido de frase) y **no puede haber controles interactivos en el dorso** (por ejemplo "Ver gráfico"). | Cambiar a `div role="button" tabIndex={0}` con manejo de Enter/Espacio, o separar el control de giro del contenido. |
| Estado interno sin control externo | No se puede mantener **una sola tarjeta girada** a la vez ni girar desde afuera. | Props `flipped` / `onFlip` (modo controlado) o un contexto de "tarjeta abierta". |
| Etiquetas genéricas por defecto ("Ver más"/"Volver") | Lectores de pantalla no saben qué tarjeta es. | Ya admite props; hay que pasarlas siempre ("Ver detalle de mayor progreso"). |
| Fondo y bordes los define quien la usa | Inicio, Camino (`#1a1625`) y Victoria (`#1e1830`) usan colores distintos; cada cara repite el estilo. | Un componente de tarjeta de métrica común (fondo, borde, radio) que reciba `front` y `back`. |
| Gráfico (`recharts`, 140 px) | No entra en el dorso. | En el dorso, una línea/sparkline SVG liviana; el gráfico completo, en un modal o en la sección "Ejercicios". |
| CSS duplicado | `.flip-card-inner`, `.flip-face`, `.flip-face-back` (`index.css:85-100`) no los usa ningún JSX. | Eliminar al unificar. |

---

## 5. Puntos de mejora (priorizados)

Esfuerzo estimado: **S** (horas), **M** (un día), **L** (varios días).

### 🔴 Crítico (números o textos que inducen a error)

| # | Qué | Dónde | Por qué importa | Esfuerzo |
|---|---|---|---|---|
| C1 | **"Mayor progreso" y "Mejor marca" comparan primera vs. última sesión con peso, solo en kg**, sin valores inicial/final | `ProgresoPage.jsx:55-99` | Una descarga reciente oculta el progreso; el % depende de la carga inicial; ejercicios por segundos/repeticiones/peso corporal son invisibles; el ranking premia pesos chicos. | M |
| C2 | **"mejor marca" no es la mejor marca** (es el mayor aumento absoluto) y casi siempre repite "mayor progreso" | `:93-99` | El nombre promete algo que el número no es. | S |
| C3 | **Texto cortado "+N kg en {2 palabras}"** | `:99` | Texto sin sentido en una tarjeta principal; el recorte es del código. | S |
| C4 | **Fatiga como "victoria" y contradicción con la sugerencia de descarga** (promedio histórico, `> 7` vs `>= 7`, ventana de 40 registros, `?? 5`, 4 escalas) | `ProgresoPage.jsx:101-104,398-406`, `ConfigPage.jsx:106-109`, `useDeload.js` | Mensajes opuestos sobre el mismo dato; premia el exceso; el redondeo a un decimal oculta por qué cambia el color. | M |

### 🟠 Importante

| # | Qué | Dónde | Detalle | Esfuerzo |
|---|---|---|---|---|
| I1 | **"Principales progresiones" muestra las 3 más recientes**, no las principales; el mismo ejercicio puede repetirse | `:126-167` | Título engañoso; ejercicios sin peso no aparecen. | S-M |
| I2 | **Racha: etiqueta y semántica** ("N sem." no son seguidas); duplicada en Camino y Victorias; falta la racha actual | `streak.js`, `:435,448` | Reemplazar una tarjeta; mostrar actual y récord; aclarar "semanas con 3+ días". | S |
| I3 | **"PRs históricos" cuenta eventos**, no ejercicios; no usa `detectPRs`; difiere de los logros | `:55-74` vs `achievements.js:93-108` | Unificar la definición en una función compartida. | M |
| I4 | **"Más trabajado" solo cuenta sesiones con peso**; ignora planchas/segundos/peso corporal; desempate arbitrario | `:61-91` | Contar sesiones del ejercicio (cualquier peso) o series. | S |
| I5 | **Ids `alt-…` fragmentan el historial** (cada uso es un ejercicio distinto) | `FuerzaFlow.jsx` (`swapToAlt`), todas las métricas | Cada alternativa fuera del catálogo no acumula progreso. Conviene un id estable por nombre. | M |
| I6 | **Rótulos "reps" para segundos** en Progreso (5 lugares, 3.8) y falta de unidad en `ExerciseProgress` | `ProgresoPage.jsx:483,486,491`, `ExerciseProgress.jsx:145`, `GeneradorTab.jsx:49,163` | Usar `getExerciseUnit` y `formatSetText` como ya se hizo en el resto. | S |
| I7 | **`ExerciseProgress`**: lista inicial = primeros 5 alfabéticos; "PR 0 kg"; gráfico de peso para ejercicios sin peso; "Última serie" es en realidad la última sesión | `ExerciseProgress.jsx:35,63-82,145-157` | Mostrar primero los más recientes; elegir la métrica según la unidad (peso, segundos o repeticiones). | M |
| I8 | **"N meses entrenando" = diferencia de meses de calendario**, no descuenta parates | `:43-51` | Cambiar el texto a "desde {mes año}". | S |
| I9 | **Escalas de fatiga inconsistentes** (3/6, 4/7, 5/7, ≥7) | varios | Una constante compartida. | S |
| I10 | **Falta de pruebas automáticas** de las fórmulas (viven dentro de un componente, sin exportar) | `computeAll` | Extraer a `utils/progressStats.js` y testear con casos como los del apéndice. | M |

### 🟡 Menor

| # | Qué | Dónde |
|---|---|---|
| m1 | Saludo "Llevas" sin voseo; con nombre vacío queda "¡…, !" | `:421-424,396` |
| m2 | "Esta semana": "¡vamos!" el lunes; regla `× 0.5` sin considerar el día de la semana; el círculo del día solo muestra el primer workout | `:106-113,395,408-413` |
| m3 | Formatos de fecha relativa distintos ("hace alrededor de…" de date-fns vs. `daysAgo`) | `:301` vs `:169-178` |
| m4 | `WorkoutHistorial`: un solo workout por día; "/10" si falta `fatigue`; el tipo se muestra en minúscula ("fuerza"); navegación libre hacia meses futuros | `WorkoutHistorial.jsx:23,156-159,86-88` |
| m5 | El texto del botón "Ejercicios" no dice qué hace ("Análisis por ejercicio") | `:503` |
| m6 | Docs: `CONTEXTO.md:387` dice 30 logros (son 35); `LOGICA_TECNICA.md` (líneas 780, 783, 786, 807) cita `TYPE_COLORS`, que no existe en el código (es `WORKOUT_ICON_COLORS`) | docs |
| m7 | `getThisWeekDays` y el cálculo del lunes duplican helpers de `utils/dates.js`; `REAL_TYPES` se define entre imports; `// eslint-disable-line react-hooks/exhaustive-deps` en `:378` | `ProgresoPage.jsx` |
| m8 | CSS sin uso: `.flip-card-inner`, `.flip-face`, `.flip-face-back` | `index.css:85-100` |

### 🎨 Diseño visual y UX

| # | Problema | Evidencia |
|---|---|---|
| D1 | **Texto demasiado chico y con poco contraste.** Etiquetas de 8-9 px; `#4a4560` sobre `#1e1830` es **1,88:1** (etiqueta de `VictoriaCard`) y sobre `#1a1625` **1,95:1** (letras de los días y tipo en `WeekRow`); `#6B7280` en las etiquetas de "Tu camino" y en las fechas da 3,5-3,7:1; el título de sección `#64748B` sobre el fondo da 4,07:1. El mínimo AA para texto normal es 4,5:1. | `ProgresoPage.jsx:207-223,251,271,185` |
| D2 | **Jerarquía de números desigual.** El tamaño depende de la longitud del texto (`valueSize`: 26 px hasta 4 caracteres, 17 px hasta 9, 12 px más) y, con nombre, 22 px fijo: en la misma grilla conviven 26, 22 y 17 px, así que "148" luce más importante que "N sem.". | `:191-196,203` |
| D3 | **Dos estilos de tarjeta casi iguales** (`#1a1625` y `#1e1830`, con y sin borde) y estructuras distintas (grilla de 2 columnas vs. fila de 3). Los fondos son valores sueltos en vez de los tokens del tema (`app-elevated` = `#1A1A26`). | `:200,218` |
| D4 | **Íconos repetidos** con significados distintos: 🏆 en "PRs históricos" y en "mejor marca"; 🔥 en la racha dos veces (y de nuevo como alerta de fatiga). El 💪 de fatiga no se muestra cuando no hay datos y deja una tarjeta más baja. | `:434-448,450` |
| D5 | **Ninguna señal de interacción**: las tarjetas no parecen tocables (sin chevron, sin sombra, sin hover/pressed). Esto se vuelve crítico al agregar el giro. | `CaminoCard`, `VictoriaCard` |
| D6 | **Valores sin contexto**: "+N%", "+Nkg" y "N ses." no dicen respecto de qué ni en cuánto tiempo. | 2.1, 2.2 |
| D7 | **Estados vacíos poco cuidados**: un usuario nuevo ve "0", "0 sem." y "—" en cuatro tarjetas, sin una frase que explique cuándo aparecerán. | `:434-440,447` |
| D8 | **Texto con ellipsis en 9 px** para el nombre del ejercicio (`truncate`): nombres largos se pierden. | `:207` |
| D9 | **Bloque de "Tus victorias" con color de alerta** (rojo) para un dato que no es una victoria. | `:398-406` |

### 🧱 Deuda técnica

| # | Qué |
|---|---|
| T1 | La lógica de negocio (`computeAll`, `computeTopExercises`) está **dentro** de un componente de vista, sin exportar ni probar. |
| T2 | **Tres implementaciones de "primer/último peso, PR y salto"**: `computeAll`, `achievements.js` (`computePRData`, `primerSalto`, `dobleProg`…) y `prUtils.js`. Pueden divergir. |
| T3 | **El promedio de fatiga se calcula en 5 lugares** (Progreso, Configuración, `useDeload` —sin uso—, Logros e Inicio) con reglas distintas. |
| T4 | `useDeload.shouldSuggestDeload` **no tiene llamadores**; Configuración reimplementa la regla. |
| T5 | Colores en línea (`style={{ backgroundColor: '#1a1625' }}`) en vez de tokens de Tailwind. |
| T6 | Dos implementaciones de tarjeta que gira (`FlipCard` y la de `Logros.jsx`), más CSS sin uso. |
| T7 | Las métricas se recomputan completas ante cada cambio de `workouts` (O(n) sobre el historial completo): hoy es inocuo, pero conviene memoizar por unidad de datos al crecer el historial. |

---

## Apéndice: cómo se verificó

- **Lectura completa de:** `pages/Progreso.jsx`, `components/progreso/ProgresoPage.jsx`, `ExerciseProgress.jsx`, `WorkoutHistorial.jsx`, `components/ui/FlipCard.jsx`, `utils/streak.js`, `utils/prUtils.js`, `utils/achievements.js` (metadatos y `computePRData`), `hooks/useDeload.js`, `hooks/useWorkouts.js`, `ConfigPage.jsx` (descarga), `Logros.jsx` (tarjeta), `pages/Inicio.jsx` (`FlipCard`, `RachaBack`), `index.css` y `tailwind.config.js`.
- **Ejecución del código real** (script fuera del repo): se extrajeron `computeAll` y `computeTopExercises` tal cual del archivo fuente y se corrieron, junto con `computeStreak` y `detectPRs`, con historiales **sintéticos**. Casos: A) 10 → 20 → 15 kg da +50 % (última, no mejor); B) una plancha sin peso de 40 a 60 seg → "—" en todas las métricas, 0 PRs; C) un ejercicio en segundos con peso decide por el peso; D) nombres largos de ejercicio → texto recortado a 2 palabras; E) un ejercicio que sube 4 veces suma 3 PRs; F) 6 sesiones de plancha sin peso pierden contra 3 sesiones con peso; G) 4 registros → `total` 3 y `uniqueDays` 2, y los meses de calendario; H) un promedio apenas mayor que el umbral se redondea a un decimal y se ve igual que el umbral, pero cae del lado rojo; I) semanas de 3, 1, 3, 2, 3, 1 y 3 días → racha 4; J) las 3 "principales progresiones" son 3 eventos del mismo ejercicio.
- **Contraste (WCAG):** `#4a4560` sobre `#1e1830` = 1,88:1; sobre `#1a1625` = 1,95:1; `#6B7280` sobre `#1a1625` = 3,66:1; `#64748B` sobre `#0D0D12` = 4,07:1; `#9B7FD4` sobre `#1a1625` = 5,38:1.
- **Limitación:** no se probó la pantalla con una sesión real iniciada ni con datos reales; los porcentajes y ejemplos son sintéticos.

---

## 6. Datos disponibles para dashboard por período

Fecha: 09-11-2026 · Código analizado: `master` en `3ae00ca` · **Sin modificar código de la app.** Objetivo: saber qué datos reales existen para un rediseño de Progreso por período (**4 semanas / 12 semanas / todo**). Solo hay campos, fórmulas y ejemplos genéricos: ningún dato personal.

> **Método.** Se leyó cómo se arma y se guarda cada tipo de workout (`WorkoutWizard.jsx`, `FuerzaFlow.jsx`, `CardioFlow.jsx`, `ClaseFlow.jsx`, `db.js`, `workoutSave.js`), dónde se define el objetivo semanal, y se midió el bundle con esbuild. Las fórmulas de 6.3 y las reglas de 6.5 se **ejecutaron con las funciones reales de la app** (`getExerciseUnit`, `getEffectiveDurationSeconds`, `REAL_WORKOUT_TYPES`, `weekKey`) sobre historiales sintéticos: 10 comprobaciones, todas bien.

### Resumen de lo que hay y lo que falta

| Dato | Estado |
|---|---|
| Entrenamientos, días activos, series, volumen (kg × reps sin `'secs'`) | ✅ Se calculan con datos reales |
| Cansancio (escala 1 a 10) por semana | ✅ Se calcula (con la salvedad del valor por defecto 5) |
| Minutos de cardio por sesión | ✅ Parcial: solo las sesiones donde se cargó el tiempo (es opcional) |
| Cumplimiento del objetivo semanal | ✅ Con una meta única y actual (`profile.diasSemana`), sin historial de cambios |
| **Horas de entrenamiento** | ❌ **No se guarda la duración de fuerza** (ni hora de inicio y fin); solo hay duración en cardio (opcional) y clase (por defecto 60) |
| **Objetivo mensual** | ❌ No existe; solo se puede derivar del semanal |
| **Calorías / frecuencia cardíaca** | ❌ No existen en ningún tipo de workout |
| Intensidad de la clase | ❌ No se guarda |
| Tabata | ❌ No hay datos: la app no guarda sesiones de Tabata |

---

### 6.1 Campos que se guardan en Firestore, por tipo de workout

Colección `users/{uid}/workouts/{id}`. El `id` lo genera el cliente (`newWorkoutId`) y se escribe con `setDoc` (`db.js:40-52`). **No hay validación de formulario**: el botón "Continuar" del paso de detalle no exige nada (`WorkoutWizard.jsx:273`). En la práctica solo `type`, `date` y `fatigue` siempre tienen valor; todo lo demás puede quedar vacío. En las tablas, **"siempre"** significa "el código siempre escribe el campo" (aunque sea vacío o `null`) y **"opcional"** significa "puede faltar o ser `null`".

#### Campos comunes (los escribe el wizard en todos los tipos)

| Campo | Tipo | Obligatorio | Detalle |
|---|---|---|---|
| `type` | string | siempre | `'fuerza'`, `'cardio'` o `'clase'` (los únicos que ofrece el wizard) |
| `date` | `'YYYY-MM-DD'` | siempre | Fecha local; por defecto hoy, editable (se puede registrar un día pasado) |
| `fatigue` | entero 1 a 10 | siempre | Slider de 1 a 10 que **arranca en 5** (`WorkoutWizard.jsx:62,296-301`); no se puede dejar vacío, así que un 5 puede ser "no lo toqué" |
| `notes` | string | siempre | `''` si no se escribe |
| `deload` | boolean | siempre | `true` si la semana de descarga estaba activa al guardar |
| `muscleGroups` | string[] | siempre | Grupos musculares de los ejercicios (solo fuerza); `[]` en los demás tipos |
| `createdAt` | Timestamp | siempre | Lo agrega `db.js`. Es **el momento en que se guardó** (con la cola offline, el momento en que se armó el borrador), **no** la hora del entrenamiento ni de su inicio, y no cambia si se eligió otra fecha en `date`. Hoy solo lo usan los logros de horario (`achievements.js:179-184`) |

#### Fuerza

| Campo | Obligatorio | Detalle |
|---|---|---|
| `exercises[]` | siempre (puede ir vacío) | No se exige ningún ejercicio |
| `exercises[].exerciseId`, `name`, `muscle` | siempre | Para ejercicios propios, `exerciseId` es `custom_…`; para alternativas fuera del catálogo, `alt-…` (único por uso) |
| `exercises[].originalMuscle` | siempre | Músculo del ejercicio antes de un "Cambiar" |
| `exercises[].originalExerciseId` | opcional | Solo si se usó la alternativa |
| `exercises[].unit` | siempre (desde noviembre 2026) | `'reps'` o `'secs'`; los workouts viejos no lo tienen (se resuelve por catálogo) |
| `exercises[].restSecs` | opcional | Solo si se cambió el descanso de ese ejercicio |
| `exercises[].sets[]` → `{ reps, weight }` | siempre (≥ 1 serie al armar) | `reps` es número o `''`; **`weight` puede ser número, `0`, `''` o texto**; en `'secs'` los segundos van en `reps` |
| `cinta` | siempre (`null` si no se usó) | `{ tipo, min, kmh, inclinacion }`, cada uno número o `null`: es el único dato de "cardio" dentro de una sesión de fuerza |
| `regreso`, `regresoPct` | opcional | Solo si la sesión salió de la "Rutina de regreso" |

*Nota de documentación:* `LOGICA_TECNICA.md` (sección 7) lista un `fatigue` por ejercicio; el código actual **no lo guarda**.

#### Cardio

| Campo | Obligatorio | Detalle |
|---|---|---|
| `activity` | siempre | `'Running'`, `'Caminata'`, `'Rollers'`, `'Trekking'`, `'Bici'`, `'Tenis'` o texto libre ("otra"); `''` si no se elige |
| `durationSeconds` | siempre (`null` si es 0) | **Fuente de verdad del tiempo**: horas + minutos + segundos que se cargan |
| `tiempo` | siempre (`null` si es 0) | Minutos redondeados, derivados de `durationSeconds` (los workouts viejos solo tienen este campo) |
| `distancia` | siempre | km o `null` |
| `paceSecondsPerKm`, `ritmo` | siempre (`null` si falta tiempo o distancia, o si pasa de 60 min/km) | Ritmo derivado; `ritmo` es `'m:ss'` sin "/km". **La velocidad en km/h de la bici no se guarda**: se calcula al mostrarla (`computeSpeedKmh`) |

**Qué pide el formulario:** actividad, tiempo (h / min / s) y distancia (km). El "Ritmo promedio" o la "Velocidad promedio" es de solo lectura, calculado. **Nada es obligatorio.** No hay calorías ni frecuencia cardíaca.

#### Clase

| Campo | Obligatorio | Detalle |
|---|---|---|
| `clase` | siempre | `'Strong'`, `'HIIT'`, `'Funcional'`, `'Hyrox'`, `'Crossfit'` o texto libre; `''` si no se elige |
| `duracion` | siempre | Minutos. **El campo se muestra con 60 por defecto y, si queda vacío o en 0, se guarda 60** (`WorkoutWizard.jsx:164`): no se puede distinguir un 60 real de uno no tocado |

**No se guarda intensidad.** (El único uso de la "alta intensidad" es un aviso durante la semana de descarga, calculado por nombre de clase: HIIT, Hyrox y Crossfit; no se persiste.)

#### Tabata

**No existen datos de Tabata.** La app no crea workouts de tipo `'tabata'` (el wizard no lo ofrece). Existe `saveTabataRecord` (`db.js:186-192`, colección aparte `users/{uid}/tabataRecords` con `tabataId`, `tabataName`, `date`, `createdAt`), pero **no tiene ningún llamador**. La sección Tabata es solo de referencia y no tiene temporizador. `LOGICA_TECNICA.md` (sección 7) lo documenta como un tipo de workout, y eso no coincide con el código. Aunque `'tabata'` figura en `REAL_WORKOUT_TYPES`, en la práctica aporta 0.

#### Pausa y descanso (legacy)

| Tipo | Campos | Estado |
|---|---|---|
| `pausa` | `pausaMotivo` (`'enfermedad'` / `'lesion'` / `'descanso'`), `pausaInicio`, `pausaFin`, `date` (= `pausaInicio`), `notes`, `createdAt` | **Ya no se puede crear.** Pueden existir documentos viejos. Se ignoran en racha, estadísticas y calendarios |
| `descanso` | `date`, `createdAt` | Igual: legado, se ignoran (`REAL_WORKOUT_TYPES` solo incluye fuerza, cardio, clase y tabata) |

#### Respuestas puntuales

- **¿Se guarda la duración de la sesión o la hora de inicio y fin?** **No.** El cronómetro de la sesión (`workout_start_ts`) vive en `localStorage`, se muestra mientras se entrena (`SessionTimer`) y **se borra al guardar** (`WorkoutWizard.jsx:171`); nunca llega a Firestore. Las únicas duraciones guardadas son: cardio (`durationSeconds` / `tiempo`, opcional), clase (`duracion`, por defecto 60) y los minutos de `cinta` dentro de una sesión de fuerza. **Fuerza no tiene duración.** `createdAt` es la hora de guardado, no un fin de sesión confiable.
- **Cardio:** minutos ✅, distancia ✅, ritmo ✅ (derivado y guardado), calorías ❌, frecuencia cardíaca ❌.
- **Clase:** duración ✅ (con el 60 por defecto), tipo ✅, intensidad ❌.
- **Calorías o frecuencia cardíaca en cualquier tipo:** **ninguno**. Se buscó en todo `src/` (calorías, kcal, bpm, frecuencia cardíaca, intensidad numérica, RPE) y no hay ningún campo ni entrada de datos.

---

### 6.2 Objetivos: semanal, mensual y por qué la racha usa 3 días

- **Dónde se define el objetivo semanal:** `profile.diasSemana` (perfil del usuario).
  - **Alta:** en el onboarding, pregunta "¿Cuántos días por semana?", con opciones **2, 3, 4, 5 y 6**; el valor inicial es **4** (`Onboarding.jsx:31,40,49`).
  - **¿Es configurable?** **Sí:** Configuración → perfil → "Días disponibles" (2 a 6, `ConfigPage.jsx:188-192`).
  - Solo se guarda **el valor actual**: no hay historial de metas, de modo que las semanas pasadas se evaluarían contra la meta de hoy.
- **Dónde se usa el objetivo:** Progreso ("X de Y días · …", con 3 si el campo faltara, `ProgresoPage.jsx:394,412`), la medalla semanal "Semana completa" y "Hamburguesa merecida" (se oculta si la meta es menor que 4, `Logros.jsx:94,102,180`), el logro "Semana perfecta" (`achievements.js:457-465`) y la sugerencia diaria ("Ya cumpliste tus N días", `dailySuggestion.js:74-76`).
- **"X de N días" en Inicio:** el texto literal "X de Y días" **no está en Inicio**; está en el bloque "Esta semana" de **Progreso** (con Y = `diasSemana`). La tarjeta de Inicio muestra el **anillo** con la cantidad de días de la semana y la palabra "días", sin "de N". Además **el anillo no usa la meta del perfil**: `StatsCards` recibe `diasSemana`, que en realidad es **la cantidad de días entrenados esta semana** (`getThisWeekCount`), y el tope es **fijo en 4** (`maxDays = 4`, `Math.min(días, 4)`; `Inicio.jsx:581-587`). Los mensajes "Semana óptima ✅" (4) e "ideal ⭐" (5 o más) también son fijos. Un usuario con meta 2 o 6 ve el mismo anillo con escala 4.
- **Objetivo mensual:** **no existe** (no hay ningún campo ni cálculo mensual en el código).
- **Por qué la racha usa 3 días y el objetivo semanal 4:** son **tres constantes independientes**, y no hay motivo documentado que las relacione:
  1. **Racha:** el umbral de **3 días** está fijo en `computeStreak` (`utils/streak.js:40`) y en `computeStreakStats` (buckets); no mira el perfil. `LOGICA_TECNICA.md` (sección 1) lo describe como regla, sin justificar el número.
  2. **Objetivo del perfil:** el valor inicial del onboarding es **4**; el respaldo cuando el campo falta es **3** (Progreso, logros, sugerencia diaria).
  3. **Anillo de Inicio:** **4** fijo.
  - Consecuencia: una persona con meta 4 puede mantener la racha con semanas de 3 días, y una con meta 5 o 6 ve la misma racha y el mismo anillo. Recomendación para el dashboard: usar `profile.diasSemana` como **única fuente** del cumplimiento y rotular la racha como "semanas con 3+ días" (o hacer el umbral de la racha configurable).

---

### 6.3 Indicadores: qué se puede calcular, con qué fórmula y qué falta

**Definiciones comunes** (usadas en todas las fórmulas):

- **Workout real:** `type` en `fuerza`, `cardio`, `clase`, `tabata` (`REAL_WORKOUT_TYPES`), con `date`. Excluye `pausa` y `descanso`.
- **Períodos:** para sumas y conteos, ventanas móviles de **28 días** (4 semanas) y **84 días** (12 semanas) que terminan hoy (incluido); **"todo"** va desde el primer workout real. Para cumplimiento y series semanales, **semanas calendario completas** (lunes a domingo, `weekKey`), sin la semana en curso (mostrarla aparte como "en curso").
- **Período anterior:** la ventana de la **misma cantidad de días inmediatamente anterior**. **"Todo" no tiene comparación.** Solo se muestra la comparación si el período anterior está **completo** (su inicio no es anterior al primer workout) y si su valor es mayor que 0.
- **Historial completo disponible:** desde la sección 22 de `LOGICA_TECNICA.md` se carga todo el historial, de modo que 12 semanas y "todo" no se truncan. Los borradores sin sincronizar también están en la lista.

| Indicador | ¿Se puede con datos reales? | Fórmula | Qué falta o qué ojo | Comparación contra el período anterior |
|---|---|---|---|---|
| **Entrenamientos por período** | ✅ Sí | `count(workouts reales con date en [inicio, fin])` | Dos workouts el mismo día cuentan 2. Tabata aporta 0 | Δ % = `(actual − anterior) / anterior × 100` |
| **Días activos** | ✅ Sí | `cantidad de fechas distintas` entre los workouts reales del período | Misma base que "días únicos" de Progreso | Δ en días (o %) |
| **Horas de entrenamiento** | ❌ **No de forma fiable** | Solo parcial: `Σ cardio.durationSeconds/3600 + Σ clase.duracion/60 (+ Σ fuerza.cinta.min/60)` | **Falta la duración de fuerza** (la mayor parte de las sesiones). Cardio solo si se cargó el tiempo; `clase.duracion` incluye valores por defecto (60) indistinguibles de los reales. Para hacerlo real hay que **guardar `durationSeconds` en cada sesión** (el cronómetro ya existe y hoy se descarta al guardar); los workouts viejos seguirían sin dato. Estimarlo por series × descanso no se recomienda | Solo sobre la parte medible y rotulada como "horas registradas" |
| **Series totales** | ✅ Sí | `Σ sets con reps > 0` de los ejercicios de fuerza del período | Cuenta también las series de ejercicios en `'secs'` (son series). Sin marca de calentamiento. Series sin reps (vacías) se ignoran | Δ % |
| **Volumen de fuerza** | ✅ Sí | `Σ (reps × weight)` por serie, solo en ejercicios con `getExerciseUnit(e) ≠ 'secs'`; `weight` se convierte con `Number(weight) \|\| 0` | Los ejercicios sin peso (peso corporal) suman **0**; el texto `"25"` se convierte bien; en `'secs'` se excluye aunque lleven peso. Es comparable **solo contra uno mismo**: el peso puede ser por mancuerna o total, y las unilaterales no distinguen lado. Se puede marcar los períodos con `deload` o `regreso` (pesos reducidos a propósito) | Δ % (si el anterior es 0, sin comparación) |
| **Minutos de cardio por sesión** | ✅ Parcial | `Σ getEffectiveDurationSeconds(w)/60 / n`, con `n` = sesiones de cardio con tiempo > 0 | Las sesiones sin tiempo se excluyen: mostrar la cobertura ("N de M sesiones con tiempo"). Los workouts viejos usan `tiempo` (el helper ya lo cubre). Se puede abrir por `activity` | Δ en minutos |
| **Cansancio promedio por semana** | ✅ Sí | Por semana calendario: `mean(fatigue)` de los workouts reales de esa semana con `fatigue != null`; semanas sin sesiones no tienen punto | **Escala: entero de 1 a 10** (slider 1-10, valor inicial 5; el wizard rotula bajo 1-4, intermedio 5-7, alto 8-10). Un 5 puede ser "no lo toqué"; se promedian todos los tipos. Ver la sección 3.2 sobre las escalas inconsistentes en la app: para el dashboard conviene usar la del wizard | Diferencia en puntos (no en %): `actual − anterior` |
| **Cumplimiento del objetivo semanal** | ✅ Sí (meta única y actual) | Una semana cumple si `días activos de la semana ≥ profile.diasSemana`. Cumplimiento del período = `semanas que cumplen / semanas completas` | La meta es el **valor actual**; no hay historial de metas. Respaldo 3 si el campo falta. La semana en curso se muestra aparte | Diferencia en **puntos porcentuales** |
| **Cumplimiento del objetivo mensual** | ❌ No existe el objetivo | Se puede **derivar**: `objetivo estimado = round(diasSemana × díasDelMes / 7)` (con meta 5 y 30 días: unos 21) y `cumplimiento = días activos del mes / objetivo estimado`, tope 100 % | Hay que rotularlo "objetivo estimado": el usuario no lo definió. Con períodos de 4 y 12 semanas conviene **no** usar mes calendario y reutilizar el semanal | Puntos porcentuales, solo con objetivo estimado |
| **Comparación contra el período anterior** | ✅ Sí, para todos los de arriba salvo "horas" | Ver cada fila. Regla general: `Δ% = (actual − anterior)/anterior` si `anterior > 0`; para cumplimiento y cansancio se usa diferencia absoluta | "Todo" no compara. Sin período anterior completo, mostrar "—" y no un % engañoso | — |

**Comprobaciones hechas** (datos sintéticos, funciones reales): 9 workouts reales en la ventana con 2 en la anterior (pausa y descanso no cuentan); 9 días activos; 16 series; volumen que excluye `'secs'` con y sin peso, suma 0 para el peso corporal y convierte un peso en texto; cardio con una sesión sin tiempo (2 de 3 con dato, promedio de las dos) y otra con solo `tiempo` (registro viejo); cansancio por semana con dos puntos; cumplimiento semanal sobre 4 semanas completas; variación vs anterior (con `null` si el anterior es 0).

---

### 6.4 Biblioteca de gráficos y peso en el bundle

- **Biblioteca:** **recharts** (`package.json`: `^2.12.7`, instalada `2.15.4`). Es la **única** dependencia de gráficos.
- **Dónde se usa hoy:** **solo** en `ExerciseProgress.jsx` (`LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `ReferenceLine`), dentro del panel colapsable "Ejercicios". Todo lo demás es SVG o CSS a mano: el anillo semanal de Inicio, el `WeekRow`, los calendarios y las barras.
- **Peso (medido con esbuild, producción, minificado):**

| Medición | Tamaño |
|---|---|
| recharts con los 7 imports actuales (React externo) | **382 kB** minificado / **106 kB** gzip |
| recharts y sus dependencias dentro del bundle completo (recharts, lodash, react-smooth, d3-*, decimal.js-light…) | **≈ 387 kB**, **≈ 28 %** del JavaScript de la app |
| Bundle completo de producción (Vite, `index-*.js`) | **1.433 kB** minificado / **382 kB** gzip, en **un único chunk** |
| + `BarChart`, `Bar`, `CartesianGrid`, `Legend`, `Cell` | 390 kB / 108 kB gzip (**+8 kB**) |
| + `AreaChart`, `Area`, `ComposedChart` | 413 kB / 112 kB gzip (**+31 kB** en total sobre hoy) |

  Para ubicarlo: dentro del bundle, `@firebase/firestore` pesa ≈ 246 kB, el código de la app ≈ 362 kB y `react-dom` ≈ 128 kB (esbuild, estimación por paquete).
- **Consecuencia:** como no hay *code splitting*, **todos los usuarios descargan recharts al abrir la app**, aunque solo se use al abrir "Ejercicios" en Progreso; además entra en el precache de la PWA. Un dashboard con barras y áreas **agrega poco peso** (+8 a +31 kB) porque comparte el núcleo con el `LineChart` actual. Opciones: (a) cargar el gráfico de forma diferida (`import()`) y bajar el peso inicial de la app en unos 380 kB; (b) para barras, barras de progreso y líneas simples (sparklines), usar SVG propio (unos pocos kB, sin dependencia nueva). Para la interacción (tooltips, zoom) recharts sigue siendo la opción razonable.

---

### 6.5 Reglas determinísticas para un "Dato clave"

Todas generan una frase a partir de datos reales, sin azar ni texto libre. Notación: **P** = período elegido (28 o 84 días; con "todo" solo aplican las reglas que no comparan), **A** = período anterior de igual largo, **hoy** = fecha local. Los números se redondean con `Math.round`, con coma decimal (es-AR) y unidad. Se muestra **un solo** dato clave, el de mayor prioridad que dispare; si ninguno dispara, se oculta la tarjeta (o se muestra "Sumá entrenamientos para ver tu dato clave" cuando P tiene menos de 2 workouts).

| Prioridad | Regla | Condición exacta de disparo | Frase (plantilla) |
|---|---|---|---|
| 1 | **R1 · Cansancio alto** | Las **2 últimas semanas completas** tienen en total **≥ 3 workouts con `fatigue`** y el promedio de esos workouts es **≥ 7** (el mismo umbral que usa la descarga en Configuración) | "Tu cansancio promedio de las últimas 2 semanas fue {x}/10. Podés considerar una semana de descarga." |
| 2 | **R2 · Récord de peso** | Existe al menos un evento en P: una sesión de fuerza con `maxW > 0` para un ejercicio cuyo mejor peso previo (**cualquier sesión anterior**, incluidas las anteriores dentro de P) es **> 0** y **menor** que `maxW` (misma definición que `detectPRs`). Si hay varios, se elige el de **fecha más reciente** y, ante empate, el de mayor mejora relativa | "Récord nuevo en {ejercicio}: {maxW} kg (+{maxW − previo} kg sobre tu marca anterior de {previo} kg)." |
| 3 | **R3 · Mejor tiempo** | Para un ejercicio con `getExerciseUnit = 'secs'`: el máximo de segundos por serie en P es **mayor** que el máximo de todas las sesiones anteriores a P, y el máximo anterior es **> 0** (se compara contra sesiones con el mismo peso, o ambas sin peso). Se elige el de fecha más reciente | "Aguantaste {n} seg en {ejercicio}, tu mejor marca (antes {m} seg)." |
| 4 | **R4 · Variación de volumen** | P no es "todo"; hay **≥ 2** sesiones de fuerza con volumen > 0 en P y **≥ 2** en A; volumen(A) **> 0**; y `abs(Δ%) ≥ 10` con `Δ% = Math.round((vol(P) − vol(A)) / vol(A) × 100)`. Si alguna sesión de P tiene `deload: true` o `regreso: true`, se agrega el sufijo | "Tu volumen de fuerza {subió/bajó} un {abs(Δ%)} % frente a las {N} semanas anteriores{ (incluye semana de descarga)}." (si `Δ% > 200`, "más de un 200 %") |
| 5 | **R5 · Constancia** | Hay **≥ 4 semanas completas** en P y **k ≥ 1**, con `k` = semanas completas con días activos **≥ `profile.diasSemana`** (respaldo 3) y `n` = semanas completas de P | Si `k = n`: "¡Cumpliste tu objetivo de {d} días las {n} semanas!"; si no: "Cumpliste tu objetivo de {d} días en {k} de {n} semanas." |

**Reglas de uso y determinismo**
- **Prioridad:** R1 > R2 > R3 > R4 > R5 (la alerta de cansancio va primero porque es la única que pide una acción). Mismos datos ⇒ misma frase.
- **Comprobado con funciones reales** (datos sintéticos): R2 detecta el récord del período incluso con el peso cargado como texto; R3 detecta el mejor tiempo de un ejercicio en `'secs'` (la condición de "mismo peso" no se probó); R4 calcula la variación de volumen excluyendo `'secs'` y devuelve "no dispara" cuando el período anterior vale 0.
- **Dependencias de calidad de datos:** R2 y R3 necesitan un `exerciseId` estable; las alternativas fuera del catálogo (ids `alt-…`, ver sección 5) no acumulan historial y nunca generarían un récord. R4 y R5 dependen de que `profile.diasSemana` exista. R1 hereda la limitación del 5 por defecto del slider.

---

### 6.6 Qué habría que agregar para un dashboard completo (sin hacerlo ahora)

| Cambio mínimo | Qué habilita | Esfuerzo estimado |
|---|---|---|
| Guardar `durationSeconds` en cada workout (el cronómetro de sesión ya existe y hoy se descarta al guardar) | Horas de entrenamiento reales para fuerza | S |
| Un objetivo mensual opcional en el perfil, o rotular el derivado como "estimado" | Cumplimiento mensual | S |
| `exerciseId` estable para las alternativas fuera del catálogo | Récords y volumen por ejercicio sin fragmentar | M |
| Marcar si la fatiga fue elegida (`fatigueSet`) o es el valor por defecto | Promedios de cansancio fiables | S |
| Guardar el historial de `diasSemana` (o la meta vigente en cada semana) | Cumplimiento histórico sin reescribir el pasado | M |
| Calorías y frecuencia cardíaca | Solo si se decide pedirlos al usuario o integrarlos con otro dispositivo: hoy no existen | L |
