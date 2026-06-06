import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div style={{ padding: '26px 10px', textAlign: 'center', color: '#6b7280' }}>
      <div style={{ color: '#111827', fontSize: 15, fontWeight: 700 }}>{title}</div>
      {description && <p style={{ margin: '8px auto 0', maxWidth: 420, fontSize: 13, lineHeight: 1.5 }}>{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
