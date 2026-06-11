export function FuerzaIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Left weight plate */}
      <rect x="2" y="7.5" width="4.5" height="9" rx="1.5"/>
      {/* Handle */}
      <line x1="6.5" y1="12" x2="17.5" y2="12"/>
      {/* Right weight plate */}
      <rect x="17.5" y="7.5" width="4.5" height="9" rx="1.5"/>
    </svg>
  )
}

export function CardioIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Head */}
      <circle cx="14.5" cy="4" r="2"/>
      {/* Body (forward lean) */}
      <path d="M13.5 6L11 13"/>
      {/* Trailing arm (pointing forward) */}
      <path d="M12.5 8L9.5 6.2"/>
      {/* Leading arm (pointing back) */}
      <path d="M11.5 9.5L14.5 12"/>
      {/* Leading leg */}
      <path d="M11 13L14 19"/>
      {/* Leading foot */}
      <path d="M14 19L16 18.2"/>
      {/* Trailing leg */}
      <path d="M11 13L8 19"/>
    </svg>
  )
}

export function ClaseIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Lightning bolt */}
      <path d="M13 2L5 13h6l-2 9l11-11h-7z"/>
    </svg>
  )
}

export function TabataIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Main circle body */}
      <circle cx="12" cy="13" r="7"/>
      {/* Crown button + stem */}
      <path d="M10 4.5h4M12 4.5v1.5"/>
      {/* 12 o'clock tick mark */}
      <line x1="12" y1="7" x2="12" y2="9"/>
      {/* Hand pointing to ~2 o'clock */}
      <line x1="12" y1="13" x2="15.5" y2="10"/>
    </svg>
  )
}

export function DescansIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Crescent moon */}
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export function WorkoutIcon({ type, size = 24, className = '' }) {
  const map = {
    fuerza:   FuerzaIcon,
    cardio:   CardioIcon,
    clase:    ClaseIcon,
    tabata:   TabataIcon,
    descanso: DescansIcon,
  }
  const Icon = map[type] || FuerzaIcon
  return <Icon size={size} className={className} />
}
