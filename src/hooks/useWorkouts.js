import { useState, useEffect, useCallback, useRef } from 'react'
import { parseISO } from 'date-fns'
import { getWorkoutsSnapshot, saveWorkout as dbSaveWorkout, newWorkoutId } from '../services/db'
import { dateToLocal } from '../utils/dates'
import { getDrafts } from '../utils/draftQueue'
import { computeStreak } from '../utils/streak'
import {
  saveWorkoutWithFallback, composeWorkoutList, loadWorkoutsSafely, syncPendingDrafts,
} from '../utils/workoutSave'

const CACHE_KEY = (uid) => `workouts_cache_${uid}`
const LOAD_TIMEOUT_MS = 15000

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

// Guardado, carga y sincronización fiables: ver LOGICA_TECNICA.md sección 22.
export function useWorkouts(uid) {
  const cached = uid ? readCache(uid) : null
  const [workouts, setWorkouts] = useState(() => (uid ? composeWorkoutList(uid, cached ?? []) : []))
  const [loading, setLoading]   = useState(!cached)
  const [loadError, setLoadError] = useState(false)

  // Contador de lecturas: solo la última lectura iniciada puede actualizar el estado (una respuesta
  // vieja y lenta nunca pisa a una más nueva).
  const loadSeq = useRef(0)
  // Workouts subidos en esta sesión (guardados o sincronizados) que la lectura del servidor todavía
  // puede no incluir: se mantienen visibles hasta que el servidor los devuelve.
  const recentRef = useRef(new Map())

  const load = useCallback(async (silent = false) => {
    if (!uid) return false
    const seq = ++loadSeq.current
    if (!silent) setLoading(true)
    try {
      const res = await loadWorkoutsSafely({
        uid,
        fetchSnapshot: () => getWorkoutsSnapshot(uid, 100),
        readCache: () => readCache(uid),
        writeCache: (data) => writeCache(uid, data),
        recent: recentRef.current,
        isStale: () => seq !== loadSeq.current, // respuesta vieja: se ignora
        timeoutMs: LOAD_TIMEOUT_MS,
      })
      if (res.stale) return false
      if (res.ok) {
        setWorkouts(res.list)
        setLoadError(false)
        return true
      }
      // Error de lectura: NO se toca el caché local ni el estado actual (antes se pisaban con []).
      console.warn('No se pudo leer el historial, se conserva el estado y el caché local:', res.error)
      setLoadError(true)
      setWorkouts(prev => (prev.length ? prev : composeWorkoutList(uid, readCache(uid) ?? [], recentRef.current)))
      return false
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [uid])

  const writeWorkout = useCallback((w, meta) => dbSaveWorkout(uid, w, null, meta), [uid])

  // Sube los borradores pendientes (candado compartido en draftQueue.syncDrafts: nunca corren dos a la vez).
  const syncPending = useCallback(async () => {
    if (!uid || !getDrafts(uid).length) return 0
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0
    const { synced } = await syncPendingDrafts(uid, writeWorkout, (w) => { recentRef.current.set(w.id, w) })
    if (synced > 0) {
      setWorkouts(prev => composeWorkoutList(uid, prev.filter(w => !w._pendingSync), recentRef.current))
      await load(true)
    }
    return synced
  }, [uid, writeWorkout, load])

  // Al abrir: lee y, si hay conexión, sube lo que haya quedado pendiente de sesiones anteriores
  // (antes solo se sincronizaba ante un evento 'online').
  useEffect(() => {
    if (!uid) return
    ;(async () => {
      await load(!!cached)
      await syncPending()
    })()
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!uid) return
    const handleOnline = async () => {
      const synced = await syncPending()
      if (!synced) await load(true) // también repara una lectura que había fallado sin red
    }
    const handleVisible = () => { if (document.visibilityState === 'visible') syncPending() }
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisible)
    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [uid, load, syncPending])

  // Devuelve { id, pending }. pending: true = quedó como borrador local (sin conexión o sin confirmación
  // en ~8 s) y se sube solo cuando haya red. Lanza (code 'draft-storage-failed') únicamente si ni el
  // borrador local se pudo guardar.
  const saveWorkout = async (workout) => {
    const result = await saveWorkoutWithFallback({ uid, workout, newId: newWorkoutId, write: writeWorkout })
    if (!result.pending) {
      recentRef.current.set(result.id, result.workout)
      writeCache(uid, [result.workout, ...(readCache(uid) ?? []).filter(w => w.id !== result.id)])
    }
    // Visible de inmediato en ambos casos (subido o borrador).
    setWorkouts(prev => composeWorkoutList(uid, prev.filter(w => !w._pendingSync), recentRef.current))
    if (!result.pending) {
      load(true) // sincroniza con Firestore en segundo plano (sin await)
      syncPending() // aprovecha la conexión para subir otros borradores
    } else if (typeof navigator !== 'undefined' && navigator.onLine) {
      // Había conexión pero no se confirmó a tiempo: reintenta en un rato (mismo ID, no duplica).
      setTimeout(() => { syncPending() }, 20000)
    }
    return { id: result.id, pending: result.pending }
  }

  const getLastWeightsForExercise = (exerciseId) => {
    // No asumir orden: los drafts offline pendientes de sync pueden anteponerse sin garantía de fecha.
    const relevant = workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === exerciseId))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
    return relevant.map(w => {
      const ex = w.exercises.find(e => e.exerciseId === exerciseId)
      return { date: w.date, sets: ex?.sets ?? [], fatigue: w.fatigue }
    })
  }

  // Historial completo (sin slice) de un ejercicio, ordenado por fecha descendente — usado por
  // el modo regreso (src/utils/reentry.js), que necesita ver más allá de las últimas 5 sesiones.
  const getExerciseSessions = (exerciseId) => {
    const relevant = workouts
      .filter(w => w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === exerciseId))
      .sort((a, b) => b.date.localeCompare(a.date))
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
    // No asumir orden (ver getLastWeightsForExercise) — acá no cambia el resultado (es una unión de
    // pesos, sin importar orden), pero se ordena explícitamente por consistencia con el resto.
    workouts
      .filter(w => w.type === 'fuerza')
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(w => {
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
    workouts, loading, loadError, saveWorkout,
    getLastWeightsForExercise, getExerciseSessions, getPRForExercise, getLearnedWeights,
    getLastFatigueForExercise, getTrainedMusclesRecovery,
    getWeekWorkouts, getCurrentStreak, reload: load,
  }
}
