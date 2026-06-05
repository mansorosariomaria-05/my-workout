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
      // Tiene caché: mostrar inmediato y actualizar en segundo plano
      load(true)
    } else {
      // Sin caché: carga normal con spinner
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

  const getTrainedMusclesLast48h = () => {
    const cutoff = new Date()
    cutoff.setHours(cutoff.getHours() - 72)
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

  const getCurrentStreak = () => {
    const realWorkouts = workouts.filter(w => w.type !== 'descanso' && w.date)
    if (!realWorkouts.length) return { current: 0, record: 0 }

    const getMondayOf = (date) => {
      const d = new Date(date)
      const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1)
      d.setHours(0, 0, 0, 0)
      return d
    }

    const toLocalStr = (date) => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return y + '-' + m + '-' + d
    }

    const thisMonday = getMondayOf(new Date())
    const lastMonday = new Date(thisMonday)
    lastMonday.setDate(lastMonday.getDate() - 7)

    let streak = 0
    let checkMonday = new Date(lastMonday)

    for (let i = 0; i < 52; i++) {
      const weekStart = toLocalStr(checkMonday)
      const weekEndDate = new Date(checkMonday)
      weekEndDate.setDate(weekEndDate.getDate() + 6)
      const weekEnd = toLocalStr(weekEndDate)

      const daysSet = new Set(
        realWorkouts
          .filter(w => w.date >= weekStart && w.date <= weekEnd)
          .map(w => w.date)
      )

      if (daysSet.size >= 3) {
        streak++
        checkMonday.setDate(checkMonday.getDate() - 7)
      } else {
        break
      }
    }

    return { current: streak, record: streak }
  }

  return {
    workouts, loading, saveWorkout,
    getLastWeightsForExercise, getPRForExercise,
    getLastFatigueForExercise, getTrainedMusclesLast48h,
    getWeekWorkouts, getCurrentStreak, reload: load,
  }
}
