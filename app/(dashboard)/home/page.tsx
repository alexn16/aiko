'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Project = {
  id: string
  name: string
  target_market?: string | null
  goal?: string | null
}

type Operator = {
  id: string
  name: string
  status: string
  current_url: string | null
  current_task: string | null
  waiting_reason: string | null
  latest_screenshot?: string | null
}

type Action = {
  id: string
  action_type: string
  description: string
  status: string
  target_url: string | null
  page_title: string | null
  screenshot_url: string | null
  is_sensitive: boolean
  created_at: string
}

type ApprovalItem = {
  id: string
  title: string
  content?: string
  status: string
  project_name?: string | null
  item_type?: string
}

type CommandResult = {
  response?: string
  intent?: string
  project_id?: string | null
  delegation?: {
    status: string
    message: string
    actionId?: string
    operatorId?: string
  } | null
  autopilot?: {
    status: string
    plan: string[]
    summary: string
    websites_checked: string[]
    opportunities: Array<{ title: string; url: string; snippet: string; source: string }>
    recommended_next_action: string
    actions: Array<{ label: string; status: string; message: string; actionId?: string; operatorId?: string; url?: string }>
  }
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  padding: 28,
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: 18,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid #dbeafe',
  background: '#eff6ff',
  color: '#1d4ed8',
  borderRadius: 8,
  padding: '11px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'left',
}

function simpleStatus(op?: Operator | null, pendingApprovalCount = 0): { label: string; tone: string; message: string } {
  if (op?.status === 'working') return { label: 'Opening browser', tone: '#2563eb', message: op.current_task ?? 'Kevin is working.' }
  if (op?.status === 'waiting_user') return { label: 'Needs your help', tone: '#d97706', message: 'Kevin needs your help. Complete this in the browser, then click Resume.' }
  if (op?.status === 'waiting_approval' || pendingApprovalCount > 0) return { label: 'Needs approval', tone: '#d97706', message: 'Kevin needs approval before doing this.' }
  if (op?.status === 'ready_to_resume') return { label: 'Needs your help', tone: '#059669', message: 'Kevin is ready. Click Resume to continue.' }
  return { label: 'Done', tone: '#059669', message: 'No active browser task right now.' }
}

