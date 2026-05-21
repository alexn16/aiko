'use client'
import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  style?: React.CSSProperties
  padding?: number
}

export function Card({ children, style, padding = 20 }: CardProps) {
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 10,
      border: '1px solid #f1f5f9',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
      padding,
      ...style,
    }}>
      {children}
    </div>
  )
}
