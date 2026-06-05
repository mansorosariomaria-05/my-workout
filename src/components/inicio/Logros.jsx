import { useState, useEffect } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import { getAchievements, unlockAchievement } from '../../services/db'
import { dateToLocal } from '../../utils/dates'
import { textoGenero } from '../../utils/genero'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Footprints, CalendarCheck, CalendarCheck2, Sunrise, Sun, Flame, Star, Gem,
  TrendingUp, Medal, Trophy, ChevronsUp, Dumbbell, Timer, Zap,
  User, Globe, Activity, Circle, Play, Shuffle, Scale, BarChart2,
  Moon, RefreshCw, Cake, AlarmClock, CloudMoon, Award,
  X, ChevronRight, Lock,
} from 'lucide-react'

// ─── Achievement definitions ──────────────────────────────────────────────────
const ACHIEVEMENTS = [
  // CONSISTENCIA
  { key: 'primerPaso',         Icon: Footprints,    label: 'Primer paso',            desc: 'Registrá tu primer entrenamiento' },
  { key: 'semanaActiva',       Icon: CalendarCheck,  label: 'Semana activa',          desc: 'Entrenaste 3+ días en una semana' },
  { key: 'madrugadora',        Icon: Sunrise,        label: 'Madrugador/a',           labelMasc: 'Madrugador',          labelFem: 'Madrugadora',          desc: '5 entrenamientos antes de las 8 AM' },
  { key: 'finDeSeActivo',      Icon: Sun,            label: 'Fin de semana activo',   desc: 'Entrenaste sábado Y domingo en la misma semana' },
  { key: 'rachaFuego',         Icon: Flame,          label: 'Racha de fuego',         desc: '4 semanas seguidas con 3+ días cada una' },
  { key: 'rachaElite',         Icon: Flame,          label: 'Racha élite',            desc: '12 semanas seguidas con 3+ días cada una', iconColor: '#FBBF24' },
  { key: 'cincuenta',          Icon: Star,           label: '50 entrenamientos',      desc: 'Registrá 50 entrenamientos en total' },
  { key: 'constanciaTotal',    Icon: Gem,            label: 'Constancia total',       desc: 'Registrá 100 entrenamientos en total' },
  // FUERZA
  { key: 'primerAumento',      Icon: TrendingUp,     label: 'Primer aumento',         desc: 'Subiste el peso por primera vez' },
  { key: 'tresPRs',            Icon: Medal,          label: 'Superaste 3 PRs',        desc: 'Récord personal en 3 ejercicios distintos' },
  { key: 'diezPRs',            Icon: Trophy,         label: 'Superaste 10 PRs',       desc: 'Récord personal en 10 ejercicios distintos' },
  { key: 'dobleProg',          Icon: ChevronsUp,     label: 'Doble progresión',       desc: 'Duplicaste el peso inicial en algún ejercicio' },
  { key: 'piernasAcero',       Icon: Dumbbell,       label: 'Piernas de acero',       desc: 'Un mes completo sin saltear el día de pierna' },
  { key: 'poderIsometrico',    Icon: Timer,          label: 'Poder isométrico',       desc: 'Mantuviste una plancha más de 2 minutos' },
  { key: 'rachaFuerza',        Icon: Zap,            label: 'En racha de fuerza',     desc: 'Subiste peso en 3 ejercicios en la misma semana' },
  // CARDIO
  { key: 'cinco5km',           Icon: User,           label: 'Primera vez 5km',        desc: 'Acumulaste 5km corriendo en total' },
  { key: 'veinte20km',         Icon: Globe,          label: '20km acumulados',        desc: 'Acumulaste 20km corriendo en total' },
  { key: 'ritmoSolido',        Icon: Activity,       label: 'Ritmo sólido',           desc: 'Promedio menor a 6:00 min/km en 3 sesiones' },
  { key: 'dobleRueda',         Icon: Circle,         label: 'Doble rueda',            desc: '20km en rollers en una sola sesión' },
  { key: 'tabataMaster',       Icon: Play,           label: 'Tabata master',          desc: 'Completaste 10 protocolos Tabata' },
  // BALANCE
  { key: 'semanaMixta',        Icon: Shuffle,        label: 'Primera semana mixta',   desc: 'Una semana con fuerza + cardio o clase' },
  { key: 'balancePerfecto',    Icon: Scale,          label: 'Balance perfecto',       desc: '4 semanas seguidas con cardio o clase incluido' },
  { key: 'energiaAlza',        Icon: BarChart2,      label: 'Energía en alza',        desc: 'Tu cansancio promedio bajó más de 2 puntos' },
  { key: 'guerreraDescanso',   Icon: Moon,           label: 'Guerrer@ del descanso',  labelMasc: 'Guerrero del descanso', labelFem: 'Guerrera del descanso', desc: 'Completaste 3 semanas de descarga registradas' },
  { key: 'resiliencia',        Icon: RefreshCw,      label: 'Resiliencia',            desc: 'Volviste a entrenar tras 7+ días sin registros' },
  // ESPECIALES
  { key: 'aniversario',        Icon: Cake,           label: 'Aniversario',            desc: 'Un año desde tu primer entrenamiento registrado' },
  { key: 'madrugadoraExtrema', Icon: AlarmClock,     label: 'Madrugador/a extremo/a', labelMasc: 'Madrugador extremo', labelFem: 'Madrugadora extrema', desc: 'Entrenaste antes de las 6:30 AM' },
  { key: 'aveNocturna',        Icon: CloudMoon,      label: 'Ave nocturna',           desc: 'Entrenaste después de las 21:00' },
  { key: 'dosSemanas',         Icon: CalendarCheck2, label: 'Dos semanas activas',    desc: 'Entrenaste 3+ días por 2 semanas seguidas' },
  { key: 'cinturonNegro',      Icon: Award,          label: 'Cinturón negro',         desc: 'Usaste Tabata, Biblioteca y Progreso en un día' },
]

