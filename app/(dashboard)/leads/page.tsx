'use client'
import { useEffect, useState } from 'react'
import type { Lead } from '@/lib/leads'
import { LeadTable } from '@/components/leads/LeadTable'
import { ScrapeModal } from '@/components/leads/ScrapeModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// We still reference Lead from db/schema for agents — keep that import for agents only
import type { Agent } from '@/lib/db/schema'

const BLANK = { company_name: '', contact_name: '', email: '', phone: '', website: '', city: '', country: '' }

const INPUT: React.CSSProperties = {
  width: '100%', background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0f172a',
  boxSizing: 'border-box',
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'discovered', label: 'Discovered' },
]

const SCORE_COLOR = (score: number | null): string => {
  if (score === null) return '#94a3b8'
  if (score > 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#94a3b8'
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [projectId, setProjectId] = useState('')
  const [showScrape, setShowScrape] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newLead, setNewLead] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function load(pid: string) {
    const [l, a] = await Promise.all([
      fetch(`/api/leads?project_id=${pid}`).then(r => r.json()),
      fetch(`/api/agents?projectId=${pid}`).then(r => r.json()),
    ])
    setLeads(l.leads ?? [])
    setAgents(a.agents ?? [])
  }

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      const pid = d.projects?.[0]?.id
      if (pid) { setProjectId(pid); load(pid) }
    }).catch(() => {})
  }, [])

  const researchAgent = agents.find((a: Agent) => a.name === 'Research Agent')

  async function addLead() {
    if (!newLead.company_name.trim() || !projectId) return
    setSaving(true)
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newLead, project_id: projectId, created_by_role: 'manual' }),
    })
    setNewLead(BLANK)
    setShowAdd(false)
    setSaving(false)
    load(projectId)
  }

  async function updateStatus(lead: Lead, status: string) {
    setUpdatingId(lead.id)
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status } : l))
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredLeads = statusFilter
    ? leads.filter(l => l.status === statusFilter)
    : leads

  return (
    <div style={{ padding: '40px 32px' }} className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Leads
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {leads.length > 0 ? `${leads.length} leads in pipeline` : 'Build your prospect pipeline'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={() => { setShowAdd(v => !v); setShowScrape(false) }}>
            {showAdd ? 'Cancel' : '+ Add manually'}
          </Button>
          <Button variant="primary" onClick={() => { setShowScrape(true); setShowAdd(false) }}>
            + Scrape leads
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f1f5f9', marginBottom: 20 }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 14px', fontSize: 12,
              fontWeight: statusFilter === tab.value ? 600 : 400,
              color: statusFilter === tab.value ? '#0f172a' : '#94a3b8',
              borderBottom: statusFilter === tab.value ? '2px solid #0f172a' : '2px solid transparent',
              whiteSpace: 'nowrap',
              transition: 'color 0.1s',
            }}
          >
            {tab.label}
            {tab.value === '' && (
              <span style={{ marginLeft: 5, fontSize: 10, color: '#94a3b8' }}>({leads.length})</span>
            )}
            {tab.value !== '' && (
              <span style={{ marginLeft: 5, fontSize: 10, color: '#94a3b8' }}>
                ({leads.filter(l => l.status === tab.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <Card style={{ marginBottom: 20 }} padding={18}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>New lead</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            {([
              { field: 'company_name', label: 'Company *', placeholder: 'Acme Corp' },
              { field: 'contact_name', label: 'Contact',   placeholder: 'Jane Smith' },
              { field: 'email',        label: 'Email',     placeholder: 'jane@acme.com' },
              { field: 'phone',        label: 'Phone',     placeholder: '+1 555 000 0000' },
              { field: 'website',      label: 'Website',   placeholder: 'acme.com' },
              { field: 'city',         label: 'City',      placeholder: 'Barcelona' },
              { field: 'country',      label: 'Country',   placeholder: 'Spain' },
            ] as const).map(({ field, label, placeholder }) => (
              <div key={field}>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  value={newLead[field]}
                  onChange={e => setNewLead(p => ({ ...p, [field]: e.target.value }))}
                  placeholder={placeholder}
                  style={INPUT}
                  onKeyDown={e => e.key === 'Enter' && addLead()}
                />
              </div>
            ))}
          </div>
          <Button variant="primary" onClick={addLead} disabled={saving || !newLead.company_name.trim()}>
            {saving ? 'Adding…' : 'Add lead'}
          </Button>
        </Card>
      )}

      {/* Extended lead list */}
      {filteredLeads.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', padding: '20px 0' }}>
          {statusFilter ? `No leads with status "${statusFilter}".` : 'No leads yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredLeads.map(lead => (
            <div key={lead.id} style={{
              background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 10,
              padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}>
              {/* Score badge */}
              {lead.score !== null && (
                <div style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: 8,
                  background: SCORE_COLOR(lead.score) + '18',
                  border: `1px solid ${SCORE_COLOR(lead.score)}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: SCORE_COLOR(lead.score),
                  fontFamily: 'DM Mono, monospace',
                }}>
                  {lead.score}
                </div>
              )}

              {/* Main content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    {lead.company_name}
                  </span>
                  {lead.category && (
                    <span style={{
                      fontSize: 9, fontWeight: 600, background: '#eef2ff', color: '#6366f1',
                      borderRadius: 4, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {lead.category}
                    </span>
                  )}
                  <span style={{
                    fontSize: 9, fontWeight: 600,
                    background: lead.status === 'approved' ? '#f0fdf4' : lead.status === 'rejected' ? '#fef2f2' : lead.status === 'needs_review' ? '#fffbeb' : '#f8fafc',
                    color: lead.status === 'approved' ? '#15803d' : lead.status === 'rejected' ? '#dc2626' : lead.status === 'needs_review' ? '#92400e' : '#64748b',
                    borderRadius: 4, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {lead.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                  {lead.location && (
                    <span style={{ fontSize: 11, color: '#64748b' }}>{lead.location}</span>
                  )}
                  {lead.website && (
                    <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                       target="_blank" rel="noopener noreferrer"
                       style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
                      {lead.website}
                    </a>
                  )}
                  {lead.email && (
                    <span style={{ fontSize: 11, color: '#64748b' }}>{lead.email}</span>
                  )}
                </div>
                {lead.source_text && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' }}>
                    {lead.source_text.slice(0, 100)}{lead.source_text.length > 100 ? '…' : ''}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                {lead.status !== 'approved' && (
                  <button
                    onClick={() => updateStatus(lead, 'approved')}
                    disabled={updatingId === lead.id}
                    style={{
                      background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                      borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                      cursor: updatingId === lead.id ? 'not-allowed' : 'pointer', opacity: updatingId === lead.id ? 0.6 : 1,
                    }}
                  >
                    Approve
                  </button>
                )}
                {lead.status !== 'rejected' && (
                  <button
                    onClick={() => updateStatus(lead, 'rejected')}
                    disabled={updatingId === lead.id}
                    style={{
                      background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                      borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                      cursor: updatingId === lead.id ? 'not-allowed' : 'pointer', opacity: updatingId === lead.id ? 0.6 : 1,
                    }}
                  >
                    Reject
                  </button>
                )}
                {lead.status !== 'archived' && (
                  <button
                    onClick={() => updateStatus(lead, 'archived')}
                    disabled={updatingId === lead.id}
                    style={{
                      background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0',
                      borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                      cursor: updatingId === lead.id ? 'not-allowed' : 'pointer', opacity: updatingId === lead.id ? 0.6 : 1,
                    }}
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legacy LeadTable (hidden when extended list is showing, but keep for reference) */}
      <div style={{ display: 'none' }}>
        <LeadTable
          leads={leads as unknown as import('@/lib/db/schema').Lead[]}
          agentId={researchAgent?.id}
          projectId={projectId}
          onAction={() => load(projectId)}
        />
      </div>

      {showScrape && projectId && researchAgent && (
        <ScrapeModal
          projectId={projectId}
          agentId={researchAgent.id}
          onClose={() => setShowScrape(false)}
          onStarted={() => setTimeout(() => load(projectId), 2500)}
        />
      )}
    </div>
  )
}
