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
  requires_user_input?: boolean
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

type GeneratedFile = {
  id: string
  filename: string
  title?: string | null
  content_type?: string | null
  source_entity_type?: string | null
  created_at: string
  project_name?: string | null
}

type OwnerTask = {
  id: string
  project_id: string | null
  project_name: string | null
  owner_role: string
  assigned_agent_name: string | null
  output_file_id: string | null
  title: string
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'archived'
}

type DailyBrief = {
  today_summary: string
  priority_items: Array<{
    type: string
    title: string
    description: string
    href: string
    action_label: string
  }>
  recommended_next_action: {
    title: string
    description: string
    href: string
    action_label: string
  } | null
}

type CommandResult = {
  response?: string
  intent?: string
  project_id?: string | null
  short_plan?: string[]
  suggested_chips?: Array<{ label: string; command?: string; href?: string }>
  ai_skill_output?: {
    skill_id: string
    title: string
    content?: string
    format: string
    suggested_next_actions: string[]
    warning?: string
    saved_file_id?: string
    summary?: string
    sections?: Array<{ title: string; content: string }>
    recommendations?: string[]
    next_actions?: string[]
    needs_web_research?: boolean
    web_research_questions?: string[]
    structured_data?: Record<string, unknown>
    tasks_created?: number
    tasks_url?: string
    project_tasks_url?: string | null
  }
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

const mutedText: React.CSSProperties = {
  color: '#64748b',
  fontSize: 13,
  lineHeight: 1.5,
}

function simpleStatus(op?: Operator | null, pendingApprovalCount = 0): { label: string; tone: string; message: string } {
  if (op?.status === 'working') return { label: 'Opening browser', tone: '#2563eb', message: op.current_task ?? 'Kevin is working.' }
  if (op?.status === 'waiting_user' || op?.status === 'user_controlling') return { label: 'Needs your help', tone: '#d97706', message: 'Kevin needs your help. Complete this in the browser, then click Resume.' }
  if (op?.status === 'waiting_approval' || pendingApprovalCount > 0) return { label: 'Needs approval', tone: '#d97706', message: 'Kevin needs approval before doing this.' }
  if (op?.status === 'ready_to_resume') return { label: 'Ready to resume', tone: '#059669', message: 'Kevin is ready to continue.' }
  return { label: 'Done', tone: '#059669', message: 'No active browser task right now.' }
}

function sanitizeMessage(message: string | undefined): string {
  if (!message) return ''
  const withoutPlan = message.replace(/^I’ll do this:\n(?:\d+\.\s.*\n?)+\n*/i, '')
  message = withoutPlan.trim() || message
  if (/captcha|login|security|two.?factor|manual_takeover/i.test(message)) {
    return 'Kevin needs your help. Complete this in the browser, then click Resume.'
  }
  if (/approval/i.test(message)) return 'Kevin needs approval before doing this.'
  if (/playwright|browserType|net::ERR|TimeoutError|stack|selector/i.test(message)) {
    return 'Kevin hit a browser problem. View details if you want the technical reason.'
  }
  return message
}

function hasExplicitProjectHint(text: string, projects: Project[]): boolean {
  if (/\bfor\s+[^.?!]+/i.test(text)) return true
  if (/\ba[ïi]ko\b/i.test(text)) return true
  return projects.some(project => new RegExp(project.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text))
}

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [operators, setOperators] = useState<Operator[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([])
  const [files, setFiles] = useState<GeneratedFile[]>([])
  const [tasks, setTasks] = useState<OwnerTask[]>([])
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CommandResult | null>(null)
  const [liveLabel, setLiveLabel] = useState('Done')
  const [savingDraft, setSavingDraft] = useState(false)
  const [creatingTasks, setCreatingTasks] = useState(false)
  const [resumingKevin, setResumingKevin] = useState(false)
  const [resumeMessage, setResumeMessage] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  const selectedProject = useMemo(
    () => projects.find(p => p.id === projectId) ?? projects[0] ?? null,
    [projects, projectId],
  )
  const activeOperator = useMemo(
    () => operators.find(op => ['working', 'waiting_user', 'user_controlling', 'waiting_approval', 'ready_to_resume'].includes(op.status)) ?? operators[0] ?? null,
    [operators],
  )
  const live = simpleStatus(activeOperator, pendingApprovals)
  const waitingOperator = operators.find(op => op.status === 'waiting_user' || op.status === 'user_controlling' || op.requires_user_input) ?? null
  const readyOperator = operators.find(op => op.status === 'ready_to_resume') ?? null
  const pendingApproval = approvalItems.find(item => item.status === 'pending') ?? null
  const missingCapability = dailyBrief?.priority_items.find(item => item.type === 'missing_capability') ?? null
  const attentionState = waitingOperator
    ? 'manual'
    : readyOperator
      ? 'ready'
      : pendingApproval
      ? 'approval'
      : missingCapability
        ? 'missing'
        : 'clear'

  async function updateApproval(id: string, status: 'approved' | 'rejected') {
    await fetch(`/api/approval-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await refresh()
  }

  async function resumeKevin() {
    setResumingKevin(true)
    setResumeMessage('')
    try {
      const res = await fetch('/api/web-operator/resume-browser-work', { method: 'POST' })
      const data = await res.json()
      setResumeMessage(data.message ?? (res.ok ? 'Kevin can continue in the browser now.' : 'Kevin could not resume yet.'))
      await refresh()
    } catch {
      setResumeMessage('Kevin could not resume yet.')
    } finally {
      setResumingKevin(false)
    }
  }

  async function refresh() {
    const [projectRes, operatorRes, actionRes, approvalRes, fileRes, taskRes, briefRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/web-operators'),
      fetch('/api/web-operator/actions?limit=5'),
      fetch('/api/approval-items?limit=10'),
      fetch('/api/files?limit=1'),
      fetch('/api/tasks?limit=20'),
      fetch('/api/daily-brief'),
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
    if (fileRes.ok) {
      const data = await fileRes.json()
      setFiles((data.files ?? []) as GeneratedFile[])
    }
    if (taskRes.ok) {
      const data = await taskRes.json()
      const rows = (data.tasks ?? []) as OwnerTask[]
      const assigned = rows.filter(task => task.assigned_agent_name).slice(0, 1)
      const rest = rows.filter(task => !assigned.some(item => item.id === task.id))
      setTasks([...assigned, ...rest].slice(0, 3))
    }
    if (briefRes.ok) {
      const data = await briefRes.json()
      setDailyBrief(data as DailyBrief)
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
    if (/^save (it|this)( as markdown| as a file| to files?)?\.?$/i.test(baseCommand) && result?.ai_skill_output) {
      await saveDraftAsFile(result.ai_skill_output)
      return
    }
    const withProject = selectedProject && !hasExplicitProjectHint(baseCommand, projects)
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
        body: JSON.stringify({
          command: withProject,
          context: {
            selected_project_id: selectedProject?.id ?? null,
            selected_project_name: selectedProject?.name ?? null,
          },
        }),
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

  async function saveDraftAsFile(output: NonNullable<CommandResult['ai_skill_output']>) {
    setSavingDraft(true)
    try {
      const filename = `${output.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ai-skill-output'}.md`
      const sections = output.sections?.length
        ? `\n\n${output.sections.map(section => `## ${section.title}\n\n${section.content}`).join('\n\n')}`
        : ''
      const recommendations = output.recommendations?.length
        ? `\n\n## Recommendations\n\n${output.recommendations.map(item => `- ${item}`).join('\n')}`
        : ''
      const nextActions = output.next_actions?.length
        ? `\n\n## Next Actions\n\n${output.next_actions.map(item => `- ${item}`).join('\n')}`
        : ''
      const webResearch = typeof output.needs_web_research === 'boolean'
        ? `\n\n## Web Research Needed\n\n${output.needs_web_research ? 'Yes' : 'No'}${output.web_research_questions?.length ? `\n\n${output.web_research_questions.map(item => `- ${item}`).join('\n')}` : ''}`
        : ''
      const structured = output.structured_data && Object.keys(output.structured_data).length
        ? `\n\n## Structured Output\n\n\`\`\`json\n${JSON.stringify(output.structured_data, null, 2)}\n\`\`\``
        : ''
      const body = output.content ?? output.summary ?? ''
      const content = `# ${output.title}\n\n${output.warning ? `> ${output.warning}\n\n` : ''}${body}${sections}${recommendations}${nextActions}${webResearch}${structured}\n`
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: result?.project_id ?? selectedProject?.id ?? null,
          filename,
          title: output.title,
          content,
          content_type: 'markdown',
          generated_by_role: 'copywriting',
          description: `AI skill output from ${output.skill_id}`,
          source_entity_type: 'ai_skill_output',
          source_entity_id: output.skill_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not save draft.')
      setResult(prev => prev ? {
        ...prev,
        response: `Saved ${output.title} as Markdown.`,
        ai_skill_output: { ...output, saved_file_id: data.file?.id ?? output.saved_file_id },
      } : prev)
      await refresh()
    } catch (err) {
      setResult(prev => prev ? { ...prev, response: err instanceof Error ? err.message : 'Could not save draft.' } : prev)
    } finally {
      setSavingDraft(false)
    }
  }

  async function copyDraft(content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopyStatus('Copied')
      window.setTimeout(() => setCopyStatus(''), 1600)
    } catch {
      setCopyStatus('Copy failed')
    }
  }

  function copyAIOutput(output: NonNullable<CommandResult['ai_skill_output']>) {
    const structured = [
      output.summary,
      output.recommendations?.length ? `Recommendations:\n${output.recommendations.map(item => `- ${item}`).join('\n')}` : null,
      output.next_actions?.length ? `Next actions:\n${output.next_actions.map(item => `- ${item}`).join('\n')}` : null,
    ].filter(Boolean).join('\n\n')
    return copyDraft(output.content ?? structured)
  }

  async function createTasksFromOutput(output: NonNullable<CommandResult['ai_skill_output']>) {
    setCreatingTasks(true)
    try {
      const res = await fetch('/api/ai-skills/create-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: result?.project_id ?? selectedProject?.id ?? null,
          output,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not create tasks.')
      const count = Number(data.tasks_created ?? data.tasks?.length ?? 0)
      setResult(prev => prev ? {
        ...prev,
        response: `Created ${count} internal task${count === 1 ? '' : 's'}. No external action was executed.`,
        ai_skill_output: {
          ...output,
          tasks_created: count,
          tasks_url: data.tasks_url ?? '/tasks',
          project_tasks_url: data.project_tasks_url ?? null,
        },
      } : prev)
      await refresh()
    } catch (err) {
      setResult(prev => prev ? { ...prev, response: err instanceof Error ? err.message : 'Could not create tasks.' } : prev)
    } finally {
      setCreatingTasks(false)
    }
  }

  const quicks = [
    ['Start marketing', `Start marketing${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
    ['Create content', `Create a content draft${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
    ['Find customers', `Find customers${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
    ['Generate report', `Generate an executive report${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
    ['Open browser', `Kevin, open websites and start marketing research${selectedProject ? ` for ${selectedProject.name}` : ''}.`],
  ]
  const latestFile = files[0] ?? null
  const latestAction = actions[0] ?? null
  const nextAction = selectedProject
    ? selectedProject.goal ?? selectedProject.target_market ?? 'Start marketing or generate a report.'
    : 'Create your first project to start.'

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 34, letterSpacing: 0 }}>
            What should AÏKO do?
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            Run the company from one place.
          </p>
        </div>

        <section style={{ ...cardStyle, marginBottom: 16, borderColor: '#bfdbfe', background: '#f8fbff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#1d4ed8', marginBottom: 4 }}>Today</div>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22, letterSpacing: 0 }}>
                {dailyBrief?.today_summary ?? 'Loading today’s brief...'}
              </h2>
            </div>
            <Link href="/today" style={{ color: '#2563eb', fontSize: 12, fontWeight: 900, textDecoration: 'none' }}>
              Open Today
            </Link>
          </div>
          {dailyBrief?.priority_items?.length ? (
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {dailyBrief.priority_items.slice(0, 3).map(item => (
                <Link key={`${item.type}-${item.title}`} href={item.href} style={{
                  display: 'block',
                  border: '1px solid #dbeafe',
                  borderRadius: 8,
                  padding: 10,
                  background: '#ffffff',
                  textDecoration: 'none',
                }}>
                  <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 900 }}>{item.title}</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{item.description}</div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ ...mutedText, margin: '0 0 12px' }}>Everything is clear. Choose what you want AÏKO to work on.</p>
          )}
          {dailyBrief?.recommended_next_action && (
            <p style={{ margin: '0 0 12px', color: '#334155', fontSize: 13, lineHeight: 1.5 }}>
              <b>Recommended:</b> {dailyBrief.recommended_next_action.title}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/tasks" style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>Open tasks</Link>
            <Link href="/approvals" style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>Open approvals</Link>
            <Link href="/operators" style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>Open operator</Link>
            <button style={{ ...buttonStyle, padding: '8px 10px' }} onClick={() => runCommand(`Generate an executive report${selectedProject ? ` for ${selectedProject.name}` : ''}.`)} disabled={loading}>
              Generate report
            </button>
            <button style={{ ...buttonStyle, padding: '8px 10px' }} onClick={() => runCommand(`Start marketing${selectedProject ? ` for ${selectedProject.name}` : ''}.`)} disabled={loading}>
              Start marketing
            </button>
          </div>
        </section>

        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <textarea
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runCommand()
            }}
            placeholder="Start marketing for ALB Parking."
            style={{
              width: '100%',
              minHeight: 116,
              resize: 'vertical',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: 14,
              fontSize: 16,
              lineHeight: 1.5,
              color: '#0f172a',
            }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
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
              {loading ? 'Working...' : 'Run'}
            </button>
            <Link href="/ceo" style={{ color: '#475569', fontSize: 13, textDecoration: 'none', fontWeight: 700 }}>
              Open CEO Chat
            </Link>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)', gap: 16 }}>
          <section style={{ display: 'grid', gap: 16 }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#334155' }}>Current project</div>
                <Link href={selectedProject ? `/projects/${selectedProject.id}` : '/ceo'} style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 800 }}>
                  {selectedProject ? 'Open project' : 'Create project'}
                </Link>
              </div>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              style={{ width: '100%', height: 40, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px', marginBottom: 10 }}
            >
              {projects.length === 0 ? <option>No projects yet</option> : projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
              <p style={{ ...mutedText, margin: 0 }}>
                {selectedProject ? nextAction : 'Create your first project to start.'}
              </p>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 10 }}>Quick actions</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {quicks.map(([label, text]) => (
                  <button key={label} style={buttonStyle} onClick={() => runCommand(text)} disabled={loading}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#334155' }}>Next tasks</div>
                <Link href="/tasks" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 800 }}>
                  View all tasks
                </Link>
              </div>
              {tasks.length === 0 ? (
                <p style={{ ...mutedText, margin: 0 }}>Tasks created from plans will appear here.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {tasks.map(task => (
                    <div key={task.id} style={{
                      border: task.status === 'blocked' ? '1px solid #fecaca' : '1px solid #e2e8f0',
                      background: task.status === 'blocked' ? '#fef2f2' : '#f8fafc',
                      borderRadius: 8,
                      padding: 10,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 900, lineHeight: 1.35 }}>{task.title}</div>
                          <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                            {task.project_name ?? 'No project'} · {(task.assigned_agent_name ?? task.owner_role).replace(/_/g, ' ')}
                          </div>
                          {task.output_file_id && (
                            <Link href={`/files?file_id=${task.output_file_id}`} style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: '#2563eb', fontWeight: 800, textDecoration: 'none' }}>
                              Open output
                            </Link>
                          )}
                        </div>
                        <span style={{
                          flexShrink: 0,
                          color: task.status === 'blocked' ? '#991b1b' : '#475569',
                          fontSize: 11,
                          fontWeight: 900,
                        }}>
                          {task.status === 'todo' ? 'To do' : task.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 10 }}>Recent output</div>
              {latestFile ? (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{latestFile.title ?? latestFile.filename}</div>
                  <div style={{ ...mutedText, marginTop: 4 }}>{latestFile.project_name ?? 'AÏKO'} · {latestFile.content_type ?? 'file'}</div>
                  <Link href="/files" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#2563eb', fontWeight: 800, textDecoration: 'none' }}>
                    Open files
                  </Link>
                </div>
              ) : (
                <p style={{ ...mutedText, margin: 0 }}>Generated reports and exports will appear here.</p>
              )}
            </div>
          </section>

          <aside style={{ display: 'grid', gap: 16 }}>
            <section style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>Needs your attention</div>
                  <div style={{ color: attentionState === 'clear' ? '#059669' : '#d97706', fontSize: 22, fontWeight: 900, marginTop: 4 }}>
                    {attentionState === 'manual'
                      ? 'Kevin needs your help'
                      : attentionState === 'ready'
                        ? 'Kevin is ready to continue'
                        : attentionState === 'approval'
                          ? 'Approval needed'
                          : attentionState === 'missing'
                            ? 'AÏKO cannot do this yet'
                            : 'All clear'}
                  </div>
                </div>
              </div>
              <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
                {loading
                  ? 'AÏKO is thinking.'
                  : attentionState === 'manual'
                    ? 'Complete this in the browser, then click Resume.'
                    : attentionState === 'ready'
                      ? 'Kevin is ready to continue.'
                    : attentionState === 'approval'
                      ? 'Kevin needs approval before doing this.'
                      : attentionState === 'missing'
                        ? 'AÏKO cannot do this yet.'
                      : 'AÏKO is ready.'}
              </p>
              {attentionState === 'clear' && <p style={{ ...mutedText, margin: '-4px 0 0' }}>No approvals needed.</p>}
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
                    <button onClick={resumeKevin} disabled={resumingKevin} style={{ ...buttonStyle, padding: '8px 10px', textAlign: 'center' }}>
                      {resumingKevin ? 'Resuming...' : 'Resume Kevin'}
                    </button>
                  </>
                )}
                {attentionState === 'ready' && readyOperator?.id && (
                  <>
                    <Link href={`/operators/${readyOperator.id}`} style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>
                      Open browser
                    </Link>
                    <button onClick={resumeKevin} disabled={resumingKevin} style={{ ...buttonStyle, padding: '8px 10px', textAlign: 'center' }}>
                      {resumingKevin ? 'Resuming...' : 'Resume Kevin'}
                    </button>
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
                {attentionState === 'missing' && missingCapability && (
                  <Link href={missingCapability.href || '/system'} style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>
                    View proposal
                  </Link>
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
              {resumeMessage && (
                <p style={{ ...mutedText, margin: '10px 0 0' }}>{resumeMessage}</p>
              )}
            </section>

            <section style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 10 }}>Live work</div>
              {activeOperator ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{activeOperator.name}</div>
                      <div style={{ ...mutedText, color: live.tone }}>{loading ? liveLabel : live.label}</div>
                    </div>
                    <Link href={`/operators/${activeOperator.id}`} style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 800 }}>
                      Open
                    </Link>
                  </div>
                  <p style={{ ...mutedText, margin: '10px 0 0' }}>
                    {activeOperator.status === 'idle' ? 'Kevin is idle.' : live.message}
                  </p>
                  {activeOperator.latest_screenshot ? (
                    <img
                      src={activeOperator.latest_screenshot}
                      alt="Latest browser screenshot"
                      style={{ width: '100%', marginTop: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                  ) : null}
                </>
              ) : (
                <p style={{ ...mutedText, margin: 0 }}>Create or use the default operator.</p>
              )}
            </section>

            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
              AÏKO never sends, posts, publishes, or bypasses login/CAPTCHA without you.
            </div>
          </aside>
        </div>

        {result && (
          <section style={{ ...cardStyle, marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 8 }}>
              Result
            </div>
            {Array.isArray(result.short_plan) && result.short_plan.length > 0 && (
              <div style={{
                border: '1px solid #dbeafe',
                background: '#eff6ff',
                borderRadius: 8,
                padding: 12,
                marginBottom: 14,
              }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#1e40af', marginBottom: 8 }}>
                  Plan
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 13, lineHeight: 1.6 }}>
                  {result.short_plan.map(step => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
            <p style={{ color: '#0f172a', fontSize: 15, lineHeight: 1.7, marginTop: 0 }}>
              {result.ai_skill_output
                ? result.ai_skill_output.summary
                  ? (result.ai_skill_output.warning ?? 'Strategy created. Review it below.')
                  : (result.ai_skill_output.warning ?? 'Draft created. Review it below.')
                : sanitizeMessage(result.response)}
            </p>
            {result.ai_skill_output && (
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 14,
                marginBottom: 14,
                background: '#ffffff',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#334155' }}>{result.ai_skill_output.summary ? 'Strategy' : 'Draft'}</div>
                    <h3 style={{ margin: '4px 0 0', color: '#0f172a', fontSize: 18 }}>{result.ai_skill_output.title}</h3>
                    <div style={{ ...mutedText, marginTop: 4 }}>{result.ai_skill_output.format.replace(/_/g, ' ')}</div>
                  </div>
                  {(result.ai_skill_output.warning || typeof result.ai_skill_output.needs_web_research === 'boolean') && (
                    <span style={{
                      border: result.ai_skill_output.needs_web_research ? '1px solid #fde68a' : '1px solid #bfdbfe',
                      background: result.ai_skill_output.needs_web_research ? '#fffbeb' : '#eff6ff',
                      color: result.ai_skill_output.needs_web_research ? '#92400e' : '#1e40af',
                      borderRadius: 999,
                      padding: '5px 8px',
                      fontSize: 11,
                      fontWeight: 800,
                    }}>
                      {result.ai_skill_output.needs_web_research ? 'Needs web research' : 'Draft only'}
                    </span>
                  )}
                </div>
                {result.ai_skill_output.warning && (
                  <p style={{ margin: '0 0 10px', color: '#92400e', fontSize: 13, lineHeight: 1.5 }}>
                    {result.ai_skill_output.warning}
                  </p>
                )}
                {result.ai_skill_output.summary ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 6 }}>Summary</div>
                      <p style={{ margin: 0, color: '#0f172a', fontSize: 14, lineHeight: 1.6 }}>{result.ai_skill_output.summary}</p>
                    </div>
                    {Array.isArray(result.ai_skill_output.recommendations) && result.ai_skill_output.recommendations.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 6 }}>Top recommendations</div>
                        <ul style={{ margin: 0, paddingLeft: 18, color: '#0f172a', fontSize: 14, lineHeight: 1.6 }}>
                          {result.ai_skill_output.recommendations.slice(0, 3).map(item => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(result.ai_skill_output.next_actions) && result.ai_skill_output.next_actions.length > 0 && (
                      <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: '#1e40af', marginBottom: 6 }}>Next action</div>
                        <p style={{ margin: 0, color: '#0f172a', fontSize: 14, lineHeight: 1.6 }}>
                          {result.ai_skill_output.next_actions[0]}
                        </p>
                      </div>
                    )}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 6 }}>Needs web research?</div>
                      <p style={{ margin: 0, color: result.ai_skill_output.needs_web_research ? '#92400e' : '#047857', fontSize: 13, fontWeight: 800 }}>
                        {result.ai_skill_output.needs_web_research ? 'Yes. Use Kevin to verify fresh external facts before relying on them.' : 'No. This can stay internal for now.'}
                      </p>
                    </div>
                    <details>
                      <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: 12, fontWeight: 800 }}>
                        View full output
                      </summary>
                      <pre style={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit',
                        color: '#0f172a',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 13,
                        lineHeight: 1.55,
                        maxHeight: 360,
                        overflow: 'auto',
                        marginTop: 10,
                      }}>
                        {result.ai_skill_output.content ?? result.ai_skill_output.summary}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    color: '#0f172a',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    lineHeight: 1.6,
                    maxHeight: 360,
                    overflow: 'auto',
                  }}>
                    {result.ai_skill_output.content}
                  </pre>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button style={{ ...buttonStyle, padding: '8px 10px' }} onClick={() => saveDraftAsFile(result.ai_skill_output!)} disabled={savingDraft}>
                    {savingDraft ? 'Saving...' : result.ai_skill_output.saved_file_id ? 'Saved' : 'Save as file'}
                  </button>
                  <button style={{ ...buttonStyle, padding: '8px 10px' }} onClick={() => copyAIOutput(result.ai_skill_output!)}>
                    {copyStatus || 'Copy'}
                  </button>
                  <button style={{ ...buttonStyle, padding: '8px 10px' }} onClick={() => runCommand(`Create another version of ${result.ai_skill_output!.title}${selectedProject ? ` for ${selectedProject.name}` : ''}.`)} disabled={loading}>
                    Create another version
                  </button>
                  {result.ai_skill_output.summary && Array.isArray(result.ai_skill_output.next_actions) && result.ai_skill_output.next_actions.length > 0 && (
                    <button style={{ ...buttonStyle, padding: '8px 10px' }} onClick={() => createTasksFromOutput(result.ai_skill_output!)} disabled={creatingTasks}>
                      {creatingTasks ? 'Creating...' : result.ai_skill_output.tasks_created ? `Tasks created (${result.ai_skill_output.tasks_created})` : 'Create tasks'}
                    </button>
                  )}
                  {result.ai_skill_output.tasks_created ? (
                    <>
                      <Link href={result.ai_skill_output.tasks_url ?? '/tasks'} style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>
                        View tasks
                      </Link>
                      {result.ai_skill_output.project_tasks_url && (
                        <Link href={result.ai_skill_output.project_tasks_url} style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>
                          Open project
                        </Link>
                      )}
                    </>
                  ) : null}
                  {result.ai_skill_output.needs_web_research && (
                    <button style={{ ...buttonStyle, padding: '8px 10px' }} onClick={() => runCommand(`Kevin, research the open questions for ${result.ai_skill_output!.title}${selectedProject ? ` for ${selectedProject.name}` : ''}.`)} disabled={loading}>
                      Run Web Operator research
                    </button>
                  )}
                  {result.ai_skill_output.saved_file_id && (
                    <Link href="/files" style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>
                      Open files
                    </Link>
                  )}
                </div>
              </div>
            )}
            {Array.isArray(result.suggested_chips) && result.suggested_chips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {result.suggested_chips.map(chip => (
                  chip.href ? (
                    <Link key={`${chip.label}-${chip.href}`} href={chip.href} style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>
                      {chip.label}
                    </Link>
                  ) : (
                    <button key={`${chip.label}-${chip.command}`} style={{ ...buttonStyle, padding: '8px 10px' }} onClick={() => chip.command && runCommand(chip.command)} disabled={loading || !chip.command}>
                      {chip.label}
                    </button>
                  )
                ))}
              </div>
            )}
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

        <details style={{ ...cardStyle, marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: 12, fontWeight: 900 }}>
            Advanced dashboard
          </summary>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, marginBottom: 14 }}>
            <Link href="/dashboard" style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>Open dashboard</Link>
            <Link href="/system" style={{ ...buttonStyle, textDecoration: 'none', padding: '8px 10px' }}>Open system</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
            {[
              ['Needs your help', operators.filter(op => op.status === 'waiting_user').length],
              ['Needs approval', pendingApprovals],
              ['Browser blocked', operators.filter(op => op.status === 'error').length],
              ['Idle', operators.filter(op => op.status === 'idle').length],
            ].map(([label, value]) => (
              <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
            <pre style={{ overflow: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 11 }}>
              {JSON.stringify({ operators, latestAction }, null, 2)}
            </pre>
        </details>
      </div>
    </div>
  )
}
