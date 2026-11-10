import { db } from '../firebase'
import {
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, query,
  orderBy, limit, deleteDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { parseLocalDate, getTodayLocal } from '../utils/dates'
import { canonicalExerciseId } from '../data/exercises'
import { normalizeIdList, normalizeInProgress, normalizeRoutines } from '../utils/exerciseAliases'

// ─── Profile ──────────────────────────────────────────────────────────────────
// profile: los datos, o null si el documento no existe. fromCache: true si NO viene confirmado por el
// servidor (con el SDK, un documento inexistente desde el caché rechaza en vez de devolver null; igual
// el llamador debe tratar "null + fromCache" como no confirmado, nunca como "perfil nuevo").
export const getUserProfileSnapshot = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'profile'))
  return { profile: snap.exists() ? snap.data() : null, fromCache: snap.metadata.fromCache }
}

export const saveUserProfile = async (uid, profile) => {
  await setDoc(doc(db, 'users', uid, 'data', 'profile'), profile, { merge: true })
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export const getSettings = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'settings'))
  return snap.exists() ? snap.data() : { deloadActive: false, restTimerSeconds: 90, coverUrl: '' }
}

export const saveSettings = async (uid, settings) => {
  await setDoc(doc(db, 'users', uid, 'data', 'settings'), settings, { merge: true })
}

// ─── Workouts ─────────────────────────────────────────────────────────────────
// ID definitivo de un workout nuevo: se genera en el cliente (no necesita red), así el workout lo tiene
// desde que se crea y todo reintento de subida sobrescribe el mismo documento en vez de duplicarlo.
export const newWorkoutId = (uid) => doc(collection(db, 'users', uid, 'workouts')).id

// opts.id: ID fijo → setDoc (idempotente). Sin id → addDoc (solo la importación de datos de ConfigPage).
// opts.createdAtMs: createdAt determinístico para que los reintentos escriban exactamente lo mismo.
export const saveWorkout = async (uid, workout, dateStr = null, opts = {}) => {
  const { id = null, createdAtMs = null } = opts
  const createdAt = dateStr
    ? Timestamp.fromDate(parseLocalDate(dateStr))
    : (createdAtMs ? Timestamp.fromMillis(createdAtMs) : serverTimestamp())
  try {
    if (id) {
      await setDoc(doc(db, 'users', uid, 'workouts', id), { ...workout, createdAt })
      return id
    }
    const ref = await addDoc(collection(db, 'users', uid, 'workouts'), { ...workout, createdAt })
    return ref.id
  } catch (error) {
    console.error('Error guardando entrenamiento:', error.code, error.message, error)
    throw error
  }
}

// Lectura de workouts (por defecto TODOS). Un error de lectura SE PROPAGA (antes devolvía [], lo que no se
// distinguía de "no hay workouts" y vaciaba la pantalla y el caché local). fromCache indica que el
// resultado vino del caché de Firestore (sin confirmar con el servidor).
// limitN: tope de documentos; null/undefined = TODOS los workouts del usuario (lo que usa el historial
// principal, ver WorkoutsContext). Pasar un número solo tiene sentido para vistas que de verdad quieran
// "los N más recientes".
export const getWorkoutsSnapshot = async (uid, limitN = null) => {
  const q = query(
    collection(db, 'users', uid, 'workouts'),
    orderBy('date', 'desc'),
    ...(limitN ? [limit(limitN)] : [])
  )
  const snap = await getDocs(q)
  return {
    workouts: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    fromCache: snap.metadata.fromCache,
  }
}

export const getWorkouts = async (uid, limitN = null) => (await getWorkoutsSnapshot(uid, limitN)).workouts

// ─── Achievements ─────────────────────────────────────────────────────────────
export const getAchievements = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'achievements'))
  return snap.exists() ? snap.data() : {}
}

export const unlockAchievement = async (uid, key, detail) => {
  const data = { unlocked: true, at: serverTimestamp() }
  if (detail) data.detail = detail
  await setDoc(doc(db, 'users', uid, 'data', 'achievements'), {
    [key]: data,
  }, { merge: true })
}

