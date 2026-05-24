'use client'
import { useEffect, useRef, useState } from 'react'

interface ModeState {
  mode: 'read_only' | 'auto_approval' | 'full_access'
  paused: boolean
}

const MODE_LABEL: Record<string, string> = {
  read_only: 'Read Only',
  auto_approval: 'Auto / Approval',
  full_access: 'Full Access',
}

const MODE_DESCRIPTION: Record<string, string> = {
  read_only: 'AÏKO can think, plan, and prepare internally only.',
  auto_approval: 'AÏKO can browse and prepare emails. Client approves before sending.',
  full_access: 'AÏKO can send approved emails within daily limits.',
}

const MODE_COLOR: Record<string, string> = {
  read_only: '#64748b',
  auto_approval: '#f59e0b',
  full_access: '#10b981',
}

interface Props {
  size?: 'sm' | 'md'
}

export function ModeGateBadge({ size = 'sm' }: Props) {
  const [state, setState] = useState<ModeState | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/mode')
      .then(r => r.json())
      .then(d => setState({ mode: d.mode, paused: d.paused }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!state) return null

  const color = state.paused ? '#ef4444' : (MODE_COLOR[state.mode] ?? '#64748b')
  const label = state.paused ? 'PAUSED' : MODE_LABEL[state.mode]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: size === 'sm' ? '3px 0' : '4px 0',
        }}
        title="Operating mode"
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color,
          flexShrink: 0,
          boxShadow: state.paused ? `0 0 0 2px rgba(239,68,68,0.2)` : undefined,
        }} />
        <span style={{
          fontSize: size === 'sm' ? 10 : 12,
          color: '#64748b',
          fontWeight: 500,
          fontFamily: 'inherit',
        }}>
          {label}
        </span>
        {state.paused && (
          <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginLeft: 2 }}>
            PAUSED
          </span>
        )}
      </button>

      {size === 'md' && (
        <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
          {state.paused ? 'All agent actions are halted.' : MODE_DESCRIPTION[state.mode]}
        </div>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200,
          background: '#ffffff', border: '1px solid #e2e8f0',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          padding: '10px 14px', minWidth: 220, marginTop: 4,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
            Operating Mode
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>{MODE_LABEL[state.mode]}</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
            {MODE_DESCRIPTION[state.mode]}
          </div>
          {state.paused && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444', fontWeight: 500 }}>
              Agents are currently paused.
            </div>
          )}
          <div style={{ marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 8, fontSize: 10, color: '#94a3b8' }}>
            Manage at /mode
          </div>
        </div>
      )}
    </div>
  )
}
