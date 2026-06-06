import fs from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db/client'
import { callAI, type AgentRole } from '@/lib/ai/router'
import { createGeneratedFile } from '@/lib/generated-files'
import { createTaskOutput } from '@/lib/agents/task-outputs'

export type AgentTaskRunResult = {
  task_id: string
  status: 'done' | 'blocked' | 'failed'
  title: string
  assigned_agent_name: string
  output_summary: string
  output_file_id: string | null
  report_url: string | null
}

type AgentTaskRow = {
  id: string
  project_id: string | null
  owner_agent_id: string | null
  owner_role: string
  assigned_by_role: string
  title: string
  description: string
  status: string
  task_type: string
  output: Record<string, unknown> | string | null
}

type RunAgentTaskNowInput = {
  agentName: string
  role?: string
  taskType: string
  prompt: string
  projectId?: string | null
}

const SAFE_AUDIT_FILES = [
  'README.md',
  'CHANGELOG.md',
  'AIKO_APP_REPORT.md',
  'AIKO_RUNTIME_CHECK.md',
  'AIKO_APP_MAP.md',
  'lib/agents/tasks.ts',
  'lib/tasks/owner-tasks.ts',
  'app/api/ceo/command/route.ts',
  'app/(dashboard)/agents/page.tsx',
  'app/(dashboard)/tasks/page.tsx',
]

export function isAgentAssignmentIntent(command: string): boolean {
  return /\b(assign(?:ing)?\s+[A-Z][a-z]+|start prompting yourself|repo you are on|inspect the repo|audit how a[ïi]ko works|repo operational audit)\b/i.test(command)
}

export function inferAssignedAgentName(command: string): string {
  const assignMatch = command.match(/\bassign(?:ing)?\s+([A-Z][a-z]+)\b/i)
  if (assignMatch) return assignMatch[1]
  const namedTo = command.match(/\b([A-Z][a-z]+)\s+to\s+(?:inspect|audit|review|analyze)\b/i)
  if (namedTo) return namedTo[1]
  return 'Sven'
}

export function inferAgentTaskType(command: string): string {
  if (/\b(repo|repository|codebase|a[ïi]ko works|prompting yourself)\b/i.test(command)) return 'repo_operational_audit'
  if (/\b(risk|risks)\b/i.test(command)) return 'risk_analysis'
  if (/\b(report|summary)\b/i.test(command)) return 'report'
  return 'internal_analysis'
}

export async function runAgentTaskNow(input: RunAgentTaskNowInput): Promise<AgentTaskRunResult> {
  const task = await createAssignedAgentTask(input)
  await assignTaskToAgent({
    taskId: task.id,
    agentName: input.agentName,
    role: input.role ?? task.owner_role,
  })
  return runAgentTask(task.id)
}

export async function assignTaskToAgent(input: { taskId: string; agentName: string; role?: string }): Promise<void> {
  const agent = await findLiveAgent(input.agentName)
  await db.query(
    `UPDATE agent_tasks
        SET owner_agent_id = COALESCE($2, owner_agent_id),
            owner_role = COALESCE($3, owner_role),
            status = 'assigned',
            output = COALESCE(output, '{}'::jsonb)
              || jsonb_build_object(
                'assigned_agent_name', $4::text,
                'assigned_agent_id', $5::text,
                'assigned_role', COALESCE($3, owner_role),
                'assigned_at', NOW()
              ),
            updated_at = NOW()
      WHERE id = $1`,
    [input.taskId, agent?.id ?? null, input.role ?? null, input.agentName, agent?.id ?? null],
  )
  if (agent) {
    await db.query(
      `UPDATE agents
          SET status='working',
              current_task=(SELECT title FROM agent_tasks WHERE id=$2),
              progress=5,
              updated_at=NOW()
        WHERE id=$1`,
      [agent.id, input.taskId],
    )
  }
}

