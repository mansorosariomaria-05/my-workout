import { useState, useEffect } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import { getIntention, saveIntention, getIntentionHistory } from '../../services/db'
import Card from '../ui/Card'

export default function Intencion({ compact, inline }) {
  const { user } = useAuthContext()
  const [intention, setIntention] = useState('')
  const [editing, setEditing]     = useState(false)
  const [draft, setDraft]         = useState('')
  const [history, setHistory]     = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!user) return
    getIntention(user.uid).then(data => {
      if (data?.text) setIntention(data.text)
    })
    getIntentionHistory(user.uid).then(setHistory)
  }, [user])

  const save = async () => {
    if (!draft.trim()) return
    await saveIntention(user.uid, draft.trim())
    setIntention(draft.trim())
    setEditing(false)
  }

  if (inline) {
    if (expanded) return (
      <div className="mx-4 flex flex-col gap-1.5">
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="¿Qué querés lograr esta semana?"
          rows={2}
          className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-xs placeholder-app-muted/40 focus:outline-none focus:border-app-purple/60 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={async () => { await save(); setExpanded(false) }}
            className="text-app-purple-light text-xs px-3 py-1 rounded-lg bg-app-purple/20"
          >
            Guardar
          </button>
          <button onClick={() => setExpanded(false)} className="text-app-muted text-xs px-2 py-1">Cerrar</button>
        </div>
      </div>
    )

    return (
      <button
        onClick={() => { setDraft(intention); setExpanded(true) }}
        className="mx-4 flex items-center gap-1.5 py-0.5 w-full text-left"
      >
        <span className="text-app-purple-light text-xs">✦</span>
        <span className="flex-1 text-xs truncate">
          {intention
            ? <span className="text-app-text/80">{intention.length > 40 ? intention.slice(0, 40) + '…' : intention}</span>
            : <span className="text-app-muted/50">Escribí tu intención semanal...</span>
          }
        </span>
        <span className="text-app-muted/60 text-xs shrink-0">✏️</span>
      </button>
    )
  }

  if (compact) return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center px-6 text-center animate-fadeIn">
      <div className="text-4xl mb-4">✨</div>
      <p className="text-app-muted text-sm mb-3">Tu intención esta semana</p>
      {intention
        ? <p className="text-app-text text-xl font-medium leading-snug max-w-xs">"{intention}"</p>
        : <p className="text-app-muted text-base italic">Sin intención registrada</p>
      }
    </div>
  )

  return (
    <Card className="mx-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-app-muted text-xs mb-0.5">Intención semanal</p>
          {editing ? (
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="¿Qué querés lograr esta semana?"
              rows={2}
              className="w-full bg-app-bg border border-white/10 rounded-xl px-3 py-2 text-app-text text-sm placeholder-app-muted/40 focus:outline-none focus:border-app-purple/60 resize-none mt-1"
            />
          ) : (
            <p
              onClick={() => { setDraft(intention); setEditing(true) }}
              className={`text-sm cursor-pointer ${intention ? 'text-app-text font-medium' : 'text-app-muted italic'}`}
            >
              {intention || 'Escribí tu intención para esta semana...'}
            </p>
          )}
        </div>
        <div className="flex gap-1 ml-2">
          {editing ? (
            <>
              <button onClick={save} className="text-app-purple-light text-xs px-2 py-1 rounded-lg bg-app-purple/20">Guardar</button>
              <button onClick={() => setEditing(false)} className="text-app-muted text-xs px-2 py-1">✕</button>
            </>
          ) : (
            <>
              <button onClick={() => { setDraft(intention); setEditing(true) }} className="text-app-muted">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              {history.length > 1 && (
                <button onClick={() => setShowHistory(s => !s)} className="text-app-muted ml-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showHistory && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          <p className="text-app-muted text-xs mb-2">Semanas anteriores</p>
          {history.slice(1, 5).map(h => (
            <div key={h.id} className="text-app-muted text-xs">
              <span className="text-app-muted/60">{h.weekStart}</span>
              <span className="ml-2 text-app-text/70 italic">"{h.text}"</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
