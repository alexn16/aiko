'use client'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { Agent } from '@/lib/db/schema'

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div style={{
      background: '#111',
      border: '1px solid #222',
      borderRadius: 4,
      padding: 16,
      fontFamily: 'DM Mono, monospace',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <StatusDot status={agent.status} />
        <span style={{ fontSize: 11, color: '#e8e6e0', flex: 1 }}>{agent.name}</span>
        <Badge label={agent.status} />
      </div>

      <div style={{ fontSize: 9, color: '#666', marginBottom: 8, letterSpacing: '0.05em' }}>
        {agent.role}
      </div>

      {agent.current_task && (
        <div style={{ fontSize: 10, color: '#aaa', marginBottom: 10, lineHeight: 1.4 }}>
          {agent.current_task}
        </div>
      )}

      {/* Progress bar */}
      <div style={{ height: 2, background: '#222', borderRadius: 1 }}>
        <div style={{
          height: '100%',
          width: `${agent.progress}%`,
          background: agent.status === 'error' ? '#c87070' : '#7eb88a',
          borderRadius: 1,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}
