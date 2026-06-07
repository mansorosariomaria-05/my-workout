import { useState, useEffect } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import { getAchievements } from '../../services/db'
import { ACHIEVEMENTS_META, runAchievementCheck } from '../../utils/achievements'
import { textoGenero } from '../../utils/genero'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Footprints, CalendarCheck, CalendarCheck2, Sunrise, Sun, Flame, Star, Gem,
  TrendingUp, Medal, Trophy, ChevronsUp, Dumbbell, Smile, Zap,
  User, Globe, Activity, Circle, Play, Shuffle, Scale, BarChart2,
  Moon, RefreshCw, Cake, AlarmClock, CloudMoon, Award,
  X, ChevronRight, Lock,
} from 'lucide-react'

// Icon map — keeps UI concerns out of the shared utility
const ICON_MAP = {
  primerPaso:          Footprints,
  semanaActiva:        CalendarCheck,
  madrugadora:         Sunrise,
  finDeSeActivo:       Sun,
  rachaFuego:          Flame,
  rachaElite:          Flame,
  cincuenta:           Star,
  constanciaTotal:     Gem,
  primerAumento:       TrendingUp,
  tresPRs:             Medal,
  diezPRs:             Trophy,
  dobleProg:           ChevronsUp,
  piernasAcero:        Dumbbell,
  hamburguesaMerecida: Smile,
  rachaFuerza:         Zap,
  cinco5km:            User,
  veinte20km:          Globe,
  ritmoSolido:         Activity,
  dobleRueda:          Circle,
  tabataMaster:        Play,
  semanaMixta:         Shuffle,
  balancePerfecto:     Scale,
  energiaAlza:         BarChart2,
  guerreraDescanso:    Moon,
  resiliencia:         RefreshCw,
  aniversario:         Cake,
  madrugadoraExtrema:  AlarmClock,
  aveNocturna:         CloudMoon,
  dosSemanas:          CalendarCheck2,
  semanaPerfecta:      Award,
}

const ICON_COLOR_OVERRIDE = {
  rachaElite: '#FBBF24',
}

const ACHIEVEMENTS = ACHIEVEMENTS_META.map(m => ({
  ...m,
  Icon:      ICON_MAP[m.key] ?? Star,
  iconColor: ICON_COLOR_OVERRIDE[m.key] ?? undefined,
}))

function getAchievementLabel(a, genero) {
  return textoGenero(genero, a.labelMasc ?? a.label, a.labelFem ?? a.label, a.label)
}

