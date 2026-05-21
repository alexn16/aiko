'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface ScrapeModalProps {
  projectId: string
  agentId: string
  onClose: () => void
  onStarted: () => void
}

const QUICK_SOURCES = [
  { label: 'Google Maps',      instruction: 'Find businesses on Google Maps.',      url: 'https://www.google.com/maps' },
  { label: 'LinkedIn',         instruction: 'Search for companies on LinkedIn.',     url: 'https://www.linkedin.com/search/results/companies/' },
  { label: 'Crunchbase',       instruction: 'Find startups and companies on Crunchbase.', url: 'https://www.crunchbase.com/discover/organizations' },
  { label: 'Y Combinator',     instruction: 'Find YC portfolio companies.',          url: 'https://www.ycombinator.com/companies' },
  { label: 'Wellfound',        instruction: 'Find startups on Wellfound (AngelList).', url: 'https://wellfound.com/startups' },
  { label: 'Clutch',           instruction: 'Find agencies and service companies on Clutch.', url: 'https://clutch.co' },
  { label: 'Yellow Pages',     instruction: 'Find local businesses on Yellow Pages.', url: 'https://www.yellowpages.com' },
  { label: 'Europages',        instruction: 'Find European B2B companies.',          url: 'https://www.europages.com' },
  { label: 'Product Hunt',     instruction: 'Find new product launches and startups.', url: 'https://www.producthunt.com' },
  { label: 'G2',               instruction: 'Find software companies listed on G2.', url: 'https://www.g2.com/categories' },
]

const INSTRUCTION_TEMPLATES = [
  'Find all {type} companies in {city} with email addresses and contact names.',
  'Search for {industry} startups with fewer than 50 employees.',
  'Find decision makers (CEO, Founder, or Head of Marketing) at {type} companies.',
  'Extract all company listings including website, phone, and address.',
  'Find companies that recently raised funding in the {industry} space.',
]

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#ffffff', border: '1px solid #e5e7eb',
  borderRadius: 4, padding: '7px 10px', color: '#374151',
  fontFamily: 'Inter, sans-serif', fontSize: 13, boxSizing: 'border-box',
}

export function ScrapeModal({ projectId, agentId, onClose, onStarted }: ScrapeModalProps) {
  const [url, setUrl] = useState('')
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)

  async function start() {
    if (!instruction.trim()) return
    setLoading(true)
    await fetch('/api/leads/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() || undefined, instruction: instruction.trim(), projectId, agentId }),
    })
    setLoading(false)
    onStarted()
    onClose()
  }

  function applySource(source: typeof QUICK_SOURCES[0]) {
    setUrl(source.url)
    if (!instruction) setInstruction(source.instruction)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8,
        padding: 24, width: 560, maxHeight: '90vh', overflowY: 'auto',
        fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: '#111827', marginBottom: 16 }}>
          Start Scraping
        </div>

        {/* Quick sources */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Quick sources
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_SOURCES.map(s => (
              <button
                key={s.label}
                onClick={() => applySource(s)}
                style={{
                  background: url === s.url ? '#f0fdf4' : '#f9fafb',
                  border: `1px solid ${url === s.url ? '#bbf7d0' : '#e5e7eb'}`,
                  borderRadius: 4, color: url === s.url ? '#16a34a' : '#6b7280',
                  fontFamily: 'Inter, sans-serif', fontSize: 12,
                  padding: '5px 10px', cursor: 'pointer',
                }}
                type="button"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* URL */}
        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>
          Starting URL (optional — leave blank to let the agent choose)
        </label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://www.google.com/maps/search/restaurants+in+Barcelona"
          style={{ ...inputStyle, marginBottom: 14 }}
        />

        {/* Instruction */}
        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>
          Research instruction *
        </label>
        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="Find all plumbing companies in Barcelona with contact emails and owner names."
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', marginBottom: 10 }}
        />

        {/* Instruction templates */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 5 }}>Templates:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {INSTRUCTION_TEMPLATES.map(t => (
              <button
                key={t}
                onClick={() => setInstruction(t)}
                style={{
                  background: 'transparent', border: 'none', color: '#9ca3af',
                  fontFamily: 'Inter, sans-serif', fontSize: 12, cursor: 'pointer',
                  textAlign: 'left', padding: '2px 0',
                }}
                type="button"
              >
                → {t}
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
  )
}
