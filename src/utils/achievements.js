import { getAchievements, unlockAchievement, getTabataRecordCount } from '../services/db'
import { dateToLocal } from './dates'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { computeStreak, REAL_WORKOUT_TYPES } from './streak'

// ─── Achievement metadata (no React/icon refs) ────────────────────────────────
export const ACHIEVEMENTS_META = [
  // CONSISTENCIA
  { key: 'primerPaso',            label: 'Primer paso',              desc: 'Registrá tu primer entrenamiento' },
  { key: 'semanaActiva',          label: 'Semana activa',            desc: 'Entrenaste 3+ días en una semana' },
  { key: 'madrugadora',           label: 'Madrugador/a',             labelMasc: 'Madrugador',       labelFem: 'Madrugadora',       desc: '5 entrenamientos antes de las 8 AM' },
  { key: 'finDeSeActivo',         label: 'Fin de semana activo',     desc: 'Entrenaste sábado Y domingo en la misma semana' },
  { key: 'rachaFuego',            label: 'Racha de fuego',           desc: '4 semanas seguidas con 3+ días cada una' },
  { key: 'rachaElite',            label: 'Racha élite',              desc: '12 semanas seguidas con 3+ días cada una' },
  { key: 'cincuenta',             label: '50 entrenamientos',        desc: 'Registrá 50 entrenamientos en total' },
  { key: 'constanciaTotal',       label: 'Constancia total',         desc: 'Registrá 100 entrenamientos en total' },
  { key: 'medioAnio',             label: 'Medio año',                desc: '180 días desde tu primer entrenamiento registrado' },
  { key: 'cienDias',              label: '100 días entrenados',      desc: '100 días únicos con al menos un entrenamiento' },
  { key: 'consistenciaRegistro',  label: 'Consistencia de registro', desc: 'Escribiste una nota en 20 o más entrenamientos' },
  // FUERZA
  { key: 'primerAumento',         label: 'Primer aumento',           desc: 'Subiste el peso por primera vez' },
  { key: 'primerSalto',           label: 'Primer salto',             desc: 'Subiste un 25% o más tu peso inicial en algún ejercicio' },
  { key: 'tresPRs',               label: 'Superaste 3 PRs',          desc: 'Récord personal en 3 ejercicios distintos' },
  { key: 'diezPRs',               label: 'Superaste 10 PRs',         desc: 'Récord personal en 10 ejercicios distintos' },
  { key: 'dobleProg',             label: 'Doble progresión',         desc: 'Duplicaste el peso inicial en algún ejercicio' },
  { key: 'transformacion',        label: 'Transformación',           desc: 'Duplicaste el peso inicial en 3 o más ejercicios' },
  { key: 'piernasAcero',          label: 'Piernas de acero',         desc: '4 semanas seguidas entrenando piernas' },
  { key: 'hamburguesaMerecida',   label: 'Hamburguesa merecida',     desc: 'Entrenaste 4 o más días en una semana' },
  { key: 'rachaFuerza',           label: 'Racha de fuerza',          desc: 'Subiste el peso en 3+ ejercicios distintos en la misma semana' },
  // CARDIO
  { key: 'cinco5km',              label: 'Primera vez 5km',          desc: 'Acumulaste 5km corriendo en total' },
  { key: 'veinte20km',            label: '20km acumulados',          desc: 'Acumulaste 20km corriendo en total' },
  { key: 'ritmoSolido',           label: 'Ritmo sólido',             desc: 'Promedio menor a 6:00 min/km en 3 sesiones' },
  { key: 'dobleRueda',            label: 'Doble rueda',              desc: '20km en rollers en una sola sesión' },
  { key: 'tabataMaster',          label: 'Tabata master',            desc: 'Completaste 10 sesiones de Tabata' },
  // BALANCE
  { key: 'semanaMixta',           label: 'Primera semana mixta',     desc: 'Una semana con fuerza + cardio o clase' },
  { key: 'balancePerfecto',       label: 'Balance perfecto',         desc: '4 semanas seguidas con cardio o clase incluido' },
  { key: 'energiaAlza',           label: 'Energía en alza',          desc: 'Tu cansancio promedio bajó más de 2 puntos' },
  { key: 'guerreraDescanso',      label: 'Guerrer@ del descanso',    labelMasc: 'Guerrero del descanso', labelFem: 'Guerrera del descanso', desc: 'Completaste 3 semanas de descarga registradas' },
  { key: 'resiliencia',           label: 'Resiliencia',              desc: 'Volviste a entrenar tras 7+ días sin registros' },
  // ESPECIALES
  { key: 'aniversario',           label: 'Aniversario',              desc: 'Un año desde tu primer entrenamiento registrado' },
  { key: 'madrugadoraExtrema',    label: 'Madrugador/a extremo/a',   labelMasc: 'Madrugador extremo', labelFem: 'Madrugadora extrema', desc: 'Entrenaste antes de las 6:30 AM' },
  { key: 'aveNocturna',           label: 'Ave nocturna',             desc: 'Entrenaste después de las 21:00' },
  { key: 'dosSemanas',            label: 'Dos semanas activas',      desc: 'Entrenaste 3+ días por 2 semanas seguidas' },
  { key: 'semanaPerfecta',        label: 'Semana perfecta',          desc: 'Entrenaste todos los días que te propusiste en una semana' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getWeekKey(dateStr) {
  const [yr, mo, dy] = dateStr.split('-').map(Number)
  const d   = new Date(yr, mo - 1, dy)
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return dateToLocal(mon)
}

function fmtWeek(mondayStr) {
  try {
    const mon = new Date(mondayStr + 'T12:00:00')
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
    return `Semana del ${format(mon, "d MMM", { locale: es })} al ${format(sun, "d MMM", { locale: es })}`
  } catch { return '' }
}

function computeMaxStreak(workouts, minDays) {
  const weeks = {}
  workouts.filter(w => REAL_WORKOUT_TYPES.includes(w.type)).forEach(w => {
    const k = getWeekKey(w.date)
    if (!weeks[k]) weeks[k] = new Set()
    weeks[k].add(w.date)
  })
  const qualifying = Object.entries(weeks)
    .filter(([, s]) => s.size >= minDays)
    .map(([k]) => k)
    .sort()
  let max = 0, cur = 0, prev = null
  for (const week of qualifying) {
    if (prev === null) { cur = 1 }
    else {
      const diff = Math.round((new Date(week) - new Date(prev)) / (7 * 86400000))
      cur = diff === 1 ? cur + 1 : 1
    }
    max = Math.max(max, cur)
    prev = week
  }
  return max
}

function computePRData(workouts) {
  const sorted = [...workouts]
    .filter(w => w.type === 'fuerza' && w.exercises?.length)
    .sort((a, b) => a.date.localeCompare(b.date))
  const best = {}, prSet = new Set()
  for (const w of sorted) {
    for (const e of (w.exercises ?? [])) {
      if (!e.exerciseId || !e.sets?.length) continue
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (!maxW) continue
      if (best[e.exerciseId] != null && maxW > best[e.exerciseId]) prSet.add(e.exerciseId)
      best[e.exerciseId] = Math.max(best[e.exerciseId] ?? 0, maxW)
    }
  }
  return { prCount: prSet.size }
}

function computeWeightProgression(workouts) {
  const sorted = [...workouts]
    .filter(w => w.type === 'fuerza' && w.exercises?.length)
    .sort((a, b) => a.date.localeCompare(b.date))
  const firstW = {}, curW = {}, names = {}
  for (const w of sorted) {
    for (const e of (w.exercises ?? [])) {
      if (!e.exerciseId || !e.sets?.length) continue
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (!maxW) continue
      if (firstW[e.exerciseId] == null) firstW[e.exerciseId] = maxW
      curW[e.exerciseId] = maxW
      names[e.exerciseId] = e.name || e.exerciseId
    }
  }
  return { firstW, curW, names }
}

function getTotalRunningKm(workouts) {
  return workouts
    .filter(w => w.type === 'cardio' && w.activity?.toLowerCase() === 'running' && w.distancia)
    .reduce((sum, w) => sum + (Number(w.distancia) || 0), 0)
}

function getAvgPaceMinPerKm(workouts, lastN = 3) {
  const runs = workouts
    .filter(w => w.type === 'cardio' && w.activity?.toLowerCase() === 'running' && w.distancia && w.tiempo)
    .slice(0, lastN)
  if (!runs.length) return null
  const paces = runs.map(w => Number(w.tiempo) / Number(w.distancia))
  return paces.reduce((a, b) => a + b, 0) / paces.length
}

function checkBalancePerfecto(workouts) {
  const weeks = {}
  workouts.forEach(w => {
    const k = getWeekKey(w.date)
    if (!weeks[k]) weeks[k] = { cardio: 0 }
    if (w.type === 'cardio' || w.type === 'clase') weeks[k].cardio++
  })
  const qualifying = Object.entries(weeks).filter(([, v]) => v.cardio >= 1).map(([k]) => k).sort()
  let max = 0, cur = 0, prev = null
  for (const week of qualifying) {
    if (prev === null) { cur = 1 }
    else { const diff = Math.round((new Date(week) - new Date(prev)) / (7 * 86400000)); cur = diff === 1 ? cur + 1 : 1 }
    max = Math.max(max, cur); prev = week
  }
  return max >= 4
}

function checkEnergiaAlza(workouts) {
  const weeks = {}
  workouts.forEach(w => {
    if (w.fatigue == null) return
    const k = getWeekKey(w.date)
    if (!weeks[k]) weeks[k] = []
    weeks[k].push(w.fatigue)
  })
  const sorted = Object.entries(weeks)
    .map(([k, fs]) => ({ k, avg: fs.reduce((a, b) => a + b, 0) / fs.length }))
    .sort((a, b) => a.k.localeCompare(b.k))
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i]
    const diff = Math.round((new Date(cur.k) - new Date(prev.k)) / (7 * 86400000))
    if (diff === 1 && prev.avg - cur.avg >= 2) return true
  }
  return false
}

