'use client'
import { StatusDot } from '@/components/ui/StatusDot'
import { Agent } from '@/lib/db/schema'

const STATUS_COLOR: Record<string, string> = {
  active: '#10b981', browsing: '#10b981', writing: '#f59e0b',
  waiting: '#3b82f6', error: '#ef4444', idle: '#e2e8f0', paused: '#e2e8f0',
}

export function AgentCard({ agent }: { agent: Agent }) {
  const barColor = STATUS_COLOR[agent.status] ?? '#e2e8f0'

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 10,
      border: '1px solid #f1f5f9',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <StatusDot status={agent.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 1 }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{agent.role}</div>
        </div>
      </div>

      {agent.current_task && (
        <div style={{
          fontSize: 12, color: '#64748b', marginBottom: 10,
          lineHeight: 1.5, overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}>
          {agent.current_task}
        </div>
      )}

      <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${agent.progress ?? 0}%`,
          background: barColor, borderRadius: 2,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}
