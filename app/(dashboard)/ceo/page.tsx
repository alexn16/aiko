'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompanyMemory {
  summary: string
  global_priorities: string[]
  blocked_items: string[]
  last_review_at: string | null
  updated_at: string
}

interface DelegationChip {
  status: 'completed' | 'approval_required' | 'blocked' | 'failed'
  message: string
  actionId?: string
  taskOutputId?: string
}

interface CapabilityGap {
  missing: string[]
  proposal_id: string
  score: number
}

interface CeoCommand {
  id: string
  command: string
  response: string
  intent: string
  actions: Array<{ type: string; data: Record<string, unknown> }>
  created_at: string
  delegation?: DelegationChip | null
}

interface StatusData {
  projects: Array<{
    id: string
    name: string
    goal: string | null
    pm_name: string | null
  }>
  project_managers: Array<{
    id: string
    name: string
    specialty: string
    status: string
    current_focus: string
  }>
  pending_approvals: number
  total_leads: number
  active_agents: number
}

interface ReviewFinding {
  project_id: string
  project_name: string
  status: 'healthy' | 'attention' | 'blocked' | 'stale'
  issues: string[]
  positive: string[]
  pm_report_summary: string | null
  pm_report_status: string | null
  pm_report_at: string | null
}

interface CeoReview {
  id: string
  summary: string
  project_count: number
  pending_approval_count: number
  blocked_project_count: number
  priority_project_id: string | null
  priority_project_name: string | null
  findings: ReviewFinding[]
  recommended_actions: string[]
  created_at: string
}

