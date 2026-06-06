import type { CSSProperties, ReactNode } from 'react'

type MinimalCardProps = {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  style?: CSSProperties
}

export function MinimalCard({ title, subtitle, action, children, style }: MinimalCardProps) {
  return (
    <section
      data-testid={title ? `minimal-card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined}
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 20,
        padding: 22,
        boxShadow: '0 1px 2px rgba(17, 24, 39, 0.03)',
        ...style,
      }}
    >
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: subtitle ? 14 : 18 }}>
          <div>
            {title && <h2 style={{ margin: 0, color: '#111827', fontSize: 16, fontWeight: 720 }}>{title}</h2>}
            {subtitle && <p style={{ margin: '5px 0 0', color: '#6b7280', fontSize: 13, lineHeight: 1.45 }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
