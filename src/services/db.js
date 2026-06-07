import { db } from '../firebase'
import {
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, query,
  orderBy, limit, where, deleteDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { weekKey } from '../utils/dates'

// ─── Profile ──────────────────────────────────────────────────────────────────
export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'profile'))
  return snap.exists() ? snap.data() : null
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
export const saveWorkout = async (uid, workout, dateStr = null) => {
  try {
    const ref = await addDoc(collection(db, 'users', uid, 'workouts'), {
      ...workout,
      createdAt: dateStr ? Timestamp.fromDate(new Date(dateStr)) : serverTimestamp(),
    })
    return ref.id
  } catch (error) {
    console.error('Error guardando entrenamiento:', error.code, error.message, error)
    throw error
  }
}

export const getWorkouts = async (uid, limitN = 50) => {
  const q = query(
    collection(db, 'users', uid, 'workouts'),
    orderBy('date', 'desc'),
    limit(limitN)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getWorkoutsByDateRange = async (uid, startDate, endDate) => {
  const q = query(
    collection(db, 'users', uid, 'workouts'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getWorkoutsForExercise = async (uid, exerciseId) => {
  const workouts = await getWorkouts(uid, 100)
  return workouts.filter(w =>
    w.type === 'fuerza' && w.exercises?.some(e => e.exerciseId === exerciseId)
  )
}

// ─── Intentions ───────────────────────────────────────────────────────────────
export const getIntention = async (uid) => {
  const key = weekKey()
  const snap = await getDoc(doc(db, 'users', uid, 'intentions', key))
  return snap.exists() ? snap.data() : null
}

export const saveIntention = async (uid, text) => {
  const key = weekKey()
  await setDoc(doc(db, 'users', uid, 'intentions', key), {
    text, weekStart: key, savedAt: serverTimestamp(),
  })
}

export const getIntentionHistory = async (uid) => {
  const q = query(
    collection(db, 'users', uid, 'intentions'),
    orderBy('weekStart', 'desc'),
    limit(12)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

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
export const getFavorites = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'favorites'))
  return snap.exists() ? (snap.data().ids ?? []) : []
}

export const toggleFavorite = async (uid, exerciseId, currentList) => {
  const updated = currentList.includes(exerciseId)
    ? currentList.filter(id => id !== exerciseId)
    : [...currentList, exerciseId]
  await setDoc(doc(db, 'users', uid, 'data', 'favorites'), { ids: updated })
  return updated
}

export const getNeverList = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'never'))
  return snap.exists() ? (snap.data().ids ?? []) : []
}

export const toggleNever = async (uid, exerciseId, currentList) => {
  const updated = currentList.includes(exerciseId)
    ? currentList.filter(id => id !== exerciseId)
    : [...currentList, exerciseId]
  await setDoc(doc(db, 'users', uid, 'data', 'never'), { ids: updated })
  return updated
}

// ─── Custom Routines ──────────────────────────────────────────────────────────
export const getCustomRoutines = async (uid) => {
  const q = query(collection(db, 'users', uid, 'customRoutines'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
    date: new Date().toISOString().split('T')[0],
    createdAt: serverTimestamp(),
  })
}

export const getTabataSettings = async (uid, tabataId) => {
  const snap = await getDoc(doc(db, 'users', uid, 'tabataSettings', tabataId))
  return snap.exists() ? snap.data() : null
}

export const saveTabataSettings = async (uid, tabataId, settings) => {
  await setDoc(doc(db, 'users', uid, 'tabataSettings', tabataId), settings)
}
