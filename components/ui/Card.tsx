'use client'
import { ReactNode } from 'react'

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#111111',
      border: '1px solid #222222',
      borderRadius: 4,
      padding: 16,
      ...style,
    }}>
      {children}
    </div>
  )
}
