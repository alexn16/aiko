'use client'

const STATUS_COLORS: Record<string, string> = {
  idle:     '#d1d5db',
  active:   '#16a34a',
  browsing: '#16a34a',
  writing:  '#d97706',
  waiting:  '#2563eb',
  error:    '#dc2626',
  paused:   '#d1d5db',
}

export function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#d1d5db'
  const isActive = ['active', 'browsing', 'writing'].includes(status)

  return (
    <span style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
      animation: isActive ? 'pulse 1.8s ease-in-out infinite' : undefined,
    }} />
  )
}
