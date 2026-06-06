type StatusTone = 'green' | 'amber' | 'red' | 'gray' | 'blue'

const tones: Record<StatusTone, { background: string; color: string; border: string }> = {
  green: { background: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  amber: { background: '#fffbeb', color: '#b45309', border: '#fde68a' },
  red: { background: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  gray: { background: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  blue: { background: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
}

export function StatusPill({ tone = 'gray', children }: { tone?: StatusTone; children: string }) {
  const style = tones[tone]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 999,
      border: `1px solid ${style.border}`,
      background: style.background,
      color: style.color,
      padding: '4px 9px',
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1,
    }}>
      {children}
    </span>
  )
}
