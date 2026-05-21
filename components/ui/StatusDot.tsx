'use client'

const COLORS: Record<string, string> = {
  idle:     '#cbd5e1',
  active:   '#10b981',
  browsing: '#10b981',
  writing:  '#f59e0b',
  waiting:  '#3b82f6',
  error:    '#ef4444',
  paused:   '#cbd5e1',
}

export function StatusDot({ status }: { status: string }) {
  const color = COLORS[status] ?? '#cbd5e1'
  const animated = ['active', 'browsing', 'writing'].includes(status)

  return (
    <span style={{
      display: 'inline-block',
      width: 7, height: 7,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
      animation: animated ? 'pulse 2s ease-in-out infinite' : undefined,
    }} />
  )
}
