'use client'
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'ghost', size = 'md', style, children, ...rest }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid #222',
    borderRadius: 4,
    fontFamily: 'DM Mono, monospace',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    fontSize: size === 'sm' ? 9 : 11,
    padding: size === 'sm' ? '4px 10px' : '6px 14px',
    transition: 'border-color 0.15s, color 0.15s',
  }

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: '#c8b89a', color: '#0a0a0a', borderColor: '#c8b89a', fontWeight: 500 },
    ghost:   { background: 'transparent', color: '#e8e6e0' },
    danger:  { background: 'transparent', color: '#c87070', borderColor: '#c8707044' },
  }

  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  )
}
