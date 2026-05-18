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
    <div style={{ padding: 24, fontFamily: 'DM Mono, monospace' }}>
      <h2 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', marginBottom: 24, letterSpacing: '0.05em' }}>
        Approval Center
      </h2>
      <p style={{ fontSize: 10, color: '#444', marginBottom: 24 }}>
        Review and approve outreach messages before they are sent. Nothing leaves without your approval.
      </p>
      {projectId && <ApprovalQueue projectId={projectId} />}
    </div>
  )
}