export async function runAgentTask(taskId: string): Promise<AgentTaskRunResult> {
  const task = await getAgentTask(taskId)
  if (!task) throw new Error('Task not found.')
  const output = parseOutput(task.output)
  const agentName = String(output.assigned_agent_name ?? task.owner_role ?? 'Agent')

  await markTaskWorking(taskId, agentName)

  try {
    const result = task.task_type === 'repo_operational_audit'
      ? await runRepoOperationalAudit(task, agentName)
      : await runInternalAnalysisTask(task, agentName)

    await completeAgentTaskWithOutput(taskId, result)
    await markLiveAgentDone(agentName, result.output_summary)
    return result
  } catch (err) {
    const reason = err instanceof Error ? sanitizeText(err.message) : 'The agent task failed.'
    await blockAgentTask(taskId, reason)
    await markLiveAgentBlocked(agentName, reason)
    return {
      task_id: taskId,
      status: 'blocked',
      title: task.title,
      assigned_agent_name: agentName,
      output_summary: reason,
      output_file_id: null,
      report_url: null,
    }
  }
}

export async function completeAgentTask(taskId: string, output: Record<string, unknown>): Promise<void> {
  await db.query(
    `UPDATE agent_tasks
        SET status='completed',
            completed_at=NOW(),
            output=COALESCE(output, '{}'::jsonb) || $2::jsonb,
            updated_at=NOW()
      WHERE id=$1`,
    [taskId, JSON.stringify(output)],
  )
}

export async function blockAgentTask(taskId: string, reason: string): Promise<void> {
  await db.query(
    `UPDATE agent_tasks
        SET status='blocked',
            output=COALESCE(output, '{}'::jsonb) || jsonb_build_object('error_message', $2::text, 'output_summary', $2::text),
            updated_at=NOW()
      WHERE id=$1`,
    [taskId, sanitizeText(reason)],
  )
}

export async function getAgentWorkStatus(agentName: string): Promise<{
  agent_name: string
  status: 'idle' | 'working' | 'blocked' | 'done'
  task_id: string | null
  task_title: string | null
  output_summary: string | null
  output_file_id: string | null
}> {
  const res = await db.query(
    `SELECT id, title, status, output
       FROM agent_tasks
      WHERE lower(COALESCE(output->>'assigned_agent_name', owner_role)) = lower($1)
      ORDER BY updated_at DESC
      LIMIT 1`,
    [agentName],
  )
  const row = res.rows[0]
  if (!row) return { agent_name: agentName, status: 'idle', task_id: null, task_title: null, output_summary: null, output_file_id: null }
  const output = parseOutput(row.output)
  const rawStatus = String(row.status)
  const status = ['assigned', 'working', 'in_progress'].includes(rawStatus)
    ? 'working'
    : rawStatus === 'blocked' || rawStatus === 'failed'
      ? 'blocked'
      : rawStatus === 'completed' || rawStatus === 'done'
        ? 'done'
        : 'idle'
  return {
    agent_name: agentName,
    status,
    task_id: String(row.id),
    task_title: String(row.title),
    output_summary: typeof output.output_summary === 'string' ? output.output_summary : null,
    output_file_id: typeof output.output_file_id === 'string' ? output.output_file_id : null,
  }
}

async function createAssignedAgentTask(input: RunAgentTaskNowInput): Promise<AgentTaskRow> {
  const role = input.role ?? inferRoleForAgent(input.agentName, input.taskType)
  const title = titleForTaskType(input.taskType)
  const res = await db.query(
    `INSERT INTO agent_tasks
       (project_id, owner_role, assigned_by_role, title, description, status, priority, task_type, output)
     VALUES ($1,$2,'CEO',$3,$4,'assigned','high',$5,$6::jsonb)
     RETURNING *`,
    [
      input.projectId ?? null,
      role,
      title,
      input.prompt,
      input.taskType,
      JSON.stringify({
        assigned_agent_name: input.agentName,
        assigned_role: role,
        input_prompt: input.prompt,
      }),
    ],
  )
  return res.rows[0] as AgentTaskRow
}

async function getAgentTask(taskId: string): Promise<AgentTaskRow | null> {
  const res = await db.query(`SELECT * FROM agent_tasks WHERE id=$1`, [taskId])
  return res.rows[0] as AgentTaskRow ?? null
}

async function markTaskWorking(taskId: string, agentName: string): Promise<void> {
  await db.query(
    `UPDATE agent_tasks
        SET status='working',
            started_at=COALESCE(started_at, NOW()),
            output=COALESCE(output, '{}'::jsonb) || jsonb_build_object('assigned_agent_name', $2::text, 'started_at', NOW()),
            updated_at=NOW()
      WHERE id=$1`,
    [taskId, agentName],
  )
}

