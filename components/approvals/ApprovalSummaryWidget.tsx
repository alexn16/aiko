'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface ApprovalItem {
  id: string
  title: string
  project_name?: string
  status: string
  item_type: string
  created_at: string
}

interface Summary {
  pending: number
  approved_today: number
  changes_requested: number
  pending_items: ApprovalItem[]
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

export function ApprovalSummaryWidget() {
  const [summary, setSummary] = useState<Summary | null>(null)

  const fetchSummary = useCallback(async () => {
    try {
      const [pendingRes, approvedRes, changesRes] = await Promise.all([
        fetch('/api/approval-items?status=pending&limit=5').then(r => r.json()),
        fetch('/api/approval-items?status=approved&limit=100').then(r => r.json()),
        fetch('/api/approval-items?status=changes_requested&limit=100').then(r => r.json()),
      ])

      const pendingItems: ApprovalItem[] = pendingRes.items ?? []
      const approvedItems: ApprovalItem[] = approvedRes.items ?? []
      const changesItems: ApprovalItem[] = changesRes.items ?? []

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const approvedToday = approvedItems.filter(i => new Date(i.created_at) >= today).length

      setSummary({
        pending: pendingItems.length,
        approved_today: approvedToday,
        changes_requested: changesItems.length,
        pending_items: pendingItems.slice(0, 3),
      })
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchSummary()
    const id = setInterval(fetchSummary, 30_000)
    return () => clearInterval(id)
  }, [fetchSummary])

  if (!summary) return null

  return (
    <div style={{
      background: '#ffffff', borderRadius: 10, border: '1px solid #f1f5f9',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 18px', marginBottom: 28,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>Pending approvals</div>
        <Link
          href="/approvals"
          style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}
        >
          Open Approval Center →
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: summary.pending_items.length > 0 ? 14 : 0 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'DM Mono, monospace', fontSize: 20, color: summary.pending > 0 ? '#d97706' : '#0f172a',
          }}>
            {summary.pending}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>pending</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, color: '#16a34a' }}>
            {summary.approved_today}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>approved today</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'DM Mono, monospace', fontSize: 20,
            color: summary.changes_requested > 0 ? '#7c3aed' : '#0f172a',
          }}>
            {summary.changes_requested}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>changes req.</div>
        </div>
      </div>

      {/* Pending items list */}
      {summary.pending_items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {summary.pending_items.map(item => (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '6px 8px', borderRadius: 6, background: '#fefce8',
              border: '1px solid #fef3c7',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </div>
                {item.project_name && (
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                    {item.project_name}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10, color: '#cbd5e1', flexShrink: 0, marginLeft: 8, marginTop: 2 }}>
                {timeAgo(item.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {summary.pending === 0 && (
        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
          No items pending review.
        </div>
      )}
    </div>
  )
}
