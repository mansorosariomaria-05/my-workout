import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useAuthContext } from './AuthContext'
import { getTodayLocal } from '../utils/dates'
import { getWorkoutInProgress, saveWorkoutInProgress, deleteWorkoutInProgress } from '../services/db'
import { draftHasRealContent, isDraftExpired, pickNewerDraft } from '../utils/draftResolution.js'

const WorkoutDraftContext = createContext(null)

const DRAFT_KEY = (uid) => `workout_in_progress_${uid}`
const CLOUD_DEBOUNCE_MS = 5000

function readLocal(uid) {
  if (!uid) return null
  try {
    const raw = localStorage.getItem(DRAFT_KEY(uid))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeLocal(uid, data) {
  if (!uid) return
  try {
    if (data) localStorage.setItem(DRAFT_KEY(uid), JSON.stringify(data))
    else localStorage.removeItem(DRAFT_KEY(uid))
  } catch { /* almacenamiento no disponible — se sigue trabajando solo en memoria */ }
}

export function WorkoutDraftProvider({ children }) {
  const { user } = useAuthContext()
  const uid = user?.uid

  const [draft, setDraftState] = useState(() => readLocal(uid))
  const draftRef = useRef(draft)
  const uidRef = useRef(uid)
  const debounceRef = useRef(null)

  useEffect(() => { uidRef.current = uid }, [uid])

  // Cambió el usuario (login/logout) — releer el draft local del usuario correspondiente.
  useEffect(() => {
    const local = readLocal(uid)
    draftRef.current = local
    setDraftState(local)
  }, [uid])

  const flushCloudSave = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    if (uidRef.current && draftRef.current) {
      saveWorkoutInProgress(uidRef.current, draftRef.current)
    }
  }, [])

  const scheduleCloudSave = useCallback((data) => {
    if (!uidRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveWorkoutInProgress(uidRef.current, data)
    }, CLOUD_DEBOUNCE_MS)
  }, [])

  // Guardado inmediato al pasar la app a segundo plano, para no perder el debounce de 5s.
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushCloudSave() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushCloudSave)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushCloudSave)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [flushCloudSave])

  const clearDraft = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    draftRef.current = null
    setDraftState(null)
    if (uidRef.current) {
      writeLocal(uidRef.current, null)
      deleteWorkoutInProgress(uidRef.current)
    }
  }, [])

  const setDraft = useCallback((data) => {
    if (!uidRef.current) return
    if (!data) { clearDraft(); return }
    const prev = draftRef.current
    const next = {
      ...data,
      startedAt: prev?.startedAt ?? Date.now(),
      startedDate: prev?.startedDate ?? getTodayLocal(),
      updatedAt: Date.now(),
    }
    draftRef.current = next
    setDraftState(next)
    writeLocal(uidRef.current, next)
    scheduleCloudSave(next)
  }, [clearDraft, scheduleCloudSave])

  // Se llama una vez al abrir la app (Inicio) para reconciliar local vs. nube. Si la nube tiene
  // la versión más reciente, sustituye el estado local por esa. Devuelve el draft "ganador" listo
  // para mostrar en el modal de continuar, o null si no corresponde ofrecer nada.
  const resolveDraft = useCallback(async () => {
    if (!uidRef.current) return null
    const local = readLocal(uidRef.current)
    const cloud = await getWorkoutInProgress(uidRef.current)
    const winner = pickNewerDraft(local, cloud)

    if (winner && winner !== local) {
      draftRef.current = winner
      setDraftState(winner)
      writeLocal(uidRef.current, winner)
    }

    if (!winner) return null
    if (isDraftExpired(winner)) { clearDraft(); return null }
    if (!draftHasRealContent(winner)) return null
    return winner
  }, [clearDraft])

  return (
    <WorkoutDraftContext.Provider value={{ draft, setDraft, clearDraft, resolveDraft }}>
      {children}
    </WorkoutDraftContext.Provider>
  )
}

export const useWorkoutDraft = () => useContext(WorkoutDraftContext)
