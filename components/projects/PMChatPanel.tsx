'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'

interface ChatMessage {
  id: string
  role: 'user' | 'project_manager'
  content: string
  created_at: string
}

interface PMChatPanelProps {
  projectId: string
  pmName: string | null
  pmSpecialty: string | null
  hasProvider: boolean
}

const SUGGESTIONS = [
  'Prepare a campaign proposal',
  'Build the lead strategy',
  'What is blocking this project?',
  'Prepare outreach drafts',
  'Report to CEO',
]

function ts(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function PMChatPanel({ projectId, pmName, pmSpecialty, hasProvider }: PMChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [fetched, setFetched]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLTextAreaElement>(null)

  const pm = pmName ?? 'Project Manager'

  const loadMessages = useCallback(async () => {
    try {
      const res  = await fetch(`/api/projects/${projectId}/pm-chat`)
      const data = await res.json()
      setMessages(data.messages ?? [])
    } finally {
      setFetched(true)
    }
  }, [projectId])

  useEffect(() => { loadMessages() }, [loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    setLoading(true)

    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const res  = await fetch(`/api/projects/${projectId}/pm-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong.')
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      } else {
        await loadMessages()
      }
    } catch {
      setError('Could not reach the server.')
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const noProvider  = !hasProvider
  const noMessages  = fetched && messages.length === 0

  // Build welcome message
  const welcomeMsg = pmName
    ? `Hello, I'm ${pmName}, Project Manager for this project.\n\nI manage the marketing execution: strategy, research, leads, copywriting, outreach preparation, approvals, and reporting. I'll keep the project memory and plan updated so the team stays focused.\n\nWhat would you like this project team to work on first?`
    : `No Project Manager has been assigned to this project yet. Ask the CEO to assign one — just open CEO Chat and say "assign a PM to [project name]".`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* PM header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
        background: '#fafafa', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        {pmName ? (
          <>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: '#ffffff', fontWeight: 700, flexShrink: 0,
            }}>
              {pmName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{pmName}</div>
              {pmSpecialty && (
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{pmSpecialty}</div>
              )}
            </div>
            {noProvider ? (
              <Link
                href="/connect-ai"
                style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 6,
                  background: '#fef2f2', border: '1px solid #fecaca',
                  fontSize: 11, fontWeight: 500, color: '#dc2626', textDecoration: 'none',
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                No AI connected
              </Link>
            ) : (
              <div style={{
                marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 6,
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                fontSize: 11, fontWeight: 500, color: '#16a34a',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                Online
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>
            No PM assigned — open CEO Chat to assign one
          </div>
        )}
      </div>

      {/* Offline banner */}
      {noProvider && pmName && (
        <div style={{
          margin: '12px 16px 0', padding: '10px 14px',
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          fontSize: 12, color: '#dc2626', lineHeight: 1.5,
        }}>
          {pm} is offline. <Link href="/connect-ai" style={{ color: '#dc2626', fontWeight: 600 }}>Connect an AI provider</Link> to start the conversation.
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Welcome */}
        {noMessages && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <PMAvatar name={pmName} />
            <div style={{ flex: 1, maxWidth: 620 }}>
              <div style={{
                background: '#ffffff', borderRadius: '4px 12px 12px 12px',
                padding: '14px 16px', fontSize: 13, color: '#0f172a',
                lineHeight: 1.75, border: '1px solid #f1f5f9',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)', whiteSpace: 'pre-line',
              }}>
                {welcomeMsg}
              </div>

              {/* Suggestion chips — only if PM assigned and provider available */}
              {pmName && !noProvider && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus() }}
                      style={{
                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7,
                        fontSize: 11, color: '#374151', padding: '5px 10px', cursor: 'pointer',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Message history */}
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            gap: msg.role === 'user' ? 0 : 12,
            alignItems: 'flex-start',
          }}>
            {msg.role === 'project_manager' && <PMAvatar name={pmName} />}
            <div style={{ maxWidth: '72%' }}>
              <div style={{
                padding: '11px 15px',
                background: msg.role === 'user' ? '#0f172a' : '#ffffff',
                color: msg.role === 'user' ? '#ffffff' : '#0f172a',
                borderRadius: msg.role === 'user'
                  ? '12px 12px 4px 12px'
                  : '4px 12px 12px 12px',
                fontSize: 13, lineHeight: 1.7,
                border: msg.role === 'project_manager' ? '1px solid #f1f5f9' : 'none',
                boxShadow: msg.role === 'project_manager' ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                whiteSpace: 'pre-line',
              }}>
                {msg.content}
              </div>
              <div style={{
                fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1',
                marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left',
              }}>
                {ts(msg.created_at)}
              </div>
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <PMAvatar name={pmName} />
            <div style={{
              background: '#ffffff', borderRadius: '4px 12px 12px 12px',
              padding: '12px 16px', border: '1px solid #f1f5f9',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: 8,
              color: '#94a3b8', fontSize: 12, fontStyle: 'italic',
            }}>
              <span style={{ display: 'inline-flex', gap: 3 }}>
                {[0, 0.15, 0.3].map((delay, i) => (
                  <span key={i} style={{
                    width: 5, height: 5, borderRadius: '50%', background: '#cbd5e1',
                    display: 'inline-block',
                    animation: `pmPulse 1.2s ease-in-out ${delay}s infinite`,
                  }} />
                ))}
              </span>
              {pm} is thinking…
            </div>
          </div>
        )}

        {/* Inline chips when conversation has started */}
        {messages.length > 0 && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {SUGGESTIONS.slice(0, 3).map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); inputRef.current?.focus() }}
                style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
                  fontSize: 11, color: '#64748b', padding: '4px 9px', cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '0 16px 8px', padding: '9px 12px',
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          fontSize: 12, color: '#dc2626',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>{error}</span>
          <Link href="/connect-ai" style={{ color: '#dc2626', fontWeight: 600, fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Connect AI →
          </Link>
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '10px 16px 16px', borderTop: '1px solid #f1f5f9',
        background: '#ffffff', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              !pmName ? 'Assign a PM first…'
              : noProvider ? 'Connect an AI provider to start chatting…'
              : `Message ${pm}…`
            }
            disabled={!pmName || noProvider || loading}
            rows={1}
            style={{
              flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 9, padding: '10px 13px', fontSize: 13, color: '#0f172a',
              resize: 'none', lineHeight: 1.5, outline: 'none',
              fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
              transition: 'border-color 0.15s', maxHeight: 100, overflowY: 'auto',
              opacity: !pmName || noProvider ? 0.5 : 1,
            }}
            onFocus={e => { e.target.style.borderColor = '#6366f1' }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
            onInput={e => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 100) + 'px'
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading || !pmName || noProvider}
            style={{
              width: 38, height: 38, borderRadius: 9, border: 'none', flexShrink: 0,
              background: !input.trim() || loading || !pmName || noProvider ? '#e2e8f0' : '#6366f1',
              cursor: !input.trim() || loading || !pmName || noProvider ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 7L7 13M1 7H13"
                stroke={!input.trim() || loading || !pmName || noProvider ? '#94a3b8' : 'white'}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 5 }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>

      <style>{`
        @keyframes pmPulse {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50%       { opacity: 1;    transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

function PMAvatar({ name }: { name: string | null }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: name ? '#6366f1' : '#e2e8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, color: '#ffffff', fontWeight: 700, flexShrink: 0, marginTop: 2,
    }}>
      {name ? name.slice(0, 2).toUpperCase() : 'PM'}
    </div>
  )
}
