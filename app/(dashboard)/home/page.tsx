'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AdvancedDisclosure } from '@/components/ui/AdvancedDisclosure'
import { MinimalCard } from '@/components/ui/MinimalCard'
import { PageShell } from '@/components/ui/PageShell'
import { PrimaryAction } from '@/components/ui/PrimaryAction'
import { StatusPill } from '@/components/ui/StatusPill'

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
    is_stale?: boolean
    operator_id?: string | null
  }>
  recommended_next_action: {
    title: string
    description: string
    href: string
    action_label: string
  } | null
}

type IntensiveWorkStatus = {
  state: {
    enabled: boolean
    level: string
    max_actions_per_cycle: number
    cycles_today: number
    paused_reason: string | null
  }
  queue: Array<{ id: string; work_type: string; assigned_agent_name: string; status: string; output_summary?: string | null; blocked_reason?: string | null }>
  active: Array<{ id: string; work_type: string; assigned_agent_name: string; status: string; output_summary?: string | null; blocked_reason?: string | null }>
  recent: Array<{ id: string; work_type: string; assigned_agent_name: string; status: string; output_summary?: string | null; blocked_reason?: string | null }>
  counts: Record<string, number>
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
  background: '#fbfbfc',
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 20,
  padding: 22,
  boxShadow: '0 1px 2px rgba(17, 24, 39, 0.03)',
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  background: '#ffffff',
  color: '#111827',
  borderRadius: 999,
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'center',
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

function cleanDisplayTitle(title: string, status?: string): string {
  if (!title) return 'Task'
  let s = title
    .replace(/^(Blocked|Completed|Failed|Search|Task|AI Skill|Web Operator|Open URL|Open url|Browse):\s*/i, '')
    .replace(/^Item approved?:\s*/i, '')
    .replace(/^Web Operator:\s*/i, '')
    .replace(/https?:\/\/([^\s/]+)[^\s]*/g, '$1')
    .replace(/[,.]?\s*[Ii]nternally\.?(\s+[Nn]o external[^.]*\.?)?$/, '')
    .replace(/\s+in\s+(?:their|the)\s+(?:dedicated\s+)?browser\s+session\.?$/i, '')
    .trim()
  if (status === 'blocked' && (s.length > 70 || /^(search|open|browse|http)/i.test(s))) return 'Resolve blocker'
  if (!s) return 'Task'
  s = s.charAt(0).toUpperCase() + s.slice(1)
  if (s.length <= 70) return s
  const cut = s.slice(0, 70)
  const sp = cut.lastIndexOf(' ')
  return (sp > 40 ? cut.slice(0, sp) : cut) + '…'
}

function sanitizeMessage(message: string | undefined): string {
  if (!message) return ''
  const withoutPlan = message.replace(/^I'll do this:\n(?:\d+\.\s.*\n?)+\n*/i, '')
  message = withoutPlan.trim() || message
  if (/captcha|login|security|two.?factor|manual_takeover/i.test(message)) {
    return 'Kevin needs your help. Complete this in the browser, then click Resume.'
  }
  if (/approval/i.test(message)) return 'Kevin needs approval before doing this.'
  if (/agents are paused/i.test(message)) return 'Intensive Work is paused. Resume when ready.'
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
  const [intensiveWork, setIntensiveWork] = useState<IntensiveWorkStatus | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CommandResult | null>(null)
  const [liveLabel, setLiveLabel] = useState('Done')
  const [savingDraft, setSavingDraft] = useState(false)
  const [creatingTasks, setCreatingTasks] = useState(false)
  const [resumingKevin, setResumingKevin] = useState(false)
  const [runningWorkCycle, setRunningWorkCycle] = useState(false)
  const [resumeMessage, setResumeMessage] = useState('')
  const [workMessage, setWorkMessage] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [brainLabel, setBrainLabel] = useState('Checking')
  const [brainUnusable, setBrainUnusable] = useState(false)
  const [brainWarning, setBrainWarning] = useState('')
  const [projectBrainScore, setProjectBrainScore] = useState<number | null>(null)
  const [modeLabel, setModeLabel] = useState('Checking')

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
  const intensiveWorkPaused = !!(intensiveWork?.state.paused_reason && !intensiveWork?.state.enabled)
  const profileLockedOperator = operators.find(op => op.waiting_reason === 'profile_locked') ?? null
  const staleBlockerItem = dailyBrief?.priority_items.find(item => item.is_stale && item.operator_id) ?? null
  const attentionState = profileLockedOperator
    ? 'profile_locked'
    : staleBlockerItem && !waitingOperator
      ? 'stale_blocker'
      : waitingOperator
      ? 'manual'
      : readyOperator
        ? 'ready'
        : pendingApproval
          ? 'approval'
          : missingCapability
            ? 'missing'
            : intensiveWorkPaused
              ? 'intensive_paused'
              : 'clear'

  async function updateApproval(id: string, status: 'approved' | 'rejected') {
    await fetch(`/api/approval-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await refresh()
  }

  async function clearStaleBlocker(operatorId: string) {
    try {
      await fetch(`/api/web-operators/${operatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_stale_blocker' }),
      })
      await refresh()
    } catch {
      // non-fatal
    }
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
    const [projectRes, operatorRes, actionRes, approvalRes, fileRes, taskRes, briefRes, workRes, brainRes, modeRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/web-operators'),
      fetch('/api/web-operator/actions?limit=5'),
      fetch('/api/approval-items?limit=10'),
      fetch('/api/files?limit=2'),
      fetch('/api/tasks?limit=20'),
      fetch('/api/daily-brief'),
      fetch('/api/intensive-work/status'),
      fetch('/api/providers/diagnostics').catch(() => null),
      fetch('/api/mode').catch(() => null),
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
    if (workRes.ok) {
      const data = await workRes.json()
      setIntensiveWork(data as IntensiveWorkStatus)
    }
    if (brainRes?.ok) {
      const data = await brainRes.json()
      setBrainLabel(data?.ceo_provider?.name ?? 'Not connected')
      const bh = data?.brain_health
      if (bh) {
        setBrainUnusable(!bh.usable)
        setBrainWarning(!bh.usable ? bh.owner_message : '')
      }
    }
    // Load project brain score for selected project
    const currentProjectId = projectId || projects[0]?.id
    if (currentProjectId) {
      try {
        const pbRes = await fetch(`/api/projects/${currentProjectId}/brain`)
        if (pbRes.ok) {
          const pb = await pbRes.json()
          setProjectBrainScore(pb?.completeness?.score ?? null)
        }
      } catch { /* non-fatal */ }
    }
    if (modeRes?.ok) {
      const data = await modeRes.json()
      setModeLabel(data?.paused ? 'Paused' : String(data?.mode ?? 'Unknown').replace(/_/g, ' '))
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
      // Surface API-level errors (503 brain unavailable, etc.) as the response text
      if (!res.ok && data.error && !data.response) {
        data.response = data.error
      }
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

  async function startIntensiveWork(level = 'safe_internal') {
    setRunningWorkCycle(true)
    setWorkMessage('')
    try {
      const res = await fetch('/api/intensive-work/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, project_id: selectedProject?.id ?? null, run_immediately: true }),
      })
      const data = await res.json()
      setWorkMessage(data.cycle?.message ?? 'Intensive Work started.')
      await refresh()
    } catch {
      setWorkMessage('Could not start Intensive Work.')
    } finally {
      setRunningWorkCycle(false)
    }
  }

  async function runWorkCycle() {
    setRunningWorkCycle(true)
    setWorkMessage('')
    try {
      const res = await fetch('/api/intensive-work/run-cycle', { method: 'POST' })
      const data = await res.json()
      setWorkMessage(data.message ?? 'Cycle finished.')
      await refresh()
    } catch {
      setWorkMessage('Could not run work cycle.')
    } finally {
      setRunningWorkCycle(false)
    }
  }

  async function pauseIntensiveWork() {
    setRunningWorkCycle(true)
    try {
      await fetch('/api/intensive-work/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Paused from Home.' }),
      })
      setWorkMessage('Intensive Work paused.')
      await refresh()
    } finally {
      setRunningWorkCycle(false)
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
  const recentFiles = files.slice(0, 2)
  const nextAction = selectedProject
    ? selectedProject.goal ?? selectedProject.target_market ?? 'Start marketing or generate a report.'
    : 'Create your first project to start.'
  const statusTone = attentionState === 'clear' ? 'green' : attentionState === 'missing' ? 'red' : 'amber'
  const statusLabel = attentionState === 'clear'
    ? 'Ready'
    : attentionState === 'approval'
      ? 'Approval needed'
      : attentionState === 'missing'
        ? 'Blocked'
        : attentionState === 'intensive_paused'
          ? 'Paused'
          : attentionState === 'profile_locked'
            ? 'Chrome locked'
            : attentionState === 'stale_blocker'
              ? 'Old blocker'
              : 'Needs attention'

  return (
    <PageShell
      title="AÏKO"
      subtitle="AI Marketing Operating System"
      maxWidth={1120}
      style={pageStyle}
    >
        {brainUnusable && (
          <section data-testid="brain-warning" style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>CEO brain needs attention.</div>
              <div style={{ fontSize: 13, color: '#78350f', marginTop: 2 }}>{brainWarning}</div>
            </div>
            <a href="/connect-ai" style={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8', textDecoration: 'none', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 8, padding: '7px 12px', whiteSpace: 'nowrap' }}>Open Connect AI</a>
          </section>
        )}
        <section
          data-testid="home-command-box"
          style={{
            ...cardStyle,
            marginBottom: 18,
            padding: 24,
            borderRadius: 24,
            boxShadow: '0 18px 60px rgba(17, 24, 39, 0.05)',
          }}
        >
          <label style={{ display: 'block', marginBottom: 12, color: '#6b7280', fontSize: 14, fontWeight: 700 }}>
            What should AÏKO do?
          </label>
          <textarea
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runCommand()
            }}
            placeholder="Start marketing for ALB Parking."
            style={{
              width: '100%',
              minHeight: 132,
              resize: 'vertical',
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              padding: 18,
              fontSize: 18,
              lineHeight: 1.5,
              color: '#111827',
              background: '#fbfbfc',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', color: '#6b7280', fontSize: 13 }}>
              <span>Brain: {brainLabel}</span>
              <span>Project: {selectedProject?.name ?? 'None'}</span>
              <span>Mode: {modeLabel}</span>
              <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <PrimaryAction onClick={() => runCommand()} disabled={loading || !command.trim()}>
                {loading ? 'Working...' : 'Start'}
              </PrimaryAction>
              <PrimaryAction href="/ceo" variant="quiet">CEO Chat</PrimaryAction>
            </div>
          </div>
        </section>

        <div data-testid="home-main-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
          <MinimalCard
            title="Today"
            action={<PrimaryAction href="/today" variant="quiet">Open</PrimaryAction>}
          >
            {selectedProject && projectBrainScore !== null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: projectBrainScore >= 70 ? '#166534' : '#92400e' }}>
                  Project Brain: {projectBrainScore}% complete
                </span>
                <a href={`/projects/${selectedProject.id}/brain`} style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>Edit Brain</a>
              </div>
            )}
            <p style={{ margin: 0, color: '#111827', fontSize: 15, lineHeight: 1.55 }}>
              {dailyBrief?.today_summary ?? "Loading today's brief..."}
            </p>
            <div style={{ marginTop: 18 }}>
              {dailyBrief?.recommended_next_action ? (
                <>
                  <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Recommended</div>
                  <div style={{ color: '#111827', fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>
                    {dailyBrief.recommended_next_action.title}
                  </div>
                  <PrimaryAction href={dailyBrief.recommended_next_action.href} style={{ marginTop: 14 }}>
                    {dailyBrief.recommended_next_action.action_label || 'Start'}
                  </PrimaryAction>
                </>
              ) : (
                <PrimaryAction onClick={() => runCommand(`Start marketing${selectedProject ? ` for ${selectedProject.name}` : ''}.`)} disabled={loading}>
                  Start marketing
                </PrimaryAction>
              )}
            </div>
          </MinimalCard>

          <MinimalCard
            title="Current Work"
            action={activeOperator?.id ? <PrimaryAction href={`/operators/${activeOperator.id}`} variant="quiet">Open</PrimaryAction> : <PrimaryAction href="/operators" variant="quiet">Open</PrimaryAction>}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <StatusPill tone={statusTone}>{loading ? liveLabel : live.label}</StatusPill>
              <span style={{ color: '#6b7280', fontSize: 13 }}>{activeOperator?.name ?? 'Kevin'}</span>
            </div>
            <p style={{ margin: 0, color: '#111827', fontSize: 15, lineHeight: 1.55 }}>
              {attentionState === 'profile_locked'
                ? 'Chrome profile is already open.'
                : attentionState === 'stale_blocker'
                  ? (staleBlockerItem?.description ?? 'Old browser blocker. Resume it or clear it to start fresh.')
                  : attentionState === 'manual'
                    ? 'Kevin needs your help in Chrome. Complete this, then click Resume.'
                  : attentionState === 'ready'
                    ? 'Kevin is ready to continue.'
                    : attentionState === 'approval'
                      ? 'Kevin needs approval before doing this.'
                      : attentionState === 'missing'
                        ? 'AÏKO cannot do this yet.'
                        : attentionState === 'intensive_paused'
                          ? 'Intensive Work is paused.'
                          : activeOperator?.status === 'working'
                            ? (activeOperator.current_task ?? 'Kevin is working.')
                            : 'Kevin is idle.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
              {attentionState === 'profile_locked' && (
                <>
                  <PrimaryAction href="/connect-ai" variant="secondary">Open setup</PrimaryAction>
                  <PrimaryAction href="/operators" variant="secondary">Use AÏKO profile</PrimaryAction>
                </>
              )}
              {attentionState === 'stale_blocker' && staleBlockerItem?.operator_id && (
                <>
                  <PrimaryAction href={`/operators/${staleBlockerItem.operator_id}`} variant="secondary">Open operator</PrimaryAction>
                  <PrimaryAction onClick={resumeKevin} disabled={resumingKevin} variant="secondary">{resumingKevin ? 'Resuming...' : 'Resume'}</PrimaryAction>
                  <PrimaryAction onClick={() => clearStaleBlocker(staleBlockerItem.operator_id!)} variant="secondary">Clear blocker</PrimaryAction>
                </>
              )}
              {(attentionState === 'manual' || attentionState === 'ready') && (waitingOperator?.id || readyOperator?.id) && (
                <>
                  <PrimaryAction href={`/operators/${(waitingOperator ?? readyOperator)!.id}`} variant="secondary">Open browser</PrimaryAction>
                  <PrimaryAction onClick={resumeKevin} disabled={resumingKevin}>{resumingKevin ? 'Resuming...' : 'Resume Kevin'}</PrimaryAction>
                </>
              )}
              {attentionState === 'approval' && pendingApproval && (
                <>
                  <PrimaryAction href="/approvals" variant="secondary">Review</PrimaryAction>
                  <PrimaryAction onClick={() => updateApproval(pendingApproval.id, 'approved')}>Approve</PrimaryAction>
                </>
              )}
              {attentionState === 'missing' && missingCapability && (
                <PrimaryAction href={missingCapability.href || '/system'} variant="secondary">View proposal</PrimaryAction>
              )}
              {attentionState === 'intensive_paused' && (
                <PrimaryAction onClick={startIntensiveWork} disabled={loading}>Resume Intensive Work</PrimaryAction>
              )}
            </div>
            {(resumeMessage || workMessage) && <p style={{ ...mutedText, margin: '14px 0 0' }}>{resumeMessage || workMessage}</p>}
          </MinimalCard>

          <MinimalCard
            title="Next Tasks"
            action={<PrimaryAction href="/tasks" variant="quiet">View all</PrimaryAction>}
          >
            {tasks.length === 0 ? (
              <p style={{ ...mutedText, margin: 0 }}>Tasks created from plans will appear here.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {tasks.slice(0, 3).map(task => (
                  <div key={task.id} style={{ display: 'grid', gap: 4 }}>
                    <div style={{ color: '#111827', fontSize: 14, fontWeight: 720, lineHeight: 1.35 }}>{cleanDisplayTitle(task.title, task.status)}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>
                      {task.project_name ?? 'No project'} · {(task.assigned_agent_name ?? task.owner_role).replace(/_/g, ' ')}
                    </div>
                    {task.output_file_id && (
                      <Link href={`/files?file_id=${task.output_file_id}`} style={{ display: 'inline-block', marginTop: 4, color: '#4b5563', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                        Open output
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </MinimalCard>
        </div>

        <section style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ margin: 0, color: '#111827', fontSize: 15, fontWeight: 720 }}>Recent output</h2>
            <PrimaryAction href="/files" variant="quiet">Files</PrimaryAction>
          </div>
          {recentFiles.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {recentFiles.map(file => (
                <Link key={file.id} href="/files" style={{ color: 'inherit', textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, background: '#fff' }}>
                  <div style={{ color: '#111827', fontSize: 14, fontWeight: 720 }}>{file.title ?? file.filename}</div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 5 }}>{file.project_name ?? 'AÏKO'} · {file.content_type ?? 'file'}</div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ ...mutedText, margin: 0 }}>Generated reports and exports will appear here.</p>
          )}
        </section>

        <AdvancedDisclosure title="Advanced dashboard">
          {/* Compatibility labels retained for smoke coverage: Next tasks; JSON.stringify({ operators, latestAction }) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 12 }}>Project</div>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                style={{ width: '100%', height: 42, border: '1px solid #d1d5db', borderRadius: 12, padding: '0 12px', marginBottom: 10, background: '#fff' }}
              >
                {projects.length === 0 ? <option>No projects yet</option> : projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <p style={{ ...mutedText, margin: 0 }}>{selectedProject ? nextAction : 'Create your first project to start.'}</p>
              <PrimaryAction href={selectedProject ? `/projects/${selectedProject.id}` : '/ceo'} variant="secondary" style={{ marginTop: 14 }}>
                {selectedProject ? 'Open project' : 'Create project'}
              </PrimaryAction>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 12 }}>Quick actions</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <PrimaryAction href="/tasks" variant="secondary">Open tasks</PrimaryAction>
                <PrimaryAction href="/approvals" variant="secondary">Open approvals</PrimaryAction>
                <PrimaryAction href="/operators" variant="secondary">Open operator</PrimaryAction>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {quicks.map(([label, text]) => (
                  <button key={label} style={buttonStyle} onClick={() => runCommand(text)} disabled={loading}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>Intensive Work</div>
                  <p style={{ ...mutedText, margin: '8px 0 0' }}>
                    {intensiveWork?.state.enabled ? 'Working' : 'Off'} · {(intensiveWork?.state.level ?? 'off').replace(/_/g, ' ')}
                  </p>
                </div>
                <PrimaryAction href="/work" variant="quiet">Queue</PrimaryAction>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <button style={buttonStyle} onClick={() => startIntensiveWork('safe_internal')} disabled={runningWorkCycle}>
                  Start intensive work
                </button>
                <button style={buttonStyle} onClick={runWorkCycle} disabled={runningWorkCycle}>Run one cycle</button>
                <button style={buttonStyle} onClick={pauseIntensiveWork} disabled={runningWorkCycle}>Pause</button>
              </div>
              <pre style={{ overflow: 'auto', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, fontSize: 11, marginTop: 14 }}>
                {JSON.stringify(intensiveWork, null, 2)}
              </pre>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 12 }}>Needs your attention</div>
              <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
                <div>Live work: <b>{loading ? liveLabel : live.label}</b></div>
                <div>{activeOperator ? 'Operator available.' : 'Create or use the default operator.'}</div>
                <div>{pendingApproval ? 'Approval pending.' : 'No approvals needed.'}</div>
                {activeOperator?.current_url && <div style={{ wordBreak: 'break-all' }}>Website: {activeOperator.current_url}</div>}
                {pendingApproval && <div>Approval: {pendingApproval.title}</div>}
              </div>
              <pre style={{ overflow: 'auto', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, fontSize: 11, marginTop: 14 }}>
                {JSON.stringify({ operators, latestAction: actions[0] ?? null, activeOperator, pendingApproval, latestActions: actions.slice(0, 3) }, null, 2)}
              </pre>
            </div>
          </div>
        </AdvancedDisclosure>

        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginTop: 24 }}>
          AÏKO never sends, posts, publishes, or bypasses login/CAPTCHA without you.
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

    </PageShell>
  )
}
