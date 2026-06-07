import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext'
import { useWorkouts } from '../../hooks/useWorkouts'
import { logout } from '../../services/auth'
import { getWorkouts, saveWorkout } from '../../services/db'
import Button from '../ui/Button'
import Card from '../ui/Card'

const OBJETIVO_OPTIONS = ['Tonificar', 'Ganar masa muscular', 'Ganar fuerza', 'Mejorar resistencia', 'Bienestar general']
const PAUSA_OPTIONS    = ['Estoy activo/a', '1-2 semanas', '2-4 semanas', '1-3 meses', 'Más de 3 meses']
const EQUIP_OPTIONS    = ['Gym completo', 'Solo mancuernas y bandas', 'Sin equipamiento']
const NIVEL_OPTIONS    = ['Principiante (<1 año)', 'Intermedio (1-3 años)', 'Avanzado (>3 años)']

function Section({ title, children }) {
  return (
    <div>
      <p className="text-app-muted text-xs font-medium uppercase tracking-wider px-1 mb-2">{title}</p>
      <Card>{children}</Card>
    </div>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between py-1 cursor-pointer">
      <span className="text-app-text text-sm">{label}</span>
      <div
        onClick={() => onChange(!value)}
        className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${value ? 'bg-app-purple' : 'bg-app-bg border border-white/10'}`}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-5' : 'left-1'}`} />
      </div>
    </label>
  )
}

