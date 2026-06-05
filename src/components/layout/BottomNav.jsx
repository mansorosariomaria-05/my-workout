import { NavLink, useNavigate } from 'react-router-dom'
import { useWorkoutDraft } from '../../context/WorkoutDraftContext'

const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)
const BookIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
)
const PlusIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)
const TimerIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

const sideLeft  = [
  { to: '/',        icon: HomeIcon, label: 'Inicio'    },
  { to: '/rutinas', icon: BookIcon, label: 'Biblioteca' },
]
const sideRight = [
  { to: '/tabata',   icon: TimerIcon, label: 'Tabata'  },
  { to: '/progreso', icon: ChartIcon, label: 'Progreso' },
]

export default function BottomNav() {
  const { draft } = useWorkoutDraft()
  const navigate  = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-center">
      <div
        className="w-full max-w-mobile flex items-end justify-around px-2 pt-1 pb-2 safe-area-inset-bottom"
        style={{ background: 'rgba(13,13,18,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        {sideLeft.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className="flex flex-col items-center py-1 px-3 rounded-xl transition-all">
            {({ isActive }) => (
              <>
                <div style={{ color: isActive ? '#7C5CBF' : '#9991b8' }}><Icon /></div>
                <span className="text-[10px] leading-none mt-0.5" style={{ color: isActive ? '#7C5CBF' : '#9991b8' }}>{label}</span>
                {isActive && <div className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: '#7C5CBF' }} />}
              </>
            )}
          </NavLink>
        ))}

        {/* Center [+] button */}
        <button onClick={() => navigate('/registro')} className="flex flex-col items-center mb-1 relative">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center -mt-5 border-4 border-app-bg bg-[#7C5CBF]"
            style={{ boxShadow: '0 4px 20px rgba(124, 92, 191, 0.45)' }}
          >
            <PlusIcon />
          </div>
          {draft && (
            <div className="absolute top-0 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-app-bg" />
          )}
        </button>

        {sideRight.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className="flex flex-col items-center py-1 px-3 rounded-xl transition-all">
            {({ isActive }) => (
              <>
                <div style={{ color: isActive ? '#7C5CBF' : '#9991b8' }}><Icon /></div>
                <span className="text-[10px] leading-none mt-0.5" style={{ color: isActive ? '#7C5CBF' : '#9991b8' }}>{label}</span>
                {isActive && <div className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: '#7C5CBF' }} />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
