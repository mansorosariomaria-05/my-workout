import { useState } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import Button from '../ui/Button'

const OBJ_OPTIONS = [
  { key: 'fuerza',      label: 'Ganar fuerza',        emoji: '💪', objetivo: 'Ganar fuerza' },
  { key: 'masa',        label: 'Ganar masa muscular',  emoji: '🏋️', objetivo: 'Ganar masa muscular' },
  { key: 'tonificar',   label: 'Tonificar',            emoji: '🎯', objetivo: 'Tonificar' },
  { key: 'resistencia', label: 'Mejorar resistencia',  emoji: '🏃', objetivo: 'Mejorar resistencia' },
  { key: 'bienestar',   label: 'Bienestar general',    emoji: '🌿', objetivo: 'Bienestar general' },
]
const OBJ_PRIORITY = ['fuerza', 'masa', 'tonificar', 'resistencia', 'bienestar']

const NIVEL_OPTIONS = [
  { label: 'Menos de 6 meses',       value: 'principiante' },
  { label: 'Entre 6 meses y 2 años', value: 'intermedio' },
  { label: 'Más de 2 años',          value: 'avanzado' },
]

const GENERO_OPTIONS = [
  { key: 'femenino',  label: 'Femenino',               emoji: '👩' },
  { key: 'masculino', label: 'Masculino',              emoji: '👨' },
  { key: 'otro',      label: 'Otro / Prefiero no decir', emoji: '🌟' },
]

const STEPS = [
  { id: 'genero',          title: '¿Cómo querés que te llame la app?', subtitle: 'Para personalizar tu experiencia' },
  { id: 'name',            title: '¿Cómo te llamás?',                  subtitle: 'Así te saludamos cada día' },
  { id: 'objectives',      title: '¿Cuáles son tus objetivos?',        subtitle: 'Podés elegir varios' },
  { id: 'nivel',           title: '¿Cuánto tiempo llevás entrenando de forma regular?', subtitle: 'Para ajustar tus sugerencias' },
  { id: 'diasSemana',      title: '¿Cuántos días por semana?',         subtitle: 'Días disponibles para entrenar' },
  { id: 'tiposPreferidos', title: '¿Qué tipos de entrenamiento preferís?', subtitle: 'Podés elegir varios' },
  { id: 'tipoRutina',             title: '¿Cómo organizás tus sesiones de fuerza?',              subtitle: 'Ayuda a calcular tu recuperación muscular' },
  { id: 'sesionesFuerzaObjetivo', title: '¿Cuántas sesiones de fuerza querés hacer por semana?', subtitle: 'Para planificar tu semana ideal' },
  { id: 'lesiones',        title: '¿Tenés lesiones o limitaciones?',   subtitle: 'Te recordamos tenerlas en cuenta' },
  { id: 'equipamiento',    title: '¿Con qué equipamiento contás?',     subtitle: 'Filtramos ejercicios según esto' },
]

const OPTIONS = {
  diasSemana:      [2, 3, 4, 5, 6],
  tiposPreferidos: ['Fuerza', 'Cardio', 'Clases', 'Tabata', 'Mixto'],
  equipamiento:    ['Gym completo', 'Solo mancuernas y bandas', 'Sin equipamiento'],
}

