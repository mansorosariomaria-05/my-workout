import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import logoFull from '../../assets/logo-full.png'
import { login, register } from '../../services/auth'
import Button from '../ui/Button'

export default function AuthScreen() {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setVerifyMsg('')
    if (mode === 'register' && password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
        setVerifyMsg(`Te enviamos un mail de confirmación a ${email}. Revisá tu bandeja de entrada para activar tu cuenta.`)
      }
    } catch (err) {
      const msgs = {
        'auth/user-not-found':       'Usuario no encontrado',
        'auth/wrong-password':       'Contraseña incorrecta',
        'auth/email-already-in-use': 'El email ya está registrado',
        'auth/weak-password':        'La contraseña debe tener al menos 6 caracteres',
        'auth/invalid-email':        'Email inválido',
        'auth/invalid-credential':   'Credenciales incorrectas',
      }
      setError(msgs[err.code] ?? 'Ocurrió un error. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-app-bg flex justify-center">
      <div className="w-full max-w-mobile flex flex-col items-center justify-center px-6 py-12">
        <div style={{ backgroundColor: '#0D0D12' }} className="flex justify-center mb-8">
          <img src={logoFull} alt="My Workout" style={{ width: '260px', maxWidth: '75%' }} />
        </div>

        <div className="w-full bg-app-surface rounded-2xl p-6">
          <div className="flex mb-6 gap-1 bg-app-bg rounded-xl p-1">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setVerifyMsg('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? 'bg-app-purple text-white' : 'text-app-muted'
                }`}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-app-muted text-xs mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full bg-app-bg border border-white/10 rounded-xl px-4 py-3 text-app-text text-sm placeholder-app-muted/50 focus:outline-none focus:border-app-purple/60"
              />
            </div>

            <div>
              <label className="block text-app-muted text-xs mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-app-bg border border-white/10 rounded-xl px-4 py-3 pr-11 text-app-text text-sm placeholder-app-muted/50 focus:outline-none focus:border-app-purple/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted/60"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-app-muted text-xs mb-1.5">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    type={showConf ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-app-bg border border-white/10 rounded-xl px-4 py-3 pr-11 text-app-text text-sm placeholder-app-muted/50 focus:outline-none focus:border-app-purple/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConf(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted/60"
                  >
                    {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-app-coral/10 border border-app-coral/30 rounded-xl px-4 py-3 text-app-coral text-sm">
                {error}
              </div>
            )}

            {verifyMsg && (
              <div className="bg-app-purple/10 border border-app-purple/30 rounded-xl px-4 py-3 text-app-purple-light text-sm">
                {verifyMsg}
              </div>
            )}

            <Button type="submit" size="lg" disabled={loading} className="mt-2">
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
