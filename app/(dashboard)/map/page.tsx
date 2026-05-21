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
    <div style={{ padding: 24, height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 18, color: '#111827', marginBottom: 16 }}>
        Live Lead Map
      </h2>

      {/* Leaflet CSS */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div style={{ flex: 1 }}>
        {projectId ? (
          <LeadMap projectId={projectId} />
        ) : (
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#9ca3af', padding: 24 }}>
            No project configured. Create a project in Settings first.
          </div>
        )}
      </div>
    </div>
  )
}
