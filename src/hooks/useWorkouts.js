import { useState, useEffect, useCallback } from 'react'
import { parseISO } from 'date-fns'
import { getWorkouts, saveWorkout as dbSaveWorkout } from '../services/db'
import { dateToLocal } from '../utils/dates'
import { getDrafts, saveDraft, syncDrafts } from '../utils/draftQueue'
import { computeStreak } from '../utils/streak'

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
      // return an outdated value. Optimistic update ensures the cache is always current
      // on navigation.
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

  // Returns { current, record } — ver src/utils/streak.js para la regla completa.
  const getCurrentStreak = () => computeStreak(workouts)

  return {
    workouts, loading, saveWorkout,
    getLastWeightsForExercise, getPRForExercise, getLearnedWeights,
    getLastFatigueForExercise, getTrainedMusclesRecovery,
    getWeekWorkouts, getCurrentStreak, reload: load,
  }
}
