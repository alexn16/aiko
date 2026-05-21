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
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#9ca3af', padding: '24px 0' }}>
        No pending approvals.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {approvals.map(a => (
        <ApprovalItem key={a.id} approval={a} onAction={load} />
      ))}
    </div>
  )
}
