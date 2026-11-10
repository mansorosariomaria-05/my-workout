import { createContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuthContext } from './AuthContext'
import { getWorkoutsSnapshot, saveWorkout as dbSaveWorkout, newWorkoutId } from '../services/db'
import { getDrafts } from '../utils/draftQueue'
import { normalizeWorkouts } from '../utils/exerciseAliases'
import { readWorkoutCache, writeWorkoutCache } from '../utils/workoutCache'
import {
  saveWorkoutWithFallback, composeWorkoutList, loadWorkoutsSafely, syncPendingDrafts,
} from '../utils/workoutSave'

// Estado ÚNICO y compartido del historial de workouts: una sola carga, una sola sincronización de
// borradores y un solo conjunto de listeners para toda la app (antes cada useWorkouts() tenía los suyos).
// Las pantallas lo leen con useWorkouts() (src/hooks/useWorkouts.js). Ver LOGICA_TECNICA.md sección 22.
export const WorkoutsContext = createContext(null)

// El historial es COMPLETO (sin límite), así que la primera lectura puede tardar más que antes.
const LOAD_TIMEOUT_MS = 30000
// refresh() (visibilitychange / cambio de día en Inicio) no vuelve a leer si la última lectura exitosa
// fue hace menos de esto: cada lectura cuesta una lectura de Firestore por workout.
const REFRESH_MIN_INTERVAL_MS = 60000

function initState(uid) {
  const cached = uid ? readWorkoutCache(uid) : null
  return {
    uid,
    list: uid ? composeWorkoutList(uid, cached ?? []) : [],
    loading: !!uid && !cached,
    loadError: false,
  }
}