function getAchievementLabel(a, genero) {
  return textoGenero(genero, a.labelMasc ?? a.label, a.labelFem ?? a.label, a.label)
}

// ─── Unlock logic helpers ─────────────────────────────────────────────────────
function getWeekKey(dateStr) {
  const [yr, mo, dy] = dateStr.split('-').map(Number)
  const d   = new Date(yr, mo - 1, dy)
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return dateToLocal(mon)
}

function computeMaxStreak(workouts, minDays) {
  const weeks = {}
  workouts.forEach(w => {
    const k = getWeekKey(w.date)
    if (!weeks[k]) weeks[k] = new Set()
    weeks[k].add(w.date)
  })
  const qualifying = Object.entries(weeks)
    .filter(([, s]) => s.size >= minDays)
    .map(([k]) => k)
    .sort()
  let max = 0, cur = 0, prev = null
  for (const week of qualifying) {
    if (prev === null) { cur = 1 }
    else {
      const diff = Math.round((new Date(week) - new Date(prev)) / (7 * 86400000))
      cur = diff === 1 ? cur + 1 : 1
    }
    max = Math.max(max, cur)
    prev = week
  }
  return max
}

function computePRData(workouts) {
  const sorted = [...workouts]
    .filter(w => w.type === 'fuerza' && w.exercises?.length)
    .sort((a, b) => a.date.localeCompare(b.date))
  const best = {}, prSet = new Set()
  for (const w of sorted) {
    for (const e of (w.exercises ?? [])) {
      if (!e.exerciseId || !e.sets?.length) continue
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (!maxW) continue
      if (best[e.exerciseId] != null && maxW > best[e.exerciseId]) prSet.add(e.exerciseId)
      best[e.exerciseId] = Math.max(best[e.exerciseId] ?? 0, maxW)
    }
  }
  return { prCount: prSet.size }
}

function computeDoubleProgression(workouts) {
  const sorted = [...workouts]
    .filter(w => w.type === 'fuerza' && w.exercises?.length)
    .sort((a, b) => a.date.localeCompare(b.date))
  const first = {}, current = {}
  for (const w of sorted) {
    for (const e of (w.exercises ?? [])) {
      if (!e.exerciseId || !e.sets?.length) continue
      const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
      if (!maxW) continue
      if (first[e.exerciseId] == null) first[e.exerciseId] = maxW
      current[e.exerciseId] = maxW
    }
  }
  return Object.keys(first).some(id => current[id] >= first[id] * 2 && first[id] > 0)
}

function getTotalRunningKm(workouts) {
  return workouts
    .filter(w => w.type === 'cardio' && w.activity?.toLowerCase() === 'running' && w.distancia)
    .reduce((sum, w) => sum + (Number(w.distancia) || 0), 0)
}

function getAvgPaceMinPerKm(workouts, lastN = 3) {
  const runs = workouts
    .filter(w => w.type === 'cardio' && w.activity?.toLowerCase() === 'running' && w.distancia && w.tiempo)
    .slice(0, lastN)
  if (!runs.length) return null
  const paces = runs.map(w => Number(w.tiempo) / Number(w.distancia))
  return paces.reduce((a, b) => a + b, 0) / paces.length
}

