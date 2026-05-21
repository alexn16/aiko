'use client'
import { useState } from 'react'
import { Lead } from '@/lib/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface LeadTableProps {
  leads: Lead[]
  agentId?: string
  projectId?: string
  onAction?: () => void
}

function exportCsv(leads: Lead[]) {
  const headers = ['Company', 'Contact', 'Email', 'Phone', 'City', 'Country', 'Website', 'Status', 'Source', 'Notes']
  const rows = leads.map(l => [
    l.company_name, l.contact_name, l.email, l.phone,
    l.city, l.country, l.website, l.status, l.source, l.notes,
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function LeadTable({ leads, agentId, projectId, onAction }: LeadTableProps) {
  const [filter, setFilter] = useState('')
  const [loadingRows, setLoadingRows] = useState<Record<string, 'enriching' | 'messaging' | null>>({})
  const [channelOverride, setChannelOverride] = useState<Record<string, string>>({})

  const visible = leads.filter(l =>
    !filter ||
    l.company_name?.toLowerCase().includes(filter.toLowerCase()) ||
    l.city?.toLowerCase().includes(filter.toLowerCase()) ||
    l.email?.toLowerCase().includes(filter.toLowerCase()) ||
    l.status?.includes(filter.toLowerCase())
  )

  async function generateMessage(leadId: string) {
    if (!agentId) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    const channel = channelOverride[leadId] ?? 'email'
    setLoadingRows(prev => ({ ...prev, [leadId]: 'messaging' }))
    await fetch('/api/outreach/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, projectId: lead.project_id, agentId, channel }),
    })
    setLoadingRows(prev => ({ ...prev, [leadId]: null }))
    onAction?.()
  }

  async function enrich(leadId: string) {
    if (!agentId) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    setLoadingRows(prev => ({ ...prev, [leadId]: 'enriching' }))
    await fetch('/api/leads/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, projectId: lead.project_id, agentId }),
    })
    setLoadingRows(prev => ({ ...prev, [leadId]: null }))
    onAction?.()
  }

  async function bulkEnrich() {
    if (!agentId) return
    const missing = leads.filter(l => !l.email)
    for (const lead of missing.slice(0, 5)) {
      await enrich(lead.id)
    }
  }

  const selectStyle: React.CSSProperties = {
    background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 3,
    color: '#6b7280', fontFamily: 'Inter, sans-serif', fontSize: 12, padding: '3px 6px',
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Filter by company, city, email, status…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            flex: 1, minWidth: 200, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 4,
            padding: '7px 12px', color: '#374151', fontFamily: 'Inter, sans-serif', fontSize: 13,
            boxSizing: 'border-box',
          }}
        />
        {leads.some(l => !l.email) && (
          <Button size="sm" variant="ghost" onClick={bulkEnrich}>
            Enrich missing ({leads.filter(l => !l.email).length})
          </Button>
        )}
        {leads.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => exportCsv(visible)}>
            Export CSV ({visible.length})
          </Button>
        )}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, background: '#ffffff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Company', 'Contact', 'Email', 'Phone', 'City', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '7px 10px', color: '#9ca3af', textAlign: 'left', letterSpacing: '0.08em', fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(lead => {
              const rowState = loadingRows[lead.id]
              return (
                <tr key={lead.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: rowState ? 0.7 : 1 }}>
                  <td style={{ padding: '8px 10px', color: '#111827', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.website
                      ? <a href={lead.website} target="_blank" rel="noreferrer" style={{ color: '#111827', textDecoration: 'none' }}>{lead.company_name ?? '—'}</a>
                      : (lead.company_name ?? '—')}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>{lead.contact_name ?? '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#2563eb', whiteSpace: 'nowrap' }}>{lead.email ?? '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>{lead.phone ?? '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>{lead.city ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}><Badge label={lead.status} /></td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <select
                        value={channelOverride[lead.id] ?? 'email'}
                        onChange={e => setChannelOverride(prev => ({ ...prev, [lead.id]: e.target.value }))}
                        style={selectStyle}
                      >
                        {['email', 'linkedin', 'whatsapp', 'form'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => generateMessage(lead.id)} disabled={!!rowState}>
                        {rowState === 'messaging' ? '…' : 'Message'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => enrich(lead.id)} disabled={!!rowState}>
                        {rowState === 'enriching' ? '…' : 'Enrich'}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div style={{ padding: '16px 10px', color: '#9ca3af', fontSize: 13 }}>
            {filter ? `No leads match "${filter}".` : 'No leads yet. Use "+ Start scraping" to find leads.'}
          </div>
        )}
      </div>
    </div>
  )
}
