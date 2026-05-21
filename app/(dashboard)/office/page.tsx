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
      return { provider: 'Default', model: 'Fallback model', tone: '#666', source: 'Fallback' as const }
    }

    return {
      provider: providerLabel(cfg.base_url),
      model: cfg.model,
      tone: cfg.base_url.toLowerCase().includes('localhost') ? '#7eb88a' : '#8aa7d6',
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
    <div style={{ padding: 24, fontFamily: 'DM Mono, monospace' }}>
      <h2 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', marginBottom: 16, letterSpacing: '0.05em' }}>
        Live Office
      </h2>

      <div style={{ marginBottom: 16, border: '1px solid #272117', borderRadius: 4, background: '#13100d', padding: '10px 12px', fontSize: 10, color: '#c8b58c' }}>
        Approval-first safety: agents can research and draft, but external sending still requires explicit approval in Approval Center.
      </div>

      <div style={{ marginBottom: 16, border: '1px solid #1a1a1a', borderRadius: 4, background: '#101010', padding: '10px 12px' }}>
        <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Company flow</div>
        <div style={{ fontSize: 10, color: '#8a8a8a', lineHeight: 1.7 }}>
          Client<br />
          ↑<br />
          CEO Agent<br />
          ↑<br />
          Strategy Agent / Project Manager Agent<br />
          ↑<br />
          Research / Leads / Copywriting / Outreach / Reporting / Quality
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: '#777' }}>
          AÏKO works like a small marketing company. Agents report work upward before anything reaches the client.
        </div>
      </div>


      {/* Agent table */}
      <div style={{ border: '1px solid #222', borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#111', borderBottom: '1px solid #222' }}>
              {['', 'Agent', 'Role', 'Reports to', 'AI Model', 'Status', 'Current task', 'Progress', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', color: '#444', fontSize: 9, textAlign: 'left', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => {
              const assignment = modelAssignment(agent.name)
              return (
                <tr key={agent.id} style={{ borderBottom: '1px solid #1a1a1a', background: agent.status !== 'idle' ? '#0d0d0d' : 'transparent' }}>
                <td style={{ padding: '8px 12px' }}><StatusDot status={agent.status} /></td>
                <td style={{ padding: '8px 12px', fontSize: 11, color: '#e8e6e0' }}>{agent.name}</td>
                <td style={{ padding: '8px 12px', fontSize: 10, color: '#666' }}>{agent.role}</td>
                <td style={{ padding: '8px 12px', fontSize: 10, color: '#8a8a8a', minWidth: 130 }}>{REPORTS_TO[agent.name] ?? 'CEO Agent'}</td>
                <td style={{ padding: '8px 12px', minWidth: 180 }}>
                  <div style={{ fontSize: 9, color: assignment.tone }}>{assignment.provider}</div>
                  <div style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>{assignment.model}</div>
                  <span style={{ fontSize: 9, color: assignment.source === 'Configured' ? '#8e8e8e' : '#6a6a6a', border: '1px solid #2a2a2a', borderRadius: 999, padding: '1px 6px' }}>
                    {assignment.source}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}><Badge label={agent.status} /></td>
                <td style={{ padding: '8px 12px', fontSize: 10, color: '#888', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.current_task ?? '—'}
                </td>
                <td style={{ padding: '8px 12px', minWidth: 80 }}>
                  <div style={{ height: 2, background: '#222', borderRadius: 1 }}>
                    <div style={{ height: '100%', width: `${agent.progress}%`, background: '#7eb88a', borderRadius: 1, transition: 'width 0.5s' }} />
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
          <div style={{ marginBottom: 8, fontSize: 10, color: '#8a8a8a' }}>
            Live browser session: {browsingAgent.name} is actively navigating websites.
          </div>
          <BrowserStream agentId={browsingAgent.id} active={true} />
        </div>
      )}

      {/* Instruction input */}
      <div style={{ border: '1px solid #1a1a1a', borderRadius: 4, padding: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Direction update</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select
            value={selectedAgentId}
            onChange={e => setSelectedAgentId(e.target.value)}
            style={{
              background: '#111', border: '1px solid #222', borderRadius: 3,
              padding: '7px 10px', color: '#e8e6e0', fontFamily: 'DM Mono, monospace', fontSize: 10,
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
              flex: 1, background: '#111', border: '1px solid #222', borderRadius: 3,
              padding: '7px 12px', color: '#e8e6e0', fontFamily: 'DM Mono, monospace', fontSize: 11,
            }}
          />

          <Button variant="primary" onClick={sendInstruction} disabled={evaluating}>
            {evaluating ? 'Evaluating…' : 'Evaluate & run'}
          </Button>
        </div>

        <div style={{ marginBottom: 8, fontSize: 10, color: '#777' }}>
          {selectedAgent ? `Target: ${selectedAgent.name} · ${modelAssignment(selectedAgent.name).provider} / ${modelAssignment(selectedAgent.name).model} · Status: ${selectedAgent.status}` : 'Select an agent to send a direction update.'}
        </div>

        {selectedAgent && (
          <div style={{ marginBottom: 8, fontSize: 10, color: '#6f6f6f' }}>
            Reporting path: {reportingPath(selectedAgent.name)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DIRECTION_TEMPLATES.map((template) => (
            <button
              key={template}
              onClick={() => setInstruction(template)}
              style={{ background: '#101010', border: '1px solid #222', borderRadius: 3, color: '#9a9a9a', fontSize: 10, padding: '4px 8px', cursor: 'pointer' }}
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
      <div style={{ border: '1px solid #1a1a1a', borderRadius: 4, padding: 12 }}>
        <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Activity</div>
        <ActivityFeed logs={logs} />
      </div>
    </div>
  )
}
