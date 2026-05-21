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
    <div style={{ padding: '40px 32px', maxWidth: 800 }} className="page-enter">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
          Approval Center
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Every outreach message sits here until you approve it. Nothing leaves without your sign-off.
        </p>
      </div>
      {projectId && <ApprovalQueue projectId={projectId} />}
    </div>
  )
}
