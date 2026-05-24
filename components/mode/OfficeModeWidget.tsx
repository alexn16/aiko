'use client'
import { useEffect, useState } from 'react'

interface ModeState {
  mode: 'read_only' | 'auto_approval' | 'full_access'
  paused: boolean
  paused_reason: string | null
  sends_today: number
  daily_send_limit: number
}

const MODE_LABEL: Record<string, string> = {
  read_only: 'Read Only',
  auto_approval: 'Auto / Approval Required',
  full_access: 'Full Access',
}

const MODE_COLOR: Record<string, string> = {
  read_only: '#64748b',
  auto_approval: '#f59e0b',
  full_access: '#10b981',
}

export function OfficeModeWidget() {
  const [state, setState] = useState<ModeState | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const res = await fetch('/api/mode')
      setState(await res.json())
    } catch {
      // ignore
    }
  }

  useEffect(() => { load() }, [])

  async function handlePause() {
    setSaving(true)
    try {
      const res = await fetch('/api/mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: true }),
      })
      setState(await res.json())
    } finally {
      setSaving(false)
    }
  }

  async function handleResume() {
    setSaving(true)
    try {
      const res = await fetch('/api/mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: false }),
      })
      setState(await res.json())
    } finally {
      setSaving(false)
    }
  }

  if (!state) return null

  const color = state.paused ? '#ef4444' : (MODE_COLOR[state.mode] ?? '#64748b')

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #f1f5f9',
      borderRadius: 10, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      marginBottom: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Mode badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
          boxShadow: state.paused ? '0 0 0 3px rgba(239,68,68,0.15)' : undefined,
        }} />
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
            {state.paused ? 'PAUSED — ' : ''}{MODE_LABEL[state.mode]}
          </span>
          {state.paused && state.paused_reason && (
            <span style={{ fontSize: 11, color: '#ef4444', marginLeft: 6 }}>
              {state.paused_reason}
            </span>
          )}
        </div>
      </div>

      {/* Full access send bar */}
      {state.mode === 'full_access' && !state.paused && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
            {state.sends_today}/{state.daily_send_limit} sent today
          </div>
          <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2, minWidth: 60 }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (state.sends_today / state.daily_send_limit) * 100)}%`,
              background: '#10b981', borderRadius: 2,
            }} />
          </div>
        </div>
      )}

      {/* Pause / resume */}
      {state.paused ? (
        <button
          onClick={handleResume}
          disabled={saving}
          style={{
            background: '#10b981', color: '#fff', border: 'none',
            borderRadius: 7, padding: '5px 12px', fontSize: 11,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          Resume agents
        </button>
      ) : (
        <button
          onClick={handlePause}
          disabled={saving}
          style={{
            background: '#ef4444', color: '#fff', border: 'none',
            borderRadius: 7, padding: '5px 12px', fontSize: 11,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          Pause all agents
        </button>
      )}

      <a
        href="/mode"
        style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}
      >
        Manage mode
      </a>
    </div>
  )
}
