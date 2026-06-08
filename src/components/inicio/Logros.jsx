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
  ArrowUp, Sparkles, CalendarRange, ListChecks, PenLine,
  X, ChevronRight, Lock,
} from 'lucide-react'

// ─── Icon map (UI-only, no refs in shared utility) ────────────────────────────
const ICON_MAP = {
  primerPaso:           Footprints,
  semanaActiva:         CalendarCheck,
  madrugadora:          Sunrise,
  finDeSeActivo:        Sun,
  rachaFuego:           Flame,
  rachaElite:           Flame,
  cincuenta:            Star,
  constanciaTotal:      Gem,
  medioAnio:            CalendarRange,
  cienDias:             ListChecks,
  consistenciaRegistro: PenLine,
  primerAumento:        TrendingUp,
  primerSalto:          ArrowUp,
  tresPRs:              Medal,
  diezPRs:              Trophy,
  dobleProg:            ChevronsUp,
  transformacion:       Sparkles,
  piernasAcero:         Dumbbell,
  hamburguesaMerecida:  Smile,
  rachaFuerza:          Zap,
  cinco5km:             User,
  veinte20km:           Globe,
  ritmoSolido:          Activity,
  dobleRueda:           Circle,
  tabataMaster:         Play,
  semanaMixta:          Shuffle,
  balancePerfecto:      Scale,
  energiaAlza:          BarChart2,
  guerreraDescanso:     Moon,
  resiliencia:          RefreshCw,
  aniversario:          Cake,
  madrugadoraExtrema:   AlarmClock,
  aveNocturna:          CloudMoon,
  dosSemanas:           CalendarCheck2,
  semanaPerfecta:       Award,
}

const ICON_COLOR_OVERRIDE = {
  rachaElite: '#FBBF24',
}

const ACHIEVEMENTS = ACHIEVEMENTS_META.map(m => ({
  ...m,
  Icon:      ICON_MAP[m.key] ?? Star,
  iconColor: ICON_COLOR_OVERRIDE[m.key] ?? undefined,
}))

// Recurrentes: aparecen en "Por desbloquear" en la vitrina hasta que el próximo
// prompt los mueva al pool semanal
const RECURRING_KEYS = new Set(['hamburguesaMerecida', 'rachaFuerza', 'semanaPerfecta'])
const PERMANENT_ACHIEVEMENTS = ACHIEVEMENTS.filter(a => !RECURRING_KEYS.has(a.key))
const RECURRENT_ACHIEVEMENTS = ACHIEVEMENTS.filter(a => RECURRING_KEYS.has(a.key))

// 4 medallas semanales hardcodeadas (lógica dinámica en próximo prompt)
const WEEKLY_MEDALS = [
  { key: 'w_semana_completa', label: 'Semana completa',    Icon: CalendarCheck, completed: false },
  { key: 'w_mas_fuerte',      label: 'Mas fuerte',         Icon: Dumbbell,      completed: false },
  { key: 'w_semana_mixta',    label: 'Semana mixta',       Icon: Shuffle,       completed: false },
  { key: 'w_cuatro_dias',     label: '4 dias esta semana', Icon: Star,          completed: false },
]

function getAchievementLabel(a, genero) {
  return textoGenero(genero, a.labelMasc ?? a.label, a.labelFem ?? a.label, a.label)
}

// ─── Medalla semanal ──────────────────────────────────────────────────────────
function WeeklyMedalCard({ medal, size = 'sm' }) {
  const { Icon, label, completed } = medal
  const dim  = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11'
  const ico  = size === 'sm' ? 14 : 18
  const txt  = size === 'sm' ? 'text-[8px] w-10' : 'text-[9px] w-12'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`${dim} rounded-full border flex items-center justify-center`}
        style={{
          borderColor:     completed ? 'rgba(124,92,191,0.4)' : 'rgba(255,255,255,0.08)',
          backgroundColor: completed ? 'rgba(124,92,191,0.15)' : 'rgba(255,255,255,0.03)',
        }}
      >
        <Icon size={ico} color={completed ? '#9b7fd4' : '#3a3550'} />
      </div>
      <p className={`${txt} text-center leading-tight`} style={{ color: completed ? '#94A3B8' : '#3a3550' }}>
        {label}
      </p>
    </div>
  )
}

// ─── Flip card (trofeo permanente) ───────────────────────────────────────────
function TrophyCard({ achievement, isUnlocked, unlockedAt, genero }) {
  const [flipped, setFlipped] = useState(false)
  const { Icon, iconColor } = achievement
  const label   = getAchievementLabel(achievement, genero)
  const color   = isUnlocked ? (iconColor ?? '#9b7fd4') : '#3a3550'
  const opacity = isUnlocked ? 1 : 0.5
  const iconBg  = isUnlocked ? 'rgba(124,92,191,0.18)' : 'rgba(255,255,255,0.04)'

  const dateLabel = unlockedAt
    ? (() => {
        try {
          const d = typeof unlockedAt.toDate === 'function'
            ? unlockedAt.toDate()
            : new Date(unlockedAt.seconds * 1000)
          return format(d, "d 'de' MMMM 'de' yyyy", { locale: es })
        } catch { return null }
      })()
    : null

  return (
    <div className="flip-card" style={{ height: '108px' }} onClick={() => setFlipped(f => !f)}>
      <div className={`flip-inner${flipped ? ' flipped' : ''}`} style={{ height: '108px' }}>
        <div className="flip-front flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.06]"
          style={{ height: '108px', backgroundColor: '#1a1625', opacity }}
        >
          <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center"
            style={{ backgroundColor: iconBg }}
          >
            <Icon size={20} color={color} />
          </div>
          <p className="text-[9px] text-center leading-tight px-1"
            style={{ color: isUnlocked ? '#94A3B8' : '#3a3550' }}
          >{label}</p>
        </div>
        <div className="flip-back flex flex-col justify-center rounded-xl px-2 py-2 border"
          style={{ height: '108px', backgroundColor: '#1a1625', borderColor: isUnlocked ? 'rgba(124,92,191,0.2)' : 'rgba(255,255,255,0.06)' }}
        >
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

// ─── Section label inside vitrina ─────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
      style={{ color: '#94A3B8' }}
    >{children}</p>
  )
}