function getWorkoutHour(w) {
  const ts = w.createdAt
  if (!ts) return null
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.getHours() + d.getMinutes() / 60
}

function checkResiliencia(workouts) {
  const real = workouts.filter(w => w.type !== 'descanso').sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 1; i < real.length; i++) {
    const gap = Math.round((new Date(real[i].date) - new Date(real[i - 1].date)) / 86400000)
    if (gap >= 7) return true
  }
  return false
}

function checkFinSemanaActivo(workouts) {
  const byWeek = {}
  workouts.forEach(w => {
    const d = new Date(w.date + 'T12:00:00')
    const day = d.getDay()
    if (day !== 0 && day !== 6) return
    const k = getWeekKey(w.date)
    if (!byWeek[k]) byWeek[k] = new Set()
    byWeek[k].add(day)
  })
  return Object.values(byWeek).some(s => s.has(0) && s.has(6))
}

function checkPiernasAcero(workouts) {
  const LEG = ['Glúteos', 'Isquios', 'Cuádriceps', 'Abductores', 'Gemelos']
  const weeks = {}
  workouts.filter(w => w.type === 'fuerza').forEach(w => {
    const muscles = [...(w.muscleGroups ?? []), ...(w.exercises?.map(e => e.muscle).filter(Boolean) ?? [])]
    if (!muscles.some(m => LEG.includes(m))) return
    const k = getWeekKey(w.date)
    weeks[k] = true
  })
  return computeMaxStreak(Object.keys(weeks).map(date => ({ date, type: 'fuerza' })), 1) >= 4
}