function checkBalancePerfecto(workouts) {
  const weeks = {}
  workouts.forEach(w => {
    const k = getWeekKey(w.date)
    if (!weeks[k]) weeks[k] = { cardio: 0 }
    if (w.type === 'cardio' || w.type === 'clase') weeks[k].cardio++
  })
  const qualifying = Object.entries(weeks).filter(([, v]) => v.cardio >= 1).map(([k]) => k).sort()
  let max = 0, cur = 0, prev = null
  for (const week of qualifying) {
    if (prev === null) { cur = 1 }
    else { const diff = Math.round((new Date(week) - new Date(prev)) / (7 * 86400000)); cur = diff === 1 ? cur + 1 : 1 }
    max = Math.max(max, cur); prev = week
  }
  return max >= 4
}

function checkEnergiaAlza(workouts) {
  const weeks = {}
  workouts.forEach(w => {
    if (w.fatigue == null) return
    const k = getWeekKey(w.date)
    if (!weeks[k]) weeks[k] = []
    weeks[k].push(w.fatigue)
  })
  const sorted = Object.entries(weeks)
    .map(([k, fs]) => ({ k, avg: fs.reduce((a, b) => a + b, 0) / fs.length }))
    .sort((a, b) => a.k.localeCompare(b.k))
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i]
    const diff = Math.round((new Date(cur.k) - new Date(prev.k)) / (7 * 86400000))
    if (diff === 1 && prev.avg - cur.avg >= 2) return true
  }
  return false
}

function getWorkoutHour(w) {
  const ts = w.createdAt
  if (!ts) return null
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.getHours() + d.getMinutes() / 60
}

function checkResiliencia(workouts) {
  const real = workouts.filter(w => w.type !== 'descanso').sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 1; i < real.length; i++) {
    const gap = Math.round((new Date(real[i].date) - new Date(real[i-1].date)) / 86400000)
    if (gap >= 7) return true
  }
  return false
}

function checkFinSemanaActivo(workouts) {
  const byWeek = {}
  workouts.forEach(w => {
    const d = new Date(w.date + 'T12:00:00')
    const day = d.getDay()
    if (day !== 0 && day !== 6) return
    const k = getWeekKey(w.date)
    if (!byWeek[k]) byWeek[k] = new Set()
    byWeek[k].add(day)
  })
  return Object.values(byWeek).some(s => s.has(0) && s.has(6))
}

function checkPiernasAcero(workouts) {
  const LEG = ['Glúteos','Isquios','Cuádriceps','Abductores','Gemelos']
  const weeks = {}
  workouts.filter(w => w.type === 'fuerza').forEach(w => {
    const muscles = [...(w.muscleGroups ?? []), ...(w.exercises?.map(e => e.muscle).filter(Boolean) ?? [])]
    if (!muscles.some(m => LEG.includes(m))) return
    const k = getWeekKey(w.date)
    weeks[k] = true
  })
  return computeMaxStreak(
    Object.keys(weeks).map(date => ({ date, type: 'fuerza' })),
    1
  ) >= 4
}

