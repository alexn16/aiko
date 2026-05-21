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
    <div style={{ padding: '40px 32px', maxWidth: 760 }} className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Reports
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            AI-generated performance summary and strategic recommendations.
          </p>
        </div>
        <Button variant="primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate report'}
        </Button>
      </div>

      {!report && !loading && (
        <div style={{
          padding: '64px 24px', textAlign: 'center',
          background: '#ffffff', borderRadius: 10,
          border: '1px solid #f1f5f9',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>No report yet</div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px' }}>
            Click "Generate report" to get the latest performance summary from your AI team.
          </p>
          <Button variant="primary" onClick={generate}>Generate report</Button>
        </div>
      )}

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Executive summary
            </div>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0 }}>{report.summary}</p>
          </Card>

          {/* Metrics */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              Key metrics
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              {Object.entries(report.metrics ?? {}).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 3 }}>
                    {k.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recommendations */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              Recommendations
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {report.recommendations?.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#f1f5f9', color: '#6366f1',
                    fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{r}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Agent highlights */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              Agent highlights
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {report.agentPerformance?.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < report.agentPerformance.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', minWidth: 160 }}>{a.name}</span>
                  <span style={{ fontSize: 13, color: '#64748b' }}>{a.highlight}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
