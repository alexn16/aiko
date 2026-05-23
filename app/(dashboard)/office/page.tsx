'use client'
import { useEffect, useMemo, useState } from 'react'
import { Agent, AgentLog } from '@/lib/db/schema'
import { StatusDot } from '@/components/ui/StatusDot'
import { Button } from '@/components/ui/Button'
import { BrowserStream } from '@/components/agents/BrowserStream'
import { ActivityFeed } from '@/components/agents/ActivityFeed'
import { InternalCommsPanel } from '@/components/agents/InternalCommsPanel'
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

function providerLabel(u?: string) {
  if (!u) return '—'
  const l = u.toLowerCase()
  if (l.includes('ollama') || l.includes('localhost:11434')) return 'Ollama'
  if (l.includes('openai')) return 'OpenAI'
  if (l.includes('groq')) return 'Groq'
  if (l.includes('mistral')) return 'Mistral'
  if (l.includes('lmstudio')) return 'LM Studio'
  return 'Custom'
}

const STATUS_COLOR: Record<string, string> = {
  active: '#10b981', browsing: '#10b981', writing: '#f59e0b',
  waiting: '#3b82f6', error: '#ef4444', idle: '#cbd5e1', paused: '#cbd5e1',
}

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
    const src = new EventSource(`/api/agents/stream?projectId=${projectId}`)
    src.onmessage = e => {
      const d = JSON.parse(e.data)
      if (d.agents) {
        setAgents(d.agents)
        setBrowsingAgent(d.agents.find((a: Agent) => a.status === 'browsing') ?? null)
      }
      if (d.logs) setLogs(d.logs)
    }
    return () => src.close()
  }, [projectId])

  useEffect(() => {
    if (!selectedAgentId && agents[0]?.id) setSelectedAgentId(agents[0].id)
  }, [agents, selectedAgentId])

  const selectedAgent = useMemo(() => agents.find(a => a.id === selectedAgentId) ?? null, [agents, selectedAgentId])

  function modelInfo(name: string) {
    const slot = AGENT_NAME_TO_SLOT[name]
    const cfg = slot ? modelConfigs[slot] : undefined
    if (!cfg?.model) return { provider: '—', model: 'not configured' }
    return { provider: providerLabel(cfg.base_url), model: cfg.model }
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
    if (data.evaluation) setPendingEval({ jobId: data.jobId, evaluation: data.evaluation })
  }

  async function stopAgent(agentId: string) {
    await fetch('/api/agents/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    })
  }

  return (
    <div style={{ padding: '40px 32px' }} className="page-enter">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
          Live Office
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Watch and direct your agents in real time. Nothing is sent without your approval.
        </p>
      </div>

      {/* Agent roster */}
      <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>Agent roster</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {agents.filter(a => a.status !== 'idle').length} of {agents.length} active
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} className="data-table">
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['', 'Agent', 'Reports to', 'Model', 'Task', 'Progress', ''].map(h => (
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
            {agents.map(agent => {
              const { provider, model } = modelInfo(agent.name)
              const statusColor = STATUS_COLOR[agent.status] ?? '#cbd5e1'
              return (
                <tr key={agent.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 14px', width: 24 }}>
                    <StatusDot status={agent.status} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{agent.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{agent.role}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                    {REPORTS_TO[agent.name] ?? 'CEO Agent'}
                  </td>
                  <td style={{ padding: '10px 14px', minWidth: 130 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#64748b' }}>{model}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{provider}</div>
                  </td>
                  <td style={{ padding: '10px 14px', maxWidth: 220 }}>
                    <div style={{
                      fontSize: 12, color: agent.current_task ? '#64748b' : '#cbd5e1',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {agent.current_task ?? 'idle'}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', minWidth: 80 }}>
                    <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2 }}>
                      <div style={{
                        height: '100%', width: `${agent.progress ?? 0}%`,
                        background: statusColor, borderRadius: 2, transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
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
        <div style={{ marginBottom: 20, maxWidth: 680 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
            {browsingAgent.name} is browsing
          </div>
          <BrowserStream agentId={browsingAgent.id} active={true} />
        </div>
      )}

      {/* Job evaluation */}
      {pendingEval && (
        <div style={{ marginBottom: 20 }}>
          <JobEvaluationCard
            jobId={pendingEval.jobId}
            projectId={projectId}
            evaluation={pendingEval.evaluation}
            onApprove={() => { setPendingEval(null); setInstruction('') }}
            onCancel={() => setPendingEval(null)}
          />
        </div>
      )}

      {/* Instruction input — ChatGPT style */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 10 }}>
          Send instruction
        </div>
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          padding: '4px 4px 4px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <select
            value={selectedAgentId}
            onChange={e => setSelectedAgentId(e.target.value)}
            style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
              padding: '6px 10px', fontSize: 12, color: '#374151', flexShrink: 0,
            }}
          >
            <option value="">Any agent</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendInstruction()}
            placeholder="Tell the team what to work on next…"
            style={{
              flex: 1, background: 'transparent', border: 'none',
              fontSize: 13, color: '#0f172a', outline: 'none', padding: '10px 0',
            }}
          />
          <Button
            variant="primary"
            size="md"
            style={{ borderRadius: 8, flexShrink: 0 }}
            onClick={sendInstruction}
            disabled={evaluating || !instruction.trim()}
          >
            {evaluating ? 'Evaluating…' : 'Run →'}
          </Button>
        </div>
        {selectedAgent && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, paddingLeft: 4 }}>
            Directing: {selectedAgent.name} · {modelInfo(selectedAgent.name).model}
          </div>
        )}
        {/* Quick templates */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            'Focus on lead research and summarize findings',
            'Find decision-makers with verified contact details',
            'Prepare outreach drafts only, do not send',
          ].map(t => (
            <button
              key={t}
              onClick={() => setInstruction(t)}
              style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 6, color: '#64748b', fontSize: 11,
                padding: '4px 10px', cursor: 'pointer',
              }}
              type="button"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Activity */}
      <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 18, marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Activity log</div>
        <ActivityFeed logs={logs} />
      </div>

      {/* Internal communications */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', margin: '0 0 16px' }}>
          Internal communications
        </h2>
        <InternalCommsPanel />
      </div>
    </div>
  )
}
