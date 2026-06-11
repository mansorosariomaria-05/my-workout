import { useState, useEffect, useCallback } from 'react'
import { getWorkouts, saveWorkout as dbSaveWorkout } from '../services/db'
import { dateToLocal } from '../utils/dates'

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
    const data = await getWorkouts(uid, 100)
    setWorkouts(data)
    writeCache(uid, data)
    setLoading(false)
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
    const id = await dbSaveWorkout(uid, workout)
    await load(true)
    return id
  }

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
    const end = new Date(weekStartStr)
    end.setDate(end.getDate() + 6)
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
      const mon = toStr(getMondayOf(new Date(w.date + 'T12:00:00')))
      if (!weekMap[mon]) weekMap[mon] = new Set()
      weekMap[mon].add(w.date)
    })

    // Record: longest consecutive run of qualifying active weeks (≥3 days/week)
    const qualifying = Object.entries(weekMap)
      .filter(([, days]) => days.size >= 3).map(([mon]) => mon).sort()
    let record = qualifying.length ? 1 : 0, runLen = 1
    for (let i = 1; i < qualifying.length; i++) {
      const diff = Math.round(
        (new Date(qualifying[i] + 'T12:00:00') - new Date(qualifying[i - 1] + 'T12:00:00')) / 86400000
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

      if (isActive) {
        current++
        emptyTol = 0
        if (mostRecentStatus === null) mostRecentStatus = 'active'
      } else if (pausaType) {
        emptyTol = 0
        if (mostRecentStatus === null) mostRecentStatus = pausaType
        // frozen/paused: don't break streak, don't increment current
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

    return { current, record: Math.max(current, record), state }
  }

  return {
    workouts, loading, saveWorkout,
    getLastWeightsForExercise, getPRForExercise,
    getLastFatigueForExercise, getTrainedMusclesRecovery,
    getWeekWorkouts, getCurrentStreak, reload: load,
  }
}
