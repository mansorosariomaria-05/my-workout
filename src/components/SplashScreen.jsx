import { useEffect, useState } from 'react'
import logoFull from '../assets/logo-full.png'

export default function SplashScreen({ onDone }) {
  const [opacity, setOpacity]   = useState(0)
  const [barWidth, setBarWidth] = useState(0)

  useEffect(() => {
    // Trigger fade-in + start progress bar after first paint
    const t0 = setTimeout(() => { setOpacity(1); setBarWidth(100) }, 30)
    // Begin fade-out at 2.5s
    const t1 = setTimeout(() => setOpacity(0), 2500)
    // Notify parent after fade-out completes (2.5 + 0.3)
    const t2 = setTimeout(() => onDone?.(), 2800)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        backgroundColor: '#0D0D12',
        opacity,
        transition: opacity === 0 ? 'opacity 0.3s ease-out' : 'opacity 0.5s ease-in',
        pointerEvents: 'none',
      }}
    >
      <img
        src={logoFull}
        alt="My Workout"
        style={{ width: '340px', maxWidth: '80%' }}
      />

      {/* Progress bar */}
      <div
        style={{
          width: '200px',
          height: '3px',
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: '99px',
          marginTop: '28px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${barWidth}%`,
            backgroundColor: '#7C5CBF',
            borderRadius: '99px',
            transition: 'width 2.5s linear',
          }}
        />
      </div>
    </div>
  )
}
