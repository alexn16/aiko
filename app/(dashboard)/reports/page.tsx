'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface Report {
  summary: string
  metrics: Record<string, number>
  agentPerformance: { name: string; highlight: string }[]
  recommendations: string[]
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    const d = await fetch('/api/projects').then(r => r.json())
    const pid = d.projects?.[0]?.id
    if (!pid) { setLoading(false); return }

    const res = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: pid }),
    })
    const data = await res.json()
    setReport(data.report)
    setLoading(false)
  }

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 18, color: '#111827', margin: 0 }}>
          Reports
        </h2>
        <Button variant="primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate report'}
        </Button>
      </div>

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Summary</div>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{report.summary}</p>
          </Card>

          <Card>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Metrics</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {Object.entries(report.metrics ?? {}).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k.replace(/_/g, ' ')}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, color: '#111827', fontWeight: 300 }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Recommendations</div>
            {report.recommendations?.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: '#374151', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
                {i + 1}. {r}
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Agent highlights</div>
            {report.agentPerformance?.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 13, color: '#111827', fontWeight: 500, minWidth: 140 }}>{a.name}</span>
                <span style={{ fontSize: 13, color: '#6b7280' }}>{a.highlight}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {!report && !loading && (
        <div style={{ fontSize: 13, color: '#9ca3af', padding: '24px 0' }}>
          Click "Generate report" to produce the latest marketing performance summary.
        </div>
      )}
    </div>
  )
}
