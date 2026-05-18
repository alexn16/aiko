'use client'

const STATUS_COLORS: Record<string, string> = {
  idle:     '#444444',
  active:   '#7eb88a',
  browsing: '#7eb88a',
  writing:  '#c8a84a',
  waiting:  '#7098c8',
  error:    '#c87070',
  paused:   '#444444',
}

export function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#444444'
  const isActive = status === 'active' || status === 'browsing' || status === 'writing'

  return (
    <span
      style={{
        display: 'inline-block',
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        animation: isActive ? 'pulse 2s ease-in-out infinite' : undefined,
      }}
    />
  )
}
