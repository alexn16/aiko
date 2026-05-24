'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { WebOperatorSession, WebOperatorAction } from '@/lib/web-operator/web-operator'
import type { WebOperator } from '@/lib/web-operator/operators'

const STATUS_COLOR: Record<string, string> = {
  idle: '#94a3b8',
  active: '#10b981',
  working: '#3b82f6',
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
  const [operators, setOperators] = useState<WebOperator[]>([])

  const load = useCallback(async () => {
    try {
      const [statusRes, opsRes] = await Promise.all([
        fetch('/api/web-operator/status'),
        fetch('/api/web-operators'),
      ])
      if (statusRes.ok) setData(await statusRes.json())
      if (opsRes.ok) {
        const d = await opsRes.json()
        setOperators(d.operators ?? [])
      }
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  // If multiple operators, show compact fleet view
  if (operators.length > 1) {
    return (
      <div style={{
        background: '#ffffff',
        border: '1px solid #f1f5f9',
        borderRadius: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        padding: '16px 18px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
            Web Operators
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 500, color: '#94a3b8' }}>
              {operators.length} agents
            </span>
          </span>
          <Link href="/operators" style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
            Manage fleet →
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {operators.slice(0, 3).map(op => {
            const color = STATUS_COLOR[op.status] ?? '#94a3b8'
            return (
              <div key={op.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 6, background: '#fafafa',
                border: '1px solid #f1f5f9',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <Link href={`/operators/${op.id}`} style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', flexShrink: 0, textDecoration: 'none' }}>{op.name}</Link>
                <span style={{ fontSize: 10, color: color, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                  {op.status.replace(/_/g, ' ')}
                </span>
                {op.requires_user_input && (
                  <span style={{
                    fontSize: 9, fontWeight: 600,
                    background: '#fef9c3', color: '#92400e',
                    borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                  }}>
                    needs input
                  </span>
                )}
                {op.current_goal && !op.requires_user_input && (
                  <span style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {truncate(op.current_goal, 40)}
                  </span>
                )}
                {op.current_task && !op.current_goal && (
                  <span style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {truncate(op.current_task, 32)}
                  </span>
                )}
                {op.current_url && !op.current_task && !op.current_goal && (
                  <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'DM Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {truncate(op.current_url, 28)}
                  </span>
                )}
              </div>
            )
          })}
          {operators.length > 3 && (
            <div style={{ fontSize: 10, color: '#94a3b8', paddingLeft: 4 }}>
              +{operators.length - 3} more…
            </div>
          )}
        </div>

        {/* Runtime indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10 }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: data?.browser_available ? '#10b981' : '#f59e0b',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>
            {data?.browser_available ? 'Playwright ready' : 'Runtime not configured'}
          </span>
          {(data?.pending_approvals ?? 0) > 0 && (
            <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 600,
              background: '#fef9c3', color: '#92400e',
              borderRadius: 4, padding: '1px 6px',
            }}>
              {data?.pending_approvals} pending
            </span>
          )}
        </div>
      </div>
    )
  }

  // Single operator (legacy) view
  const latestAction = data?.recent_actions?.[0] ?? null
  const session = data?.active_session ?? null

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
        <Link href="/operators" style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
          Operators →
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {latestAction.screenshot_url && !(latestAction as { is_sensitive?: boolean }).is_sensitive && (
              <img
                src={latestAction.screenshot_url}
                alt="Page screenshot"
                style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1 }}>
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
                  {truncate(latestAction.target_url, 40)}
                </div>
              )}
              {(latestAction as { page_title?: string | null }).page_title && (
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                  {truncate((latestAction as { page_title?: string | null }).page_title, 30)}
                </div>
              )}
              {(latestAction as { failure_reason?: string | null }).failure_reason && (
                <div style={{ fontSize: 9, color: '#ef4444', marginTop: 2 }}>
                  {(latestAction as { failure_reason?: string | null }).failure_reason}
                </div>
              )}
            </div>
          </div>
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
          {(session as { page_title?: string | null }).page_title && (
            <> · <span style={{ color: '#64748b' }}>{truncate((session as { page_title?: string | null }).page_title, 30)}</span></>
          )}
          {(session as { recovery_count?: number }).recovery_count && (session as { recovery_count?: number }).recovery_count! > 0 ? (
            <span style={{
              marginLeft: 6, fontSize: 9, fontWeight: 600,
              background: '#fef3c7', color: '#92400e',
              borderRadius: 3, padding: '1px 4px',
            }}>
              Recovered
            </span>
          ) : null}
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
