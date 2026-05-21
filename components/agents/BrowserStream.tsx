'use client'
import { useEffect, useState } from 'react'

export function BrowserStream({ agentId, active }: { agentId: string; active: boolean }) {
  const [ts, setTs] = useState(Date.now())

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTs(Date.now()), 1500)
    return () => clearInterval(id)
  }, [active])

  if (!active) return null

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{
        padding: '8px 12px', background: '#ffffff', borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#94a3b8', letterSpacing: '0.06em' }}>LIVE BROWSER</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/screenshots/${agentId}/latest.jpg?t=${ts}`}
        alt="Browser view"
        style={{ width: '100%', display: 'block' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  )
}
