'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { JobEvaluation, AgentNeeded } from '@/lib/agents/evaluator-agent'

const COMPLEXITY_STYLE: Record<string, { color: string; bg: string }> = {
  simple:  { color: '#10b981', bg: '#ecfdf5' },
  medium:  { color: '#f59e0b', bg: '#fffbeb' },
  complex: { color: '#ef4444', bg: '#fef2f2' },
}

interface Props {
  jobId: string
  projectId: string
  evaluation: JobEvaluation
  onApprove: () => void
  onCancel: () => void
}

export function JobEvaluationCard({ jobId, projectId, evaluation, onApprove, onCancel }: Props) {
  const [approvedNew, setApprovedNew] = useState<string[]>(
    evaluation.agents_needed.filter(a => a.role === 'new').map(a => a.name)
  )
  const [loading, setLoading] = useState(false)

  const newAgents = evaluation.agents_needed.filter(a => a.role === 'new')
  const existingAgents = evaluation.agents_needed.filter(a => a.role === 'existing')

  function toggle(name: string) {
    setApprovedNew(p => p.includes(name) ? p.filter(n => n !== name) : [...p, name])
  }

  async function approve() {
    setLoading(true)
    await fetch('/api/jobs/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, projectId, approvedAgents: approvedNew }),
    })
    setLoading(false)
    onApprove()
  }

  const cs = COMPLEXITY_STYLE[evaluation.complexity] ?? COMPLEXITY_STYLE.medium

  return (
    <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Job evaluation</div>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 5,
          background: cs.bg, color: cs.color,
        }}>
          {evaluation.complexity}
        </span>
      </div>

      <div style={{ padding: 18 }}>
        {/* Plan */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Execution plan
          </div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {evaluation.plan}
          </div>
        </div>

        {/* Agents */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Team assigned
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {existingAgents.map(a => <AgentRow key={a.name} agent={a} isNew={false} />)}
            {newAgents.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, marginBottom: 2 }}>
                  New hires proposed — click to toggle approval:
                </div>
                {newAgents.map(a => (
                  <AgentRow key={a.name} agent={a} isNew approved={approvedNew.includes(a.name)} onToggle={() => toggle(a.name)} />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Cost */}
        <div style={{
          display: 'flex', gap: 20, padding: '12px 14px', marginBottom: 16,
          background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9',
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Est. tokens</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#0f172a', fontWeight: 400 }}>
              {evaluation.estimated_tokens.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Est. cost</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#10b981', fontWeight: 400 }}>
              {evaluation.cost_range}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Reasoning</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{evaluation.reasoning}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" onClick={approve} disabled={loading}>
            {loading ? 'Starting…' : `Approve & run${newAgents.length > 0 && approvedNew.length > 0 ? ` (hire ${approvedNew.length})` : ''}`}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

function AgentRow({ agent, isNew, approved, onToggle }: { agent: AgentNeeded; isNew: boolean; approved?: boolean; onToggle?: () => void }) {
  const bg = isNew ? (approved ? '#ecfdf5' : '#fef2f2') : '#f8fafc'
  const border = isNew ? (approved ? '#a7f3d0' : '#fecaca') : '#f1f5f9'
  const nameColor = isNew ? (approved ? '#10b981' : '#ef4444') : '#0f172a'

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '8px 12px', background: bg, border: `1px solid ${border}`,
        borderRadius: 7, cursor: isNew ? 'pointer' : 'default',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: nameColor }}>
            {isNew ? (approved ? '+ ' : '− ') : '· '}{agent.name}
          </span>
          {isNew && (
            <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', color: '#64748b' }}>
              new hire
            </span>
          )}
        </div>
        {agent.specialty && <div style={{ fontSize: 12, color: '#64748b' }}>{agent.specialty}</div>}
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
          {agent.tasks.join(' · ')} · ~{agent.estimated_tokens.toLocaleString()} tokens
        </div>
      </div>
    </div>
  )
}
