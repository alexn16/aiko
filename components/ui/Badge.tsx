'use client'

const STYLES: Record<string, { color: string; bg: string }> = {
  idle:              { color: '#94a3b8', bg: '#f8fafc' },
  active:            { color: '#10b981', bg: '#ecfdf5' },
  browsing:          { color: '#10b981', bg: '#ecfdf5' },
  writing:           { color: '#f59e0b', bg: '#fffbeb' },
  waiting:           { color: '#3b82f6', bg: '#eff6ff' },
  error:             { color: '#ef4444', bg: '#fef2f2' },
  paused:            { color: '#94a3b8', bg: '#f8fafc' },
  new:               { color: '#94a3b8', bg: '#f8fafc' },
  contacted:         { color: '#3b82f6', bg: '#eff6ff' },
  replied:           { color: '#f59e0b', bg: '#fffbeb' },
  qualified:         { color: '#10b981', bg: '#ecfdf5' },
  rejected:          { color: '#ef4444', bg: '#fef2f2' },
  pending:           { color: '#f59e0b', bg: '#fffbeb' },
  approved:          { color: '#10b981', bg: '#ecfdf5' },
  sent:              { color: '#10b981', bg: '#ecfdf5' },
  quality_passed:    { color: '#10b981', bg: '#ecfdf5' },
  quality_rejected:  { color: '#ef4444', bg: '#fef2f2' },
  running:           { color: '#10b981', bg: '#ecfdf5' },
  complete:          { color: '#10b981', bg: '#ecfdf5' },
  evaluating:        { color: '#3b82f6', bg: '#eff6ff' },
  awaiting_approval: { color: '#f59e0b', bg: '#fffbeb' },
  simple:            { color: '#10b981', bg: '#ecfdf5' },
  medium:            { color: '#f59e0b', bg: '#fffbeb' },
  complex:           { color: '#ef4444', bg: '#fef2f2' },
  email:             { color: '#3b82f6', bg: '#eff6ff' },
  linkedin:          { color: '#6366f1', bg: '#eef2ff' },
  whatsapp:          { color: '#10b981', bg: '#ecfdf5' },
  social:            { color: '#f59e0b', bg: '#fffbeb' },
  multi:             { color: '#64748b', bg: '#f1f5f9' },
  CEO:               { color: '#6366f1', bg: '#eef2ff' },
  user:              { color: '#64748b', bg: '#f1f5f9' },
  ceo:               { color: '#6366f1', bg: '#eef2ff' },
}

const DEFAULT = { color: '#64748b', bg: '#f1f5f9' }

export function Badge({ label }: { label: string }) {
  const s = STYLES[label] ?? DEFAULT
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 11,
      fontWeight: 500,
      padding: '2px 7px',
      borderRadius: 5,
      background: s.bg,
      color: s.color,
      whiteSpace: 'nowrap',
      letterSpacing: '0.01em',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: s.color,
        display: 'inline-block', flexShrink: 0,
      }} />
      {label}
    </span>
  )
}
