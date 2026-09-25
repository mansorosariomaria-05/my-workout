import { useState, useEffect } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import { getAchievements } from '../../services/db'
import { ACHIEVEMENTS_META, runAchievementCheck } from '../../utils/achievements'
import { textoGenero } from '../../utils/genero'
import { getWeekStartLocal } from '../../utils/dates'
import { detectPRs } from '../../utils/prUtils'
import { REAL_WORKOUT_TYPES } from '../../utils/streak'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Footprints, CalendarCheck, CalendarCheck2, Sunrise, Sun, Flame, Star, Gem,
  TrendingUp, Medal, Trophy, ChevronsUp, Dumbbell, Smile, Zap,
  User, Globe, Activity, Circle, Play, Shuffle, Scale, BarChart2,
  Moon, RefreshCw, Cake, AlarmClock, CloudMoon, Award,
  ArrowUp, Sparkles, CalendarRange, ListChecks, PenLine,
  X, ChevronRight, Lock, Shield, Heart,
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

const RECURRING_KEYS = new Set(['hamburguesaMerecida', 'rachaFuerza', 'semanaPerfecta'])
const PERMANENT_ACHIEVEMENTS = ACHIEVEMENTS.filter(a => !RECURRING_KEYS.has(a.key))
const RECURRENT_ACHIEVEMENTS = ACHIEVEMENTS.filter(a => RECURRING_KEYS.has(a.key))

// ─── Pool de 12 medallas semanales ────────────────────────────────────────────
const MEDAL_POOL = [
  { key: 'w_semana_completa',   label: 'Semana completa',      Icon: CalendarCheck, categoria: 'consistencia' },
  { key: 'w_sin_excusas',       label: 'Sin excusas',          Icon: Shield,        categoria: 'consistencia' },
  { key: 'w_arrancaste_fuerte', label: 'Arrancaste fuerte',    Icon: Zap,           categoria: 'consistencia' },
  { key: 'w_mas_fuerte',        label: 'Más fuerte',           Icon: Dumbbell,      categoria: 'progresion'  },
  { key: 'w_supero_pr',         label: 'Nuevo récord',         Icon: Trophy,        categoria: 'progresion'  },
  { key: 'w_volumen_alto',      label: 'Volumen alto',         Icon: BarChart2,     categoria: 'progresion'  },
  { key: 'w_semana_mixta',      label: 'Semana mixta',         Icon: Shuffle,       categoria: 'balance'     },
  { key: 'w_cuerpo_sabio',      label: 'Cuerpo sabio',         Icon: Heart,         categoria: 'balance'     },
  { key: 'w_bien_descansada',   label: 'Bien descansada',      Icon: Moon,          categoria: 'balance'     },
  { key: 'w_racha_viva',        label: 'Racha viva',           Icon: Flame,         categoria: 'libre'       },
  { key: 'w_hamburguesa',       label: 'Hamburguesa merecida', Icon: Award,         categoria: 'libre'       },
  { key: 'w_sabado',            label: 'Guerrera del sábado',  Icon: Star,          categoria: 'libre'       },
]

