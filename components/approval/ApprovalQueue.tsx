'use client'
import { useEffect, useState } from 'react'
import { ApprovalItem } from '@/components/approval/ApprovalItem'
import { Approval } from '@/lib/db/schema'

export function ApprovalQueue({ projectId }: { projectId: string }) {
  const [approvals, setApprovals] = useState<(Approval & { company_name?: string; email?: string })[]>([])

  async function load() {
    const res = await fetch(`/api/approvals?projectId=${projectId}`)
    const data = await res.json()
    setApprovals(data.approvals ?? [])
  }

  useEffect(() => { load() }, [projectId])

  if (!approvals.length) {
    return (
      <div style={{
        padding: '64px 24px', textAlign: 'center',
        background: '#ffffff', borderRadius: 10,
        border: '1px solid #f1f5f9',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>All clear</div>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
          No pending approvals right now. Messages will appear here once agents draft them.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
        {approvals.length} message{approvals.length !== 1 ? 's' : ''} waiting for review
      </div>
      {approvals.map(a => (
        <ApprovalItem key={a.id} approval={a} onAction={load} />
      ))}
    </div>
  )
}
