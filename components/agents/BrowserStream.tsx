'use client'
import { useEffect, useState } from 'react'

interface BrowserStreamProps {
  agentId: string
  active: boolean
}

export function BrowserStream({ agentId, active }: BrowserStreamProps) {
  const [ts, setTs] = useState(Date.now())

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => setTs(Date.now()), 1500)
    return () => clearInterval(interval)
  }, [active])

  if (!active) return null

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 6,
      overflow: 'hidden',
      background: '#f9fafb',
    }}>
      <div style={{ padding: '6px 10px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.1em' }}>
        LIVE BROWSER
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/screenshots/${agentId}/latest.jpg?t=${ts}`}
        alt="Browser view"
        style={{ width: '100%', display: 'block' }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  )
}
