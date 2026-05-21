'use client'

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  idle:             { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
  active:           { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  browsing:         { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  writing:          { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  waiting:          { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  error:            { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  paused:           { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
  new:              { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
  contacted:        { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  replied:          { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  qualified:        { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  rejected:         { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  pending:          { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  approved:         { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  sent:             { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  quality_passed:   { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  quality_rejected: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  running:          { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  complete:         { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  evaluating:       { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  awaiting_approval:{ bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
}

const DEFAULT = { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' }

interface BadgeProps { label: string; color?: string }

export function Badge({ label }: BadgeProps) {
  const c = STATUS_COLORS[label] ?? DEFAULT
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 4,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      fontFamily: 'DM Mono, monospace',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap',
      fontWeight: 400,
    }}>
      {label}
    </span>
  )
}
