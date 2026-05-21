'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface Props { projectId: string; agentId: string; onClose: () => void; onStarted: () => void }

const QUICK_SOURCES = [
  { label: 'Google Maps',   url: 'https://www.google.com/maps',                                 hint: 'Local businesses by area' },
  { label: 'LinkedIn',      url: 'https://www.linkedin.com/search/results/companies/',           hint: 'Companies & founders' },
  { label: 'Crunchbase',    url: 'https://www.crunchbase.com/discover/organizations',            hint: 'Funded startups' },
  { label: 'Y Combinator',  url: 'https://www.ycombinator.com/companies',                       hint: 'YC portfolio' },
  { label: 'Wellfound',     url: 'https://wellfound.com/startups',                              hint: 'Hiring startups' },
  { label: 'Clutch',        url: 'https://clutch.co',                                           hint: 'Agencies & services' },
  { label: 'Yellow Pages',  url: 'https://www.yellowpages.com',                                 hint: 'Local US businesses' },
  { label: 'Europages',     url: 'https://www.europages.com',                                   hint: 'European B2B' },
  { label: 'Product Hunt',  url: 'https://www.producthunt.com',                                 hint: 'New product launches' },
  { label: 'G2',            url: 'https://www.g2.com/categories',                               hint: 'Software companies' },
]

const TEMPLATES = [
  'Find {type} companies in {city} with contact emails and decision-maker names.',
  'Search for {industry} startups with fewer than 50 employees.',
  'Find CEOs or Founders at {type} companies in {city}.',
  'Extract company listings with website, phone, and address.',
  'Find companies that recently raised funding in the {industry} space.',
]

const INPUT: React.CSSProperties = {
  width: '100%', background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0f172a',
  boxSizing: 'border-box',
}

export function ScrapeModal({ projectId, agentId, onClose, onStarted }: Props) {
  const [url, setUrl] = useState('')
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)

  async function start() {
    if (!instruction.trim()) return
    setLoading(true)
    await fetch('/api/leads/scrape', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() || undefined, instruction: instruction.trim(), projectId, agentId }),
    })
    setLoading(false)
    onStarted()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,23,42,0.4)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
        width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Find leads</div>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Tell the agent where to look and what to find.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94a3b8', cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {/* Quick sources */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Quick sources
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_SOURCES.map(s => (
                <button
                  key={s.label}
                  onClick={() => { setUrl(s.url); if (!instruction) setInstruction(s.hint) }}
                  title={s.hint}
                  style={{
                    background: url === s.url ? '#eef2ff' : '#f8fafc',
                    border: `1px solid ${url === s.url ? '#c7d2fe' : '#e2e8f0'}`,
                    borderRadius: 6, color: url === s.url ? '#6366f1' : '#64748b',
                    fontSize: 12, fontWeight: url === s.url ? 600 : 400,
                    padding: '5px 11px', cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                  type="button"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
              Starting URL <span style={{ color: '#cbd5e1' }}>(optional — leave blank to let the agent decide)</span>
            </label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" style={INPUT} />
          </div>

          {/* Instruction */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
              Research instruction <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="e.g. Find plumbing companies in Barcelona with contact emails and owner names."
              rows={3}
              style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* Templates */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 6 }}>Templates</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {TEMPLATES.map(t => (
                <button key={t} onClick={() => setInstruction(t)} type="button" style={{
                  background: 'none', border: 'none', padding: '3px 0',
                  textAlign: 'left', cursor: 'pointer',
                  fontSize: 12, color: '#94a3b8',
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                  <span style={{ color: '#cbd5e1', flexShrink: 0 }}>→</span>
                  <span style={{ lineHeight: 1.4 }}>{t}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={start} disabled={loading || !instruction.trim()}>
              {loading ? 'Starting…' : 'Start research'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
