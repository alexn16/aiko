'use client'
import { useEffect, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

export function AIChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    const userMsg: Message = { role: 'user', content: text }
    const pendingMsg: Message = { role: 'assistant', content: '', pending: true }

    setMessages(prev => [...prev, userMsg, pendingMsg])
    setLoading(true)

    // Build history for the API (exclude the pending placeholder)
    const history = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      if (!res.ok || res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        throw new Error(data.error ?? 'Request failed')
      }

      // Stream SSE
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              accumulated += parsed.text
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { role: 'assistant', content: accumulated }
                return next
              })
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      setMessages(prev => prev.slice(0, -1)) // remove pending
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function clear() {
    setMessages([])
    setError(null)
  }

  return (
    <>
      {/* ── Floating button ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Chat with AI"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 48, height: 48, borderRadius: '50%',
          background: open ? '#374151' : '#0f172a',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, transform 0.15s',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
        aria-label={open ? 'Close chat' : 'Open AI chat'}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2L14 14M14 2L2 14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C5.58 2 2 5.13 2 9C2 11.07 2.96 12.93 4.5 14.22L4 18L7.8 16.14C8.51 16.36 9.24 16.5 10 16.5C14.42 16.5 18 13.37 18 9.5C18 5.63 14.42 2 10 2Z" fill="white"/>
          </svg>
        )}
      </button>

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 84, right: 24, zIndex: 1000,
          width: 380, height: 520,
          background: '#ffffff', borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.14), 0 4px 20px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'chatSlideUp 0.18s ease-out',
        }}>

          {/* Header */}
          <div style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#ffffff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#0f172a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em',
              }}>
                AI
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>AÏKO Assistant</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Ask me anything</div>
              </div>
            </div>
            {messages.length > 0 && (
              <button onClick={clear} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 10, color: '#94a3b8', padding: '3px 6px',
                borderRadius: 4,
              }}>
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px 14px 8px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 40 }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>✦</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>
                  How can I help?
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
                  Ask about marketing strategy, outreach copy, ICP, campaigns, or anything else.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    'Write a cold email for a SaaS product',
                    'What makes a good ICP?',
                    'Suggest 5 lead generation ideas',
                    'Review my value proposition',
                  ].map(s => (
                    <button key={s} onClick={() => { setInput(s) }} type="button" style={{
                      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7,
                      fontSize: 11, color: '#64748b', padding: '7px 10px', cursor: 'pointer',
                      textAlign: 'left', lineHeight: 1.4,
                    }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '9px 12px',
                  borderRadius: msg.role === 'user'
                    ? '12px 12px 3px 12px'
                    : '3px 12px 12px 12px',
                  background: msg.role === 'user' ? '#0f172a' : '#f8fafc',
                  color: msg.role === 'user' ? '#ffffff' : '#0f172a',
                  fontSize: 13, lineHeight: 1.6,
                  border: msg.role === 'assistant' ? '1px solid #f1f5f9' : 'none',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.pending && !msg.content ? (
                    <span style={{ color: '#94a3b8' }}>
                      <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                      <span style={{ animation: 'pulse 1s infinite 0.2s', marginLeft: 3 }}>●</span>
                      <span style={{ animation: 'pulse 1s infinite 0.4s', marginLeft: 3 }}>●</span>
                    </span>
                  ) : msg.content}
                </div>
              </div>
            ))}

            {error && (
              <div style={{
                padding: '8px 12px', background: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: 8,
                fontSize: 11, color: '#dc2626',
              }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px 12px',
            borderTop: '1px solid #f1f5f9',
            background: '#ffffff',
          }}>
            <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Message AÏKO…"
                rows={1}
                style={{
                  flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 9, padding: '9px 11px',
                  fontSize: 13, color: '#0f172a', resize: 'none', outline: 'none',
                  lineHeight: 1.5, fontFamily: 'Inter, sans-serif',
                  maxHeight: 100, overflowY: 'auto',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
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
                disabled={loading || !input.trim()}
                style={{
                  width: 34, height: 34, borderRadius: 9, border: 'none', flexShrink: 0,
                  background: loading || !input.trim() ? '#e2e8f0' : '#0f172a',
                  cursor: loading || !input.trim() ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L13 7L7 13M1 7H13" stroke={loading || !input.trim() ? '#94a3b8' : 'white'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div style={{ fontSize: 9, color: '#cbd5e1', marginTop: 5, textAlign: 'center' }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  )
}
