import type { ReactNode } from 'react'

export function AdvancedDisclosure({ title = 'Advanced', children }: { title?: string; children: ReactNode }) {
  return (
    <details style={{ marginTop: 16 }} data-testid="advanced-disclosure">
      <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: 13, fontWeight: 700, listStyle: 'none' }}>
        {title}
      </summary>
      <div style={{ marginTop: 14 }}>
        {children}
      </div>
    </details>
  )
}