// ─── Vitrina full-screen ──────────────────────────────────────────────────────
function VitrinaTrofeos({ achieved, onClose, genero }) {
  const sortByDateV = (a, b) => {
    const tA = achieved?.[a.key]?.at
    const tB = achieved?.[b.key]?.at
    const mA = tA?.toMillis?.() ?? (tA?.seconds ? tA.seconds * 1000 : 0)
    const mB = tB?.toMillis?.() ?? (tB?.seconds ? tB.seconds * 1000 : 0)
    return mB - mA
  }

  const permanentUnlocked = PERMANENT_ACHIEVEMENTS.filter(a => achieved?.[a.key]?.unlocked).sort(sortByDateV)
  const permanentLocked   = PERMANENT_ACHIEVEMENTS.filter(a => !achieved?.[a.key]?.unlocked)

  const unlockedCount = permanentUnlocked.length
  const total = PERMANENT_ACHIEVEMENTS.length

  return (
    <div className="fixed inset-0 z-50 bg-[#0D0D12] flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-app-text text-lg font-semibold">Mis Trofeos</h2>
          <p className="text-[11px]" style={{ color: '#94A3B8' }}>{unlockedCount}/{total} trofeos desbloqueados</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl border border-white/10">
          <X size={16} color="#94A3B8" />
        </button>
      </div>

      {/* Barra de progreso (solo permanentes) */}
      <div className="mx-4 mt-3 mb-1">
        <div className="w-full h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${total > 0 ? (unlockedCount / total) * 100 : 0}%`, background: 'linear-gradient(to right, #7C5CBF, #9B7FD4)' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">

        {/* SECCIÓN: Esta semana */}
        <div className="pt-4 mb-5">
          <SectionLabel>Esta semana</SectionLabel>
          <div className="flex justify-around">
            {WEEKLY_MEDALS.map(medal => (
              <WeeklyMedalCard key={medal.key} medal={medal} size="lg" />
            ))}
          </div>
        </div>

        <div className="h-px bg-white/[0.06] mb-5" />

        {/* SECCIÓN: Trofeos conseguidos */}
        {permanentUnlocked.length > 0 && (
          <div className="mb-5">
            <SectionLabel>Trofeos conseguidos</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {permanentUnlocked.map(a => (
                <TrophyCard key={a.key} achievement={a} isUnlocked={true} unlockedAt={achieved[a.key]?.at} genero={genero} />
              ))}
            </div>
          </div>
        )}

        {/* SECCIÓN: Por desbloquear */}
        <div>
          <SectionLabel>Por desbloquear</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {permanentLocked.map(a => (
              <TrophyCard key={a.key} achievement={a} isUnlocked={false} unlockedAt={null} genero={genero} />
            ))}
            {RECURRENT_ACHIEVEMENTS.map(a => (
              <TrophyCard key={a.key} achievement={a} isUnlocked={false} unlockedAt={null} genero={genero} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Logros({ workouts, compact }) {
  const { user, settings, profile } = useAuthContext()
  const genero = profile?.genero ?? ''
  const [achieved, setAchieved] = useState(null)
  const [showVitrina, setShowVitrina] = useState(false)

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

  // Vista compacta (Home): 4 medallas semanales fijas
  if (compact) {
    return (
      <>
        <div className="mx-4 rounded-xl px-3 py-2.5 border border-white/[0.06]" style={{ backgroundColor: '#1a1625' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Esta semana</span>
            <button onClick={() => setShowVitrina(true)} className="text-xs flex items-center gap-0.5" style={{ color: '#9B7FD4' }}>
              Ver todos <ChevronRight size={12} />
            </button>
          </div>
          <div className="flex justify-around">
            {WEEKLY_MEDALS.map(medal => (
              <WeeklyMedalCard key={medal.key} medal={medal} size="sm" />
            ))}
          </div>
        </div>

        {showVitrina && (
          <VitrinaTrofeos achieved={achieved ?? {}} onClose={() => setShowVitrina(false)} genero={genero} />
        )}
      </>
    )
  }

  // Vista no-compact (si se usa fuera del Home)
  const unlockedList = achieved ? PERMANENT_ACHIEVEMENTS.filter(a => achieved[a.key]?.unlocked) : []

  return (
    <>
      <div className="mx-4 rounded-xl px-3 py-3 border border-white/[0.06]" style={{ backgroundColor: '#1a1625' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Logros</span>
          <button onClick={() => setShowVitrina(true)} className="text-xs flex items-center gap-0.5" style={{ color: '#9B7FD4' }}>
            Ver todos <ChevronRight size={12} />
          </button>
        </div>
        {unlockedList.length === 0 ? (
          <p className="text-[10px]" style={{ color: '#4a4560' }}>Completá tu primer entrenamiento</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {unlockedList.map(a => (
              <div key={a.key} className="flex flex-col items-center gap-1 animate-fadeIn">
                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(124,92,191,0.15)' }}
                >
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

      {showVitrina && (
        <VitrinaTrofeos achieved={achieved ?? {}} onClose={() => setShowVitrina(false)} genero={genero} />
      )}
    </>
  )
}