export default function Onboarding() {
  const { user, updateProfile } = useAuthContext()
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    genero: '', name: '', objectives: [], nivel: '', diasSemana: 4,
    tiposPreferidos: [], tipoRutina: '', sesionesFuerzaObjetivo: 3, lesiones: '', equipamiento: '', lesionesYes: false,
  })
  const [saving, setSaving] = useState(false)

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1

  const canContinue = () => {
    const { id } = current
    if (id === 'genero')          return !!data.genero
    if (id === 'name')            return data.name.trim().length > 0
    if (id === 'objectives')      return data.objectives.length > 0
    if (id === 'tiposPreferidos') return data.tiposPreferidos.length > 0
    if (id === 'tipoRutina')             return !!data.tipoRutina
    if (id === 'sesionesFuerzaObjetivo') return data.sesionesFuerzaObjetivo != null
    if (id === 'lesiones')               return true
    return !!data[id]
  }

  const handleNext = async () => {
    if (!canContinue()) return
    if (isLast) {
      setSaving(true)
      const primaryKey = [...data.objectives].sort((a, b) => OBJ_PRIORITY.indexOf(a) - OBJ_PRIORITY.indexOf(b))[0] ?? 'bienestar'
      const objetivo = OBJ_OPTIONS.find(o => o.key === primaryKey)?.objetivo ?? 'Bienestar general'
      await updateProfile({ ...data, objetivo, onboardingDone: true })
      setSaving(false)
    } else {
      setStep(s => s + 1)
    }
  }

  const toggleList = (field, value) => {
    setData(d => ({
      ...d,
      [field]: d[field].includes(value) ? d[field].filter(v => v !== value) : [...d[field], value],
    }))
  }

  const renderStep = () => {
    const { id } = current

    if (id === 'genero') return (
      <div className="space-y-3">
        {GENERO_OPTIONS.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setData(d => ({ ...d, genero: key }))}
            className={`w-full py-3.5 px-4 rounded-xl text-sm text-left border transition-all ${
              data.genero === key
                ? 'bg-app-purple border-app-purple text-white font-medium'
                : 'bg-app-bg border-white/10 text-app-muted hover:border-white/20'
            }`}
          >
            {emoji} {label}
          </button>
        ))}
      </div>
    )

    if (id === 'name') return (
      <input
        autoFocus
        value={data.name}
        onChange={e => setData(d => ({ ...d, name: e.target.value }))}
        placeholder="Tu nombre"
        className="w-full bg-app-bg border border-white/10 rounded-xl px-4 py-3.5 text-app-text text-base placeholder-app-muted/40 focus:outline-none focus:border-app-purple/60"
      />
    )

    if (id === 'objectives') return (
      <div className="space-y-3">
        {OBJ_OPTIONS.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => toggleList('objectives', key)}
            className={`w-full py-3.5 px-4 rounded-xl text-sm text-left border transition-all flex items-center justify-between ${
              data.objectives.includes(key)
                ? 'bg-app-purple border-app-purple text-white font-medium'
                : 'bg-app-bg border-white/10 text-app-muted hover:border-white/20'
            }`}
          >
            <span>{emoji} {label}</span>
            {data.objectives.includes(key) && <span className="text-white text-xs">✓</span>}
          </button>
        ))}
      </div>
    )

    if (id === 'nivel') return (
      <div className="space-y-3">
        {NIVEL_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setData(d => ({ ...d, nivel: value }))}
            className={`w-full py-3.5 px-4 rounded-xl text-sm text-left border transition-all ${
              data.nivel === value
                ? 'bg-app-purple border-app-purple text-white font-medium'
                : 'bg-app-bg border-white/10 text-app-muted hover:border-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    )

    if (id === 'tiposPreferidos') return (
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.tiposPreferidos.map(opt => (
          <button
            key={opt}
            onClick={() => toggleList('tiposPreferidos', opt)}
            className={`py-3 px-4 rounded-xl text-sm font-medium border transition-all ${
              data.tiposPreferidos.includes(opt)
                ? 'bg-app-purple border-app-purple text-white'
                : 'bg-app-bg border-white/10 text-app-muted'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    )

    if (id === 'tipoRutina') return (
      <div className="space-y-3">
        {[
          { value: 'fullbody', emoji: '💪', label: 'Full-body', desc: 'Trabajás todo el cuerpo en cada sesión' },
          { value: 'split',    emoji: '📋', label: 'Split',     desc: 'Cada sesión tiene un grupo muscular distinto' },
        ].map(({ value, emoji, label, desc }) => (
          <button
            key={value}
            onClick={() => setData(d => ({ ...d, tipoRutina: value }))}
            className={`w-full py-3.5 px-4 rounded-xl text-sm text-left border transition-all ${
              data.tipoRutina === value
                ? 'bg-app-purple border-app-purple text-white font-medium'
                : 'bg-app-bg border-white/10 text-app-muted hover:border-white/20'
            }`}
          >
            <span className="font-medium">{emoji} {label}</span>
            <span className={`block text-xs mt-0.5 ${data.tipoRutina === value ? 'text-white/70' : 'text-app-muted/60'}`}>{desc}</span>
          </button>
        ))}
      </div>
    )

    if (id === 'sesionesFuerzaObjetivo') return (
      <div className="flex gap-3 justify-center flex-wrap">
        {[2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => setData(p => ({ ...p, sesionesFuerzaObjetivo: n }))}
            className={`w-14 h-14 rounded-xl text-lg font-bold border transition-all ${
              data.sesionesFuerzaObjetivo === n
                ? 'bg-app-purple border-app-purple text-white'
                : 'bg-app-bg border-white/10 text-app-muted'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    )

    if (id === 'diasSemana') return (
      <div className="flex gap-3 justify-center flex-wrap">
        {OPTIONS.diasSemana.map(d => (
          <button
            key={d}
            onClick={() => setData(p => ({ ...p, diasSemana: d }))}
            className={`w-14 h-14 rounded-xl text-lg font-bold border transition-all ${
              data.diasSemana === d
                ? 'bg-app-purple border-app-purple text-white'
                : 'bg-app-bg border-white/10 text-app-muted'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    )

    if (id === 'lesiones') return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {['No', 'Sí'].map(opt => (
            <button
              key={opt}
              onClick={() => setData(d => ({ ...d, lesionesYes: opt === 'Sí', lesiones: opt === 'No' ? 'Ninguna' : d.lesiones }))}
              className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                (opt === 'No' && !data.lesionesYes) || (opt === 'Sí' && data.lesionesYes)
                  ? 'bg-app-purple border-app-purple text-white'
                  : 'bg-app-bg border-white/10 text-app-muted'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {data.lesionesYes && (
          <textarea
            value={data.lesiones === 'Ninguna' ? '' : data.lesiones}
            onChange={e => setData(d => ({ ...d, lesiones: e.target.value }))}
            placeholder="Describí tu lesión o limitación..."
            rows={3}
            className="w-full bg-app-bg border border-white/10 rounded-xl px-4 py-3 text-app-text text-sm placeholder-app-muted/40 focus:outline-none focus:border-app-purple/60 resize-none"
          />
        )}
      </div>
    )

    const opts = OPTIONS[id] ?? []
    return (
      <div className="space-y-3">
        {opts.map(opt => (
          <button
            key={opt}
            onClick={() => setData(d => ({ ...d, [id]: opt }))}
            className={`w-full py-3.5 px-4 rounded-xl text-sm text-left border transition-all ${
              data[id] === opt
                ? 'bg-app-purple border-app-purple text-white font-medium'
                : 'bg-app-bg border-white/10 text-app-muted hover:border-white/20'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app-bg flex justify-center">
      <div className="w-full max-w-mobile flex flex-col px-6 py-8">
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-app-purple' : 'bg-app-surface'}`}
            />
          ))}
        </div>

        <div className="flex-1">
          <p className="text-app-muted text-xs mb-1">{step + 1} / {STEPS.length}</p>
          <h2 className="text-app-text text-xl font-bold mb-1">{current.title}</h2>
          <p className="text-app-muted text-sm mb-8">{current.subtitle}</p>
          {renderStep()}
        </div>

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="secondary" size="md" onClick={() => setStep(s => s - 1)} className="w-16">
              ←
            </Button>
          )}
          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canContinue() || saving}
            className="flex-1"
          >
            {saving ? 'Guardando...' : isLast ? 'Empezar 💪' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
