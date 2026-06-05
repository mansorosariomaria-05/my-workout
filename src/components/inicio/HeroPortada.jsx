import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext'

export default function HeroPortada() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()

  const name = profile?.name ?? 'Ro'
  const genero = profile?.genero ?? ''
  const greeting = genero === 'masculino' ? `¡Bienvenido, ${name}!`
    : genero === 'otro' ? `¡Hola, ${name}!`
    : `¡Bienvenida, ${name}!`

  const str = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const fechaDisplay = str.charAt(0).toUpperCase() + str.slice(1)

  return (
    <div
      className="relative h-[120px] flex flex-col justify-end overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0D0D12 0%, #1A1026 50%, #0D0D12 100%)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

      <div className="relative px-4 pb-3">
        <h2 className="text-white text-2xl font-semibold">{greeting}</h2>
        <p className="text-white/60 text-xs mt-0.5">{fechaDisplay}</p>
      </div>

      <div className="absolute top-3 right-3">
        <button
          onClick={() => navigate('/configuracion')}
          className="bg-black/30 backdrop-blur-sm text-white/70 p-1.5 rounded-lg border border-white/10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