export function WorkoutsProvider({ children }) {
  const { user } = useAuthContext()
  const uid = user?.uid ?? null

  const [state, setState] = useState(() => initState(uid))

  const uidRef = useRef(uid)
  // Contador de lecturas: solo la última lectura iniciada puede actualizar el estado.
  const loadSeq = useRef(0)
  // Workouts subidos en esta sesión que la lectura del servidor todavía puede no incluir.
  const recentRef = useRef(new Map())
  const lastOkRef = useRef(0)

  // Aplica un cambio solo si el estado sigue siendo del mismo usuario (un logout/login no recibe datos ajenos).
  const update = useCallback((forUid, patch) => {
    setState(prev => (prev.uid !== forUid ? prev : { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }))
  }, [])

  const load = useCallback(async (forUid, silent = false) => {
    if (!forUid) return false
    const seq = ++loadSeq.current
    if (!silent) update(forUid, { loading: true })
    try {
      const res = await loadWorkoutsSafely({
        uid: forUid,
        fetchSnapshot: () => getWorkoutsSnapshot(forUid), // sin límite: historial completo
        readCache: () => readWorkoutCache(forUid),
        writeCache: (data) => writeWorkoutCache(forUid, data),
        recent: recentRef.current,
        isStale: () => seq !== loadSeq.current, // respuesta vieja: se ignora
        timeoutMs: LOAD_TIMEOUT_MS,
      })
      if (res.stale) return false
      if (res.ok) {
        lastOkRef.current = Date.now()
        update(forUid, { list: res.list, loadError: false })
        return true
      }
      // Error de lectura: NO se toca el caché local ni el estado actual.
      console.warn('No se pudo leer el historial, se conserva el estado y el caché local:', res.error)
      update(forUid, prev => ({
        loadError: true,
        list: prev.list.length ? prev.list : composeWorkoutList(forUid, readWorkoutCache(forUid) ?? [], recentRef.current),
      }))
      return false
    } finally {
      if (seq === loadSeq.current) update(forUid, { loading: false })
    }
  }, [update])

  const writeWorkout = useCallback((w, meta) => dbSaveWorkout(uidRef.current, w, null, meta), [])

  // Sube los borradores pendientes (candado compartido en draftQueue.syncDrafts: nunca corren dos a la vez).
  const syncPending = useCallback(async (forUid) => {
    if (!forUid || !getDrafts(forUid).length) return 0
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0
    const { synced } = await syncPendingDrafts(forUid, writeWorkout, (w) => { recentRef.current.set(w.id, w) })
    if (synced > 0) {
      update(forUid, prev => ({ list: composeWorkoutList(forUid, prev.list.filter(w => !w._pendingSync), recentRef.current) }))
      await load(forUid, true)
    }
    return synced
  }, [writeWorkout, update, load])

  // Al abrir (o cambiar de usuario): muestra el caché al instante, lee TODO el historial en segundo plano
  // y, si hay conexión, sube lo que haya quedado pendiente de sesiones anteriores.
  useEffect(() => {
    uidRef.current = uid
    loadSeq.current++ // invalida lecturas en vuelo del usuario anterior
    recentRef.current = new Map()
    lastOkRef.current = 0
    setState(prev => (prev.uid === uid ? prev : initState(uid)))
    if (!uid) return
    ;(async () => {
      await load(uid, !!readWorkoutCache(uid))
      await syncPending(uid)
    })()
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps

  // UN solo conjunto de listeners para toda la app.
  useEffect(() => {
    if (!uid) return
    const handleOnline = async () => {
      const synced = await syncPending(uid)
      if (!synced) await load(uid, true) // también repara una lectura que había fallado sin red
    }
    const handleVisible = () => { if (document.visibilityState === 'visible') syncPending(uid) }
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisible)
    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [uid, load, syncPending])

  // Releer ahora, sin esperar (para acciones del usuario como importar datos).
  const forceReload = useCallback(() => load(uidRef.current, true), [load])

  // Releer con freno: no repite si la última lectura exitosa es de hace menos de REFRESH_MIN_INTERVAL_MS.
  const refresh = useCallback(() => {
    const u = uidRef.current
    if (!u || Date.now() - lastOkRef.current < REFRESH_MIN_INTERVAL_MS) return Promise.resolve(false)
    return load(u, true)
  }, [load])

  // Devuelve { id, pending }. pending: true = quedó como borrador local (sin conexión o sin confirmación
  // en ~8 s) y se sube solo cuando haya red. Lanza (code 'draft-storage-failed') únicamente si ni el
  // borrador local se pudo guardar.
  const saveWorkout = useCallback(async (workout) => {
    const u = uidRef.current
    if (!u) throw new Error('No hay usuario para guardar el entrenamiento')
    const result = await saveWorkoutWithFallback({ uid: u, workout, newId: newWorkoutId, write: writeWorkout })
    if (!result.pending) {
      recentRef.current.set(result.id, result.workout)
      writeWorkoutCache(u, [result.workout, ...(readWorkoutCache(u) ?? []).filter(w => w.id !== result.id)])
    }
    // Visible de inmediato en ambos casos (subido o borrador).
    update(u, prev => ({ list: composeWorkoutList(u, prev.list.filter(w => !w._pendingSync), recentRef.current) }))
    if (!result.pending) {
      load(u, true) // sincroniza con Firestore en segundo plano (sin await)
      syncPending(u) // aprovecha la conexión para subir otros borradores
    } else if (typeof navigator !== 'undefined' && navigator.onLine) {
      // Había conexión pero no se confirmó a tiempo: reintenta en un rato (mismo ID, no duplica).
      setTimeout(() => { syncPending(u) }, 20000)
    }
    return { id: result.id, pending: result.pending }
  }, [writeWorkout, update, load, syncPending])

  // Alias de ejercicios fusionados (data/exercises.js → EXERCISE_ALIASES): el estado interno, el caché local y
  // los borradores conservan los ids tal como se guardaron (nada se reescribe en Firestore); acá, en el ÚNICO
  // punto por el que el resto de la app lee el historial, cada exerciseId / originalExerciseId pasa a su id
  // canónico (y name al del catálogo). Cubre lo leído de Firestore, del caché y de los borradores sin subir.
  const workouts = useMemo(() => (state.uid === uid ? normalizeWorkouts(state.list) : []), [state.uid, state.list, uid])

  const value = {
    workouts,
    loading: state.uid === uid ? state.loading : !!uid,
    loadError: state.loadError,
    saveWorkout, refresh, forceReload,
  }

  return <WorkoutsContext.Provider value={value}>{children}</WorkoutsContext.Provider>
}
