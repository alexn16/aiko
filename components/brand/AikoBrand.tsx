type AikoBrandProps = {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  showSubtitle?: boolean
}

const SIZE = {
  sm: { mark: 30, name: 18, subtitle: 9 },
  md: { mark: 44, name: 28, subtitle: 11 },
  lg: { mark: 70, name: 46, subtitle: 13 },
}

export function AikoBrand({ variant = 'light', size = 'md', showSubtitle = true }: AikoBrandProps) {
  const s = SIZE[size]
  const subtitle = variant === 'dark' ? '#7dd3fc' : '#64748b'

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'sm' ? 9 : 13 }}>
      <img
        src="/brand/aiko-mark.svg"
        alt="AÏKO logo mark"
        width={s.mark}
        height={s.mark}
        style={{ display: 'block', borderRadius: size === 'sm' ? 8 : 12 }}
      />
      <div>
        <div style={{
          fontSize: s.name,
          fontWeight: 850,
          lineHeight: 0.92,
          letterSpacing: size === 'sm' ? '-0.06em' : '-0.07em',
          background: 'linear-gradient(135deg,#1d4ed8,#22d3ee)',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}>
          AÏKO
        </div>
        {showSubtitle && (
          <div style={{
            marginTop: size === 'sm' ? 4 : 7,
            fontSize: s.subtitle,
            fontWeight: 800,
            letterSpacing: size === 'sm' ? '0.12em' : '0.16em',
            textTransform: 'uppercase',
            color: subtitle,
            whiteSpace: 'nowrap',
          }}>
            AI Marketing Operating System
          </div>
        )}
      </div>
    </div>
  )
}
