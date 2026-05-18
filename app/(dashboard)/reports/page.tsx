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
    <div style={{ padding: 24, fontFamily: 'DM Mono, monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', margin: 0 }}>
          Reports
        </h2>
        <Button variant="primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate report'}
        </Button>
      </div>

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Summary</div>
            <p style={{ fontSize: 11, color: '#e8e6e0', lineHeight: 1.6, margin: 0 }}>{report.summary}</p>
          </Card>

          <Card>
            <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Metrics</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {Object.entries(report.metrics ?? {}).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 20, color: '#e8e6e0', fontWeight: 300 }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Recommendations</div>
            {report.recommendations?.map((r, i) => (
              <div key={i} style={{ fontSize: 11, color: '#888', padding: '6px 0', borderBottom: '1px solid #1a1a1a' }}>
                {i + 1}. {r}
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Agent highlights</div>
            {report.agentPerformance?.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ fontSize: 10, color: '#c8b89a', minWidth: 140 }}>{a.name}</span>
                <span style={{ fontSize: 10, color: '#666' }}>{a.highlight}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {!report && !loading && (
        <div style={{ fontSize: 11, color: '#333', padding: '24px 0' }}>
          Click "Generate report" to produce the latest marketing performance summary.
        </div>
      )}
    </div>
  )
}
