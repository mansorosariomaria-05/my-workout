import { useState, useEffect, useRef } from 'react'

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.6, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.8)
  } catch {}
}

export default function RestTimer({ defaultSeconds = 90, onClose }) {
  const [seconds, setSeconds] = useState(defaultSeconds)
  const [running, setRunning] = useState(false)
  const [done, setDone]       = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            setDone(true)
            playBeep()
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const pct = ((defaultSeconds - seconds) / defaultSeconds) * 100
  const min = Math.floor(seconds / 60)
  const sec = String(seconds % 60).padStart(2, '0')
  const radius = 44
  const circ = 2 * Math.PI * radius
  const dash = circ - (pct / 100) * circ

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="bg-app-elevated rounded-2xl p-6 mx-4 w-full max-w-[280px] animate-scaleIn text-center">
        <p className="text-app-muted text-sm mb-4">Descanso</p>
        <div className="relative w-28 h-28 mx-auto mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#1A1A26" strokeWidth="8" />
            <circle
              cx="50" cy="50" r={radius} fill="none"
              stroke={done ? '#40916C' : '#7C5CBF'}
              strokeWidth="8"
              strokeDasharray={circ}
              strokeDashoffset={dash}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${done ? 'text-app-green-light' : 'text-app-text'}`}>
              {done ? '✓' : `${min}:${sec}`}
            </span>
          </div>
        </div>

        {done && <p className="text-app-green-light text-sm mb-4 font-medium">¡Listo para la siguiente!</p>}

        <div className="flex gap-2">
          {!done && (
            <button
              onClick={() => setRunning(r => !r)}
              className="flex-1 py-2.5 rounded-xl bg-app-purple text-app-text text-sm font-medium"
            >
              {running ? 'Pausar' : (seconds === defaultSeconds ? 'Iniciar' : 'Continuar')}
            </button>
          )}
          {!running && (
            <button
              onClick={() => { setSeconds(defaultSeconds); setDone(false) }}
              className="px-3 py-2.5 rounded-xl bg-app-surface text-app-muted text-sm"
            >
              ↺
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-2.5 rounded-xl bg-app-surface text-app-muted text-sm"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
