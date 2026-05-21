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

const COMPLEXITY_COLOR: Record<string, string> = {
  simple: '#7eb88a',
  medium: '#c8b58c',
  complex: '#c87878',
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
      border: '1px solid #2a2a2a', borderRadius: 6, background: '#0d0d0d',
      fontFamily: 'DM Mono, monospace', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Job evaluation</div>
        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 999, background: '#111', border: '1px solid #222', color: COMPLEXITY_COLOR[evaluation.complexity] ?? '#888' }}>
          {evaluation.complexity}
        </span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Plan */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Execution plan</div>
          <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {evaluation.plan}
          </div>
        </div>

        {/* Agents */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Team assigned</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {existingAgents.map(a => (
              <AgentRow key={a.name} agent={a} isNew={false} />
            ))}
            {newAgents.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: '#555', marginTop: 4, marginBottom: 2 }}>
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
        <div style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '10px 12px', background: '#111', borderRadius: 4, border: '1px solid #1a1a1a' }}>
          <div>
            <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Est. tokens</div>
            <div style={{ fontSize: 16, color: '#c8b89a', fontWeight: 300 }}>
              {evaluation.estimated_tokens.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Est. cost</div>
            <div style={{ fontSize: 16, color: '#7eb88a', fontWeight: 300 }}>
              {evaluation.cost_range}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Reasoning</div>
            <div style={{ fontSize: 9, color: '#666', lineHeight: 1.5 }}>{evaluation.reasoning}</div>
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
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px',
        background: isNew ? (approved ? '#0d1a0d' : '#1a0d0d') : '#111',
        border: `1px solid ${isNew ? (approved ? '#1a3a1a' : '#2a1a1a') : '#1e1e1e'}`,
        borderRadius: 3, cursor: isNew ? 'pointer' : 'default',
      }}
      onClick={onToggle}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 10, color: isNew ? (approved ? '#7eb88a' : '#c87878') : '#c8b89a' }}>
            {isNew ? (approved ? '+ ' : '✗ ') : '● '}{agent.name}
          </span>
          {isNew && (
            <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 999, background: '#222', color: '#666' }}>new hire</span>
          )}
        </div>
        {agent.specialty && (
          <div style={{ fontSize: 9, color: '#555' }}>{agent.specialty}</div>
        )}
        <div style={{ fontSize: 9, color: '#444', marginTop: 2 }}>
          {agent.tasks.join(' · ')} · ~{agent.estimated_tokens.toLocaleString()} tokens
        </div>
      </div>
    </div>
  )
}
