import { db } from '@/lib/db/client'
import { getSetupState } from '@/lib/setup-state'
import { listOwnerTasks, type OwnerTask } from '@/lib/tasks/owner-tasks'

type BriefItem = {
  type: string
  title: string
  description: string
  href: string
  action_label: string
  project_name?: string | null
}

type BriefOutput = {
  id: string
  title: string
  type: string
  href: string
  project_name?: string | null
  created_at: string
}

export type DailyBrief = {
  date: string
  greeting: string
  ceo_brain: {
    can_think: boolean
    provider_name: string | null
    auth_method: string | null
    model: string | null
  }
  active_project: {
    id: string
    name: string
    goal: string | null
    href: string
  } | null
  today_summary: string
  priority_items: BriefItem[]
  waiting_for_user: BriefItem[]
  pending_approvals: BriefItem[]
  blocked_tasks: BriefItem[]
  next_tasks: BriefItem[]
  recent_outputs: BriefOutput[]
  recommended_next_action: BriefItem | null
}

async function rowsQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const res = await db.query(sql, params)
    return res.rows as T[]
  } catch {
    return []
  }
}

function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning.'
  if (hour < 18) return 'Good afternoon.'
  return 'Good evening.'
}

function taskItem(task: OwnerTask): BriefItem {
  return {
    type: task.status === 'blocked' ? 'blocked_task' : 'task',
    title: task.title,
    description: `${task.project_name ?? 'No project'} · ${task.owner_role.replace(/_/g, ' ')}`,
    href: task.project_id ? `/projects/${task.project_id}` : '/tasks',
    action_label: task.status === 'blocked' ? 'Open blocked task' : 'Open task',
    project_name: task.project_name,
  }
}

function cleanTitle(value: unknown, fallback: string) {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, 140) : fallback
}

