'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

interface CompanyMemory {
  summary: string
  global_priorities: string[]
  blocked_items: string[]
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

function ts(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const PM_STATUS_COLOR: Record<string, string> = {
  available: '#10b981',
  busy: '#f59e0b',
  away: '#94a3b8',
}

export default function CeoPage() {
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [memory, setMemory] = useState<CompanyMemory | null>(null)
  const [commands, setCommands] = useState<CeoCommand[]>([])
  const [status, setStatus] = useState<StatusData | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    const [memRes, statusRes] = await Promise.all([
      fetch('/api/ceo/memory'),
      fetch('/api/ceo/status'),
    ])
    const memData = await memRes.json()
    const statusData = await statusRes.json()
    setMemory(memData.memory)
    setCommands(memData.commands ?? [])
    setStatus(statusData)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [commands])

  async function send() {
    if (!command.trim() || loading) return
    const cmd = command.trim()
    setCommand('')
    setLoading(true)
    // Optimistic: add to log immediately
    setCommands(prev => [{
      id: 'pending',
      command: cmd,
      response: '…',
      intent: 'general',
      actions: [],
      created_at: new Date().toISOString(),
    }, ...prev])

    await fetch('/api/ceo/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd }),
    })
    setLoading(false)
    await loadData()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const LABEL_STYLE: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>

      {/* ── Left panel: Memory + Status ────────────────────────────── */}
      <div style={{
        width: 272, flexShrink: 0, borderRight: '1px solid #f1f5f9',
        overflowY: 'auto', padding: '28px 20px',
        display: 'flex', flexDirection: 'column', gap: 24,
      }}>

        {/* Company memory */}
        <div>
          <div style={LABEL_STYLE}>Company memory</div>
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
                updated {ts(memory.updated_at)}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>No memory yet — issue your first command.</div>
          )}
        </div>

        {/* Project Managers */}
        {status && (
          <div>
            <div style={LABEL_STYLE}>Project managers</div>
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

        {/* Active projects summary */}
        {status && status.projects.length > 0 && (
          <div>
            <div style={LABEL_STYLE}>Active projects</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {status.projects.map(p => (
                <a key={p.id} href={`/projects/${p.id}`} style={{
                  display: 'block', padding: '7px 10px', borderRadius: 7,
                  background: '#f8fafc', border: '1px solid #f1f5f9',
                  textDecoration: 'none',
                  transition: 'border-color 0.1s',
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
              { label: 'Leads', value: status.total_leads },
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

      {/* ── Right panel: Command log + Input ───────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          padding: '22px 28px 18px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'baseline', gap: 10,
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>CEO</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Command centre</div>
        </div>

        {/* Command log */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {commands.length === 0 && !loading && (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>◆</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>
                What do you need?
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
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
              {/* User command */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '70%', background: '#f1f5f9', borderRadius: '10px 10px 2px 10px',
                  padding: '8px 12px', fontSize: 13, color: '#0f172a', lineHeight: 1.5,
                }}>
                  {cmd.command}
                </div>
              </div>
              {/* CEO response */}
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
                    border: '1px solid #f1f5f9',
                    borderLeft: '3px solid #6366f1',
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

        {/* Input bar */}
        <div style={{
          padding: '14px 28px 20px',
          borderTop: '1px solid #f1f5f9',
          background: '#ffffff',
        }}>
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
                fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#6366f1' }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
            />
            <button
              onClick={send}
              disabled={loading || !command.trim()}
              style={{
                background: loading || !command.trim() ? '#e2e8f0' : '#0f172a',
                color: loading || !command.trim() ? '#94a3b8' : '#ffffff',
                border: 'none', borderRadius: 10, padding: '10px 18px',
                fontSize: 13, fontWeight: 500, cursor: loading || !command.trim() ? 'default' : 'pointer',
                transition: 'background 0.15s',
                flexShrink: 0, letterSpacing: '-0.01em',
              }}
            >
              {loading ? '…' : 'Send'}
            </button>
          </div>
          <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 6 }}>
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  )
}
