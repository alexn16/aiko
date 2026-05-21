'use client'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { Agent } from '@/lib/db/schema'

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 6,
      padding: 16,
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <StatusDot status={agent.status} />
        <span style={{ fontSize: 13, color: '#111827', flex: 1, fontWeight: 500 }}>{agent.name}</span>
        <Badge label={agent.status} />
      </div>

      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        {agent.role}
      </div>

      {agent.current_task && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, lineHeight: 1.4 }}>
          {agent.current_task}
        </div>
      )}

      {/* Progress bar */}
      <div style={{ height: 3, background: '#f3f4f6', borderRadius: 2 }}>
        <div style={{
          height: '100%',
          width: `${agent.progress}%`,
          background: agent.status === 'error' ? '#dc2626' : '#16a34a',
          borderRadius: 2,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}