export async function getDailyBrief(userId?: string | null): Promise<DailyBrief> {
  const setup = await getSetupState(userId).catch(() => ({
    can_ceo_think: false,
    ceo_profile: null,
  }))
  const [
    activeProjects,
    waitingRows,
    approvals,
    tasks,
    proposals,
    files,
    reports,
    decisions,
  ] = await Promise.all([
    rowsQuery<{ id: string; name: string; goal: string | null }>(
      `SELECT id, name, goal
       FROM projects
       WHERE active=true
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
    ),
    rowsQuery<{ id: string; name: string; status: string; current_task: string | null; waiting_reason: string | null }>(
      `SELECT id, name, status, current_task, waiting_reason
       FROM web_operators
       WHERE status IN ('waiting_user', 'ready_to_resume')
       ORDER BY updated_at DESC
       LIMIT 5`,
    ),
    rowsQuery<{ id: string; title: string; item_type: string | null; project_name: string | null }>(
      `SELECT ai.id, ai.title, ai.item_type, p.name AS project_name
       FROM approval_items ai
       LEFT JOIN projects p ON p.id = ai.project_id
       WHERE ai.status='pending'
       ORDER BY ai.created_at DESC
       LIMIT 5`,
    ),
    listOwnerTasks({ active: true, limit: 12 }).catch(() => []),
    rowsQuery<{ id: string; title: string; status: string; platform: string | null; related_project_id: string | null; project_name: string | null }>(
      `SELECT sip.id, sip.title, sip.status, sip.platform, sip.related_project_id, p.name AS project_name
       FROM system_improvement_proposals sip
       LEFT JOIN projects p ON p.id = sip.related_project_id
       WHERE sip.status NOT IN ('validated_available','rejected','archived')
       ORDER BY sip.created_at DESC
       LIMIT 3`,
    ),
    rowsQuery<{ id: string; title: string | null; filename: string; content_type: string | null; source_entity_type: string | null; project_name: string | null; created_at: string }>(
      `SELECT gf.id, gf.title, gf.filename, gf.content_type, gf.source_entity_type, gf.created_at, p.name AS project_name
       FROM generated_files gf
       LEFT JOIN projects p ON p.id = gf.project_id
       ORDER BY gf.created_at DESC
       LIMIT 3`,
    ),
    rowsQuery<{ id: string; title: string; project_name: string | null; created_at: string }>(
      `SELECT r.id, r.title, p.name AS project_name, r.created_at
       FROM project_executive_reports r
       LEFT JOIN projects p ON p.id = r.project_id
       ORDER BY r.created_at DESC
       LIMIT 3`,
    ),
    rowsQuery<{ id: string; title: string; project_name: string | null; created_at: string }>(
      `SELECT d.id, d.title, p.name AS project_name, d.created_at
       FROM project_decisions d
       LEFT JOIN projects p ON p.id = d.project_id
       ORDER BY d.created_at DESC
       LIMIT 3`,
    ),
  ])

  const activeProject = activeProjects[0]
    ? {
        id: String(activeProjects[0].id),
        name: String(activeProjects[0].name),
        goal: activeProjects[0].goal,
        href: `/projects/${activeProjects[0].id}`,
      }
    : null

  const waitingForUser: BriefItem[] = waitingRows.map(row => ({
    type: 'waiting_user',
    title: `${row.name} needs your help`,
    description: 'Complete this in the browser, then click Resume.',
    href: `/operators/${row.id}`,
    action_label: 'Open operator',
  }))

  const pendingApprovals: BriefItem[] = approvals.map(row => ({
    type: 'pending_approval',
    title: 'Approval needed',
    description: `${cleanTitle(row.title, 'Kevin needs approval before doing this.')}${row.project_name ? ` · ${row.project_name}` : ''}`,
    href: '/approvals',
    action_label: 'Open approvals',
    project_name: row.project_name,
  }))

  const blockedTasks = tasks.filter(task => task.status === 'blocked').slice(0, 5).map(taskItem)
  const nextTasks = tasks.filter(task => task.status !== 'blocked').slice(0, 5).map(taskItem)
  const improvementItems: BriefItem[] = proposals.map(row => ({
    type: 'missing_capability',
    title: cleanTitle(row.title, 'Missing capability proposal'),
    description: `${row.status.replace(/_/g, ' ')}${row.platform ? ` · ${row.platform}` : ''}`,
    href: '/system',
    action_label: 'Open system',
    project_name: row.project_name,
  }))

  const recentOutputs: BriefOutput[] = [
    ...reports.map(row => ({
      id: String(row.id),
      title: cleanTitle(row.title, 'Executive report'),
      type: 'Executive report',
      href: activeProject ? `${activeProject.href}` : '/reports',
      project_name: row.project_name,
      created_at: String(row.created_at),
    })),
    ...files.map(row => ({
      id: String(row.id),
      title: cleanTitle(row.title ?? row.filename, 'Generated file'),
      type: row.source_entity_type === 'ai_skill_output' ? 'AI skill output' : (row.content_type ?? 'File'),
      href: '/files',
      project_name: row.project_name,
      created_at: String(row.created_at),
    })),
    ...decisions.map(row => ({
      id: String(row.id),
      title: cleanTitle(row.title, 'Decision'),
      type: 'Decision',
      href: activeProject ? `${activeProject.href}` : '/projects',
      project_name: row.project_name,
      created_at: String(row.created_at),
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const priorityItems = [
    ...waitingForUser,
    ...pendingApprovals,
    ...blockedTasks,
    ...nextTasks,
    ...improvementItems,
  ].slice(0, 8)

  const recommendedNextAction = priorityItems[0] ?? (
    activeProject
      ? {
          type: 'project_next_step',
          title: `Move ${activeProject.name} forward`,
          description: 'Plan the next useful marketing action or generate a report.',
          href: activeProject.href,
          action_label: 'Open project',
          project_name: activeProject.name,
        }
      : {
          type: 'start',
          title: 'Create your first project',
          description: 'Start with a project so AÏKO can plan useful work.',
          href: '/home',
          action_label: 'Start',
        }
  )

  const issueCount = waitingForUser.length + pendingApprovals.length + blockedTasks.length
  const taskCount = nextTasks.length
  const todaySummary = issueCount > 0
    ? `${issueCount} item${issueCount === 1 ? '' : 's'} need attention before work flows smoothly.`
    : taskCount > 0
      ? `${taskCount} internal task${taskCount === 1 ? '' : 's'} are ready to work on.`
      : 'Everything is clear. Choose what you want AÏKO to work on.'

  const ceoProfile = setup.ceo_profile as { provider?: string | null; display_name?: string | null; auth_method?: string | null; model?: string | null } | null

  return {
    date: new Date().toISOString().slice(0, 10),
    greeting: greetingFor(),
    ceo_brain: {
      can_think: Boolean(setup.can_ceo_think),
      provider_name: ceoProfile?.provider ?? ceoProfile?.display_name ?? null,
      auth_method: ceoProfile?.auth_method ?? null,
      model: ceoProfile?.model ?? null,
    },
    active_project: activeProject,
    today_summary: todaySummary,
    priority_items: priorityItems,
    waiting_for_user: waitingForUser,
    pending_approvals: pendingApprovals,
    blocked_tasks: blockedTasks,
    next_tasks: nextTasks,
    recent_outputs: recentOutputs,
    recommended_next_action: recommendedNextAction,
  }
}

export function formatDailyBriefForCEO(brief: DailyBrief): string {
  const topItems = brief.priority_items.slice(0, 5)
  const itemText = topItems.length
    ? topItems.map((item, index) => `${index + 1}. ${item.title}: ${item.description}`).join('\n')
    : 'No urgent items need attention.'
  const next = brief.recommended_next_action
    ? `${brief.recommended_next_action.title}: ${brief.recommended_next_action.description}`
    : 'Choose what you want AÏKO to work on.'

  return [
    `${brief.greeting} ${brief.today_summary}`,
    '',
    'Priority items:',
    itemText,
    '',
    `Recommended next action: ${next}`,
    '',
    'This is read-only guidance. I did not open the browser, create approvals, or execute external actions.',
  ].join('\n')
}