interface ProviderInfo {
  name: string
  type: string
  model?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WELCOME_MESSAGE = `Hello, I'm AÏKO CEO.

I manage your AI marketing company. You can give me a project, and I will assign a Project Manager, create a marketing team, build the project memory, prepare the project map, and coordinate research, leads, copywriting, outreach, approvals, and reports.

Nothing external will be sent without your approval.

What project should we work on first?`

const SUGGESTIONS = [
  'Create a marketing team for ALB Parking',
  'Show me what every team is doing',
  'Run a CEO review',
  'Prepare a campaign proposal',
  'What needs my approval?',
]

const FINDING_STYLE: Record<string, { dot: string; labelColor: string; bg: string; border: string }> = {
  healthy:   { dot: '#10b981', labelColor: '#10b981',  bg: '#f0fdf4', border: '#bbf7d0' },
  attention: { dot: '#f59e0b', labelColor: '#d97706',  bg: '#fffbeb', border: '#fde68a' },
  blocked:   { dot: '#ef4444', labelColor: '#dc2626',  bg: '#fef2f2', border: '#fecaca' },
  stale:     { dot: '#94a3b8', labelColor: '#64748b',  bg: '#f8fafc', border: '#e2e8f0' },
}

const PM_DOT: Record<string, string> = {
  available: '#10b981', busy: '#f59e0b', away: '#94a3b8',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function relativeDate(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function providerLabel(p: ProviderInfo) {
  const typeMap: Record<string, string> = {
    openai_api: 'OpenAI', anthropic_api: 'Claude', ollama: 'Ollama',
    openai_compatible: 'Custom', groq: 'Groq',
  }
  return p.name || typeMap[p.type] || 'AI'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CeoPage() {
  const [tab, setTab] = useState<'chat' | 'review'>('chat')

  // Chat state
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [cmdError, setCmdError]       = useState<string | null>(null)
  const [commands, setCommands]       = useState<CeoCommand[]>([])
  const [lastDelegation, setLastDelegation] = useState<DelegationChip | null>(null)
  const [lastCapabilityGap, setLastCapabilityGap] = useState<CapabilityGap | null>(null)
  const bottomRef                     = useRef<HTMLDivElement>(null)
  const inputRef                      = useRef<HTMLTextAreaElement>(null)

  // Reviews
  const [reviews, setReviews]             = useState<CeoReview[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [selectedReview, setSelectedReview] = useState<CeoReview | null>(null)

  // Company data
  const [memory, setMemory]           = useState<CompanyMemory | null>(null)
  const [status, setStatus]           = useState<StatusData | null>(null)
  const [provider, setProvider]       = useState<ProviderInfo | null>(null)
  const [providerChecked, setProviderChecked] = useState(false)

  const loadData = useCallback(async () => {
    const [memRes, statusRes, reviewsRes, provRes, brainRes] = await Promise.all([
      fetch('/api/ceo/memory'),
      fetch('/api/ceo/status'),
      fetch('/api/ceo/reviews'),
      fetch('/api/providers'),
      fetch('/api/providers/brain'),
    ])
    const memData     = await memRes.json()
    const statusData  = await statusRes.json()
    const reviewsData = await reviewsRes.json()
    const provData    = await provRes.json()
    const brainData   = await brainRes.json()

    setMemory(memData.memory ?? null)
    setCommands(memData.commands ?? [])
    setStatus(statusData)

    const reviewList: CeoReview[] = reviewsData.reviews ?? []
    setReviews(reviewList)
    if (reviewList.length > 0 && !selectedReview) setSelectedReview(reviewList[0])

    // Find CEO-role-specific provider, fall back to first connected
    const ceoBrain = (brainData.roles ?? []).find((r: { role: string }) => r.role === 'ceo')
    if (ceoBrain?.provider_name) {
      setProvider({ name: ceoBrain.provider_name, type: ceoBrain.provider_type ?? '', model: ceoBrain.model ?? undefined })
    } else {
      const connected = (provData.providers ?? []).filter((p: { status: string }) => p.status === 'connected')
      if (connected.length > 0) setProvider({ name: connected[0].name, type: connected[0].type })
    }
    setProviderChecked(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [commands, loading])

  // ── Send ──────────────────────────────────────────────────────────────────

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setCmdError(null)
    setLastDelegation(null)
    setLastCapabilityGap(null)
    setLoading(true)

    // Optimistic user message
    const optimistic: CeoCommand = {
      id: `pending-${Date.now()}`,
      command: text,
      response: '',
      intent: 'general',
      actions: [],
      created_at: new Date().toISOString(),
    }
    setCommands(prev => [optimistic, ...prev])

    try {
      const res = await fetch('/api/ceo/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: text }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setCmdError(data.error ?? 'Something went wrong.')
        setCommands(prev => prev.filter(c => c.id !== optimistic.id))
      } else {
        if (data.delegation) setLastDelegation(data.delegation)
        if (data.capability_gap) setLastCapabilityGap(data.capability_gap)
      }
    } catch {
      setCmdError('Could not reach the server.')
      setCommands(prev => prev.filter(c => c.id !== optimistic.id))
    } finally {
      setLoading(false)
      await loadData()
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ── Review ────────────────────────────────────────────────────────────────

  async function runReview() {
    if (reviewLoading) return
    setReviewLoading(true)
    const res  = await fetch('/api/ceo/reviews', { method: 'POST' })
    const data = await res.json()
    setReviewLoading(false)
    if (data.review) {
      setReviews(prev => [data.review, ...prev])
      setSelectedReview(data.review)
      setTab('review')
    }
    await loadData()
  }

  const noProvider = providerChecked && !provider

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 48, flexShrink: 0,
        borderBottom: '1px solid #f1f5f9', background: '#ffffff',
        gap: 16,
      }}>
        {/* Left: title + tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', marginRight: 20 }}>
            CEO
          </span>
          {(['chat', 'review'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 2px', marginRight: 18, height: 48,
                fontSize: 13,
                fontWeight: tab === t ? 500 : 400,
                color: tab === t ? '#0f172a' : '#94a3b8',
                borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
                letterSpacing: '-0.01em',
                textTransform: 'capitalize',
                transition: 'color 0.1s',
              }}
            >
              {t === 'review'
                ? `Reviews${reviews.length > 0 ? ` (${reviews.length})` : ''}`
                : 'Chat'}
            </button>
          ))}
        </div>

        {/* Right: provider badge + run review */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {provider ? (
            <Link
              href="/connect-ai"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 6,
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                fontSize: 11, fontWeight: 500, color: '#16a34a',
                textDecoration: 'none',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
              CEO brain: {providerLabel(provider)}{provider.model ? <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 400, color: '#64748b', marginLeft: 4 }}>{` · ${provider.model}`}</span> : null}
            </Link>
          ) : providerChecked ? (
            <Link
              href="/connect-ai"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 6,
                background: '#fef2f2', border: '1px solid #fecaca',
                fontSize: 11, fontWeight: 500, color: '#dc2626',
                textDecoration: 'none',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
              No AI connected
            </Link>
          ) : null}

          <button
            onClick={runReview}
            disabled={reviewLoading || noProvider}
            style={{
              background: reviewLoading || noProvider ? '#f1f5f9' : '#0f172a',
              color: reviewLoading || noProvider ? '#94a3b8' : '#ffffff',
              border: 'none', borderRadius: 7,
              padding: '5px 12px',
              fontSize: 12, fontWeight: 500,
              cursor: reviewLoading || noProvider ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {reviewLoading ? 'Running…' : 'Run review'}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Chat tab ──────────────────────────────────────────────────────── */}
        {tab === 'chat' && (
          <>
            {/* Main chat area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Offline banner */}
              {noProvider && (
                <div style={{
                  margin: '16px 24px 0', padding: '14px 18px',
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                  fontSize: 13, color: '#dc2626', lineHeight: 1.6,
                }}>
                  <strong>AÏKO CEO is offline.</strong> Connect ChatGPT, Claude, OpenAI API, Anthropic API, Local AI, or Custom Endpoint before the company can operate.{' '}
                  <Link href="/connect-ai" style={{ color: '#dc2626', fontWeight: 600 }}>Connect AI →</Link>
                </div>
              )}

              {/* Messages */}
              <div style={{
                flex: 1, overflowY: 'auto', padding: '24px 28px',
                display: 'flex', flexDirection: 'column', gap: 20,
              }}>

                {/* Welcome — shown when no commands yet */}
                {commands.length === 0 && !loading && (
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <CeoAvatar />
                    <div style={{ flex: 1, maxWidth: 680 }}>
                      <div style={{
                        background: '#ffffff', borderRadius: '4px 14px 14px 14px',
                        padding: '16px 20px', fontSize: 14, color: '#0f172a',
                        lineHeight: 1.75, border: '1px solid #f1f5f9',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        whiteSpace: 'pre-line',
                      }}>
                        {noProvider
                          ? 'AÏKO CEO is offline. Connect ChatGPT, Claude, OpenAI API, Anthropic API, Local AI, or Custom Endpoint before the company can operate.'
                          : WELCOME_MESSAGE}
                      </div>

                      {/* Suggestion chips */}
                      {!noProvider && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                          {SUGGESTIONS.map(s => (
                            <button
                              key={s}
                              onClick={() => { setInput(s); inputRef.current?.focus() }}
                              style={{
                                background: '#f8fafc', border: '1px solid #e2e8f0',
                                borderRadius: 8, fontSize: 12, color: '#374151',
                                padding: '6px 12px', cursor: 'pointer', lineHeight: 1.4,
                                transition: 'background 0.1s',
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

                {/* Command history (reversed so newest is at bottom) */}
                {[...commands].reverse().map((cmd) => (
                  <div key={cmd.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* User message */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{
                        maxWidth: '72%', background: '#0f172a', color: '#ffffff',
                        borderRadius: '14px 14px 4px 14px',
                        padding: '12px 16px', fontSize: 14, lineHeight: 1.6,
                      }}>
                        {cmd.command}
                      </div>
                    </div>

                    {/* CEO response */}
                    {(cmd.response || cmd.id.startsWith('pending')) && (
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <CeoAvatar />
                        <div style={{ flex: 1, maxWidth: 680 }}>
                          {cmd.id.startsWith('pending') ? (
                            <div style={{
                              background: '#ffffff', borderRadius: '4px 14px 14px 14px',
                              padding: '14px 18px', border: '1px solid #f1f5f9',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                              color: '#94a3b8', fontSize: 13, fontStyle: 'italic',
                              display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                              <span style={{
                                display: 'inline-flex', gap: 3,
                              }}>
                                {[0, 0.15, 0.3].map((delay, i) => (
                                  <span key={i} style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: '#cbd5e1', display: 'inline-block',
                                    animation: `ceoPulse 1.2s ease-in-out ${delay}s infinite`,
                                  }} />
                                ))}
                              </span>
                              AÏKO CEO is thinking…
                            </div>
                          ) : (
                            <>
                              <div style={{
                                background: '#ffffff', borderRadius: '4px 14px 14px 14px',
                                padding: '14px 18px', fontSize: 14, color: '#0f172a',
                                lineHeight: 1.75, border: '1px solid #f1f5f9',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                whiteSpace: 'pre-line',
                              }}>
                                {cmd.response}
                              </div>
                              {cmd.actions.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                  {cmd.actions.map((a, i) => (
                                    <span key={i} style={{
                                      fontSize: 10, color: '#6366f1', background: '#eef2ff',
                                      borderRadius: 4, padding: '2px 7px', fontWeight: 500,
                                    }}>
                                      {a.type.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#cbd5e1', marginTop: 5 }}>
                                {ts(cmd.created_at)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Delegation chip — shown after the last CEO response */}
                {lastDelegation && !loading && (
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, flexShrink: 0 }} />
                    <DelegationChipView chip={lastDelegation} />
                  </div>
                )}

                {/* Capability gap chip */}
                {lastCapabilityGap && !loading && (
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, flexShrink: 0 }} />
                    <div style={{ marginTop: 4 }}>
                      <Link
                        href="/system"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 11, padding: '4px 10px', borderRadius: 6,
                          fontWeight: 500, textDecoration: 'none',
                          background: '#fef3c7', color: '#d97706',
                        }}
                      >
                        ⚠ {lastCapabilityGap.missing.length} {lastCapabilityGap.missing.length === 1 ? 'capability' : 'capabilities'} missing — improvement proposal created
                      </Link>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input area */}
              <div style={{
                padding: '12px 24px 18px', borderTop: '1px solid #f1f5f9', background: '#ffffff',
                flexShrink: 0,
              }}>
                {cmdError && (
                  <div style={{
                    marginBottom: 10, padding: '9px 14px',
                    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                    fontSize: 12, color: '#dc2626',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <span>{cmdError}</span>
                    <Link href="/connect-ai" style={{ color: '#dc2626', fontWeight: 600, fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      Connect AI →
                    </Link>
                  </div>
                )}

                {/* Show chips inline above input when there ARE commands */}
                {commands.length > 0 && !loading && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {SUGGESTIONS.slice(0, 3).map(s => (
                      <button
                        key={s}
                        onClick={() => { setInput(s); inputRef.current?.focus() }}
                        style={{
                          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
                          fontSize: 11, color: '#64748b', padding: '4px 10px', cursor: 'pointer',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={noProvider
                      ? 'Connect an AI provider to start the CEO…'
                      : 'Message AÏKO CEO…'}
                    disabled={noProvider || loading}
                    rows={1}
                    style={{
                      flex: 1, background: noProvider ? '#f8fafc' : '#f8fafc',
                      border: '1px solid #e2e8f0', borderRadius: 10,
                      padding: '11px 14px', fontSize: 14, color: '#0f172a',
                      resize: 'none', lineHeight: 1.5, outline: 'none',
                      fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
                      transition: 'border-color 0.15s', maxHeight: 120, overflowY: 'auto',
                      opacity: noProvider ? 0.5 : 1,
                    }}
                    onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
                    onInput={e => {
                      const t = e.currentTarget
                      t.style.height = 'auto'
                      t.style.height = Math.min(t.scrollHeight, 120) + 'px'
                    }}
                  />
                  <button
                    onClick={send}
                    disabled={loading || !input.trim() || noProvider}
                    style={{
                      width: 42, height: 42, borderRadius: 10, border: 'none', flexShrink: 0,
                      background: loading || !input.trim() || noProvider ? '#e2e8f0' : '#0f172a',
                      cursor: loading || !input.trim() || noProvider ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1L13 7L7 13M1 7H13" stroke={loading || !input.trim() || noProvider ? '#94a3b8' : 'white'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 5 }}>
                  Enter to send · Shift+Enter for new line
                </div>
              </div>
            </div>

            {/* ── Right panel: Company info ─────────────────────────────────── */}
            <div style={{
              width: 248, flexShrink: 0, borderLeft: '1px solid #f1f5f9',
              overflowY: 'auto', padding: '20px 16px',
              display: 'flex', flexDirection: 'column', gap: 20,
              background: '#fafafa',
            }}>
              <PanelSection label="Company memory">
                {memory ? (
                  <>
                    <div style={{
                      fontSize: 12, color: '#374151', lineHeight: 1.65,
                      background: '#ffffff', borderRadius: 7, padding: '9px 11px',
                      border: '1px solid #f1f5f9',
                    }}>
                      {memory.summary || 'No summary yet.'}
                    </div>
                    {(memory.global_priorities ?? []).length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginBottom: 4 }}>Priorities</div>
                        {memory.global_priorities.map((p, i) => (
                          <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 3 }}>
                            <span style={{ color: '#6366f1', fontSize: 10, flexShrink: 0, marginTop: 2 }}>·</span>
                            <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(memory.blocked_items ?? []).length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 500, marginBottom: 4 }}>Blocked</div>
                        {memory.blocked_items.map((b, i) => (
                          <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 3 }}>
                            <span style={{ color: '#ef4444', fontSize: 10, flexShrink: 0, marginTop: 2 }}>!</span>
                            <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{b}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1', marginTop: 6 }}>
                      {memory.last_review_at ? `reviewed ${relativeDate(memory.last_review_at)}` : `updated ${ts(memory.updated_at)}`}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>No memory yet — issue your first command.</div>
                )}
              </PanelSection>

              {status && (
                <PanelSection label="Project Managers">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {status.project_managers.map(pm => (
                      <div key={pm.id} style={{
                        padding: '7px 9px', borderRadius: 7,
                        background: '#ffffff', border: '1px solid #f1f5f9',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                            background: PM_DOT[pm.status] ?? '#94a3b8',
                          }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{pm.name}</span>
                          <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 'auto' }}>{pm.status}</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', paddingLeft: 10 }}>{pm.specialty}</div>
                        {pm.current_focus && (
                          <div style={{ fontSize: 10, color: '#64748b', paddingLeft: 10, marginTop: 1, lineHeight: 1.4, fontStyle: 'italic' }}>
                            {pm.current_focus}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </PanelSection>
              )}

              {status && status.projects.length > 0 && (
                <PanelSection label="Active projects">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {status.projects.map(p => (
                      <div key={p.id} style={{
                        padding: '7px 9px', borderRadius: 6,
                        background: '#ffffff', border: '1px solid #f1f5f9',
                      }}>
                        <a href={`/projects/${p.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                            {p.pm_name ? `PM: ${p.pm_name}` : 'No PM assigned'}
                          </div>
                        </a>
                        {p.pm_name && (
                          <a href={`/projects/${p.id}?tab=pm-chat`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 10, color: '#6366f1', fontWeight: 500,
                            textDecoration: 'none',
                          }}>
                            <span style={{ fontSize: 9 }}>💬</span> Chat with {p.pm_name}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </PanelSection>
              )}

              {status && (
                <PanelSection label="Quick stats">
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { label: 'Leads',    value: status.total_leads },
                      { label: 'Pending',  value: status.pending_approvals },
                      { label: 'Active',   value: status.active_agents },
                    ].map(s => (
                      <div key={s.label} style={{
                        flex: 1, padding: '7px 4px', background: '#ffffff',
                        borderRadius: 6, border: '1px solid #f1f5f9', textAlign: 'center',
                      }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, color: '#0f172a' }}>
                          {s.value}
                        </div>
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </PanelSection>
              )}
            </div>
          </>
        )}

        {/* ── Reviews tab ──────────────────────────────────────────────────── */}
        {tab === 'review' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Review detail */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
              {selectedReview ? (
                <ReviewDetail review={selectedReview} />
              ) : (
                <div style={{ textAlign: 'center', paddingTop: 80 }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>◎</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a', marginBottom: 6 }}>
                    No review yet
                  </div>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
                    Click &quot;Run review&quot; in the top bar to inspect all active projects.
                  </p>
                  <button
                    onClick={runReview}
                    disabled={reviewLoading}
                    style={{
                      background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: 8,
                      padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    {reviewLoading ? 'Running…' : 'Run CEO review'}
                  </button>
                </div>
              )}
            </div>

            {/* Review history */}
            {reviews.length > 1 && (
              <div style={{
                width: 180, flexShrink: 0, borderLeft: '1px solid #f1f5f9',
                padding: '24px 14px', overflowY: 'auto', background: '#fafafa',
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  History
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {reviews.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedReview(r)}
                      style={{
                        background: selectedReview?.id === r.id ? '#f1f5f9' : 'none',
                        border: `1px solid ${selectedReview?.id === r.id ? '#e2e8f0' : 'transparent'}`,
                        borderRadius: 7, padding: '8px 10px', cursor: 'pointer',
                        textAlign: 'left', width: '100%',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#0f172a', marginBottom: 1 }}>
                        {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#94a3b8' }}>
                        {ts(r.created_at)}
                      </div>
                      <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                        {r.blocked_project_count > 0 && (
                          <span style={{ fontSize: 9, background: '#fef2f2', color: '#ef4444', borderRadius: 3, padding: '1px 5px' }}>
                            {r.blocked_project_count} blocked
                          </span>
                        )}
                        {r.pending_approval_count > 0 && (
                          <span style={{ fontSize: 9, background: '#fffbeb', color: '#d97706', borderRadius: 3, padding: '1px 5px' }}>
                            {r.pending_approval_count} pending
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes ceoPulse {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50%       { opacity: 1;    transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Delegation chip ───────────────────────────────────────────────────────────

function DelegationChipView({ chip }: { chip: DelegationChip }) {
  const styles: Record<string, React.CSSProperties> = {
    completed:        { background: '#dcfce7', color: '#16a34a' },
    approval_required:{ background: '#fef3c7', color: '#d97706' },
    blocked:          { background: '#fee2e2', color: '#dc2626' },
    failed:           { background: '#f1f5f9', color: '#64748b' },
  }
  const labels: Record<string, string> = {
    completed:        '✓ Research saved',
    approval_required:'⏸ Approval required',
    blocked:          '✗ Blocked',
    failed:           '✗ Action failed',
  }
  const chipStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 11, padding: '4px 10px', borderRadius: 6,
    fontWeight: 500, marginTop: 6,
    ...(styles[chip.status] ?? styles.failed),
  }
  return (
    <div style={{ marginTop: 4 }}>
      <span style={chipStyle}>
        {labels[chip.status] ?? chip.status}
      </span>
      {chip.message && chip.status !== 'completed' && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, marginLeft: 2 }}>
          {chip.message}
        </div>
      )}
    </div>
  )
}

function CeoAvatar() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', background: '#0f172a',
      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, color: '#ffffff', fontWeight: 700, letterSpacing: '-0.02em',
      marginTop: 2,
    }}>
      CEO
    </div>
  )
}

function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

// ── Review Detail ─────────────────────────────────────────────────────────────

function ReviewDetail({ review }: { review: CeoReview }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 700 }}>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
            CEO Review
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#94a3b8' }}>
            {new Date(review.created_at).toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Projects', value: review.project_count },
            { label: 'Pending',  value: review.pending_approval_count,  warn: review.pending_approval_count > 0,  warnType: 'amber' },
            { label: 'Blocked',  value: review.blocked_project_count,   warn: review.blocked_project_count > 0,   warnType: 'red' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '8px 14px', borderRadius: 8,
              background: s.warn ? (s.warnType === 'red' ? '#fef2f2' : '#fffbeb') : '#f8fafc',
              border: `1px solid ${s.warn ? (s.warnType === 'red' ? '#fecaca' : '#fde68a') : '#f1f5f9'}`,
            }}>
              <div style={{
                fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 400,
                color: s.warn ? (s.warnType === 'red' ? '#ef4444' : '#d97706') : '#0f172a',
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
          {review.priority_project_name && (
            <div style={{
              padding: '8px 14px', borderRadius: 8,
              background: '#eef2ff', border: '1px solid #c7d2fe', flex: 1,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6366f1', marginBottom: 2 }}>Priority</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#4338ca' }}>{review.priority_project_name}</div>
            </div>
          )}
        </div>

        <div style={{
          padding: '14px 16px', background: '#f8fafc', borderRadius: 8,
          border: '1px solid #f1f5f9', borderLeft: '3px solid #6366f1',
        }}>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.75 }}>{review.summary}</div>
        </div>
      </div>

      {review.findings.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Findings
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {review.findings.map(f => {
              const s = FINDING_STYLE[f.status] ?? FINDING_STYLE.attention
              return (
                <div key={f.project_id} style={{ borderRadius: 8, border: `1px solid ${s.border}`, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: s.bg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: s.dot }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{f.project_name}</span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: s.labelColor, marginLeft: 'auto', textTransform: 'capitalize' }}>
                        {f.status}
                      </span>
                    </div>
                    <div style={{ paddingLeft: 15 }}>
                      {f.positive.map((p, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span style={{ color: '#10b981', fontSize: 11 }}>✓</span>
                          <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{p}</span>
                        </div>
                      ))}
                      {f.issues.map((issue, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span style={{ color: s.dot, fontSize: 11 }}>·</span>
                          <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {f.pm_report_summary ? (
                    <div style={{ padding: '8px 14px', background: '#ffffff', borderTop: `1px solid ${s.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          PM report
                        </span>
                        {f.pm_report_at && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1' }}>
                            {relativeDate(f.pm_report_at)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>
                        &ldquo;{f.pm_report_summary}&rdquo;
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '7px 14px', background: '#fafafa', borderTop: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>No Project Manager report yet</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {review.recommended_actions.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Recommended actions
          </div>
          <div style={{
            background: '#ffffff', borderRadius: 8, border: '1px solid #f1f5f9',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
          }}>
            {review.recommended_actions.map((action, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 14px',
                borderBottom: i < review.recommended_actions.length - 1 ? '1px solid #f8fafc' : 'none',
              }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#cbd5e1', flexShrink: 0, marginTop: 1 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.5 }}>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#e2e8f0', paddingBottom: 8 }}>
        Generated {ts(review.created_at)}
      </div>
    </div>
  )
}
