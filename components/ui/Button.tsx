'use client'
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'accent'
  size?: 'sm' | 'md' | 'lg'
}

const VARIANTS: Record<string, React.CSSProperties> = {
  primary: { background: '#0f172a', color: '#ffffff', borderColor: '#0f172a' },
  ghost:   { background: 'transparent', color: '#374151', borderColor: '#e2e8f0' },
  danger:  { background: 'transparent', color: '#ef4444', borderColor: '#fecaca' },
  accent:  { background: '#6366f1', color: '#ffffff', borderColor: '#6366f1' },
}

const SIZES: Record<string, React.CSSProperties> = {
  sm: { fontSize: 12, padding: '4px 10px', borderRadius: 6 },
  md: { fontSize: 13, padding: '7px 14px', borderRadius: 8 },
  lg: { fontSize: 14, padding: '10px 20px', borderRadius: 8 },
}

export function Button({
  variant = 'ghost',
  size = 'md',
  style,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    whiteSpace: 'nowrap',
    transition: 'opacity 0.1s, background 0.1s',
    letterSpacing: '-0.01em',
  }

  return (
    <button
      style={{ ...base, ...SIZES[size], ...VARIANTS[variant], ...style }}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}
