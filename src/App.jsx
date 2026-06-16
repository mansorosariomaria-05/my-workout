import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import { WorkoutDraftProvider } from './context/WorkoutDraftContext'
import AuthScreen from './components/auth/AuthScreen'
import Onboarding from './components/onboarding/Onboarding'
import Layout from './components/layout/Layout'
import Inicio from './pages/Inicio'
import Registro from './pages/Registro'
import Rutinas from './pages/Rutinas'
import Tabata from './pages/Tabata'
import Progreso from './pages/Progreso'
import ConfigPage from './components/configuracion/ConfigPage'
import SplashScreen from './components/SplashScreen'

function LoadingScreen({ message, showRetry }) {
  return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 bg-app-purple rounded-xl flex items-center justify-center">
        <span className="text-2xl">💪</span>
      </div>
      <div className="w-6 h-1 bg-app-purple/40 rounded-full animate-pulse-slow" />
      {message && (
        <p className="text-app-muted text-xs text-center max-w-[220px] mt-2 leading-snug">{message}</p>
      )}
      {showRetry && (
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ backgroundColor: 'rgba(124,92,191,0.2)', color: '#9B7FD4', border: '1px solid rgba(124,92,191,0.3)' }}
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

function AppRoutes() {
  const { user, profile, loading, authTimedOut } = useAuthContext()

  if (loading) return <LoadingScreen />

  if (authTimedOut && user === undefined) {
    return <LoadingScreen message="No pudimos verificar tu sesión. Revisá tu conexión." showRetry />
  }

  if (user === null) return <AuthScreen />
  if (!profile?.onboardingDone) return <Onboarding />

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="registro" element={<Registro />} />
        <Route path="rutinas"  element={<Rutinas />} />
        <Route path="tabata"   element={<Tabata />} />
        <Route path="progreso" element={<Progreso />} />
        <Route path="configuracion" element={<ConfigPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [swReady, setSwReady]       = useState(false)

  useEffect(() => {
    const handler = () => {
      setSwReady(true)
      setTimeout(() => setSwReady(false), 4000)
    }
    window.addEventListener('pwa-offline-ready', handler)
    return () => window.removeEventListener('pwa-offline-ready', handler)
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkoutDraftProvider>
          {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
          {splashDone && <AppRoutes />}
          {swReady && (
            <div
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg"
              style={{ backgroundColor: '#7C5CBF', whiteSpace: 'nowrap' }}
            >
              La app está lista para usar sin conexión
            </div>
          )}
        </WorkoutDraftProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
