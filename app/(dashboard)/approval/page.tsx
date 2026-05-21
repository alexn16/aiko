'use client'
import { useEffect, useState } from 'react'
import { ApprovalQueue } from '@/components/approval/ApprovalQueue'

export default function ApprovalPage() {
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      if (d.projects?.[0]?.id) setProjectId(d.projects[0].id)
    }).catch(() => {})
  }, [])

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 18, color: '#111827', marginBottom: 8 }}>
        Approval Center
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        Review and approve outreach messages before they are sent. Nothing leaves without your approval.
      </p>
      {projectId && <ApprovalQueue projectId={projectId} />}
    </div>
  )
}
