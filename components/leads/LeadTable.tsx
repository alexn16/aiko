'use client'
import { useState } from 'react'
import { Lead } from '@/lib/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface Props { leads: Lead[]; agentId?: string; projectId?: string; onAction?: () => void }

function exportCsv(leads: Lead[]) {
  const headers = ['Company', 'Contact', 'Email', 'Phone', 'City', 'Country', 'Website', 'Status', 'Source']
  const rows = leads.map(l =>
    [l.company_name, l.contact_name, l.email, l.phone, l.city, l.country, l.website, l.status, l.source]
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  )
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function LeadTable({ leads, agentId, projectId, onAction }: Props) {
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState<Record<string, 'enriching' | 'messaging' | null>>({})
  const [channels, setChannels] = useState<Record<string, string>>({})

  const visible = leads.filter(l =>
    !filter ||
    [l.company_name, l.city, l.email, l.status].some(v => v?.toLowerCase().includes(filter.toLowerCase()))
  )

  async function enrich(leadId: string) {
    if (!agentId) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    setLoading(p => ({ ...p, [leadId]: 'enriching' }))
    await fetch('/api/leads/enrich', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, projectId: lead.project_id, agentId }),
    })
    setLoading(p => ({ ...p, [leadId]: null }))
    onAction?.()
  }

  async function generateMessage(leadId: string) {
    if (!agentId) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    const channel = channels[leadId] ?? 'email'
    setLoading(p => ({ ...p, [leadId]: 'messaging' }))
    await fetch('/api/outreach/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, projectId: lead.project_id, agentId, channel }),
    })
    setLoading(p => ({ ...p, [leadId]: null }))
    onAction?.()
  }

  async function bulkEnrich() {
    for (const lead of leads.filter(l => !l.email).slice(0, 5)) await enrich(lead.id)
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Filter by company, city, email, status…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            flex: 1, minWidth: 220, background: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0f172a',
            boxSizing: 'border-box',
          }}
        />
        {leads.some(l => !l.email) && (
          <Button size="sm" variant="ghost" onClick={bulkEnrich}>
            Enrich {leads.filter(l => !l.email).length} missing
          </Button>
        )}
        {leads.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => exportCsv(visible)}>
            Export CSV ({visible.length})
          </Button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} className="data-table">
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['Company', 'Contact', 'Email', 'Phone', 'City', 'Status', ''].map(h => (
                <th key={h} style={{
                  padding: '9px 14px', fontSize: 11, fontWeight: 500, color: '#94a3b8',
                  textAlign: 'left', borderBottom: '1px solid #f1f5f9',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((lead, i) => {
              const state = loading[lead.id]
              return (
                <tr key={lead.id} style={{
                  borderBottom: i < visible.length - 1 ? '1px solid #f8fafc' : 'none',
                  opacity: state ? 0.65 : 1, transition: 'opacity 0.2s',
                }}>
                  <td style={{ padding: '10px 14px', maxWidth: 180 }}>
                    {lead.website
                      ? <a href={lead.website} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', textDecoration: 'none' }}>{lead.company_name ?? '—'}</a>
                      : <span style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{lead.company_name ?? '—'}</span>
                    }
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{lead.contact_name ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#3b82f6', whiteSpace: 'nowrap' }}>{lead.email ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{lead.phone ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{lead.city ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}><Badge label={lead.status} /></td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <select
                        value={channels[lead.id] ?? 'email'}
                        onChange={e => setChannels(p => ({ ...p, [lead.id]: e.target.value }))}
                        style={{
                          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5,
                          fontSize: 11, color: '#64748b', padding: '3px 6px',
                        }}
                      >
                        {['email', 'linkedin', 'whatsapp', 'form'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => generateMessage(lead.id)} disabled={!!state}>
                        {state === 'messaging' ? '…' : 'Draft'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => enrich(lead.id)} disabled={!!state}>
                        {state === 'enriching' ? '…' : 'Enrich'}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div style={{ padding: '40px 14px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
            {filter ? `No leads match "${filter}"` : 'No leads yet — use "+ Scrape leads" to start building your pipeline.'}
          </div>
        )}
      </div>
    </div>
  )
}
