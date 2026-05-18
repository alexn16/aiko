'use client'
import { useEffect, useState } from 'react'
import { Lead, Agent } from '@/lib/db/schema'
import { LeadTable } from '@/components/leads/LeadTable'
import { ScrapeModal } from '@/components/leads/ScrapeModal'
import { Button } from '@/components/ui/Button'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [projectId, setProjectId] = useState('')
  const [showScrape, setShowScrape] = useState(false)

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

  return (
    <div style={{ padding: 24, fontFamily: 'DM Mono, monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', margin: 0 }}>
          Leads
        </h2>
        <Button variant="primary" onClick={() => setShowScrape(true)}>
          + Start scraping
        </Button>
      </div>

      <LeadTable
        leads={leads}
        agentId={researchAgent?.id}
        onAction={() => load(projectId)}
      />

      {showScrape && projectId && researchAgent && (
        <ScrapeModal
          projectId={projectId}
          agentId={researchAgent.id}
          onClose={() => setShowScrape(false)}
          onStarted={() => setTimeout(() => load(projectId), 2000)}
        />
      )}
    </div>
  )
}