async function completeAgentTaskWithOutput(taskId: string, result: AgentTaskRunResult): Promise<void> {
  await completeAgentTask(taskId, {
    assigned_agent_name: result.assigned_agent_name,
    output_summary: result.output_summary,
    output_file_id: result.output_file_id,
    report_url: result.report_url,
  })
}

async function runRepoOperationalAudit(task: AgentTaskRow, agentName: string): Promise<AgentTaskRunResult> {
  const context = await collectRepoAuditContext()
  const prompt = `You are ${agentName}, an internal AÏKO agent. Produce a concise repo operational audit.

User request:
${task.description}

Repo context:
${context}

Return Markdown with these headings:
- Operational map
- What works
- What is idle
- Missing execution links
- Blocked capabilities
- Recommended next fixes
- Owner-facing summary

Rules:
- Use only the provided repo context.
- Do not reveal secrets, tokens, env values, or raw private paths.
- Do not claim external web research.
- Be concrete and owner-friendly.`

  let markdown: string
  try {
    markdown = await callAI({
      role: 'project_manager',
      messages: [
        { role: 'system', content: 'You write concise internal operational audits for AÏKO. Do not include hidden reasoning or secrets.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1800,
    })
  } catch {
    markdown = deterministicRepoAudit(context)
  }

  markdown = sanitizeAuditMarkdown(markdown)
  const file = await createGeneratedFile({
    project_id: task.project_id,
    filename: 'AIKO_REPO_OPERATIONAL_AUDIT.md',
    content: markdown,
    content_type: 'markdown',
    title: 'AÏKO Repo Operational Audit',
    description: 'Internal agent audit of how AÏKO works and what should improve next.',
    generated_by_role: agentName,
    source_entity_type: 'agent_task',
    source_entity_id: task.id,
  })

  await createTaskOutput({
    task_id: task.id,
    project_id: task.project_id,
    agent_role: agentName,
    output_type: 'repo_operational_audit',
    title: 'AÏKO Repo Operational Audit',
    content: markdown,
    structured_data: {
      output_file_id: file.id,
      report_url: `/files/${file.id}`,
      external_action_executed: false,
    },
    status: 'ready',
    requires_approval: false,
  })

  return {
    task_id: task.id,
    status: 'done',
    title: task.title,
    assigned_agent_name: agentName,
    output_summary: summarizeMarkdown(markdown),
    output_file_id: file.id,
    report_url: `/files/${file.id}`,
  }
}

async function runInternalAnalysisTask(task: AgentTaskRow, agentName: string): Promise<AgentTaskRunResult> {
  const markdown = sanitizeAuditMarkdown(`# ${task.title}

${agentName} completed the internal analysis.

## Summary

${task.description}

## Next action

Review the task output and decide whether to create follow-up internal tasks.
`)
  const file = await createGeneratedFile({
    project_id: task.project_id,
    filename: `${task.task_type || 'agent-task-output'}.md`,
    content: markdown,
    content_type: 'markdown',
    title: task.title,
    description: 'Internal agent task output.',
    generated_by_role: agentName,
    source_entity_type: 'agent_task',
    source_entity_id: task.id,
  })
  return {
    task_id: task.id,
    status: 'done',
    title: task.title,
    assigned_agent_name: agentName,
    output_summary: summarizeMarkdown(markdown),
    output_file_id: file.id,
    report_url: `/files/${file.id}`,
  }
}

async function collectRepoAuditContext(): Promise<string> {
  const parts: string[] = []
  for (const file of SAFE_AUDIT_FILES) {
    const full = path.join(process.cwd(), file)
    try {
      const text = await fs.readFile(full, 'utf8')
      parts.push(`\n--- ${file} ---\n${sanitizeText(text).slice(0, 5000)}`)
    } catch {
      parts.push(`\n--- ${file} ---\nNot available.`)
    }
  }
  return parts.join('\n').slice(0, 30000)
}

function deterministicRepoAudit(context: string): string {
  const hasCeo = context.includes('app/api/ceo/command/route.ts')
  const hasTasks = context.includes('agent_tasks')
  const hasHome = context.includes('/home')
  return `# AÏKO Repo Operational Audit

## Operational map

- CEO Chat receives owner commands and routes them through command classification, provider routing, AI skills, Web Operator delegation, strategy planning, and reports.
- Internal tasks are stored in agent_tasks and surfaced in /tasks, /home, and project workspaces.
- Web Operator work remains separate from internal planning and requires browser supervision and approvals.

## What works

- ${hasHome ? 'The owner-facing /home flow is the primary command center.' : 'The owner-facing home flow needs confirmation.'}
- ${hasTasks ? 'Internal task storage exists and supports status updates.' : 'Internal task storage was not detected in the sampled files.'}
- ${hasCeo ? 'CEO command routing exists and handles several internal shortcuts.' : 'CEO command routing was not detected in the sampled files.'}

## What is idle

- Agent assignment has historically been mostly conversational unless a route creates a concrete task.
- Built-in agent cards are specs/status surfaces, not independent background workers.

## Missing execution links

- CEO assignment language must create a task, assign an agent, run or queue the task, and attach output.
- Agent pages need to derive working/blocked/done state from real task records.

## Blocked capabilities

- External sends, posts, messages, publishing, and security bypass remain intentionally blocked without approval/manual takeover.
- Fresh web facts still require Web Operator research.

## Recommended next fixes

1. Keep assignment language tied to task creation.
2. Use internal AI skills for thinking tasks before delegating to the browser.
3. Show active agent work from task status in /home, /tasks, and /agents.

## Owner-facing summary

AÏKO can plan and draft internally, but assignments must be backed by task records and output artifacts. This audit was produced without external actions.
`
}

function sanitizeAuditMarkdown(markdown: string): string {
  return sanitizeText(markdown)
    .replace(/(api[_-]?key|access[_-]?token|refresh[_-]?token|secret)\s*[:=]\s*\S+/gi, '$1: [redacted]')
    .trim()
}

function sanitizeText(text: string): string {
  return text
    .replace(/OPENAI_API_KEY=\S+/g, 'OPENAI_API_KEY=[redacted]')
    .replace(/ANTHROPIC_API_KEY=\S+/g, 'ANTHROPIC_API_KEY=[redacted]')
    .replace(/AUTH_SECRET=\S+/g, 'AUTH_SECRET=[redacted]')
    .replace(/NEXTAUTH_SECRET=\S+/g, 'NEXTAUTH_SECRET=[redacted]')
    .replace(/oauth_access_token\S*/gi, 'oauth_access_token[redacted]')
    .replace(/oauth_refresh_token\S*/gi, 'oauth_refresh_token[redacted]')
}

function summarizeMarkdown(markdown: string): string {
  const lines = markdown
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .filter(line => !/^here is\b/i.test(line))
  return (lines[0] ?? 'Agent task completed.').slice(0, 240)
}

function parseOutput(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  return {}
}

async function findLiveAgent(agentName: string): Promise<{ id: string } | null> {
  const res = await db.query(
    `SELECT id FROM agents WHERE lower(name)=lower($1) ORDER BY updated_at DESC LIMIT 1`,
    [agentName],
  ).catch(() => ({ rows: [] }))
  return res.rows[0] ? { id: String(res.rows[0].id) } : null
}

async function markLiveAgentDone(agentName: string, summary: string): Promise<void> {
  await db.query(
    `UPDATE agents
        SET status='idle', current_task=NULL, progress=100, latest_output=$2, updated_at=NOW()
      WHERE lower(name)=lower($1)`,
    [agentName, summary],
  ).catch(() => {})
}

async function markLiveAgentBlocked(agentName: string, reason: string): Promise<void> {
  await db.query(
    `UPDATE agents
        SET status='error', current_task=$2, progress=0, latest_output=$2, updated_at=NOW()
      WHERE lower(name)=lower($1)`,
    [agentName, reason],
  ).catch(() => {})
}

function inferRoleForAgent(agentName: string, taskType: string): string {
  if (/sven/i.test(agentName)) return 'repo_auditor'
  if (taskType === 'repo_operational_audit') return 'repo_auditor'
  return 'internal_agent'
}

function titleForTaskType(taskType: string): string {
  if (taskType === 'repo_operational_audit') return 'Repo operational audit'
  if (taskType === 'risk_analysis') return 'Risk analysis'
  return 'Internal agent task'
}
