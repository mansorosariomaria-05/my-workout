import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { onAuthChange } from '../services/auth'
import { getUserProfileSnapshot, saveUserProfile, getSettings, saveSettings } from '../services/db'
import { loadProfileState } from '../utils/profileLoad'

const AuthContext = createContext(null)

// Estados del perfil (ver LOGICA_TECNICA.md sección 23):
//   'idle'    sin usuario logueado
//   'loading' leyendo perfil y ajustes → pantalla "Cargando…", nunca onboarding ni la app vacía
//   'error'   falló la lectura o tardó demasiado → pantalla con "Reintentar", nunca onboarding
//   'missing' el SERVIDOR confirmó que el perfil no existe → onboarding
//   'ready'   perfil cargado (si onboardingDone no es true, se muestra el onboarding)
export function AuthProvider({ children }) {
  const [user, setUser]               = useState(undefined)
  const [profile, setProfile]         = useState(null)
  const [settings, setSettings]       = useState(null)
  const [profileStatus, setProfileStatus] = useState('idle')
  const [authTimedOut, setAuthTimedOut] = useState(false)

  const seqRef    = useRef(0)      // solo la última lectura iniciada puede actualizar el estado
  const uidRef    = useRef(null)
  const statusRef = useRef('idle')

  const setStatus = useCallback((s) => { statusRef.current = s; setProfileStatus(s) }, [])

  const loadFor = useCallback(async (firebaseUser) => {
    const seq = ++seqRef.current
    setStatus('loading') // síncrono: queda en el mismo lote de render que setUser(firebaseUser)
    const res = await loadProfileState({
      fetchProfile:  () => getUserProfileSnapshot(firebaseUser.uid),
      fetchSettings: () => getSettings(firebaseUser.uid),
    })
    if (seq !== seqRef.current) return
    if (res.status === 'error') {
      console.warn('No se pudo cargar el perfil:', res.error)
      setStatus('error')
      return
    }
    setProfile(res.profile)
    setSettings(res.settings)
    setStatus(res.status)
  }, [setStatus])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAuthTimedOut(true)
      // user queda undefined — no forzamos null para no enviar al login
    }, 15000)

    const unsub = onAuthChange((firebaseUser) => {
      clearTimeout(timeout)
      setAuthTimedOut(false)

      if (!firebaseUser) {
        seqRef.current++ // descarta cualquier lectura de perfil en vuelo
        uidRef.current = null
        setUser(null)
        setProfile(null)
        setSettings(null)
        setStatus('idle')
        return
      }

      // El mismo usuario ya cargado (p. ej. el evento se repite): no se vuelve a "cargando", para no
      // desmontar la app en uso.
      if (uidRef.current === firebaseUser.uid && statusRef.current === 'ready') {
        setUser(firebaseUser)
        return
      }

      // Usuario nuevo (login, o sesión recién restaurada): se marca "cargando" en el MISMO lote que
      // setUser, así nunca hay un render con usuario y sin perfil que caiga en el onboarding.
      uidRef.current = firebaseUser.uid
      setProfile(null)
      setSettings(null)
      setUser(firebaseUser)
      loadFor(firebaseUser)
    })

    return () => {
      clearTimeout(timeout)
      unsub()
      seqRef.current++
    }
  }, [loadFor, setStatus])

  const retryProfile = useCallback(() => {
    if (user) loadFor(user)
  }, [user, loadFor])

  // Escribe SOLO los campos recibidos, con merge: nunca reenvía el perfil completo (así una copia vieja
  // en memoria no pisa datos del servidor). El estado local sí se actualiza al instante (optimista).
  const updateProfile = async (data) => {
    if (!user) return
    setProfile(prev => ({ ...(prev ?? {}), ...data }))
    setStatus('ready')
    await saveUserProfile(user.uid, data)
  }

  // Cierre del onboarding. Antes de escribir confirma que no exista ya un perfil completo
  // (onboardingDone: true): si existe, NO lo pisa — adopta ese perfil y sigue.
  const completeOnboarding = async (data) => {
    if (!user) return
    try {
      const { profile: existing } = await getUserProfileSnapshot(user.uid)
      if (existing?.onboardingDone === true) {
        setProfile(existing)
        setStatus('ready')
        return
      }
    } catch { /* sin poder confirmarlo, se escribe igual: el estado era 'missing' o incompleto y la escritura usa merge */ }
    await updateProfile({ ...data, onboardingDone: true })
  }

  const updateSettings = async (data) => {
    if (!user) return
    const updated = { ...(settings ?? {}), ...data }
    await saveSettings(user.uid, updated)
    setSettings(updated)
  }

  // "loading": todavía no se sabe quién es el usuario, o se está leyendo su perfil.
  const loading = (user === undefined && !authTimedOut) || (!!user && profileStatus === 'loading')

  return (
    <AuthContext.Provider value={{
      user, profile, settings, profileStatus, loading, authTimedOut,
      retryProfile, updateProfile, completeOnboarding, updateSettings,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be inside AuthProvider')
  return ctx
}
