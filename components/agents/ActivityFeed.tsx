'use client'
import { AgentLog } from '@/lib/db/schema'

interface ActivityFeedProps {
  logs: AgentLog[]
}

const ACTION_LABELS: Record<string, string> = {
  thought:           '→',
  browser_action:    '◉',
  data_extracted:    '↓',
  message_generated: '✉',
  error:             '✕',
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  return (
    <div style={{ fontFamily: 'DM Mono, monospace' }}>
      {logs.map(log => (
        <div key={log.id} style={{
          display: 'flex',
          gap: 10,
          padding: '6px 0',
          borderBottom: '1px solid #f3f4f6',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 9, color: '#d1d5db', minWidth: 60, paddingTop: 1 }}>
            {new Date(log.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 12 }}>
            {ACTION_LABELS[log.action] ?? '·'}
          </span>
          <span style={{ fontSize: 11, color: '#6b7280', flex: 1, lineHeight: 1.4 }}>
            {log.details
              ? (typeof log.details === 'object'
                  ? ((log.details as Record<string, unknown>).thought as string) ??
                    JSON.stringify(log.details).slice(0, 80)
                  : String(log.details))
              : log.action}
          </span>
        </div>
      ))}
      {logs.length === 0 && (
        <div style={{ fontSize: 12, color: '#d1d5db', padding: '8px 0' }}>No activity yet.</div>
      )}
    </div>
  )
}
