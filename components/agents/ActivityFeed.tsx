'use client'
import { AgentLog } from '@/lib/db/schema'

const ICONS: Record<string, string> = {
  thought:           '→',
  browser_action:    '◉',
  data_extracted:    '↓',
  message_generated: '✉',
  error:             '!',
}

export function ActivityFeed({ logs }: { logs: AgentLog[] }) {
  if (logs.length === 0) {
    return (
      <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, padding: '4px 0' }}>
        No activity yet — agents will log here when they start working.
      </p>
    )
  }

  return (
    <div>
      {logs.map((log, i) => {
        const text = log.details
          ? (typeof log.details === 'object'
              ? ((log.details as Record<string, unknown>).thought as string) ?? JSON.stringify(log.details).slice(0, 90)
              : String(log.details))
          : log.action

        const isError = log.action === 'error'

        return (
          <div key={log.id} style={{
            display: 'flex', gap: 10, padding: '7px 0',
            borderBottom: i < logs.length - 1 ? '1px solid #f8fafc' : 'none',
            alignItems: 'flex-start',
          }}>
            <span style={{
              fontFamily: 'DM Mono, monospace', fontSize: 10,
              color: '#cbd5e1', minWidth: 48, paddingTop: 1, flexShrink: 0,
            }}>
              {new Date(log.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: isError ? '#ef4444' : '#cbd5e1',
              minWidth: 10, paddingTop: 2, flexShrink: 0,
            }}>
              {ICONS[log.action] ?? '·'}
            </span>
            <span style={{
              fontSize: 12, color: isError ? '#ef4444' : '#64748b',
              flex: 1, lineHeight: 1.45,
            }}>
              {text.length > 100 ? text.slice(0, 100) + '…' : text}
            </span>
          </div>
        )
      })}
    </div>
  )
}
