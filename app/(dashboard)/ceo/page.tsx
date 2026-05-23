'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompanyMemory {
  summary: string
  global_priorities: string[]
  blocked_items: string[]
  last_review_at: string | null
  updated_at: string
}

interface CeoCommand {
  id: string
  command: string
  response: string
  intent: string
  actions: Array<{ type: string; data: Record<string, unknown> }>
  created_at: string
}

interface StatusData {
  projects: Array<{
    id: string
    name: string
    goal: string | null
    pm_name: string | null
    pm_focus: string | null
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function relativeDate(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const PM_STATUS_COLOR: Record<string, string> = {
  available: '#10b981',
  busy:      '#f59e0b',
  away:      '#94a3b8',
}

const FINDING_STYLE: Record<string, { dot: string; labelColor: string; bg: string; border: string }> = {
  healthy:   { dot: '#10b981', labelColor: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
  attention: { dot: '#f59e0b', labelColor: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  blocked:   { dot: '#ef4444', labelColor: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  stale:     { dot: '#94a3b8', labelColor: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
}

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CeoPage() {
  const [tab, setTab] = useState<'commands' | 'review'>('commands')

  // Commands state
  const [command, setCommand] = useState('')
  const [cmdLoading, setCmdLoading] = useState(false)
  const [cmdError, setCmdError] = useState<string | null>(null)
  const [commands, setCommands] = useState<CeoCommand[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  // Review state
  const [reviews, setReviews] = useState<CeoReview[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [selectedReview, setSelectedReview] = useState<CeoReview | null>(null)

  // Shared state
  const [memory, setMemory] = useState<CompanyMemory | null>(null)
  const [status, setStatus] = useState<StatusData | null>(null)

  const loadData = useCallback(async () => {
    const [memRes, statusRes, reviewsRes] = await Promise.all([
      fetch('/api/ceo/memory'),
      fetch('/api/ceo/status'),
      fetch('/api/ceo/reviews'),
    ])
    const memData = await memRes.json()
    const statusData = await statusRes.json()
    const reviewsData = await reviewsRes.json()

    setMemory(memData.memory)
    setCommands(memData.commands ?? [])
    setStatus(statusData)

    const reviewList: CeoReview[] = reviewsData.reviews ?? []
    setReviews(reviewList)
    if (reviewList.length > 0 && !selectedReview) {
      setSelectedReview(reviewList[0])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (tab === 'commands') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [commands, tab])

  // ── Command send ──────────────────────────────────────────────────────────

  async function send() {
    if (!command.trim() || cmdLoading) return
    const cmd = command.trim()
    setCommand('')
    setCmdLoading(true)
    setCmdError(null)
    // Optimistic entry
    setCommands(prev => [{
      id: 'pending',
      command: cmd,
      response: '…',
      intent: 'general',
      actions: [],
      created_at: new Date().toISOString(),
    }, ...prev])

    try {
      const res = await fetch('/api/ceo/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setCmdError(data.error ?? 'Something went wrong. Check Settings → AI Models.')
        // Remove the optimistic pending entry
        setCommands(prev => prev.filter(c => c.id !== 'pending'))
      }
    } catch {
      setCmdError('Could not reach the server. Check your connection.')
      setCommands(prev => prev.filter(c => c.id !== 'pending'))
    } finally {
      setCmdLoading(false)
      await loadData()
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ── Review run ────────────────────────────────────────────────────────────

  async function runReview() {
    if (reviewLoading) return
    setReviewLoading(true)
    const res = await fetch('/api/ceo/reviews', { method: 'POST' })
    const data = await res.json()
    setReviewLoading(false)
    if (data.review) {
      setReviews(prev => [data.review, ...prev])
      setSelectedReview(data.review)
      setTab('review')
    }
    await loadData()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div style={{
        width: 272, flexShrink: 0, borderRight: '1px solid #f1f5f9',
        overflowY: 'auto', padding: '28px 20px',
        display: 'flex', flexDirection: 'column', gap: 24,
      }}>

        {/* Company memory */}
        <div>
          <div style={LABEL}>Company memory</div>
          {memory ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                fontSize: 12, color: '#374151', lineHeight: 1.6,
                background: '#f8fafc', borderRadius: 8, padding: '10px 12px',
                border: '1px solid #f1f5f9',
              }}>
                {memory.summary || 'No summary yet.'}
              </div>

              {(memory.global_priorities ?? []).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginBottom: 5 }}>Priorities</div>
                  {memory.global_priorities.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
                      <span style={{ color: '#6366f1', fontSize: 11, flexShrink: 0, marginTop: 1 }}>·</span>
                      <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{p}</span>
                    </div>
                  ))}
                </div>
              )}

              {(memory.blocked_items ?? []).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 500, marginBottom: 5 }}>Blocked</div>
                  {memory.blocked_items.map((b, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
                      <span style={{ color: '#ef4444', fontSize: 11, flexShrink: 0, marginTop: 1 }}>!</span>
                      <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{b}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1' }}>
                {memory.last_review_at
                  ? `reviewed ${relativeDate(memory.last_review_at)}`
                  : `updated ${ts(memory.updated_at)}`}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>No memory yet — issue your first command.</div>
          )}
        </div>

        {/* Project Managers */}
        {status && (
          <div>
            <div style={LABEL}>Project managers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {status.project_managers.map(pm => (
                <div key={pm.id} style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: '#f8fafc', border: '1px solid #f1f5f9',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: PM_STATUS_COLOR[pm.status] ?? '#94a3b8',
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{pm.name}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>{pm.status}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', paddingLeft: 12 }}>{pm.specialty}</div>
                  {pm.current_focus && (
                    <div style={{ fontSize: 10, color: '#64748b', paddingLeft: 12, marginTop: 2, lineHeight: 1.4, fontStyle: 'italic' }}>
                      {pm.current_focus}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active projects */}
        {status && status.projects.length > 0 && (
          <div>
            <div style={LABEL}>Active projects</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {status.projects.map(p => (
                <a key={p.id} href={`/projects/${p.id}`} style={{
                  display: 'block', padding: '7px 10px', borderRadius: 7,
                  background: '#f8fafc', border: '1px solid #f1f5f9',
                  textDecoration: 'none',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', marginBottom: 1 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    {p.pm_name ? `PM: ${p.pm_name}` : 'No PM assigned'}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Quick stats */}
        {status && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Leads',     value: status.total_leads },
              { label: 'Approvals', value: status.pending_approvals },
              { label: 'Agents on', value: status.active_agents },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, padding: '8px 6px', background: '#f8fafc',
                borderRadius: 7, border: '1px solid #f1f5f9', textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, color: '#0f172a', fontWeight: 400 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header with tabs */}
        <div style={{
          padding: '18px 28px 0',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
            <div style={{ marginRight: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 10 }}>
                CEO
              </div>
            </div>
            {(['commands', 'review'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px 2px', marginRight: 20,
                  fontSize: 13,
                  fontWeight: tab === t ? 500 : 400,
                  color: tab === t ? '#0f172a' : '#94a3b8',
                  borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
                  letterSpacing: '-0.01em',
                  transition: 'color 0.1s',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'review' ? `Review${reviews.length > 0 ? ` (${reviews.length})` : ''}` : 'Commands'}
              </button>
            ))}
          </div>

          {/* Run review button */}
          <button
            onClick={runReview}
            disabled={reviewLoading}
            style={{
              background: reviewLoading ? '#f1f5f9' : '#0f172a',
              color: reviewLoading ? '#94a3b8' : '#ffffff',
              border: 'none', borderRadius: 8,
              padding: '7px 14px', marginBottom: 10,
              fontSize: 12, fontWeight: 500, cursor: reviewLoading ? 'default' : 'pointer',
              letterSpacing: '-0.01em', transition: 'background 0.15s',
              flexShrink: 0,
            }}
          >
            {reviewLoading ? 'Running review…' : 'Run CEO review'}
          </button>
        </div>

        {/* ── Tab: Commands ──────────────────────────────────────────────────── */}
        {tab === 'commands' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {commands.length === 0 && !cmdLoading && (
                <div style={{ textAlign: 'center', paddingTop: 60 }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>◆</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>What do you need?</div>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, maxWidth: 320, marginInline: 'auto', lineHeight: 1.6 }}>
                    Create a project, assign a PM, check status, set priorities — just type it.
                  </p>
                  <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {[
                      'Create a project for TechCorp and assign a PM',
                      'What is the current status of all projects?',
                      'Assign Kenji to focus on outbound for Startup X',
                      'Update priorities: close 3 deals this week',
                    ].map(s => (
                      <button key={s} onClick={() => setCommand(s)} type="button" style={{
                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
                        fontSize: 11, color: '#64748b', padding: '5px 10px', cursor: 'pointer',
                      }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {[...commands].reverse().map((cmd) => (
                <div key={cmd.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                    <div style={{
                      maxWidth: '70%', background: '#f1f5f9', borderRadius: '10px 10px 2px 10px',
                      padding: '8px 12px', fontSize: 13, color: '#0f172a', lineHeight: 1.5,
                    }}>
                      {cmd.command}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', background: '#0f172a',
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: '#ffffff', fontWeight: 700, letterSpacing: '-0.02em',
                    }}>
                      CEO
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        background: '#ffffff', borderRadius: '2px 10px 10px 10px',
                        padding: '10px 14px', fontSize: 13, color: '#0f172a', lineHeight: 1.65,
                        border: '1px solid #f1f5f9', borderLeft: '3px solid #6366f1',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}>
                        {cmd.response}
                      </div>
                      {cmd.actions.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
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
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1', marginTop: 4 }}>
                        {ts(cmd.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '14px 28px 20px', borderTop: '1px solid #f1f5f9', background: '#ffffff' }}>
              {cmdError && (
                <div style={{
                  marginBottom: 10, padding: '9px 12px',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 8, fontSize: 12, color: '#dc2626',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span>{cmdError}</span>
                  <a href="/settings" style={{ color: '#dc2626', fontWeight: 600, fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    Open Settings →
                  </a>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Give an instruction to the CEO…"
                  rows={2}
                  style={{
                    flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#0f172a',
                    resize: 'none', lineHeight: 1.5, outline: 'none',
                    fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
                />
                <button
                  onClick={send}
                  disabled={cmdLoading || !command.trim()}
                  style={{
                    background: cmdLoading || !command.trim() ? '#e2e8f0' : '#0f172a',
                    color: cmdLoading || !command.trim() ? '#94a3b8' : '#ffffff',
                    border: 'none', borderRadius: 10, padding: '10px 18px',
                    fontSize: 13, fontWeight: 500,
                    cursor: cmdLoading || !command.trim() ? 'default' : 'pointer',
                    transition: 'background 0.15s', flexShrink: 0, letterSpacing: '-0.01em',
                  }}
                >
                  {cmdLoading ? '…' : 'Send'}
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 6 }}>
                Enter to send · Shift+Enter for new line
              </div>
            </div>
          </>
        )}

        {/* ── Tab: Review ────────────────────────────────────────────────────── */}
        {tab === 'review' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', minWidth: 0 }}>

            {/* Review detail */}
            <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', minWidth: 0 }}>
              {selectedReview ? (
                <ReviewDetail review={selectedReview} />
              ) : (
                <div style={{ textAlign: 'center', paddingTop: 80 }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>◎</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>
                    No review yet
                  </div>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                    Click "Run CEO review" to inspect all active projects and generate a company-level briefing.
                  </p>
                </div>
              )}
            </div>

            {/* Review history sidebar */}
            {reviews.length > 1 && (
              <div style={{
                width: 180, flexShrink: 0,
                borderLeft: '1px solid #f1f5f9',
                padding: '24px 14px',
                overflowY: 'auto',
              }}>
                <div style={{ ...LABEL, marginBottom: 10 }}>History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {reviews.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedReview(r)}
                      style={{
                        background: selectedReview?.id === r.id ? '#f8fafc' : 'none',
                        border: `1px solid ${selectedReview?.id === r.id ? '#e2e8f0' : 'transparent'}`,
                        borderRadius: 7, padding: '8px 10px', cursor: 'pointer',
                        textAlign: 'left', width: '100%',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#0f172a', marginBottom: 2 }}>
                        {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#94a3b8' }}>
                        {ts(r.created_at)}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
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
    </div>
  )
}

// ── Review Detail Component ───────────────────────────────────────────────────

function ReviewDetail({ review }: { review: CeoReview }) {
  const SECTION_LABEL: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680 }}>

      {/* Memo header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
            CEO Review
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#94a3b8' }}>
            {new Date(review.created_at).toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Projects', value: review.project_count },
            { label: 'Pending', value: review.pending_approval_count, warn: review.pending_approval_count > 0 },
            { label: 'Blocked', value: review.blocked_project_count, warn: review.blocked_project_count > 0 },
          ].map(s => (
            <div key={s.label} style={{
              padding: '8px 14px', borderRadius: 8,
              background: s.warn && s.value > 0 ? (s.label === 'Blocked' ? '#fef2f2' : '#fffbeb') : '#f8fafc',
              border: `1px solid ${s.warn && s.value > 0 ? (s.label === 'Blocked' ? '#fecaca' : '#fde68a') : '#f1f5f9'}`,
            }}>
              <div style={{
                fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 400,
                color: s.warn && s.value > 0 ? (s.label === 'Blocked' ? '#ef4444' : '#d97706') : '#0f172a',
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
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6366f1', marginBottom: 1 }}>Priority</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#4338ca' }}>
                {review.priority_project_name}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div style={{
          padding: '14px 16px', background: '#f8fafc', borderRadius: 8,
          border: '1px solid #f1f5f9', borderLeft: '3px solid #6366f1',
        }}>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
            {review.summary}
          </div>
        </div>
      </div>

      {/* Findings */}
      {review.findings.length > 0 && (
        <div>
          <div style={SECTION_LABEL}>Findings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {review.findings.map(f => {
              const s = FINDING_STYLE[f.status] ?? FINDING_STYLE.attention
              const pmAge = f.pm_report_at
                ? relativeDate(f.pm_report_at)
                : null
              return (
                <div key={f.project_id} style={{
                  borderRadius: 8, border: `1px solid ${s.border}`,
                  overflow: 'hidden',
                }}>
                  {/* Finding header */}
                  <div style={{ padding: '10px 14px', background: s.bg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: f.positive.length + f.issues.length > 0 ? 6 : 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: s.dot }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        {f.project_name}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: s.labelColor, marginLeft: 'auto', textTransform: 'capitalize' }}>
                        {f.status}
                      </span>
                    </div>
                    <div style={{ paddingLeft: 15 }}>
                      {f.positive.length > 0 && (
                        <div style={{ marginBottom: f.issues.length > 0 ? 4 : 0 }}>
                          {f.positive.map((p, i) => (
                            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                              <span style={{ color: '#10b981', fontSize: 11, flexShrink: 0 }}>✓</span>
                              <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{p}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {f.issues.map((issue, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span style={{ color: s.dot, fontSize: 11, flexShrink: 0 }}>·</span>
                          <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PM report strip */}
                  {f.pm_report_summary ? (
                    <div style={{
                      padding: '8px 14px',
                      background: '#ffffff',
                      borderTop: `1px solid ${s.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          PM report
                        </span>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1' }}>
                          {pmAge}
                        </span>
                        {f.pm_report_status && (
                          <span style={{
                            fontSize: 9, fontWeight: 500,
                            color: (FINDING_STYLE[f.pm_report_status] ?? FINDING_STYLE.attention).labelColor,
                            background: (FINDING_STYLE[f.pm_report_status] ?? FINDING_STYLE.attention).bg,
                            border: `1px solid ${(FINDING_STYLE[f.pm_report_status] ?? FINDING_STYLE.attention).border}`,
                            borderRadius: 4, padding: '1px 6px',
                            textTransform: 'capitalize',
                          }}>
                            {f.pm_report_status}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>
                        "{f.pm_report_summary}"
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '7px 14px',
                      background: '#fafafa',
                      borderTop: `1px solid ${s.border}`,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 10, color: '#cbd5e1' }}>○</span>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>No Project Manager report yet</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommended actions */}
      {review.recommended_actions.length > 0 && (
        <div>
          <div style={SECTION_LABEL}>Recommended actions</div>
          <div style={{
            background: '#ffffff', borderRadius: 8,
            border: '1px solid #f1f5f9',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}>
            {review.recommended_actions.map((action, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '11px 14px',
                borderBottom: i < review.recommended_actions.length - 1 ? '1px solid #f8fafc' : 'none',
              }}>
                <span style={{
                  fontFamily: 'DM Mono, monospace', fontSize: 11,
                  color: '#cbd5e1', flexShrink: 0, minWidth: 16,
                  marginTop: 1,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.5 }}>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#e2e8f0', paddingBottom: 8 }}>
        Generated {new Date(review.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}
