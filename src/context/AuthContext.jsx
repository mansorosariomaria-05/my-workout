import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthChange } from '../services/auth'
import { getUserProfile, saveUserProfile, getSettings, saveSettings } from '../services/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(undefined)
  const [profile, setProfile]         = useState(null)
  const [settings, setSettings]       = useState(null)
  const [loading, setLoading]         = useState(true)
  const [authTimedOut, setAuthTimedOut] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAuthTimedOut(true)
      setLoading(false)
      // user queda undefined — no forzamos null para no enviar al login
    }, 15000)

    const unsub = onAuthChange(async (firebaseUser) => {
      clearTimeout(timeout)
      setAuthTimedOut(false)
      setUser(firebaseUser)
      if (firebaseUser) {
        const [prof, sett] = await Promise.all([
          getUserProfile(firebaseUser.uid),
          getSettings(firebaseUser.uid),
        ])
        setProfile(prof)
        setSettings(sett ?? { deloadActive: false, restTimerSeconds: 90, coverUrl: '' })
      } else {
        setProfile(null)
        setSettings(null)
      }
      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      unsub()
    }
  }, [])

  const updateProfile = async (data) => {
    if (!user) return
    const updated = { ...(profile ?? {}), ...data }
    setProfile(updated) // optimistic: refleja el cambio en memoria/cache antes de que confirme Firestore
    await saveUserProfile(user.uid, updated)
  }

  const updateSettings = async (data) => {
    if (!user) return
    const updated = { ...(settings ?? {}), ...data }
    await saveSettings(user.uid, updated)
    setSettings(updated)
  }

  return (
    <AuthContext.Provider value={{ user, profile, settings, loading, authTimedOut, updateProfile, updateSettings }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be inside AuthProvider')
  return ctx
}
