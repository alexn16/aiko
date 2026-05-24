'use client'
import { useEffect, useState } from 'react'

type OperatingMode = 'read_only' | 'auto_approval' | 'full_access'

interface ModeState {
  id: string
  mode: OperatingMode
  paused: boolean
  paused_at: string | null
  paused_reason: string | null
  daily_send_limit: number
  sends_today: number
  last_reset_date: string | null
  notes: string | null
  updated_at: string
}

const MODES: Array<{
  key: OperatingMode
  label: string
  description: string
  detail: string
  btnLabel: string
}> = [
  {
    key: 'read_only',
    label: 'Read Only',
    description: 'AÏKO can think, plan, and prepare internally only.',
    detail: 'No web browsing. No email sending. All outputs are internal.',
    btnLabel: 'Select',
  },
  {
    key: 'auto_approval',
    label: 'Auto / Approval Required',
    description: 'AÏKO can browse, research, and prepare emails. Client approves before sending.',
    detail: 'Web research and lead finding enabled. All outreach goes through the Approval Center first.',
    btnLabel: 'Select',
  },
  {
    key: 'full_access',
    label: 'Full Access',
    description: 'AÏKO can send approved emails within daily limits.',
    detail: 'Requires explicit confirmation to enable. Daily send limit enforced. Full audit log.',
    btnLabel: 'Activate',
  },
]

const MODE_COLOR: Record<OperatingMode, string> = {
  read_only: '#64748b',
  auto_approval: '#f59e0b',
  full_access: '#10b981',
}