// ─── Flip card for VitrinaTrofeos ─────────────────────────────────────────────
function TrophyCard({ achievement, isUnlocked, unlockedAt, genero }) {
  const [flipped, setFlipped] = useState(false)
  const { Icon, iconColor } = achievement
  const label   = getAchievementLabel(achievement, genero)
  const color   = isUnlocked ? (iconColor ?? '#9b7fd4') : '#3a3550'
  const opacity = isUnlocked ? 1 : 0.5
  const iconBg  = isUnlocked ? 'rgba(124,92,191,0.18)' : 'rgba(255,255,255,0.04)'

  const dateLabel = unlockedAt
    ? (() => { try { const d = typeof unlockedAt.toDate === 'function' ? unlockedAt.toDate() : new Date(unlockedAt.seconds * 1000); return format(d, "d 'de' MMMM 'de' yyyy", { locale: es }) } catch { return null } })()
    : null

  return (
    <div className="flip-card" style={{ height: '108px' }} onClick={() => setFlipped(f => !f)}>
      <div className={`flip-inner${flipped ? ' flipped' : ''}`} style={{ height: '108px' }}>
        <div className="flip-front flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.06]" style={{ height: '108px', backgroundColor: '#1a1625', opacity }}>
          <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center" style={{ backgroundColor: iconBg }}>
            <Icon size={20} color={color} />
          </div>
          <p className="text-[9px] text-center leading-tight px-1" style={{ color: isUnlocked ? '#94A3B8' : '#3a3550' }}>{label}</p>
        </div>
        <div className="flip-back flex flex-col justify-center rounded-xl px-2 py-2 border" style={{ height: '108px', backgroundColor: '#1a1625', borderColor: isUnlocked ? 'rgba(124,92,191,0.2)' : 'rgba(255,255,255,0.06)' }}>
          {isUnlocked ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9b7fd4' }}>{label}</p>
              <p className="text-[10px] leading-tight mt-1" style={{ color: '#94A3B8' }}>{achievement.desc}</p>
              {dateLabel && <p className="text-[9px] mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Logrado el {dateLabel}</p>}
            </>
          ) : (
            <>
              <Lock size={12} color="#3a3550" />
              <p className="text-[10px] leading-tight mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>{achievement.desc}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Vitrina de Trofeos modal ─────────────────────────────────────────────────
function VitrinaTrofeos({ achieved, onClose, genero }) {
  const unlockedCount = ACHIEVEMENTS.filter(a => achieved[a.key]?.unlocked).length
  const total = ACHIEVEMENTS.length

  const sortByDateV = (a, b) => {
    const tA = achieved?.[a.key]?.at
    const tB = achieved?.[b.key]?.at
    const mA = tA?.toMillis?.() ?? (tA?.seconds ? tA.seconds * 1000 : 0)
    const mB = tB?.toMillis?.() ?? (tB?.seconds ? tB.seconds * 1000 : 0)
    return mB - mA
  }
  const unlocked = ACHIEVEMENTS.filter(a => achieved?.[a.key]?.unlocked).sort(sortByDateV)
  const locked   = ACHIEVEMENTS.filter(a => !achieved?.[a.key]?.unlocked)

  return (
    <div className="fixed inset-0 z-50 bg-[#0D0D12] flex flex-col animate-fadeIn">
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-app-text text-lg font-semibold">Mis Trofeos</h2>
          <p className="text-[11px]" style={{ color: '#94A3B8' }}>{unlockedCount}/{total} desbloqueados</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl border border-white/10">
          <X size={16} color="#94A3B8" />
        </button>
      </div>

      <div className="mx-4 mt-3 mb-1">
        <div className="w-full h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(unlockedCount / total) * 100}%`, background: 'linear-gradient(to right, #7C5CBF, #9B7FD4)' }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="grid grid-cols-3 gap-2 pt-3">
          {unlocked.map(a => (
            <TrophyCard key={a.key} achievement={a} isUnlocked={true} unlockedAt={achieved[a.key]?.at} genero={genero} />
          ))}
          {locked.length > 0 && (
            <div className="col-span-3 flex items-center gap-2 my-1">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] text-white/20 uppercase tracking-widest">Por desbloquear</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          )}
          {locked.map(a => (
            <TrophyCard key={a.key} achievement={a} isUnlocked={false} unlockedAt={null} genero={genero} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Logros({ workouts, compact }) {
  const { user, settings, profile } = useAuthContext()
  const genero = profile?.genero ?? ''
  const [achieved, setAchieved] = useState(null)
  const [showVitrina, setShowVitrina] = useState(false)
  const loadingLogros = achieved === null

  useEffect(() => {
    if (!user) return
    getAchievements(user.uid).then(data => setAchieved(data ?? {}))
  }, [user])

  useEffect(() => {
    if (!user || !workouts.length || achieved === null) return
    runAchievementCheck(user.uid, workouts, profile, settings).then(newKeys => {
      if (newKeys.length > 0) {
        setAchieved(prev => {
          const next = { ...prev }
          newKeys.forEach(key => { next[key] = { ...(next[key] ?? {}), unlocked: true } })
          return next
        })
      }
    })
  }, [workouts, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortByDate = (a, b) => {
    const tA = achieved?.[a.key]?.at
    const tB = achieved?.[b.key]?.at
    const mA = tA?.toMillis?.() ?? (tA?.seconds ? tA.seconds * 1000 : 0)
    const mB = tB?.toMillis?.() ?? (tB?.seconds ? tB.seconds * 1000 : 0)
    return mB - mA
  }
  const unlockedList = achieved ? ACHIEVEMENTS.filter(a => achieved[a.key]?.unlocked) : []
  const total = ACHIEVEMENTS.length

  if (compact) {
    const recent = [...unlockedList].sort(sortByDate).slice(0, 4)

    return (
      <>
        <div className="mx-4 rounded-xl px-3 py-2.5 border border-white/[0.06]" style={{ backgroundColor: '#1a1625' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Logros</span>
            <button onClick={() => setShowVitrina(true)} className="text-xs flex items-center gap-0.5" style={{ color: '#9B7FD4' }}>
              Ver todos <ChevronRight size={12} />
            </button>
          </div>
          <div className="w-full mb-3" style={{ height: '2px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '999px' }}>
            <div style={{ height: '100%', width: `${(unlockedList.length / total) * 100}%`, background: 'linear-gradient(to right, #7C5CBF, #9B7FD4)', borderRadius: '999px', transition: 'width 0.6s ease' }} />
          </div>
          {loadingLogros ? (
            <div className="flex gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-9 h-9 rounded-full bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-[10px]" style={{ color: '#4a4560' }}>Completá tu primer entrenamiento 🏅</p>
          ) : (
            <div className="flex gap-3">
              {recent.map(a => (
                <div key={a.key} className="flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center" style={{ backgroundColor: 'rgba(124,92,191,0.15)' }}>
                    <a.Icon size={16} color={a.iconColor ?? '#9b7fd4'} />
                  </div>
                  <p className="text-[8px] text-center w-10 leading-tight" style={{ color: '#94A3B8' }}>
                    {getAchievementLabel(a, genero)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {showVitrina && <VitrinaTrofeos achieved={achieved} onClose={() => setShowVitrina(false)} genero={genero} />}
      </>
    )
  }

  return (
    <>
      <div className="mx-4 rounded-xl px-3 py-3 border border-white/[0.06]" style={{ backgroundColor: '#1a1625' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Logros</span>
          <button onClick={() => setShowVitrina(true)} className="text-xs flex items-center gap-0.5" style={{ color: '#9B7FD4' }}>
            Ver todos <ChevronRight size={12} />
          </button>
        </div>
        <div className="w-full mb-3" style={{ height: '2px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '999px' }}>
          <div style={{ height: '100%', width: `${(unlockedList.length / total) * 100}%`, background: 'linear-gradient(to right, #7C5CBF, #9B7FD4)', borderRadius: '999px' }} />
        </div>
        {loadingLogros ? (
          <div className="flex gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {unlockedList.map(a => (
              <div key={a.key} className="flex flex-col items-center gap-1 animate-fadeIn">
                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center" style={{ backgroundColor: 'rgba(124,92,191,0.15)' }}>
                  <a.Icon size={18} color={a.iconColor ?? '#9b7fd4'} />
                </div>
                <p className="text-[9px] text-center leading-tight" style={{ color: '#94A3B8' }}>
                  {getAchievementLabel(a, genero)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showVitrina && <VitrinaTrofeos achieved={achieved} onClose={() => setShowVitrina(false)} genero={genero} />}
    </>
  )
}