// ─── Favorites & Never ────────────────────────────────────────────────────────
// Los ids se leen ya traducidos a su id canónico y sin duplicados (alias de ejercicios fusionados).
export const getFavorites = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'favorites'))
  return snap.exists() ? normalizeIdList(snap.data().ids ?? []) : []
}

export const toggleFavorite = async (uid, exerciseId, currentList) => {
  const id = canonicalExerciseId(exerciseId)
  const list = normalizeIdList(currentList ?? [])
  const updated = list.includes(id)
    ? list.filter(x => x !== id)
    : [...list, id]
  await setDoc(doc(db, 'users', uid, 'data', 'favorites'), { ids: updated })
  return updated
}

export const getNeverList = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'never'))
  return snap.exists() ? normalizeIdList(snap.data().ids ?? []) : []
}

export const toggleNever = async (uid, exerciseId, currentList) => {
  const id = canonicalExerciseId(exerciseId)
  const list = normalizeIdList(currentList ?? [])
  const updated = list.includes(id)
    ? list.filter(x => x !== id)
    : [...list, id]
  await setDoc(doc(db, 'users', uid, 'data', 'never'), { ids: updated })
  return updated
}

// ─── Entrenamiento en curso (respaldo en la nube) ──────────────────────────────
// Falla en silencio: sin red, el guardado local alcanza y esto sincroniza cuando vuelva la conexión.
export const getWorkoutInProgress = async (uid) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'data', 'workoutInProgress'))
    return snap.exists() ? normalizeInProgress(snap.data()) : null
  } catch (err) {
    console.warn('getWorkoutInProgress sin red:', err)
    return null
  }
}

export const saveWorkoutInProgress = async (uid, draftData) => {
  try {
    await setDoc(doc(db, 'users', uid, 'data', 'workoutInProgress'), draftData)
  } catch (err) {
    console.warn('saveWorkoutInProgress sin red, sigue solo en local:', err)
  }
}

export const deleteWorkoutInProgress = async (uid) => {
  try {
    await deleteDoc(doc(db, 'users', uid, 'data', 'workoutInProgress'))
  } catch (err) {
    console.warn('deleteWorkoutInProgress sin red:', err)
  }
}

// ─── Custom Routines ──────────────────────────────────────────────────────────
export const getCustomRoutines = async (uid) => {
  const q = query(collection(db, 'users', uid, 'customRoutines'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return normalizeRoutines(snap.docs.map(d => ({ id: d.id, ...d.data() })))
}

export const saveCustomRoutine = async (uid, routine) => {
  await addDoc(collection(db, 'users', uid, 'customRoutines'), {
    ...routine,
    createdAt: serverTimestamp(),
  })
}

export const updateCustomRoutine = async (uid, routineId, updates) => {
  await updateDoc(doc(db, 'users', uid, 'customRoutines', routineId), updates)
}

export const deleteCustomRoutine = async (uid, routineId) => {
  await deleteDoc(doc(db, 'users', uid, 'customRoutines', routineId))
}

// ─── Custom Exercises ─────────────────────────────────────────────────────────
export const getCustomExercises = async (uid) => {
  const q = query(collection(db, 'users', uid, 'customExercises'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const saveCustomExercise = async (uid, exercise) => {
  await addDoc(collection(db, 'users', uid, 'customExercises'), exercise)
}

export const deleteCustomExercise = async (uid, exerciseId) => {
  await deleteDoc(doc(db, 'users', uid, 'customExercises', exerciseId))
}

// ─── Tabata Records ───────────────────────────────────────────────────────────
export const saveTabataRecord = async (uid, tabataId, tabataName) => {
  await addDoc(collection(db, 'users', uid, 'tabataRecords'), {
    tabataId, tabataName,
    date: getTodayLocal(),
    createdAt: serverTimestamp(),
  })
}

export const getTabataRecordCount = async (uid) => {
  const snap = await getDocs(collection(db, 'users', uid, 'tabataRecords'))
  return snap.size
}

export const getTabataSettings = async (uid, tabataId) => {
  const snap = await getDoc(doc(db, 'users', uid, 'tabataSettings', tabataId))
  return snap.exists() ? snap.data() : null
}

export const saveTabataSettings = async (uid, tabataId, settings) => {
  await setDoc(doc(db, 'users', uid, 'tabataSettings', tabataId), settings)
}
