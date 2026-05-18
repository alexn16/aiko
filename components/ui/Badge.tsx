'use client'

const STATUS_COLORS: Record<string, string> = {
  idle:              '#444444',
  active:            '#7eb88a',
  browsing:          '#7eb88a',
  writing:           '#c8a84a',
  waiting:           '#7098c8',
  error:             '#c87070',
  paused:            '#444444',
  new:               '#666666',
  contacted:         '#7098c8',
  replied:           '#c8a84a',
  qualified:         '#7eb88a',
  rejected:          '#c87070',
  pending:           '#7098c8',
  approved:          '#7eb88a',
  sent:              '#7eb88a',
  quality_passed:    '#7eb88a',
  quality_rejected:  '#c87070',
}

interface BadgeProps {
  label: string
  color?: string
}

export function Badge({ label, color }: BadgeProps) {
  const c = color ?? STATUS_COLORS[label] ?? '#444'
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 9,
      padding: '3px 8px',
      borderRadius: 2,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      background: `${c}22`,
      color: c,
      border: `1px solid ${c}44`,
      fontFamily: 'DM Mono, monospace',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
