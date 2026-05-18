'use client'
import { useEffect, useState } from 'react'
import { Agent, AgentLog } from '@/lib/db/schema'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { BrowserStream } from '@/components/agents/BrowserStream'
import { ActivityFeed } from '@/components/agents/ActivityFeed'

export default function OfficePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [projectId, setProjectId] = useState('')
  const [instruction, setInstruction] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [browsingAgent, setBrowsingAgent] = useState<Agent | null>(null)

  useEffect(() => {
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

  async function sendInstruction() {
    if (!instruction || !selectedAgentId || !projectId) return
    await fetch('/api/agents/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: selectedAgentId, projectId, instruction }),
    })
    setInstruction('')
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
      <h2 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', marginBottom: 24, letterSpacing: '0.05em' }}>
        Live Office
      </h2>

      {/* Agent table */}
      <div style={{ border: '1px solid #222', borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#111', borderBottom: '1px solid #222' }}>
              {['', 'Agent', 'Role', 'Status', 'Current task', 'Progress', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', color: '#444', fontSize: 9, textAlign: 'left', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => (
              <tr key={agent.id} style={{ borderBottom: '1px solid #1a1a1a', background: agent.status !== 'idle' ? '#0d0d0d' : 'transparent' }}>
                <td style={{ padding: '8px 12px' }}><StatusDot status={agent.status} /></td>
                <td style={{ padding: '8px 12px', fontSize: 11, color: '#e8e6e0' }}>{agent.name}</td>
                <td style={{ padding: '8px 12px', fontSize: 10, color: '#666' }}>{agent.role}</td>
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Browser stream */}
      {browsingAgent && (
        <div style={{ marginBottom: 24, maxWidth: 680 }}>
          <BrowserStream agentId={browsingAgent.id} active={true} />
        </div>
      )}

      {/* Instruction input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
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
          placeholder="Tell an agent what to do…"
          style={{
            flex: 1, background: '#111', border: '1px solid #222', borderRadius: 3,
            padding: '7px 12px', color: '#e8e6e0', fontFamily: 'DM Mono, monospace', fontSize: 11,
          }}
        />

        <Button variant="primary" onClick={sendInstruction}>Send</Button>
      </div>

      {/* Activity feed */}
      <div style={{ border: '1px solid #1a1a1a', borderRadius: 4, padding: 12 }}>
        <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Activity</div>
        <ActivityFeed logs={logs} />
      </div>
    </div>
  )
}