export function OperatingModePanel() {
  const [state, setState] = useState<ModeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingMode, setPendingMode] = useState<OperatingMode | null>(null)
  const [confirmToken, setConfirmToken] = useState('')
  const [pauseReason, setPauseReason] = useState('')
  const [editLimit, setEditLimit] = useState<number | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/mode')
      const d = await res.json()
      setState(d)
      setEditLimit(d.daily_send_limit)
    } catch {
      setError('Could not load mode settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function patch(body: Record<string, unknown>) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? 'Error')
        return
      }
      setState(d)
      setEditLimit(d.daily_send_limit)
      setPendingMode(null)
      setConfirmToken('')
    } catch {
      setError('Request failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSelectMode(m: OperatingMode) {
    if (m === 'full_access') {
      setPendingMode('full_access')
      return
    }
    await patch({ mode: m })
  }

  async function handleEnableFullAccess() {
    await patch({ mode: 'full_access', confirmation_token: confirmToken })
  }

  async function handlePause() {
    await patch({ paused: true, paused_reason: pauseReason || undefined })
    setPauseReason('')
  }

  async function handleResume() {
    await patch({ paused: false })
  }

  async function handleSaveLimit() {
    if (editLimit !== null) {
      await patch({ daily_send_limit: editLimit })
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, color: '#94a3b8', fontSize: 13 }}>Loading mode settings…</div>
    )
  }

  const current = state?.mode ?? 'read_only'
  const paused = state?.paused ?? false

  return (
    <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px', borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
            Operating Mode
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Control what AÏKO is allowed to do.
          </div>
        </div>

        {/* Current mode badge + pause button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 20, padding: '4px 12px',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: paused ? '#ef4444' : MODE_COLOR[current],
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>
              {paused ? 'PAUSED' : MODES.find(m => m.key === current)?.label}
            </span>
          </div>

          {paused ? (
            <button
              onClick={handleResume}
              disabled={saving}
              style={{
                background: '#10b981', color: '#fff', border: 'none',
                borderRadius: 8, padding: '7px 14px', fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Resume
            </button>
          ) : (
            <button
              onClick={handlePause}
              disabled={saving}
              style={{
                background: '#ef4444', color: '#fff', border: 'none',
                borderRadius: 8, padding: '7px 14px', fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Pause all agents
            </button>
          )}
        </div>
      </div>

      {/* Paused warning */}
      {paused && (
        <div style={{
          background: '#fef2f2', borderBottom: '1px solid #fecaca',
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
            All agent actions are halted.
          </span>
          {state?.paused_reason && (
            <span style={{ fontSize: 12, color: '#ef4444' }}>Reason: {state.paused_reason}</span>
          )}
        </div>
      )}

      {/* Pause reason input (only when not paused) */}
      {!paused && (
        <div style={{ padding: '10px 24px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={pauseReason}
            onChange={e => setPauseReason(e.target.value)}
            placeholder="Optional pause reason…"
            style={{
              flex: 1, background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#374151',
            }}
          />
        </div>
      )}

      {/* Mode selector */}
      <div style={{ padding: '24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {MODES.map(m => {
            const isActive = current === m.key && !pendingMode
            return (
              <div
                key={m.key}
                style={{
                  border: `2px solid ${isActive ? MODE_COLOR[m.key] : '#e2e8f0'}`,
                  borderRadius: 10,
                  padding: '16px',
                  background: isActive ? '#f8fafc' : '#fff',
                  position: 'relative',
                  transition: 'border-color 0.15s',
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    background: MODE_COLOR[m.key], color: '#fff',
                    fontSize: 9, fontWeight: 700, borderRadius: 4,
                    padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    Active
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>
                  {m.description}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginBottom: 14 }}>
                  {m.detail}
                </div>
                {current !== m.key && (
                  <button
                    onClick={() => handleSelectMode(m.key)}
                    disabled={saving}
                    style={{
                      background: m.key === 'full_access' ? '#ef4444' : '#0f172a',
                      color: '#fff', border: 'none', borderRadius: 7,
                      padding: '6px 14px', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {m.btnLabel}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Full Access confirmation */}
        {pendingMode === 'full_access' && (
          <div style={{
            marginTop: 16,
            background: '#fff5f5', border: '1px solid #fecaca',
            borderRadius: 10, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
              Enable Full Access
            </div>
            <div style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 12, lineHeight: 1.5 }}>
              Full Access allows AÏKO to send emails automatically within the daily limit.
              Review the audit log regularly. Type <strong>CONFIRM_FULL_ACCESS</strong> to enable.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={confirmToken}
                onChange={e => setConfirmToken(e.target.value)}
                placeholder="CONFIRM_FULL_ACCESS"
                style={{
                  flex: 1, background: '#fff', border: '1px solid #fca5a5',
                  borderRadius: 7, padding: '7px 12px', fontSize: 12,
                  fontFamily: 'DM Mono, monospace', color: '#374151',
                }}
              />
              <button
                onClick={handleEnableFullAccess}
                disabled={saving || confirmToken !== 'CONFIRM_FULL_ACCESS'}
                style={{
                  background: '#ef4444', color: '#fff', border: 'none',
                  borderRadius: 7, padding: '7px 14px', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer',
                  opacity: (saving || confirmToken !== 'CONFIRM_FULL_ACCESS') ? 0.4 : 1,
                }}
              >
                Enable Full Access
              </button>
              <button
                onClick={() => { setPendingMode(null); setConfirmToken('') }}
                style={{
                  background: 'transparent', color: '#64748b',
                  border: '1px solid #e2e8f0', borderRadius: 7,
                  padding: '7px 12px', fontSize: 12, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Full Access send controls */}
        {current === 'full_access' && (
          <div style={{
            marginTop: 16,
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 10, padding: '16px 20px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 12 }}>
              Daily Send Limit
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                type="number"
                value={editLimit ?? state?.daily_send_limit}
                onChange={e => setEditLimit(parseInt(e.target.value, 10))}
                min={1} max={1000}
                style={{
                  width: 80, background: '#fff', border: '1px solid #86efac',
                  borderRadius: 6, padding: '5px 10px', fontSize: 13,
                }}
              />
              <span style={{ fontSize: 12, color: '#166534' }}>emails per day</span>
              <button
                onClick={handleSaveLimit}
                disabled={saving}
                style={{
                  background: '#16a34a', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '5px 12px', fontSize: 12,
                  fontWeight: 500, cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#166534', marginBottom: 4 }}>
                <span>Sent today</span>
                <span>{state?.sends_today ?? 0} / {state?.daily_send_limit ?? 50}</span>
              </div>
              <div style={{ height: 6, background: '#dcfce7', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, ((state?.sends_today ?? 0) / (state?.daily_send_limit ?? 50)) * 100)}%`,
                  background: '#16a34a', borderRadius: 4,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#dc2626', padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
