import type { CSSProperties, ReactNode } from 'react'

type PageShellProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  maxWidth?: number
  style?: CSSProperties
}

export function PageShell({ eyebrow, title, subtitle, actions, children, maxWidth = 1120, style }: PageShellProps) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#fbfbfc',
        padding: '48px 36px',
        color: '#111827',
        ...style,
      }}
    >
      <div style={{ maxWidth, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            {eyebrow && (
              <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                {eyebrow}
              </div>
            )}
            <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: 0, fontWeight: 760 }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ margin: '12px 0 0', color: '#6b7280', fontSize: 15, lineHeight: 1.55, maxWidth: 700 }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </header>
        {children}
      </div>
    </main>
  )
}