function sanitizeMessage(message: string | undefined): string {
  if (!message) return ''
  if (/captcha|login|security|two.?factor|manual_takeover/i.test(message)) {
    return 'Kevin needs your help. Complete this in the browser, then click Resume.'
  }
  if (/approval/i.test(message)) return 'Kevin needs approval before doing this.'
  if (/playwright|browserType|net::ERR|TimeoutError|stack|selector/i.test(message)) {
    return 'Kevin hit a browser problem. View details if you want the technical reason.'
  }
  return message
}

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [operators, setOperators] = useState<Operator[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([])
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CommandResult | null>(null)
  const [liveLabel, setLiveLabel] = useState('Done')

  const selectedProject = useMemo(
    () => projects.find(p => p.id === projectId) ?? projects[0] ?? null,
    [projects, projectId],
  )
  const activeOperator = useMemo(
    () => operators.find(op => ['working', 'waiting_user', 'waiting_approval', 'ready_to_resume'].includes(op.status)) ?? operators[0] ?? null,
    [operators],
  )
  const live = simpleStatus(activeOperator, pendingApprovals)
  const waitingOperator = operators.find(op => op.status === 'waiting_user' || op.status === 'ready_to_resume') ?? null
  const pendingApproval = approvalItems.find(item => item.status === 'pending') ?? null
  const attentionState = waitingOperator
    ? 'manual'
    : pendingApproval
      ? 'approval'
      : 'clear'

  async function updateApproval(id: string, status: 'approved' | 'rejected') {
    await fetch(`/api/approval-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await refresh()
  }

  async function refresh() {
    const [projectRes, operatorRes, actionRes, approvalRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/web-operators'),
      fetch('/api/web-operator/actions?limit=5'),
      fetch('/api/approval-items?limit=10'),
    ])
    if (projectRes.ok) {
      const data = await projectRes.json()
      const rows = (data.projects ?? []) as Project[]
      setProjects(rows)
      setProjectId(current => current || rows[0]?.id || '')
    }
    if (operatorRes.ok) {
      const data = await operatorRes.json()
      setOperators((data.operators ?? []) as Operator[])
    }
    if (actionRes.ok) {
      const data = await actionRes.json()
      setActions((data.actions ?? []) as Action[])
    }
    if (approvalRes.ok) {
      const data = await approvalRes.json()
      const rows = (data.items ?? []) as ApprovalItem[]
      setApprovalItems(rows)
      setPendingApprovals(rows.filter(item => item.status === 'pending').length)
    }
  }

  useEffect(() => {
    refresh().catch(() => {})
    const id = window.setInterval(() => refresh().catch(() => {}), 5000)
    return () => window.clearInterval(id)
  }, [])

  async function runCommand(text?: string) {
    const baseCommand = (text ?? command).trim()
    if (!baseCommand) return
    const withProject = selectedProject && !new RegExp(selectedProject.name, 'i').test(baseCommand)
      ? `${baseCommand} for ${selectedProject.name}.`
      : baseCommand
    setLoading(true)
    setLiveLabel('Thinking')
    setResult(null)
    try {
      window.setTimeout(() => setLiveLabel('Opening browser'), 500)
      window.setTimeout(() => setLiveLabel('Searching web'), 1400)
      const res = await fetch('/api/ceo/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: withProject }),
      })
      const data = await res.json()
      setResult(data)
      setLiveLabel(data.autopilot?.status === 'needs_your_help' ? 'Needs your help' : data.autopilot?.opportunities?.length ? 'Found opportunity' : 'Done')
      await refresh()
    } catch {
      setResult({ response: 'AÏKO could not start the task. Check the local server and try again.' })
      setLiveLabel('Done')
    } finally {
      setLoading(false)
    }
  }

  const quicks = [
    ['Start marketing', `Start marketing${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
    ['Find customers', `Find customers${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
    ['Research competitors', `Research competitors${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
    ['Create content', `Create a content draft${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
    ['Generate report', `Generate an executive report${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
    ['Open browser operator', `Kevin, open websites and start marketing research${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
  ]

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            AÏKO Home
          </div>
          <h1 style={{ margin: '6px 0 8px', color: '#0f172a', fontSize: 34, letterSpacing: 0 }}>
            What should AÏKO do?
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 15 }}>
            Simple command center for project work. Advanced systems stay in Dashboard and System.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)', gap: 18 }}>
          <section style={cardStyle}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 8 }}>
              Current project
            </label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              style={{ width: '100%', height: 42, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px', marginBottom: 14 }}
            >
              {projects.length === 0 ? <option>No projects yet</option> : projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>

            <textarea
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runCommand()
              }}
              placeholder="Start marketing for ALB Parking."
              style={{
                width: '100%',
                minHeight: 112,
                resize: 'vertical',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: 13,
                fontSize: 15,
                lineHeight: 1.5,
                color: '#0f172a',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                onClick={() => runCommand()}
                disabled={loading || !command.trim()}
                style={{
                  border: 0,
                  background: loading || !command.trim() ? '#94a3b8' : '#0f172a',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '11px 16px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: loading || !command.trim() ? 'default' : 'pointer',
                }}
              >
                {loading ? 'Working…' : 'Run'}
              </button>
              <Link href="/ceo" style={{ color: '#475569', fontSize: 13, alignSelf: 'center', textDecoration: 'none', fontWeight: 700 }}>
                Open CEO Chat
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 18 }}>
              {quicks.map(([label, text]) => (
                <button key={label} style={buttonStyle} onClick={() => runCommand(text)} disabled={loading}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          <aside style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>Needs your attention</div>
                <div style={{ color: attentionState === 'clear' ? '#059669' : '#d97706', fontSize: 22, fontWeight: 900, marginTop: 4 }}>
                  {attentionState === 'manual' ? 'Kevin needs your help' : attentionState === 'approval' ? 'Approval needed' : 'All clear'}
                </div>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
              {loading
                ? 'AÏKO is thinking.'
                : attentionState === 'manual'
                  ? 'Complete this in the browser, then click Resume.'
                  : attentionState === 'approval'
                    ? 'Kevin needs approval before doing this.'
                    : 'AÏKO is ready.'}
            </p>
            {waitingOperator?.latest_screenshot && (
              <img
                src={waitingOperator.latest_screenshot}
                alt="Latest browser screenshot"
                style={{ width: '100%', marginTop: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {attentionState === 'manual' && waitingOperator?.id && (
                <>
                <Link href={`/operators/${waitingOperator.id}`} style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>
                  Open browser
                </Link>
                <Link href={`/operators/${waitingOperator.id}`} style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>
                  Resume
                </Link>
                </>
              )}
              {attentionState === 'approval' && pendingApproval && (
                <>
                  <Link href="/approvals" style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>
                    Review
                  </Link>
                  <button onClick={() => updateApproval(pendingApproval.id, 'approved')} style={{ ...buttonStyle, padding: '8px 10px', textAlign: 'center' }}>
                    Approve
                  </button>
                  <button onClick={() => updateApproval(pendingApproval.id, 'rejected')} style={{ ...buttonStyle, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', padding: '8px 10px', textAlign: 'center' }}>
                    Reject
                  </button>
                </>
              )}
              <details style={{ width: '100%', marginTop: 4 }}>
                <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: 12, fontWeight: 800 }}>
                  Advanced
                </summary>
                <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                  <div>Live work: <b>{loading ? liveLabel : live.label}</b></div>
                  {activeOperator?.current_url && <div style={{ wordBreak: 'break-all' }}>Website: {activeOperator.current_url}</div>}
                  {pendingApproval && <div>Approval: {pendingApproval.title}</div>}
                  <pre style={{ overflow: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, fontSize: 11 }}>
                    {JSON.stringify({ activeOperator, pendingApproval, latestActions: actions.slice(0, 3) }, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          </aside>
        </div>

        {result && (
          <section style={{ ...cardStyle, marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 8 }}>
              Result
            </div>
            <p style={{ color: '#0f172a', fontSize: 15, lineHeight: 1.7, marginTop: 0 }}>
              {sanitizeMessage(result.response)}
            </p>
            {result.autopilot && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>Opportunities</div>
                  {result.autopilot.opportunities.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: 13 }}>No useful results were extracted yet.</p>
                  ) : result.autopilot.opportunities.slice(0, 5).map(item => (
                    <a key={item.url} href={item.url} target="_blank" rel="noreferrer" style={{ display: 'block', color: '#2563eb', fontSize: 13, marginBottom: 8, textDecoration: 'none' }}>
                      {item.title}
                    </a>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>Websites checked</div>
                  <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                    {result.autopilot.websites_checked.length ? result.autopilot.websites_checked.join(', ') : 'No public websites extracted yet.'}
                  </p>
                </div>
              </div>
            )}
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: 12, fontWeight: 800 }}>
                Advanced details
              </summary>
              <pre style={{
                overflow: 'auto',
                background: '#0f172a',
                color: '#e2e8f0',
                borderRadius: 8,
                padding: 12,
                fontSize: 11,
                lineHeight: 1.5,
              }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </section>
        )}

        <section style={{ ...cardStyle, marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 10 }}>
            Status overview
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            {[
              ['Needs your help', operators.filter(op => op.status === 'waiting_user').length],
              ['Needs approval', pendingApprovals],
              ['Browser blocked', operators.filter(op => op.status === 'error').length],
              ['Done', operators.filter(op => op.status === 'idle').length],
            ].map(([label, value]) => (
              <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: 12, fontWeight: 800 }}>
              Advanced details
            </summary>
            <pre style={{ overflow: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 11 }}>
              {JSON.stringify({ operators, actions: actions.slice(0, 5) }, null, 2)}
            </pre>
          </details>
        </section>
      </div>
    </div>
  )
}
