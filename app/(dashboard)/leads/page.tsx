'use client'
import { useEffect, useState } from 'react'
import { Lead, Agent } from '@/lib/db/schema'
import { LeadTable } from '@/components/leads/LeadTable'
import { ScrapeModal } from '@/components/leads/ScrapeModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const BLANK = { company_name: '', contact_name: '', email: '', phone: '', website: '', city: '', country: '' }

const INPUT: React.CSSProperties = {
  width: '100%', background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0f172a',
  boxSizing: 'border-box',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [projectId, setProjectId] = useState('')
  const [showScrape, setShowScrape] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newLead, setNewLead] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  async function load(pid: string) {
    const [l, a] = await Promise.all([
      fetch(`/api/leads?projectId=${pid}`).then(r => r.json()),
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

  const researchAgent = agents.find(a => a.name === 'Research Agent')

  async function addLead() {
    if (!newLead.company_name.trim() || !projectId) return
    setSaving(true)
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newLead, projectId, source: 'manual' }),
    })
    setNewLead(BLANK)
    setShowAdd(false)
    setSaving(false)
    load(projectId)
  }

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
