'use client'
import { useState } from 'react'
import { Lead } from '@/lib/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface LeadTableProps {
  leads: Lead[]
  agentId?: string
  onAction?: () => void
}

export function LeadTable({ leads, agentId, onAction }: LeadTableProps) {
  const [filter, setFilter] = useState('')

  const visible = leads.filter(l =>
    !filter ||
    l.company_name?.toLowerCase().includes(filter.toLowerCase()) ||
    l.city?.toLowerCase().includes(filter.toLowerCase()) ||
    l.status?.includes(filter.toLowerCase())
  )

  async function generateMessage(leadId: string) {
    if (!agentId) return
    const projectId = leads.find(l => l.id === leadId)?.project_id
    await fetch('/api/outreach/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, projectId, agentId, channel: 'email' }),
    })
    onAction?.()
  }

  async function enrich(leadId: string) {
    if (!agentId) return
    const projectId = leads.find(l => l.id === leadId)?.project_id
    await fetch('/api/leads/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, projectId, agentId }),
    })
    onAction?.()
  }

  return (
    <div style={{ fontFamily: 'DM Mono, monospace' }}>
      <input
        placeholder="Filter by company, city, or status…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        style={{
          width: '100%',
          background: '#111',
          border: '1px solid #222',
          borderRadius: 3,
          padding: '7px 12px',
          color: '#e8e6e0',
          fontFamily: 'DM Mono, monospace',
          fontSize: 11,
          marginBottom: 12,
          boxSizing: 'border-box',
        }}
      />

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #222' }}>
              {['Company', 'Contact', 'Email', 'City', 'Status', 'Source', ''].map(h => (
                <th key={h} style={{ padding: '6px 8px', color: '#666', textAlign: 'left', letterSpacing: '0.1em', fontSize: 9, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(lead => (
              <tr key={lead.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                <td style={{ padding: '8px', color: '#e8e6e0' }}>{lead.company_name ?? '—'}</td>
                <td style={{ padding: '8px', color: '#888' }}>{lead.contact_name ?? '—'}</td>
                <td style={{ padding: '8px', color: '#7098c8' }}>{lead.email ?? '—'}</td>
                <td style={{ padding: '8px', color: '#888' }}>{lead.city ?? '—'}</td>
                <td style={{ padding: '8px' }}><Badge label={lead.status} /></td>
                <td style={{ padding: '8px', color: '#444' }}>{lead.source ?? '—'}</td>
                <td style={{ padding: '8px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="sm" variant="ghost" onClick={() => generateMessage(lead.id)}>Message</Button>
                    <Button size="sm" variant="ghost" onClick={() => enrich(lead.id)}>Enrich</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div style={{ padding: '16px 8px', color: '#333', fontSize: 11 }}>No leads found.</div>
        )}
      </div>
    </div>
  )
}