function computeWeeklyMedals(workouts, profile) {
  const mondayStr  = getWeekStartLocal()
  const thisWeek   = workouts.filter(w => w.date >= mondayStr && REAL_WORKOUT_TYPES.includes(w.type))

  const hasFuerzaHistory = workouts.some(w => w.type === 'fuerza' && w.date < mondayStr)
  const diasObjetivo     = profile?.diasSemana ?? 3
  const weekNum = Math.floor(new Date(mondayStr + 'T12:00:00').getTime() / (7 * 86400000))

  const medalsWithState = MEDAL_POOL.map(m => {
    let completed = false
    switch (m.key) {
      case 'w_semana_completa': {
        const days = new Set(thisWeek.map(w => w.date)).size
        completed = days >= diasObjetivo
        break
      }
      case 'w_sin_excusas': {
        completed = thisWeek.some(w => {
          const d = new Date(w.date + 'T12:00:00').getDay()
          return d === 0 || d === 6
        })
        break
      }
      case 'w_arrancaste_fuerte': {
        const sorted = [...thisWeek].sort((a, b) => a.date.localeCompare(b.date))
        if (sorted.length > 0) {
          const firstDay = new Date(sorted[0].date + 'T12:00:00').getDay()
          completed = firstDay === 1 || firstDay === 2
        }
        break
      }
      case 'w_mas_fuerte':
      case 'w_supero_pr': {
        const fuerzaW = thisWeek.filter(w => w.type === 'fuerza')
        completed = fuerzaW.some(w =>
          detectPRs(w, workouts.filter(h => h.date < w.date)).length > 0
        )
        break
      }
      case 'w_volumen_alto': {
        completed = thisWeek.filter(w => w.type === 'fuerza').some(w => (w.exercises?.length ?? 0) >= 5)
        break
      }
      case 'w_semana_mixta': {
        const hasFuerza      = thisWeek.some(w => w.type === 'fuerza')
        const hasCardioClase = thisWeek.some(w => w.type === 'cardio' || w.type === 'clase')
        completed = hasFuerza && hasCardioClase
        break
      }
      case 'w_cuerpo_sabio': {
        const wf = thisWeek.filter(w => w.fatigue != null)
        if (wf.length > 0) {
          const avg = wf.reduce((s, w) => s + w.fatigue, 0) / wf.length
          completed = avg <= 5
        }
        break
      }
      case 'w_bien_descansada': {
        const fs = thisWeek
          .filter(w => w.type === 'fuerza')
          .sort((a, b) => a.date.localeCompare(b.date))
        if (fs.length >= 2) {
          completed = true
          for (let i = 1; i < fs.length; i++) {
            const d1 = new Date(fs[i - 1].date + 'T12:00:00')
            const d2 = new Date(fs[i].date + 'T12:00:00')
            if (Math.round((d2 - d1) / 86400000) < 1) { completed = false; break }
          }
        }
        break
      }
      case 'w_racha_viva': {
        // Esta semana ya suma a la racha (ver src/utils/streak.js): 3+ días de entrenamiento real.
        completed = new Set(thisWeek.map(w => w.date)).size >= 3
        break
      }
      case 'w_hamburguesa': {
        completed = new Set(thisWeek.map(w => w.date)).size >= 4
        break
      }
      case 'w_sabado': {
        completed = thisWeek.some(w => new Date(w.date + 'T12:00:00').getDay() === 6)
        break
      }
    }
    return { ...m, completed }
  })

  // Filtrar medallas imposibles según contexto
  const filtered = medalsWithState.filter(m => {
    if (['w_mas_fuerte', 'w_supero_pr', 'w_volumen_alto'].includes(m.key) && !hasFuerzaHistory) return false
    if (m.key === 'w_hamburguesa' && diasObjetivo < 4) return false
    return true
  })

  // Seleccionar 1 por categoría, priorizando completadas, rotando por semana
  const categories = ['consistencia', 'progresion', 'balance', 'libre']
  const selected = []

  for (const cat of categories) {
    const candidates = filtered.filter(m => m.categoria === cat)
    if (!candidates.length) continue
    const pool = candidates.some(m => m.completed)
      ? candidates.filter(m => m.completed)
      : candidates
    selected.push(pool[weekNum % pool.length])
  }

  // Fallback: completar hasta 4 con cualquier medalla no seleccionada
  while (selected.length < 4) {
    const usedKeys  = new Set(selected.map(m => m.key))
    const remaining = filtered.filter(m => !usedKeys.has(m.key))
    if (!remaining.length) break
    const pool = remaining.some(m => m.completed)
      ? remaining.filter(m => m.completed)
      : remaining
    selected.push(pool[weekNum % pool.length])
  }

  return selected.slice(0, 4)
}

function getAchievementLabel(a, genero) {
  return textoGenero(genero, a.labelMasc ?? a.label, a.labelFem ?? a.label, a.label)
}

// ─── Medalla semanal ──────────────────────────────────────────────────────────
function WeeklyMedalCard({ medal, size = 'sm' }) {
  const { Icon, label, completed } = medal
  const dim = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11'
  const ico = size === 'sm' ? 14 : 18
  const txt = size === 'sm' ? 'text-[8px] w-10' : 'text-[9px] w-12'
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
function VitrinaTrofeos({ achieved, onClose, genero, weeklyMedals }) {
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
            {weeklyMedals.map(medal => (
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

  const weeklyMedals = computeWeeklyMedals(workouts, profile)

  // Vista compacta (Home): 4 medallas semanales dinámicas
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
            {weeklyMedals.map(medal => (
              <WeeklyMedalCard key={medal.key} medal={medal} size="sm" />
            ))}
          </div>
        </div>

        {showVitrina && (
          <VitrinaTrofeos
            achieved={achieved ?? {}}
            onClose={() => setShowVitrina(false)}
            genero={genero}
            weeklyMedals={weeklyMedals}
          />
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
        <VitrinaTrofeos
          achieved={achieved ?? {}}
          onClose={() => setShowVitrina(false)}
          genero={genero}
          weeklyMedals={weeklyMedals}
        />
      )}
    </>
  )
}