// ─── Flip card for VitrinaTrofeos ─────────────────────────────────────────────
function TrophyCard({ achievement, isUnlocked, unlockedAt, detail, genero }) {
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
        {/* Frente */}
        <div className="flip-front flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.06]" style={{ height: '108px', backgroundColor: '#1a1625', opacity }}>
          <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center" style={{ backgroundColor: iconBg }}>
            <Icon size={20} color={color} />
          </div>
          <p className="text-[9px] text-center leading-tight px-1" style={{ color: isUnlocked ? '#94A3B8' : '#3a3550' }}>{label}</p>
        </div>
        {/* Reverso */}
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
  const locked = ACHIEVEMENTS.filter(a => !achieved?.[a.key]?.unlocked)

  return (
    <div className="fixed inset-0 z-50 bg-[#0D0D12] flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-app-text text-lg font-semibold">Mis Trofeos</h2>
          <p className="text-[11px]" style={{ color: '#94A3B8' }}>{unlockedCount}/{total} desbloqueados</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl border border-white/10">
          <X size={16} color="#94A3B8" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mt-3 mb-1">
        <div className="w-full h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(unlockedCount / total) * 100}%`, background: 'linear-gradient(to right, #7C5CBF, #9B7FD4)' }} />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="grid grid-cols-3 gap-2 pt-3">
          {unlocked.map(a => (
            <TrophyCard
              key={a.key}
              achievement={a}
              isUnlocked={true}
              unlockedAt={achieved[a.key]?.at}
              detail={achieved[a.key]?.detail}
              genero={genero}
            />
          ))}
          {locked.length > 0 && (
            <div className="col-span-3 flex items-center gap-2 my-1">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] text-white/20 uppercase tracking-widest">Por desbloquear</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          )}
          {locked.map(a => (
            <TrophyCard
              key={a.key}
              achievement={a}
              isUnlocked={false}
              unlockedAt={null}
              detail={null}
              genero={genero}
            />
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

    const check = async () => {
      const toUnlock = []
      const a = achieved
      const push = (key, detail = '') => toUnlock.push({ key, detail })

      const fmtWeek = (mondayStr) => {
        try {
          const mon = new Date(mondayStr + 'T12:00:00')
          const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
          return `Semana del ${format(mon, "d MMM", { locale: es })} al ${format(sun, "d MMM", { locale: es })}`
        } catch { return '' }
      }

      if (!a.primerPaso?.unlocked) push('primerPaso', 'Primer entrenamiento registrado')

      if (!a.semanaActiva?.unlocked) {
        const weeks = {}
        workouts.forEach(w => {
          const k = getWeekKey(w.date)
          if (!weeks[k]) weeks[k] = new Set()
          weeks[k].add(w.date)
        })
        const qualEntry = Object.entries(weeks).find(([, s]) => s.size >= 3)
        if (qualEntry) push('semanaActiva', fmtWeek(qualEntry[0]))
      }

      if (!a.madrugadora?.unlocked) {
        const early = workouts.filter(w => { const h = getWorkoutHour(w); return h !== null && h < 8 })
        if (early.length >= 5) push('madrugadora', `${early.length} entrenamientos antes de las 8 AM`)
      }
      if (!a.madrugadoraExtrema?.unlocked) {
        if (workouts.some(w => { const h = getWorkoutHour(w); return h !== null && h < 6.5 })) push('madrugadoraExtrema', 'Entrenamiento antes de las 6:30 AM')
      }
      if (!a.aveNocturna?.unlocked) {
        if (workouts.some(w => { const h = getWorkoutHour(w); return h !== null && h >= 21 })) push('aveNocturna', 'Entrenamiento después de las 21:00')
      }

      if (!a.finDeSeActivo?.unlocked) {
        const byWeek = {}
        workouts.forEach(w => {
          const d = new Date(w.date + 'T12:00:00')
          const day = d.getDay()
          if (day !== 0 && day !== 6) return
          const k = getWeekKey(w.date)
          if (!byWeek[k]) byWeek[k] = new Set()
          byWeek[k].add(day)
        })
        const qualEntry = Object.entries(byWeek).find(([, s]) => s.has(0) && s.has(6))
        if (qualEntry) push('finDeSeActivo', fmtWeek(qualEntry[0]))
      }

      const streak3 = computeMaxStreak(workouts, 3)
      if (!a.rachaFuego?.unlocked  && streak3 >= 4)  push('rachaFuego',  '4 semanas seguidas con 3+ días')
      if (!a.rachaElite?.unlocked  && streak3 >= 12) push('rachaElite',  '12 semanas seguidas con 3+ días')

      if (!a.cincuenta?.unlocked       && workouts.length >= 50)  push('cincuenta',       '50 entrenamientos completados')
      if (!a.constanciaTotal?.unlocked && workouts.length >= 100) push('constanciaTotal', '100 entrenamientos completados')

      if (!a.primerAumento?.unlocked || !a.tresPRs?.unlocked || !a.diezPRs?.unlocked) {
        const { prCount } = computePRData(workouts)
        if (!a.primerAumento?.unlocked && prCount >= 1)  push('primerAumento', 'Primera subida de peso registrada')
        if (!a.tresPRs?.unlocked       && prCount >= 3)  push('tresPRs',       '3 récords personales superados')
        if (!a.diezPRs?.unlocked       && prCount >= 10) push('diezPRs',       '10 récords personales superados')
      }

      if (!a.dobleProg?.unlocked) {
        const sorted = [...workouts].filter(w => w.type === 'fuerza' && w.exercises?.length).sort((a, b) => a.date.localeCompare(b.date))
        const firstW = {}, curW = {}, names = {}
        for (const w of sorted) {
          for (const e of (w.exercises ?? [])) {
            if (!e.exerciseId || !e.sets?.length) continue
            const maxW = Math.max(0, ...e.sets.map(s => Number(s.weight) || 0))
            if (!maxW) continue
            if (firstW[e.exerciseId] == null) firstW[e.exerciseId] = maxW
            curW[e.exerciseId] = maxW
            names[e.exerciseId] = e.name || e.exerciseId
          }
        }
        const doubled = Object.keys(firstW).find(id => curW[id] >= firstW[id] * 2 && firstW[id] > 0)
        if (doubled) push('dobleProg', `${names[doubled]} · de ${firstW[doubled]}kg a ${curW[doubled]}kg`)
      }

      if (!a.piernasAcero?.unlocked && checkPiernasAcero(workouts)) push('piernasAcero', '4 semanas seguidas entrenando piernas')

      if (!a.cinco5km?.unlocked || !a.veinte20km?.unlocked) {
        const km = getTotalRunningKm(workouts)
        if (!a.cinco5km?.unlocked   && km >= 5)  push('cinco5km',   `${km.toFixed(1)}km acumulados corriendo`)
        if (!a.veinte20km?.unlocked && km >= 20) push('veinte20km', `${km.toFixed(1)}km acumulados corriendo`)
      }

      if (!a.ritmoSolido?.unlocked) {
        const pace = getAvgPaceMinPerKm(workouts)
        if (pace != null && pace < 6) {
          const mins = Math.floor(pace)
          const secs = String(Math.round((pace - mins) * 60)).padStart(2, '0')
          push('ritmoSolido', `Promedio ${mins}:${secs} min/km`)
        }
      }

      if (!a.dobleRueda?.unlocked) {
        if (workouts.some(w => w.type === 'cardio' && w.activity?.toLowerCase().includes('roller') && Number(w.distancia) >= 20))
          push('dobleRueda', '20km en rollers en una sesión')
      }

      if (!a.semanaMixta?.unlocked) {
        const mix = {}
        workouts.forEach(w => {
          const k = getWeekKey(w.date)
          if (!mix[k]) mix[k] = { f: false, c: false }
          if (w.type === 'fuerza') mix[k].f = true
          if (w.type === 'cardio' || w.type === 'clase') mix[k].c = true
        })
        if (Object.values(mix).some(v => v.f && v.c)) push('semanaMixta', 'Semana con fuerza + cardio o clase')
      }

      if (!a.balancePerfecto?.unlocked && checkBalancePerfecto(workouts)) push('balancePerfecto', '4 semanas seguidas con cardio incluido')
      if (!a.energiaAlza?.unlocked     && checkEnergiaAlza(workouts))     push('energiaAlza',    'Cansancio bajó 2+ puntos en una semana')
      if (!a.guerreraDescanso?.unlocked && (settings?.deloadsCompleted ?? 0) >= 3) push('guerreraDescanso', `${settings?.deloadsCompleted ?? 3} semanas de descarga completadas`)
      if (!a.resiliencia?.unlocked && checkResiliencia(workouts)) push('resiliencia', 'Vuelta después de 7+ días sin entrenar')

      if (!a.aniversario?.unlocked && workouts.length > 0) {
        const real = workouts.filter(w => w.type !== 'descanso')
        if (real.length > 0) {
          const first = new Date(real[real.length - 1].date + 'T12:00:00')
          if ((new Date() - first) >= 365 * 24 * 3600 * 1000) push('aniversario', 'Un año desde el primer entrenamiento')
        }
      }

      if (!a.dosSemanas?.unlocked) {
        const weekDays = {}
        workouts.filter(w => w.type !== 'descanso').forEach(w => {
          const k = getWeekKey(w.date)
          if (!weekDays[k]) weekDays[k] = new Set()
          weekDays[k].add(w.date)
        })
        const qualifying = Object.keys(weekDays).filter(k => weekDays[k].size >= 3).sort()
        let found = false
        for (let i = 1; i < qualifying.length; i++) {
          const diff = Math.round((new Date(qualifying[i] + 'T12:00:00') - new Date(qualifying[i-1] + 'T12:00:00')) / 86400000)
          if (diff === 7) { found = true; break }
        }
        if (found) push('dosSemanas', fmtWeek(qualifying[qualifying.length - 1]))
      }

      for (const { key, detail } of toUnlock) {
        await unlockAchievement(user.uid, key, detail)
        setAchieved(prev => ({ ...prev, [key]: { unlocked: true, detail } }))
      }
    }

    check()
  }, [workouts, user])

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
