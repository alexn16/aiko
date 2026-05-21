'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { JobEvaluation, AgentNeeded } from '@/lib/agents/evaluator-agent'

interface JobEvaluationCardProps {
  jobId: string
  projectId: string
  evaluation: JobEvaluation
  onApprove: () => void
  onCancel: () => void
}

export function JobEvaluationCard({ jobId, projectId, evaluation, onApprove, onCancel }: JobEvaluationCardProps) {
  const [approvedNewAgents, setApprovedNewAgents] = useState<string[]>(
    evaluation.agents_needed.filter(a => a.role === 'new').map(a => a.name)
  )
  const [loading, setLoading] = useState(false)

  const newAgents = evaluation.agents_needed.filter(a => a.role === 'new')
  const existingAgents = evaluation.agents_needed.filter(a => a.role === 'existing')

  function toggleNewAgent(name: string) {
    setApprovedNewAgents(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  async function approve() {
    setLoading(true)
    await fetch('/api/jobs/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, projectId, approvedAgents: approvedNewAgents }),
    })
    setLoading(false)
    onApprove()
  }

  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 8, background: '#ffffff',
      fontFamily: 'Inter, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, background: '#f9fafb' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Job evaluation</div>
        <Badge label={evaluation.complexity} />
      </div>

      <div style={{ padding: 16 }}>
        {/* Plan */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Execution plan</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {evaluation.plan}
          </div>
        </div>

        {/* Agents */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Team assigned</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {existingAgents.map(a => (
              <AgentRow key={a.name} agent={a} isNew={false} />
            ))}
            {newAgents.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, marginBottom: 2 }}>
                  New agents proposed — toggle to approve hiring:
                </div>
                {newAgents.map(a => (
                  <AgentRow
                    key={a.name}
                    agent={a}
                    isNew={true}
                    approved={approvedNewAgents.includes(a.name)}
                    onToggle={() => toggleNewAgent(a.name)}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Token / cost estimate */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '12px 14px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
          <div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Est. tokens</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#111827', fontWeight: 300 }}>
              {evaluation.estimated_tokens.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Est. cost</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#16a34a', fontWeight: 300 }}>
              {evaluation.cost_range}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Reasoning</div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{evaluation.reasoning}</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" onClick={approve} disabled={loading}>
            {loading ? 'Starting…' : `Approve & run${newAgents.length > 0 && approvedNewAgents.length > 0 ? ` (hire ${approvedNewAgents.length})` : ''}`}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

function AgentRow({ agent, isNew, approved, onToggle }: {
  agent: AgentNeeded
  isNew: boolean
  approved?: boolean
  onToggle?: () => void
}) {
  const bg = isNew ? (approved ? '#f0fdf4' : '#fef2f2') : '#f9fafb'
  const border = isNew ? (approved ? '#bbf7d0' : '#fecaca') : '#e5e7eb'
  const nameColor = isNew ? (approved ? '#16a34a' : '#dc2626') : '#111827'

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 4, cursor: isNew ? 'pointer' : 'default',
      }}
      onClick={onToggle}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, color: nameColor, fontWeight: 500 }}>
            {isNew ? (approved ? '+ ' : '✗ ') : '● '}{agent.name}
          </span>
          {isNew && (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '1px 6px', borderRadius: 999, background: '#e5e7eb', color: '#6b7280' }}>new hire</span>
          )}
        </div>
        {agent.specialty && (
          <div style={{ fontSize: 12, color: '#6b7280' }}>{agent.specialty}</div>
        )}
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>
          {agent.tasks.join(' · ')} · ~{agent.estimated_tokens.toLocaleString()} tokens
        </div>
      </div>
    </div>
  )
}
