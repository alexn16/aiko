'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const LeadMap = dynamic(
  () => import('@/components/map/LeadMap').then(m => m.LeadMap),
  { ssr: false }
)

export default function MapPage() {
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      if (d.projects?.[0]?.id) setProjectId(d.projects[0].id)
    }).catch(() => {})
  }, [])

  return (
    <div style={{ padding: '40px 32px 0', height: '100vh', display: 'flex', flexDirection: 'column' }} className="page-enter">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
          Lead Map
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Geographic distribution of your pipeline.
        </p>
      </div>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: 32 }}>
        {projectId
          ? <LeadMap projectId={projectId} />
          : <div style={{ padding: 40, fontSize: 13, color: '#94a3b8' }}>No project configured. Add one in Settings.</div>
        }
      </div>
    </div>
  )
}
