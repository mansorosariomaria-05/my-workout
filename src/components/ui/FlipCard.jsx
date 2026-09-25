import { useState } from 'react'

// Tarjeta 3D genérica que se da vuelta al tocarla — reusa las clases .flip-card/.flip-inner/
// .flip-front/.flip-back de index.css (mismo patrón visual que TrophyCard en Logros.jsx), envuelto
// en un botón accesible (aria-pressed/aria-label) en vez de un div con onClick.
// prefers-reduced-motion se respeta desde el CSS (.flip-inner sin transition en ese caso).
export default function FlipCard({ front, back, height = '108px', flipLabel = 'Ver más', unflipLabel = 'Volver', className = '' }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className={`flip-card ${className}`} style={{ height }}>
      <button
        type="button"
        onClick={() => setFlipped(f => !f)}
        aria-pressed={flipped}
        aria-label={flipped ? unflipLabel : flipLabel}
        className={`flip-inner${flipped ? ' flipped' : ''} w-full appearance-none bg-transparent border-0 p-0 m-0 text-left cursor-pointer`}
        style={{ height }}
      >
        <div className="flip-front w-full h-full">{front}</div>
        <div className="flip-back w-full h-full">{back}</div>
      </button>
    </div>
  )
}