function checkRachaFuerza(workouts) {
  const fuerza = workouts
    .filter(w => w.type === 'fuerza' && w.exercises?.length)
    .sort((a, b) => a.date.localeCompare(b.date))

  const byWeek = {}
  fuerza.forEach(w => {
    const k = getWeekKey(w.date)
    if (!byWeek[k]) byWeek[k] = []
    byWeek[k].push(w)
  })

  for (const week of Object.keys(byWeek).sort()) {
    const beforeWorkouts = fuerza.filter(w => getWeekKey(w.date) < week)
    if (!beforeWorkouts.length) continue

    const beforeBest = {}
    beforeWorkouts.forEach(w => {
      ;(w.exercises ?? []).forEach(e => {
        if (!e.exerciseId || !e.sets?.length) return
        const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
        if (maxW > 0) beforeBest[e.exerciseId] = Math.max(beforeBest[e.exerciseId] ?? 0, maxW)
      })
    })

    const weekBest = {}
    byWeek[week].forEach(w => {
      ;(w.exercises ?? []).forEach(e => {
        if (!e.exerciseId || !e.sets?.length) return
        const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
        if (maxW > 0) weekBest[e.exerciseId] = Math.max(weekBest[e.exerciseId] ?? 0, maxW)
      })
    })

    const increased = Object.keys(weekBest).filter(
      id => beforeBest[id] != null && weekBest[id] > beforeBest[id]
    )
    if (increased.length >= 3) {
      return { found: true, detail: `${increased.length} aumentos en ${fmtWeek(week)}` }
    }
  }
  return { found: false, detail: '' }
}

