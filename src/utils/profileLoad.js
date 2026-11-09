import { withTimeout } from './withTimeout.js'

// Carga del perfil y los ajustes del usuario con estados EXPLÍCITOS (sin React, para poder probarlo):
//   { status: 'ready',   profile, settings }  perfil leído (puede tener onboardingDone distinto de true)
//   { status: 'missing', profile: null, settings }  el SERVIDOR confirmó que el perfil no existe → onboarding
//   { status: 'error',   error }  fallo, demora excesiva o dato sin confirmar → "Reintentar", nunca onboarding
// Ver LOGICA_TECNICA.md sección 23.
export const PROFILE_LOAD_TIMEOUT_MS = 15000
export const DEFAULT_SETTINGS = { deloadActive: false, restTimerSeconds: 90, coverUrl: '' }

// fetchProfile(): { profile: objeto|null, fromCache: boolean }  (db.getUserProfileSnapshot)
// fetchSettings(): objeto de ajustes o null
export async function loadProfileState({ fetchProfile, fetchSettings, timeoutMs = PROFILE_LOAD_TIMEOUT_MS }) {
  try {
    const [snap, sett] = await withTimeout(Promise.all([fetchProfile(), fetchSettings()]), timeoutMs)
    const settings = sett ?? DEFAULT_SETTINGS
    const profile = snap?.profile ?? null

    if (!profile) {
      // "No existe" solo vale si lo confirmó el servidor. Desde el caché local no es una respuesta
      // (el SDK de Firestore ya lo rechaza, pero no se depende de eso): se trata como error.
      if (snap?.fromCache) return { status: 'error', error: new Error('El perfil no se pudo confirmar con el servidor') }
      return { status: 'missing', profile: null, settings }
    }
    // Perfil que viene del caché y todavía no está completo: puede ser un dato viejo o parcial; no se
    // muestra el onboarding sin confirmarlo con el servidor.
    if (snap.fromCache && profile.onboardingDone !== true) {
      return { status: 'error', error: new Error('Perfil incompleto en el caché local; falta confirmarlo con el servidor') }
    }
    return { status: 'ready', profile, settings }
  } catch (error) {
    return { status: 'error', error }
  }
}

// Qué pantalla corresponde según el estado de autenticación y del perfil (usado por App.jsx).
// El onboarding SOLO aparece con el perfil ya resuelto: servidor confirmó que no existe ('missing') o
// existe y onboardingDone no es true. Mientras carga ('loading') o si falla ('error') nunca.
export function screenFor({ user, profile, profileStatus, loading, authTimedOut }) {
  if (authTimedOut && user === undefined) return 'session-timeout'
  if (loading) return 'loading'
  if (user === null) return 'auth'
  if (profileStatus === 'error') return 'profile-error'
  if (profileStatus === 'missing' || (profileStatus === 'ready' && profile?.onboardingDone !== true)) return 'onboarding'
  if (profileStatus === 'ready') return 'app'
  return 'loading'
}