export default function ConfigPage() {
  const { user, profile, settings, updateProfile, updateSettings } = useAuthContext()
  const { workouts } = useWorkouts(user?.uid)
  const navigate = useNavigate()

  const [editingProfile, setEditingProfile] = useState(false)
  const [draft, setDraft] = useState({ ...profile })
  const [saving, setSaving]     = useState(false)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 2000) }

  const saveProfile = async () => {
    setSaving(true)
    await updateProfile(draft)
    setSaving(false)
    setEditingProfile(false)
    showMsg('Perfil actualizado')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const exportData = async () => {
    const data = { profile, settings, workouts }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `myworkout-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        setImporting(true)
        if (data.profile)  await updateProfile(data.profile)
        if (data.settings) await updateSettings(data.settings)
        if (Array.isArray(data.workouts)) {
          for (const w of data.workouts) {
            const { id, createdAt, ...workoutData } = w
            await saveWorkout(user.uid, workoutData, workoutData.date ?? null)
          }
        }
        showMsg('Datos importados correctamente')
      } catch {
        showMsg('Error al importar')
      } finally {
        setImporting(false)
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  const avgFatigue = workouts.length
    ? workouts.slice(0, 40).reduce((a, w) => a + (w.fatigue ?? 5), 0) / Math.min(workouts.length, 40)
    : 0
  const suggestDeload = avgFatigue >= 7 && workouts.length >= 8

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-5 pb-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-app-muted">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-app-text text-xl font-bold">Configuración</h1>
      </div>

      {msg && (
        <div className="mx-4 mb-3 bg-app-green/20 border border-app-green-light/30 rounded-xl px-4 py-2.5 text-app-green-light text-sm text-center">
          {msg}
        </div>
      )}

      <div className="px-4 space-y-5 pb-8">
        <Section title="Mi perfil">
          {!editingProfile ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-app-muted text-sm">Nombre</span>
                <span className="text-app-text text-sm">{profile?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-muted text-sm">Objetivo</span>
                <span className="text-app-text text-sm">{profile?.objetivo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-muted text-sm">Nivel</span>
                <span className="text-app-text text-sm">{profile?.nivel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-muted text-sm">Días / semana</span>
                <span className="text-app-text text-sm">{profile?.diasSemana}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-muted text-sm">Equipamiento</span>
                <span className="text-app-text text-sm">{profile?.equipamiento}</span>
              </div>
              {profile?.lesiones && profile.lesiones !== 'Ninguna' && (
                <div className="flex justify-between">
                  <span className="text-app-muted text-sm">Lesiones</span>
                  <span className="text-app-coral text-sm text-right max-w-[180px]">{profile.lesiones}</span>
                </div>
              )}
              <Button size="sm" variant="secondary" onClick={() => { setDraft({ ...profile }); setEditingProfile(true) }}>
                Editar perfil
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-app-muted text-xs mb-1 block">Nombre</label>
                <input value={draft.name ?? ''} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-app-muted text-xs mb-1 block">Objetivo</label>
                <select value={draft.objetivo ?? ''} onChange={e => setDraft(d => ({ ...d, objetivo: e.target.value }))}
                  className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none">
                  {OBJETIVO_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-app-muted text-xs mb-1 block">Nivel</label>
                <select value={draft.nivel ?? ''} onChange={e => setDraft(d => ({ ...d, nivel: e.target.value }))}
                  className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none">
                  {NIVEL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-app-muted text-xs mb-1 block">Días disponibles</label>
                <div className="flex gap-2">
                  {[2,3,4,5,6].map(d => (
                    <button key={d} onClick={() => setDraft(p => ({ ...p, diasSemana: d }))}
                      className={`flex-1 py-2 rounded-xl text-sm border ${draft.diasSemana === d ? 'border-app-purple bg-app-purple/20 text-app-purple-light' : 'border-white/10 text-app-muted'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-app-muted text-xs mb-1 block">Equipamiento</label>
                <select value={draft.equipamiento ?? ''} onChange={e => setDraft(d => ({ ...d, equipamiento: e.target.value }))}
                  className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none">
                  {EQUIP_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-app-muted text-xs mb-1 block">Género</label>
                <div className="flex gap-2">
                  {[['femenino','Femenino'],['masculino','Masculino'],['otro','Prefiero no decir']].map(([val, label]) => (
                    <button key={val} onClick={() => setDraft(d => ({ ...d, genero: val }))}
                      className={`flex-1 py-2 rounded-xl text-xs border transition-all ${draft.genero === val ? 'border-app-purple bg-app-purple/20 text-app-purple-light' : 'border-white/10 text-app-muted'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-app-muted text-xs mb-1 block">Lesiones / limitaciones</label>
                <textarea value={draft.lesiones ?? ''} onChange={e => setDraft(d => ({ ...d, lesiones: e.target.value }))}
                  rows={2} className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm focus:outline-none resize-none" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveProfile} disabled={saving} className="flex-1">
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingProfile(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </Section>

        <Section title="Pausa del entrenamiento">
          <div>
            <p className="text-app-text text-sm mb-3">¿Volvés después de una pausa?</p>
            <div className="space-y-2">
              {PAUSA_OPTIONS.map(p => (
                <button key={p} onClick={() => updateProfile({ pausa: p })}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm border transition-all ${
                    profile?.pausa === p ? 'border-app-purple bg-app-purple/10 text-app-purple-light' : 'border-white/8 text-app-muted'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Semana de descarga">
          {suggestDeload && !settings?.deloadActive && (
            <div className="bg-app-amber/10 border border-app-amber/30 rounded-xl px-3 py-2.5 mb-3">
              <p className="text-app-amber text-xs font-medium">Tu cansancio promedio es {avgFatigue.toFixed(1)}/10</p>
              <p className="text-app-muted text-xs mt-0.5">Se recomienda activar una semana de descarga</p>
            </div>
          )}
          <Toggle
            label="Semana de descarga"
            value={settings?.deloadActive ?? false}
            onChange={(v) => {
              if (!v && settings?.deloadActive) {
                updateSettings({ deloadActive: false, deloadsCompleted: (settings.deloadsCompleted ?? 0) + 1 })
              } else {
                updateSettings({ deloadActive: v })
              }
            }}
          />
          {settings?.deloadActive && (
            <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
              <p className="text-app-muted text-xs">· Fuerza: 65% del peso habitual, 2 series</p>
              <p className="text-app-muted text-xs">· Cardio: 20-40 min, ritmo suave</p>
              <p className="text-app-muted text-xs">· HIIT/Tabata: aviso antes de empezar</p>
            </div>
          )}
        </Section>

        <Section title="Timer de descanso">
          <div>
            <p className="text-app-muted text-xs mb-2">Segundos de descanso por defecto</p>
            <input
              type="number"
              value={settings?.restTimerSeconds ?? 90}
              onChange={e => updateSettings({ restTimerSeconds: Number(e.target.value) })}
              className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm text-center focus:outline-none"
            />
          </div>
        </Section>

        <Section title="Datos">
          <div className="space-y-3">
            <Button size="md" variant="secondary" onClick={exportData} className="w-full">
              Exportar datos (JSON)
            </Button>
            <label className={`block ${importing ? 'pointer-events-none opacity-60' : ''}`}>
              <div className="w-full py-2.5 px-4 rounded-xl bg-app-elevated text-app-muted text-sm text-center border border-white/10 cursor-pointer active:scale-95">
                {importing ? 'Importando...' : 'Importar datos (JSON)'}
              </div>
              <input type="file" accept=".json" className="hidden" onChange={importData} disabled={importing} />
            </label>
          </div>
        </Section>

        <Button size="lg" variant="danger" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
