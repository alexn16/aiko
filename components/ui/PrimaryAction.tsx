import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

type PrimaryActionProps = {
  children: ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'quiet'
  style?: CSSProperties
}

export function PrimaryAction({ children, href, onClick, disabled = false, variant = 'primary', style }: PrimaryActionProps) {
  const palette =
    variant === 'primary'
      ? { background: disabled ? '#e5e7eb' : '#111827', color: disabled ? '#9ca3af' : '#ffffff', border: disabled ? '#e5e7eb' : '#111827' }
      : variant === 'secondary'
        ? { background: '#ffffff', color: '#111827', border: '#d1d5db' }
        : { background: 'transparent', color: '#4b5563', border: 'transparent' }
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 999,
    border: `1px solid ${palette.border}`,
    background: palette.background,
    color: palette.color,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
    cursor: disabled ? 'default' : 'pointer',
    whiteSpace: 'nowrap',
    ...style,
  }
  if (href && !disabled) return <Link href={href} style={base}>{children}</Link>
  return <button type="button" onClick={onClick} disabled={disabled} style={base}>{children}</button>
}
