'use client'
import { ReactNode } from 'react'

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  )
}