// ─── Main exported check function ─────────────────────────────────────────────
export async function runAchievementCheck(uid, workouts, profile, settings) {
  if (!workouts.length) return []
  const a = await getAchievements(uid)
  const toUnlock = []
  const push = (key, detail = '') => toUnlock.push({ key, detail })

  if (!a.primerPaso?.unlocked) push('primerPaso', 'Primer entrenamiento registrado')

  if (!a.semanaActiva?.unlocked) {
    const weeks = {}
    workouts.forEach(w => {
      const k = getWeekKey(w.date)
      if (!weeks[k]) weeks[k] = new Set()
      weeks[k].add(w.date)
    })
    const qualEntry = Object.entries(weeks).find(([, s]) => s.size >= 3)
    if (qualEntry) push('semanaActiva', fmtWeek(qualEntry[0]))
  }

  if (!a.madrugadora?.unlocked) {
    const early = workouts.filter(w => { const h = getWorkoutHour(w); return h !== null && h < 8 })
    if (early.length >= 5) push('madrugadora', `${early.length} entrenamientos antes de las 8 AM`)
  }
  if (!a.madrugadoraExtrema?.unlocked) {
    if (workouts.some(w => { const h = getWorkoutHour(w); return h !== null && h < 6.5 }))
      push('madrugadoraExtrema', 'Entrenamiento antes de las 6:30 AM')
  }
  if (!a.aveNocturna?.unlocked) {
    if (workouts.some(w => { const h = getWorkoutHour(w); return h !== null && h >= 21 }))
      push('aveNocturna', 'Entrenamiento después de las 21:00')
  }

  if (!a.finDeSeActivo?.unlocked && checkFinSemanaActivo(workouts)) {
    const byWeek = {}
    workouts.forEach(w => {
      const d = new Date(w.date + 'T12:00:00')
      const day = d.getDay()
      if (day !== 0 && day !== 6) return
      const k = getWeekKey(w.date)
      if (!byWeek[k]) byWeek[k] = new Set()
      byWeek[k].add(day)
    })
    const qualEntry = Object.entries(byWeek).find(([, s]) => s.has(0) && s.has(6))
    if (qualEntry) push('finDeSeActivo', fmtWeek(qualEntry[0]))
  }

  const { record: rachaRecord } = computeStreak(workouts)
  if (!a.rachaFuego?.unlocked  && rachaRecord >= 4)  push('rachaFuego',  '4 semanas seguidas con 3+ días')
  if (!a.rachaElite?.unlocked  && rachaRecord >= 12) push('rachaElite',  '12 semanas seguidas con 3+ días')

  if (!a.cincuenta?.unlocked       && workouts.length >= 50)  push('cincuenta',       '50 entrenamientos completados')
  if (!a.constanciaTotal?.unlocked && workouts.length >= 100) push('constanciaTotal', '100 entrenamientos completados')

  if (!a.medioAnio?.unlocked && workouts.length > 0) {
    const real = workouts.filter(w => w.type !== 'descanso')
    if (real.length > 0) {
      const first = new Date(real[real.length - 1].date + 'T12:00:00')
      if ((new Date() - first) >= 180 * 24 * 3600 * 1000) push('medioAnio', 'Más de 180 días desde el primer entrenamiento')
    }
  }

  if (!a.cienDias?.unlocked) {
    const uniqueDates = new Set(workouts.filter(w => w.type !== 'descanso').map(w => w.date))
    if (uniqueDates.size >= 100) push('cienDias', `${uniqueDates.size} días únicos entrenados`)
  }

  if (!a.consistenciaRegistro?.unlocked) {
    const withNotes = workouts.filter(w => w.notes && w.notes.trim().length > 0)
    if (withNotes.length >= 20) push('consistenciaRegistro', `${withNotes.length} entrenamientos con nota`)
  }

  if (!a.primerAumento?.unlocked || !a.tresPRs?.unlocked || !a.diezPRs?.unlocked) {
    const { prCount } = computePRData(workouts)
    if (!a.primerAumento?.unlocked && prCount >= 1)  push('primerAumento', 'Primera subida de peso registrada')
    if (!a.tresPRs?.unlocked       && prCount >= 3)  push('tresPRs',       '3 récords personales superados')
    if (!a.diezPRs?.unlocked       && prCount >= 10) push('diezPRs',       '10 récords personales superados')
  }

  if (!a.primerSalto?.unlocked || !a.dobleProg?.unlocked || !a.transformacion?.unlocked) {
    const { firstW, curW, names } = computeWeightProgression(workouts)
    if (!a.primerSalto?.unlocked) {
      const jumped = Object.keys(firstW).find(id => firstW[id] > 0 && curW[id] >= firstW[id] * 1.25)
      if (jumped) push('primerSalto', `${names[jumped]} · de ${firstW[jumped]}kg a ${curW[jumped]}kg`)
    }
    if (!a.dobleProg?.unlocked) {
      const doubled = Object.keys(firstW).find(id => firstW[id] > 0 && curW[id] >= firstW[id] * 2)
      if (doubled) push('dobleProg', `${names[doubled]} · de ${firstW[doubled]}kg a ${curW[doubled]}kg`)
    }
    if (!a.transformacion?.unlocked) {
      const doubledList = Object.keys(firstW).filter(id => firstW[id] > 0 && curW[id] >= firstW[id] * 2)
      if (doubledList.length >= 3) push('transformacion', `${doubledList.length} ejercicios con peso duplicado`)
    }
  }

  if (!a.piernasAcero?.unlocked && checkPiernasAcero(workouts)) push('piernasAcero', '4 semanas seguidas entrenando piernas')

  // hamburguesaMerecida — recurrente con cooldown de 2 semanas ISO
  {
    const weeks = {}
    workouts.forEach(w => {
      const k = getWeekKey(w.date)
      if (!weeks[k]) weeks[k] = new Set()
      weeks[k].add(w.date)
    })
    const qualifying = Object.entries(weeks).filter(([, s]) => s.size >= 4).map(([k]) => k).sort()
    if (qualifying.length > 0) {
      const lastAt = a.hamburguesaMerecida?.at
      let canUnlock = true
      if (lastAt) {
        const lastMs = typeof lastAt.toDate === 'function' ? lastAt.toDate().getTime() : (lastAt.seconds ?? 0) * 1000
        const lastWeek = getWeekKey(new Date(lastMs).toISOString().split('T')[0])
        const mostRecent = qualifying[qualifying.length - 1]
        canUnlock = Math.round((new Date(mostRecent) - new Date(lastWeek)) / (7 * 86400000)) >= 2
      }
      if (canUnlock) push('hamburguesaMerecida', fmtWeek(qualifying[qualifying.length - 1]))
    }
  }

  if (!a.rachaFuerza?.unlocked) {
    const result = checkRachaFuerza(workouts)
    if (result.found) push('rachaFuerza', result.detail)
  }

  if (!a.cinco5km?.unlocked || !a.veinte20km?.unlocked) {
    const km = getTotalRunningKm(workouts)
    if (!a.cinco5km?.unlocked   && km >= 5)  push('cinco5km',   `${km.toFixed(1)}km acumulados corriendo`)
    if (!a.veinte20km?.unlocked && km >= 20) push('veinte20km', `${km.toFixed(1)}km acumulados corriendo`)
  }

  if (!a.ritmoSolido?.unlocked) {
    const pace = getAvgPaceMinPerKm(workouts)
    if (pace != null && pace < 6) {
      const mins = Math.floor(pace)
      const secs = String(Math.round((pace - mins) * 60)).padStart(2, '0')
      push('ritmoSolido', `Promedio ${mins}:${secs} min/km`)
    }
  }

  if (!a.dobleRueda?.unlocked) {
    if (workouts.some(w => w.type === 'cardio' && w.activity?.toLowerCase().includes('roller') && Number(w.distancia) >= 20))
      push('dobleRueda', '20km en rollers en una sesión')
  }

  if (!a.tabataMaster?.unlocked) {
    try {
      const count = await getTabataRecordCount(uid)
      if (count >= 10) push('tabataMaster', `${count} sesiones de Tabata completadas`)
    } catch {}
  }

  if (!a.semanaMixta?.unlocked) {
    const mix = {}
    workouts.forEach(w => {
      const k = getWeekKey(w.date)
      if (!mix[k]) mix[k] = { f: false, c: false }
      if (w.type === 'fuerza') mix[k].f = true
      if (w.type === 'cardio' || w.type === 'clase') mix[k].c = true
    })
    if (Object.values(mix).some(v => v.f && v.c)) push('semanaMixta', 'Semana con fuerza + cardio o clase')
  }

  if (!a.balancePerfecto?.unlocked && checkBalancePerfecto(workouts)) push('balancePerfecto', '4 semanas seguidas con cardio incluido')
  if (!a.energiaAlza?.unlocked     && checkEnergiaAlza(workouts))     push('energiaAlza',    'Cansancio bajó 2+ puntos en una semana')
  if (!a.guerreraDescanso?.unlocked && (settings?.deloadsCompleted ?? 0) >= 3)
    push('guerreraDescanso', `${settings?.deloadsCompleted ?? 3} semanas de descarga completadas`)
  if (!a.resiliencia?.unlocked && checkResiliencia(workouts)) push('resiliencia', 'Vuelta después de 7+ días sin entrenar')

  if (!a.aniversario?.unlocked && workouts.length > 0) {
    const real = workouts.filter(w => w.type !== 'descanso')
    if (real.length > 0) {
      const first = new Date(real[real.length - 1].date + 'T12:00:00')
      if ((new Date() - first) >= 365 * 24 * 3600 * 1000) push('aniversario', 'Un año desde el primer entrenamiento')
    }
  }

  if (!a.dosSemanas?.unlocked) {
    const weekDays = {}
    workouts.filter(w => REAL_WORKOUT_TYPES.includes(w.type)).forEach(w => {
      const k = getWeekKey(w.date)
      if (!weekDays[k]) weekDays[k] = new Set()
      weekDays[k].add(w.date)
    })
    const qualifying = Object.keys(weekDays).filter(k => weekDays[k].size >= 3).sort()
    let found = false
    for (let i = 1; i < qualifying.length; i++) {
      const diff = Math.round((new Date(qualifying[i] + 'T12:00:00') - new Date(qualifying[i - 1] + 'T12:00:00')) / 86400000)
      if (diff === 7) { found = true; break }
    }
    if (found) push('dosSemanas', fmtWeek(qualifying[qualifying.length - 1]))
  }

  if (!a.semanaPerfecta?.unlocked) {
    const diasObjetivo = profile?.diasSemana ?? 3
    const weeks = {}
    workouts.filter(w => w.type !== 'descanso').forEach(w => {
      const k = getWeekKey(w.date)
      if (!weeks[k]) weeks[k] = new Set()
      weeks[k].add(w.date)
    })
    const qualEntry = Object.entries(weeks).find(([, s]) => s.size >= diasObjetivo)
    if (qualEntry) push('semanaPerfecta', `${qualEntry[1].size} días entrenados (meta: ${diasObjetivo})`)
  }

  const newlyUnlocked = []
  for (const { key, detail } of toUnlock) {
    try {
      await unlockAchievement(uid, key, detail)
      newlyUnlocked.push(key)
    } catch {}
  }
  return newlyUnlocked
}
