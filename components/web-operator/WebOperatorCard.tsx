'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { WebOperatorSession, WebOperatorAction } from '@/lib/web-operator/web-operator'

const STATUS_COLOR: Record<string, string> = {
  idle: '#94a3b8',
  active: '#10b981',
  waiting_approval: '#f59e0b',
  blocked: '#ef4444',
  error: '#ef4444',
  stopped: '#94a3b8',
}

function truncate(str: string | null | undefined, n = 42): string {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

interface StatusPayload {
  browser_available: boolean
  active_session: WebOperatorSession | null
  pending_approvals: number
  recent_actions: WebOperatorAction[]
}

export function WebOperatorCard() {
  const [data, setData] = useState<StatusPayload | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/web-operator/status')
      if (!res.ok) return
      setData(await res.json())
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  const latestAction = data?.recent_actions?.[0] ?? null
  const session = data?.active_session ?? null

  // Derive display status
  let displayStatus = 'idle'
  if (session) {
    if (data?.pending_approvals && data.pending_approvals > 0) displayStatus = 'waiting_approval'
    else if (latestAction?.status === 'running') displayStatus = 'active'
    else if (latestAction?.status === 'blocked' || latestAction?.status === 'failed') displayStatus = 'blocked'
    else displayStatus = 'active'
  }

  const dotColor = STATUS_COLOR[displayStatus] ?? '#94a3b8'

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #f1f5f9',
      borderRadius: 10,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>Web Operator</span>
          <span style={{
            fontSize: 9, fontWeight: 600,
            background: dotColor + '20', color: dotColor,
            borderRadius: 4, padding: '1px 5px',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {displayStatus.replace(/_/g, ' ')}
          </span>
        </div>
        <Link href="/operator" style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
          Open Operator →
        </Link>
      </div>

      {/* Runtime indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: data?.browser_available ? '#10b981' : '#f59e0b',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 11, color: '#64748b' }}>
          {data?.browser_available ? 'Playwright ready' : 'Runtime not configured'}
        </span>
        {(data?.pending_approvals ?? 0) > 0 && (
          <span style={{
            marginLeft: 8, fontSize: 10, fontWeight: 600,
            background: '#fef9c3', color: '#92400e',
            borderRadius: 4, padding: '1px 6px',
          }}>
            {data?.pending_approvals} pending approval{(data?.pending_approvals ?? 0) !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Current action */}
      {latestAction && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            Latest action
          </div>
          <div style={{ fontSize: 12, color: '#374151' }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6366f1', marginRight: 6 }}>
              {latestAction.action_type}
            </span>
            {truncate(latestAction.description)}
          </div>
          {latestAction.requested_by_role && (
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
              Requested by: <span style={{ color: '#475569', fontWeight: 500 }}>{latestAction.requested_by_role}</span>
            </div>
          )}
          {latestAction.target_url && (
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>
              {truncate(latestAction.target_url)}
            </div>
          )}
        </div>
      )}

      {/* Session info */}
      {session && (
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          Session{' '}
          <span style={{ fontFamily: 'DM Mono, monospace' }}>{session.id.slice(0, 8)}</span>
          {session.current_url && (
            <> · <span style={{ color: '#475569' }}>{truncate(session.current_url, 36)}</span></>
          )}
        </div>
      )}

      {/* Latest result */}
      {latestAction?.output && Object.keys(latestAction.output).length > 0 && (
        <div style={{
          marginTop: 10, padding: '8px 10px',
          background: '#f8fafc', borderRadius: 6,
          fontFamily: 'DM Mono, monospace', fontSize: 10,
          color: '#64748b', maxHeight: 60, overflow: 'hidden',
        }}>
          {JSON.stringify(latestAction.output).slice(0, 120)}…
        </div>
      )}
    </div>
  )
}
