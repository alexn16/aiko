'use client'
import { useEffect, useState } from 'react'
import { Lead, Agent } from '@/lib/db/schema'
import { LeadTable } from '@/components/leads/LeadTable'
import { ScrapeModal } from '@/components/leads/ScrapeModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const BLANK_LEAD = { company_name: '', contact_name: '', email: '', phone: '', website: '', city: '', country: '' }

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [projectId, setProjectId] = useState('')
  const [showScrape, setShowScrape] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newLead, setNewLead] = useState(BLANK_LEAD)
  const [saving, setSaving] = useState(false)

  async function load(pid: string) {
    const [leadsRes, agentsRes] = await Promise.all([
      fetch(`/api/leads?projectId=${pid}`).then(r => r.json()),
      fetch(`/api/agents?projectId=${pid}`).then(r => r.json()),
    ])
    setLeads(leadsRes.leads ?? [])
    setAgents(agentsRes.agents ?? [])
  }

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      const pid = d.projects?.[0]?.id
      if (pid) { setProjectId(pid); load(pid) }
    }).catch(() => {})
  }, [])

  const researchAgent = agents.find(a => a.name === 'Research Agent')

  async function addLead() {
    if (!newLead.company_name.trim() || !projectId) return
    setSaving(true)
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newLead, projectId, source: 'manual' }),
    })
    setNewLead(BLANK_LEAD)
    setShowAdd(false)
    setSaving(false)
    load(projectId)
  }

  const inputStyle: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 3,
    padding: '6px 10px', color: '#e8e6e0', fontFamily: 'DM Mono, monospace',
    fontSize: 10, width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: 24, fontFamily: 'DM Mono, monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', margin: 0 }}>
          Leads
          <span style={{ fontSize: 11, color: '#444', fontFamily: 'DM Mono, monospace', marginLeft: 12 }}>
            {leads.length} total
          </span>
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={() => { setShowAdd(v => !v); setShowScrape(false) }}>
            {showAdd ? 'Cancel' : '+ Add manually'}
          </Button>
          <Button variant="primary" onClick={() => { setShowScrape(true); setShowAdd(false) }}>
            + Start scraping
          </Button>
        </div>
      </div>

      {/* Manual lead creation */}
      {showAdd && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14 }}>Add lead manually</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            {([
              { field: 'company_name', label: 'Company name *', placeholder: 'Acme Corp' },
              { field: 'contact_name', label: 'Contact name',   placeholder: 'Jane Smith' },
              { field: 'email',        label: 'Email',          placeholder: 'jane@acme.com' },
              { field: 'phone',        label: 'Phone',          placeholder: '+1 555 000 0000' },
              { field: 'website',      label: 'Website',        placeholder: 'https://acme.com' },
              { field: 'city',         label: 'City',           placeholder: 'Barcelona' },
              { field: 'country',      label: 'Country',        placeholder: 'Spain' },
            ] as const).map(({ field, label, placeholder }) => (
              <div key={field}>
                <label style={{ fontSize: 9, color: '#444', display: 'block', marginBottom: 4, letterSpacing: '0.08em' }}>{label.toUpperCase()}</label>
                <input
                  value={newLead[field]}
                  onChange={e => setNewLead(p => ({ ...p, [field]: e.target.value }))}
                  placeholder={placeholder}
                  style={inputStyle}
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

      <LeadTable
        leads={leads}
        agentId={researchAgent?.id}
        projectId={projectId}
        onAction={() => load(projectId)}
      />

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
