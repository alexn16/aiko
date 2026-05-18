'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface ScrapeModalProps {
  projectId: string
  agentId: string
  onClose: () => void
  onStarted: () => void
}

export function ScrapeModal({ projectId, agentId, onClose, onStarted }: ScrapeModalProps) {
  const [url, setUrl] = useState('')
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)

  async function start() {
    setLoading(true)
    await fetch('/api/leads/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, instruction, projectId, agentId }),
    })
    setLoading(false)
    onStarted()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0a0acc', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#111', border: '1px solid #222', borderRadius: 4,
        padding: 24, width: 480, fontFamily: 'DM Mono, monospace',
      }}>
        <div style={{ fontSize: 13, color: '#e8e6e0', marginBottom: 16, letterSpacing: '0.05em' }}>
          Start Scraping
        </div>

        <label style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
          URL (optional)
        </label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com/directory"
          style={{
            width: '100%', background: '#0a0a0a', border: '1px solid #1a1a1a',
            borderRadius: 3, padding: '7px 10px', color: '#e8e6e0',
            fontFamily: 'DM Mono, monospace', fontSize: 10, marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />

        <label style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
          Instruction
        </label>
        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="Find all plumbing companies in Vigo with contact emails…"
          rows={4}
          style={{
            width: '100%', background: '#0a0a0a', border: '1px solid #1a1a1a',
            borderRadius: 3, padding: '7px 10px', color: '#e8e6e0',
            fontFamily: 'DM Mono, monospace', fontSize: 10, resize: 'vertical',
            marginBottom: 16, boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={start} disabled={loading || (!url && !instruction)}>
            {loading ? 'Starting…' : 'Start'}
          </Button>
        </div>
      </div>
    </div>
  )
}
