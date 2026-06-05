import { useState } from 'react'
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

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 bg-app-purple rounded-xl flex items-center justify-center">
        <span className="text-2xl">💪</span>
      </div>
      <div className="w-6 h-1 bg-app-purple/40 rounded-full animate-pulse-slow" />
    </div>
  )
}

function AppRoutes() {
  const { user, profile, loading } = useAuthContext()

  if (loading) return <LoadingScreen />
  if (!user)   return <AuthScreen />
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

  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkoutDraftProvider>
          {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
          {splashDone && <AppRoutes />}
        </WorkoutDraftProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
