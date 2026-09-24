import { useState, useEffect, useCallback } from 'react'
import { parseISO } from 'date-fns'
import { getWorkouts, saveWorkout as dbSaveWorkout } from '../services/db'
import { dateToLocal } from '../utils/dates'
import { getDrafts, saveDraft, syncDrafts } from '../utils/draftQueue'

const CACHE_KEY = (uid) => `workouts_cache_${uid}`

function readCache(uid) {
  try {
    const raw = localStorage.getItem(CACHE_KEY(uid))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeCache(uid, data) {
  try {
    localStorage.setItem(CACHE_KEY(uid), JSON.stringify(data))
  } catch {}
}

export function useWorkouts(uid) {
  const cached = uid ? readCache(uid) : null
  const [workouts, setWorkouts] = useState(cached ?? [])
  const [loading, setLoading]   = useState(!cached)

  const load = useCallback(async (silent = false) => {
    if (!uid) return
    if (!silent) setLoading(true)
    try {
      const data = await getWorkouts(uid, 100)
      writeCache(uid, data)
      const pending = getDrafts(uid)
      setWorkouts(pending.length ? [...pending, ...data] : data)
    } catch (err) {
      console.warn('Error cargando workouts, usando cache local:', err)
      const cached = readCache(uid)
      const pending = getDrafts(uid)
      if (cached) setWorkouts(pending.length ? [...pending, ...cached] : cached)
      else if (pending.length) setWorkouts(pending)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    if (!uid) return
    if (cached) {
      load(true)
    } else {
      load(false)
    }
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveWorkout = async (workout) => {
    try {
      const id = await dbSaveWorkout(uid, workout)
      // Root cause fix: write to cache and local state immediately after the Firestore
      // write confirms. Previously we awaited load(true) here, but if the user navigated
      // back to Inicio before that Firestore re-fetch completed, Inicio mounted with a
      // stale cache that didn't include this workout — causing getCurrentStreak() to
      // return the wrong state (e.g. 'frozen' instead of 'active' after training during
      // a pausa week). Optimistic update ensures the cache is always current on navigation.
      const fresh = { ...workout, id }
      writeCache(uid, [fresh, ...(readCache(uid) ?? [])])
      setWorkouts(prev => [fresh, ...prev])
      load(true) // background sync from Firestore (not awaited)
      return id
    } catch (err) {
      console.warn('Sin red al guardar, guardando como borrador local:', err)
      const draft = saveDraft(uid, workout)
      setWorkouts(prev => [draft, ...prev])
      return draft._draftId
    }
  }

  useEffect(() => {
    if (!uid) return
    const handleOnline = async () => {
      const { synced } = await syncDrafts(uid, (w) => dbSaveWorkout(uid, w))
      if (synced > 0) await load(true)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [uid, load])

  const getLastWeightsForExercise = (exerciseId) => {
    const relevant = workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === exerciseId))
      .slice(0, 5)
    return relevant.map(w => {
      const ex = w.exercises.find(e => e.exerciseId === exerciseId)
      return { date: w.date, sets: ex?.sets ?? [], fatigue: w.fatigue }
    })
  }

  const getPRForExercise = (exerciseId) => {
    let pr = 0
    workouts.forEach(w => {
      if (w.type !== 'fuerza') return
      w.exercises?.forEach(e => {
        if (e.exerciseId !== exerciseId) return
        e.sets?.forEach(s => {
          if ((s.weight ?? 0) > pr) pr = s.weight
        })
      })
    })
    return pr
  }

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

  const getLastFatigueForExercise = (exerciseId) => {
    const relevant = workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === exerciseId))
      .slice(0, 2)
    return relevant.map(w => w.fatigue ?? 5)
  }

  const getTrainedMusclesRecovery = (profile) => {
    const hours = profile?.tipoRutina === 'fullbody' ? 48 : 72
    const cutoff = new Date()
    cutoff.setHours(cutoff.getHours() - hours)
    const cutoffStr = dateToLocal(cutoff)
    const muscles = new Set()
    workouts.forEach(w => {
      if (w.date >= cutoffStr) {
        w.muscleGroups?.forEach(m => muscles.add(m))
      }
    })
    return Array.from(muscles)
  }

  const getWeekWorkouts = (weekStartStr) => {
    const start = parseISO(weekStartStr + 'T12:00:00')
    const end   = new Date(start.getTime() + 6 * 86400000)
    const endStr = dateToLocal(end)
    return workouts.filter(w => w.date >= weekStartStr && w.date <= endStr)
  }

  // Returns { current, record, state }
  // state: 'active' | 'frozen' | 'paused' | 'broken'
  const getCurrentStreak = () => {
    const allW = workouts.filter(w => w.date)
    if (!allW.length) return { current: 0, record: 0, state: 'broken' }

    const getMondayOf = (d) => {
      const dt = new Date(d)
      const dow = dt.getDay() || 7
      dt.setDate(dt.getDate() - dow + 1)
      dt.setHours(0, 0, 0, 0)
      return dt
    }
    const toStr = (d) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    }
    const addDays = (d, n) => new Date(d.getTime() + n * 86400000)

    const pausas = allW.filter(w => w.type === 'pausa')
    const realW  = allW.filter(w => w.type !== 'descanso' && w.type !== 'pausa')

    // Build week training map: monday -> Set of dates trained
    const weekMap = {}
    realW.forEach(w => {
      const mon = toStr(getMondayOf(parseISO(w.date + 'T12:00:00')))
      if (!weekMap[mon]) weekMap[mon] = new Set()
      weekMap[mon].add(w.date)
    })

    // Record: longest consecutive run of qualifying active weeks (≥3 days/week)
    const qualifying = Object.entries(weekMap)
      .filter(([, days]) => days.size >= 3).map(([mon]) => mon).sort()
    let record = qualifying.length ? 1 : 0, runLen = 1
    for (let i = 1; i < qualifying.length; i++) {
      const diff = Math.round(
        (parseISO(qualifying[i] + 'T12:00:00') - parseISO(qualifying[i - 1] + 'T12:00:00')) / 86400000
      )
      if (diff === 7) { runLen++; record = Math.max(record, runLen) } else runLen = 1
    }

    // Get pausa type overlapping a week
    const getPausaType = (weekStart, weekEnd) => {
      for (const p of pausas) {
        const pi = p.pausaInicio || p.date
        const pf = p.pausaFin   || p.date
        if (pi <= weekEnd && pf >= weekStart) {
          return (p.pausaMotivo === 'enfermedad' || p.pausaMotivo === 'lesion') ? 'frozen' : 'paused'
        }
      }
      return null
    }

    // Current streak: walk backwards from last completed week
    const lastMon = getMondayOf(new Date())
    lastMon.setDate(lastMon.getDate() - 7)

    let current = 0, mostRecentStatus = null, emptyTol = 0
    let checkDate = new Date(lastMon)

    for (let i = 0; i < 52; i++) {
      const weekStart = toStr(checkDate)
      const weekEnd   = toStr(addDays(checkDate, 6))
      const isActive  = (weekMap[weekStart]?.size ?? 0) >= 3
      const pausaType = getPausaType(weekStart, weekEnd)

      const weekTrainingCount = weekMap[weekStart]?.size ?? 0

      if (isActive) {
        current++
        emptyTol = 0
        if (mostRecentStatus === null) mostRecentStatus = 'active'
      } else if (pausaType) {
        emptyTol = 0
        if (mostRecentStatus === null) {
          // If user trained any day during the pausa, reactivate from here
          mostRecentStatus = weekTrainingCount > 0 ? 'active' : pausaType
        }
      } else {
        emptyTol++
        if (mostRecentStatus === null) mostRecentStatus = 'empty'
        if (emptyTol >= 2) break
      }

      checkDate.setDate(checkDate.getDate() - 7)
    }

    const state = mostRecentStatus === 'active'  ? 'active'
      : mostRecentStatus === 'frozen' ? 'frozen'
      : mostRecentStatus === 'paused' ? 'paused'
      : 'broken'

    // Override: si la racha está congelada/pausada pero el usuario ya entrenó
    // en la semana actual, descongelar visualmente aunque la semana no haya terminado.
    // El loop principal no evalúa la semana en curso (solo semanas completas),
    // por eso este check adicional es necesario para reflejar el regreso al entrenamiento.
    const thisWeekMon = toStr(getMondayOf(new Date()))
    const thisWeekTrainingCount = weekMap[thisWeekMon]?.size ?? 0
    const finalState = (state === 'frozen' || state === 'paused') && thisWeekTrainingCount > 0
      ? 'active'
      : state

    return { current, record: Math.max(current, record), state: finalState }
  }

  return {
    workouts, loading, saveWorkout,
    getLastWeightsForExercise, getPRForExercise, getLearnedWeights,
    getLastFatigueForExercise, getTrainedMusclesRecovery,
    getWeekWorkouts, getCurrentStreak, reload: load,
  }
}
