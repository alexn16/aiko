'use client'
import { useEffect, useMemo, useState } from 'react'
import { Agent, AgentLog } from '@/lib/db/schema'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { BrowserStream } from '@/components/agents/BrowserStream'
import { ActivityFeed } from '@/components/agents/ActivityFeed'
import { JobEvaluationCard } from '@/components/jobs/JobEvaluation'
import type { JobEvaluation } from '@/lib/agents/evaluator-agent'


interface ModelRow { base_url: string; model: string }

const AGENT_NAME_TO_SLOT: Record<string, string> = {
  'Browser Agent': 'browserAgent',
  'Research Agent': 'researchAgent',
  'Copywriting Agent': 'copywritingAgent',
  'Lead Gen Agent': 'leadGenAgent',
  'Outreach Agent': 'outreachAgent',
  'Strategy Agent': 'strategyAgent',
  'Reporting Agent': 'reportingAgent',
  'Quality Agent': 'qualityAgent',
  'Sales Validation Agent': 'salesValidationAgent',
  'CEO Agent': 'ceoAgent',
  'Project Manager Agent': 'projectManagerAgent',
  'Social Media Agent': 'socialMediaAgent',
}

function providerLabel(baseURL: string | undefined): string {
  if (!baseURL) return 'Default'
  const lower = baseURL.toLowerCase()
  if (lower.includes('localhost:11434') || lower.includes('ollama')) return 'Local / Ollama'
  if (lower.includes('openai')) return 'OpenAI'
  if (lower.includes('anthropic')) return 'Anthropic-compatible'
  if (lower.includes('groq')) return 'Groq'
  if (lower.includes('mistral')) return 'Mistral'
  if (lower.includes('lmstudio')) return 'Local / LM Studio'
  return 'Custom endpoint'
}


const REPORTS_TO: Record<string, string> = {
  'CEO Agent': 'Client',
  'Strategy Agent': 'CEO Agent',
  'Project Manager Agent': 'CEO Agent',
  'Research Agent': 'Strategy Agent',
  'Browser Agent': 'Strategy Agent',
  'Lead Gen Agent': 'Strategy Agent',
  'Copywriting Agent': 'Strategy Agent',
  'Social Media Agent': 'Strategy Agent',
  'Outreach Agent': 'Project Manager Agent',
  'Sales Validation Agent': 'Project Manager Agent',
  'Reporting Agent': 'Project Manager Agent',
  'Quality Agent': 'CEO Agent',
}

function reportingPath(agentName: string): string {
  const manager = REPORTS_TO[agentName] ?? 'CEO Agent'
  if (manager === 'Client') return `${agentName} → Client`
  if (manager === 'CEO Agent') return `${agentName} → CEO Agent → Client`
  return `${agentName} → ${manager} → CEO Agent → Client`
}

const DIRECTION_TEMPLATES = [
  'Focus on lead research only and summarize findings.',
  'Change focus to decision-makers and verified contact details.',
  'Prepare outreach drafts only. Do not send anything.',
  'Pause navigation and summarize blockers with next best steps.',
]

