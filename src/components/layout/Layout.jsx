import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import BottomNav from './BottomNav'
import { useWorkoutDraft } from '../../context/WorkoutDraftContext'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export default function Layout() {
  const { draft, clearDraft } = useWorkoutDraft()
  const location   = useLocation()
  const navigate   = useNavigate()
  const showBanner = !!draft && location.pathname !== '/registro'
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const isOnline = useOnlineStatus()
  const [connectionRestored, setConnectionRestored] = useState(false)
  const prevOnlineRef = useRef(isOnline)

  useEffect(() => {
    if (prevOnlineRef.current === false && isOnline) {
      setConnectionRestored(true)
      const t = setTimeout(() => setConnectionRestored(false), 3000)
      return () => clearTimeout(t)
    }
    prevOnlineRef.current = isOnline
  }, [isOnline])

  const offlineBarHeight = !isOnline ? 40 : 0
  const draftBarHeight   = showBanner  ? 44 : 0
  const totalTopOffset   = offlineBarHeight + draftBarHeight

  return (
    <div className="min-h-screen bg-app-bg flex justify-center">
      <div className="w-full max-w-mobile min-h-screen relative">

        {/* Offline banner */}
        {!isOnline && (
          <div
            className="fixed top-0 left-0 right-0 z-[55] flex items-center gap-2 px-4"
            style={{ backgroundColor: '#92400e', height: '40px' }}
          >
            <WifiOff size={14} className="text-white/80 shrink-0" />
            <span className="text-white text-xs font-medium">Sin conexión · Usando datos guardados</span>
          </div>
        )}

        {/* Draft banner */}
        {showBanner && (
          <div
            onClick={() => navigate('/registro')}
            className="fixed left-0 right-0 z-50 flex items-center justify-between px-4 cursor-pointer"
            style={{ backgroundColor: '#7C5CBF', height: '44px', top: `${offlineBarHeight}px` }}
          >
            <button
              onClick={e => { e.stopPropagation(); setShowCancelConfirm(true) }}
              className="text-white/70 p-1 -ml-1 flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="text-white text-sm font-medium">⚡ Tenés un entrenamiento en curso</span>
            <span className="text-white text-sm font-semibold">Continuar →</span>
          </div>
        )}

        <main
          className="pb-24 min-h-screen overflow-y-auto"
          style={totalTopOffset > 0 ? { paddingTop: `${totalTopOffset}px` } : undefined}
        >
          <Outlet />
        </main>
        <BottomNav />

        {/* Connection restored toast */}
        {connectionRestored && (
          <div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg"
            style={{ backgroundColor: '#15803d', whiteSpace: 'nowrap' }}
          >
            ✓ Conexión restaurada
          </div>
        )}

        {showCancelConfirm && (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-6">
            <div className="bg-app-elevated rounded-2xl p-6 w-full max-w-xs border border-white/10">
              <p className="text-app-text font-semibold text-base mb-1">¿Cancelar el entrenamiento?</p>
              <p className="text-app-muted text-sm mb-5">Perderás lo registrado hasta ahora.</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { clearDraft(); setShowCancelConfirm(false); navigate('/') }}
                  className="py-3 rounded-xl bg-app-coral text-white font-medium"
                >
                  Sí, cancelar
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="py-3 rounded-xl bg-app-bg text-app-muted border border-white/10"
                >
                  No, continuar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
