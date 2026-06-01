'use client'
import { useEffect, useState, useCallback } from 'react'

interface BuiltInAgent {
  id:           string
  name:         string
  description:  string
  capabilities: string[]
  is_built_in:  true
}

interface CustomAgent {
  id:               string
  name:             string
  description:      string | null
  purpose:          string
  capabilities:     string[]
  constraints:      string[]
  status:           'draft' | 'active' | 'archived'
  created_by_role:  string
  project_id:       string | null
  created_at:       string
  is_built_in?:     false
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:   { bg: '#dcfce7', color: '#166534' },
  draft:    { bg: '#fef9c3', color: '#92400e' },
  archived: { bg: '#f1f5f9', color: '#64748b' },
}

const CONSTRAINT_LABELS: Record<string, string> = {
  must_delegate_to_web_operator:  'Delegates web actions',
  inherits_operating_mode:        'Inherits operating mode',
  cannot_bypass_approvals:        'Cannot bypass approvals',
  cannot_send_emails_directly:    'No direct email sending',
  cannot_access_secrets:          'No access to secrets',
}

export default function AgentsPage() {
  const [builtIn, setBuiltIn]  = useState<BuiltInAgent[]>([])
  const [custom, setCustom]    = useState<CustomAgent[]>([])
  const [loading, setLoading]  = useState(true)
  const [archiving, setArchiving] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/custom-agents')
      const data = await res.json()
      setBuiltIn(data.built_in ?? [])
      setCustom(data.custom   ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function archive(id: string) {
    if (!confirm('Archive this agent?')) return
    setArchiving(id)
    try {
      await fetch(`/api/custom-agents/${id}`, { method: 'DELETE' })
      setCustom(prev => prev.map(a => a.id === id ? { ...a, status: 'archived' as const } : a))
    } finally {
      setArchiving(null)
    }
  }

  async function activate(id: string) {
    setActivating(id)
    try {
      await fetch(`/api/custom-agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })
      setCustom(prev => prev.map(a => a.id === id ? { ...a, status: 'active' as const } : a))
    } finally {
      setActivating(null)
    }
  }

  const activeCustom   = custom.filter(a => a.status === 'active')
  const draftCustom    = custom.filter(a => a.status === 'draft')
  const archivedCustom = custom.filter(a => a.status === 'archived')

  return (
    <div style={{ padding: '40px 40px', maxWidth: 960 }} className="page-enter">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 6px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          AÏKO
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 8px' }}>
          Agents
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
          Built-in AÏKO agents and custom agents created by the CEO. Custom agents delegate all external actions to the Web Operator.
        </p>
      </div>

      {/* CEO tip */}
      <div style={{
        marginBottom: 28, padding: '12px 16px',
        background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10,
        fontSize: 13, color: '#0369a1', lineHeight: 1.6,
      }}>
        💡 <strong>Create a new agent:</strong> Open CEO Chat and say something like{' '}
        <em>"Create an agent for lead qualification"</em> or{' '}
        <em>"Build an agent to monitor competitor pricing"</em>.
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          Loading agents…
        </div>
      ) : (
        <>
          {/* Built-in agents */}
          <Section title="Built-in Agents" count={builtIn.length}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {builtIn.map(agent => (
                <BuiltInCard key={agent.id} agent={agent} />
              ))}
            </div>
          </Section>

          {/* Active custom agents */}
          {activeCustom.length > 0 && (
            <Section title="Active Custom Agents" count={activeCustom.length}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeCustom.map(agent => (
                  <CustomAgentCard
                    key={agent.id}
                    agent={agent}
                    onArchive={() => archive(agent.id)}
                    archiving={archiving === agent.id}
                    onActivate={() => activate(agent.id)}
                    activating={activating === agent.id}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Draft custom agents */}
          {draftCustom.length > 0 && (
            <Section title="Draft Custom Agents" count={draftCustom.length}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {draftCustom.map(agent => (
                  <CustomAgentCard
                    key={agent.id}
                    agent={agent}
                    onArchive={() => archive(agent.id)}
                    archiving={archiving === agent.id}
                    onActivate={() => activate(agent.id)}
                    activating={activating === agent.id}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* No custom agents yet */}
          {custom.filter(a => a.status !== 'archived').length === 0 && (
            <div style={{
              marginTop: 32, padding: '40px 32px', textAlign: 'center',
              background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: 12,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>No custom agents yet</div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                Ask the CEO to create a custom agent for a specific task.
              </div>
            </div>
          )}

          {/* Archived */}
          {archivedCustom.length > 0 && (
            <details style={{ marginTop: 32 }}>
              <summary style={{
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em',
                userSelect: 'none', marginBottom: 10,
              }}>
                Archived ({archivedCustom.length})
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {archivedCustom.map(agent => (
                  <div key={agent.id} style={{
                    padding: '12px 16px', background: '#f8fafc',
                    border: '1px solid #f1f5f9', borderRadius: 9, opacity: 0.6,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{agent.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                      Archived · {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {title}
        <span style={{
          background: '#f1f5f9', color: '#64748b', borderRadius: 10,
          padding: '1px 8px', fontSize: 10, fontWeight: 600,
        }}>
          {count}
        </span>
      </div>
      {children}
    </div>
  )
}

function BuiltInCard({ agent }: { agent: BuiltInAgent }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 12,
      padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: '#eef2ff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 16, flexShrink: 0,
        }}>
          {agent.id === 'ceo' ? '👑' : agent.id === 'web_operator' ? '🌐' : agent.id === 'project_manager' ? '📋' : agent.id === 'research' ? '🔍' : '✍️'}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{agent.name}</div>
          <div style={{
            display: 'inline-block', fontSize: 9, fontWeight: 600,
            background: '#eef2ff', color: '#4338ca',
            borderRadius: 4, padding: '1px 6px', marginTop: 2,
          }}>
            BUILT-IN
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px', lineHeight: 1.5 }}>
        {agent.description}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {agent.capabilities.slice(0, 4).map(cap => (
          <span key={cap} style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 5,
            background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0',
          }}>
            {cap.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}

function CustomAgentCard({
  agent, onArchive, archiving, onActivate, activating,
}: {
  agent: CustomAgent
  onArchive: () => void
  archiving: boolean
  onActivate: () => void
  activating: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const st = STATUS_COLORS[agent.status] ?? { bg: '#f1f5f9', color: '#64748b' }
  const date = new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 12,
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Status badge */}
        <div style={{
          background: st.bg, color: st.color,
          borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginTop: 2,
        }}>
          {agent.status}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>
            {agent.name}
          </div>
          {agent.description && (
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              {agent.description}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            Created by {agent.created_by_role} · {date}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              padding: '5px 10px', borderRadius: 6,
              background: '#f8fafc', color: '#374151',
              border: '1px solid #e2e8f0', fontSize: 11, cursor: 'pointer',
            }}
          >
            {expanded ? 'Less' : 'Details'}
          </button>
          {agent.status === 'draft' && (
            <button
              onClick={onActivate}
              disabled={activating}
              style={{
                padding: '5px 10px', borderRadius: 6,
                background: '#0f172a', color: '#ffffff',
                border: 'none', fontSize: 11, cursor: 'pointer',
              }}
            >
              {activating ? '…' : 'Activate'}
            </button>
          )}
          {agent.status !== 'archived' && (
            <button
              onClick={onArchive}
              disabled={archiving}
              style={{
                padding: '5px 10px', borderRadius: 6,
                background: 'none', color: '#dc2626',
                border: '1px solid #fecaca', fontSize: 11, cursor: 'pointer',
              }}
            >
              {archiving ? '…' : 'Archive'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{
          padding: '14px 18px', borderTop: '1px solid #f1f5f9',
          background: '#fafbff',
        }}>
          {/* Purpose */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Purpose
            </div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{agent.purpose}</div>
          </div>

          {/* Capabilities */}
          {agent.capabilities.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Capabilities
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {agent.capabilities.map(cap => (
                  <span key={cap} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 5,
                    background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe',
                  }}>
                    {cap.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Constraints */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Security constraints (enforced)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {agent.constraints.map(c => (
                <div key={c} style={{
                  fontSize: 11, color: '#374151',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ color: '#16a34a', fontSize: 10 }}>✓</span>
                  {CONSTRAINT_LABELS[c] ?? c.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
