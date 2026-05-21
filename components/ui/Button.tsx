'use client'
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'ghost', size = 'md', style, disabled, children, ...rest }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 6,
    fontFamily: 'Inter, sans-serif',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: size === 'sm' ? 12 : 13,
    fontWeight: 400,
    padding: size === 'sm' ? '4px 10px' : '7px 14px',
    transition: 'background 0.1s, opacity 0.1s',
    opacity: disabled ? 0.45 : 1,
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
  }

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: '#111827', color: '#ffffff', borderColor: '#111827' },
    ghost:   { background: 'transparent', color: '#374151', borderColor: '#e5e7eb' },
    danger:  { background: 'transparent', color: '#dc2626', borderColor: '#fecaca' },
  }

  return (
    <button style={{ ...base, ...variants[variant], ...style }} disabled={disabled} {...rest}>
      {children}
    </button>
  )
}