export default function OfficePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [projectId, setProjectId] = useState('')
  const [instruction, setInstruction] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [browsingAgent, setBrowsingAgent] = useState<Agent | null>(null)
  const [modelConfigs, setModelConfigs] = useState<Record<string, ModelRow>>({})
  const [evaluating, setEvaluating] = useState(false)
  const [pendingEval, setPendingEval] = useState<{ jobId: string; evaluation: JobEvaluation } | null>(null)

  useEffect(() => {
    fetch('/api/model-configs').then(r => r.json()).then(d => setModelConfigs(d.configs ?? {})).catch(() => {})
    fetch('/api/projects').then(r => r.json()).then(d => {
      if (d.projects?.[0]?.id) setProjectId(d.projects[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!projectId) return
    const source = new EventSource(`/api/agents/stream?projectId=${projectId}`)
    source.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.agents) {
        setAgents(data.agents)
        setBrowsingAgent(data.agents.find((a: Agent) => a.status === 'browsing') ?? null)
      }
      if (data.logs) setLogs(data.logs)
    }
    return () => source.close()
  }, [projectId])

  useEffect(() => {
    if (!selectedAgentId && agents[0]?.id) {
      setSelectedAgentId(agents[0].id)
    }
  }, [agents, selectedAgentId])

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  )

  function modelAssignment(agentName: string) {
    const slot = AGENT_NAME_TO_SLOT[agentName]
    const cfg = slot ? modelConfigs[slot] : undefined
    if (!cfg || !cfg.base_url || !cfg.model) {
      return { provider: 'Default', model: 'Fallback model', tone: '#9ca3af', source: 'Fallback' as const }
    }

    return {
      provider: providerLabel(cfg.base_url),
      model: cfg.model,
      tone: cfg.base_url.toLowerCase().includes('localhost') ? '#16a34a' : '#2563eb',
      source: 'Configured' as const,
    }
  }

  async function sendInstruction() {
    if (!instruction.trim() || !projectId) return
    setEvaluating(true)
    const res = await fetch('/api/jobs/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction, projectId }),
    })
    const data = await res.json()
    setEvaluating(false)
    if (data.evaluation) {
      setPendingEval({ jobId: data.jobId, evaluation: data.evaluation })
    }
  }

  async function stopAgent(agentId: string) {
    await fetch('/api/agents/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    })
  }

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 18, color: '#111827', marginBottom: 16 }}>
        Live Office
      </h2>

      <div style={{ marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fffbeb', padding: '10px 12px', fontSize: 12, color: '#92400e' }}>
        Approval-first safety: agents can research and draft, but external sending still requires explicit approval in Approval Center.
      </div>

      <div style={{ marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 6, background: '#ffffff', padding: '12px 14px' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Company flow</div>
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8, fontFamily: 'DM Mono, monospace' }}>
          Client<br />
          ↑<br />
          CEO Agent<br />
          ↑<br />
          Strategy Agent / Project Manager Agent<br />
          ↑<br />
          Research / Leads / Copywriting / Outreach / Reporting / Quality
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
          AÏKO works like a small marketing company. Agents report work upward before anything reaches the client.
        </div>
      </div>


      {/* Agent table */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 24, overflow: 'hidden', background: '#ffffff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['', 'Agent', 'Role', 'Reports to', 'AI Model', 'Status', 'Current task', 'Progress', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', color: '#9ca3af', fontSize: 10, textAlign: 'left', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => {
              const assignment = modelAssignment(agent.name)
              return (
                <tr key={agent.id} style={{ borderBottom: '1px solid #f3f4f6', background: agent.status !== 'idle' ? '#f9fafb' : '#ffffff' }}>
                <td style={{ padding: '8px 12px' }}><StatusDot status={agent.status} /></td>
                <td style={{ padding: '8px 12px', fontSize: 13, color: '#111827' }}>{agent.name}</td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280' }}>{agent.role}</td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: '#9ca3af', minWidth: 130 }}>{REPORTS_TO[agent.name] ?? 'CEO Agent'}</td>
                <td style={{ padding: '8px 12px', minWidth: 180 }}>
                  <div style={{ fontSize: 10, color: assignment.tone, fontFamily: 'DM Mono, monospace' }}>{assignment.provider}</div>
                  <div style={{ fontSize: 11, color: '#374151', marginBottom: 3, fontFamily: 'DM Mono, monospace' }}>{assignment.model}</div>
                  <span style={{ fontSize: 9, color: assignment.source === 'Configured' ? '#6b7280' : '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 999, padding: '1px 6px', fontFamily: 'DM Mono, monospace' }}>
                    {assignment.source}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}><Badge label={agent.status} /></td>
                <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.current_task ?? '—'}
                </td>
                <td style={{ padding: '8px 12px', minWidth: 80 }}>
                  <div style={{ height: 3, background: '#e5e7eb', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${agent.progress}%`, background: '#16a34a', borderRadius: 2, transition: 'width 0.5s' }} />
                  </div>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {agent.status !== 'idle' && agent.status !== 'paused' && (
                    <Button size="sm" variant="danger" onClick={() => stopAgent(agent.id)}>Stop</Button>
                  )}
                </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Browser stream */}
      {browsingAgent && (
        <div style={{ marginBottom: 24, maxWidth: 680 }}>
          <div style={{ marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
            Live browser session: {browsingAgent.name} is actively navigating websites.
          </div>
          <BrowserStream agentId={browsingAgent.id} active={true} />
        </div>
      )}

      {/* Instruction input */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 14, marginBottom: 24, background: '#ffffff' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Direction update</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select
            value={selectedAgentId}
            onChange={e => setSelectedAgentId(e.target.value)}
            style={{
              background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 4,
              padding: '7px 10px', color: '#374151', fontFamily: 'Inter, sans-serif', fontSize: 13,
            }}
          >
            <option value="">Select agent…</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <input
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendInstruction()}
            placeholder="Tell an agent what to do or how to change focus…"
            style={{
              flex: 1, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 4,
              padding: '7px 12px', color: '#374151', fontFamily: 'Inter, sans-serif', fontSize: 13,
            }}
          />

          <Button variant="primary" onClick={sendInstruction} disabled={evaluating}>
            {evaluating ? 'Evaluating…' : 'Evaluate & run'}
          </Button>
        </div>

        <div style={{ marginBottom: 8, fontSize: 12, color: '#9ca3af' }}>
          {selectedAgent ? `Target: ${selectedAgent.name} · ${modelAssignment(selectedAgent.name).provider} / ${modelAssignment(selectedAgent.name).model} · Status: ${selectedAgent.status}` : 'Select an agent to send a direction update.'}
        </div>

        {selectedAgent && (
          <div style={{ marginBottom: 8, fontSize: 12, color: '#9ca3af' }}>
            Reporting path: {reportingPath(selectedAgent.name)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DIRECTION_TEMPLATES.map((template) => (
            <button
              key={template}
              onClick={() => setInstruction(template)}
              style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, color: '#6b7280', fontSize: 12, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              type="button"
            >
              {template}
            </button>
          ))}
        </div>
      </div>

      {/* Job evaluation card */}
      {pendingEval && (
        <div style={{ marginBottom: 24 }}>
          <JobEvaluationCard
            jobId={pendingEval.jobId}
            projectId={projectId}
            evaluation={pendingEval.evaluation}
            onApprove={() => { setPendingEval(null); setInstruction('') }}
            onCancel={() => setPendingEval(null)}
          />
        </div>
      )}

      {/* Activity feed */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 14, background: '#ffffff' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Activity</div>
        <ActivityFeed logs={logs} />
      </div>
    </div>
  )
}
