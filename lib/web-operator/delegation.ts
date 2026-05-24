import { canPerformAction } from '@/lib/operating-mode'
import { sendAgentMessage } from '@/lib/agents/internal-communication'
import { createAgentTask } from '@/lib/agents/tasks'
import { createTaskOutput } from '@/lib/agents/task-outputs'
import {
  getActiveSession,
  startWebOperatorSession,
  runWebOperatorAction,
} from '@/lib/web-operator/web-operator'
import type { WebOperatorActionType } from '@/lib/web-operator/web-operator'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DelegationRequest {
  projectId?: string
  requestedByRole: string
  actionType: string
  instruction: string
  targetUrl?: string
  query?: string
  payload?: Record<string, unknown>
  reason?: string
  taskId?: string
}

export type DelegationStatus = 'completed' | 'approval_required' | 'blocked' | 'failed'

export interface DelegationResult {
  status: DelegationStatus
  actionId?: string
  sessionId?: string
  output?: Record<string, unknown>
  approvalId?: string
  taskOutputId?: string
  error?: string
  message: string
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function sendInternalBlockMessage(req: DelegationRequest, reason: string): Promise<void> {
  try {
    await sendAgentMessage({
      project_id: req.projectId,
      from_role: 'Web Operator',
      to_role: req.requestedByRole,
      message_type: 'blocker',
      subject: `Blocked: ${req.instruction}`,
      content: `The Web Operator could not execute "${req.instruction}" because: ${reason}`,
    })
  } catch {
    // non-fatal
  }
}

function shouldSaveOutput(actionType: string): boolean {
  return ['search', 'read_page', 'open_url', 'copy_data'].includes(actionType)
}

function mapActionTypeToOutputType(actionType: string): string {
  const map: Record<string, string> = {
    search: 'research_brief',
    read_page: 'research_brief',
    open_url: 'research_brief',
    copy_data: 'research_brief',
    create_email_draft: 'outreach_draft',
    fill_form: 'approval_item',
  }
  return map[actionType] ?? 'note'
}

function mapActionTypeToTaskType(actionType: string): string {
  const map: Record<string, string> = {
    search: 'research',
    read_page: 'research',
    open_url: 'research',
    copy_data: 'research',
    create_email_draft: 'copywriting',
    fill_form: 'approval_preparation',
    send_email: 'outreach_preparation',
    submit_form: 'outreach_preparation',
  }
  return map[actionType] ?? 'project_map'
}

function formatOutputContent(actionType: string, output: Record<string, unknown>): string {
  if (actionType === 'search' && Array.isArray(output.results)) {
    return (output.results as Array<{ title: string; url: string; snippet?: string }>)
      .slice(0, 10)
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet ?? ''}`)
      .join('\n\n')
  }
  if (output.text_preview) return String(output.text_preview)
  return JSON.stringify(output, null, 2).slice(0, 2000)
}

function buildCompletionMessage(actionType: string, output: Record<string, unknown>): string {
  if (actionType === 'search') {
    const count = Array.isArray(output.results) ? output.results.length : 0
    return `Web Operator completed search — ${count} result${count !== 1 ? 's' : ''} found and saved.`
  }
  if (actionType === 'read_page') return `Web Operator read the page and saved the content.`
  if (actionType === 'create_email_draft') return `Web Operator prepared the email draft.`
  return `Web Operator completed the action successfully.`
}

// ── Core delegation function ───────────────────────────────────────────────────

export async function delegateToWebOperator(req: DelegationRequest): Promise<DelegationResult> {
  // 1. Check mode
  const modeCheck = await canPerformAction(
    ['send_email', 'submit_form'].includes(req.actionType) ? 'send_email' : 'browse_web'
  )
  if (!modeCheck.allowed) {
    await sendInternalBlockMessage(req, modeCheck.reason)
    return { status: 'blocked', message: modeCheck.reason, error: modeCheck.reason }
  }

  // 2. Send internal message: requestedByRole → Web Operator
  try {
    await sendAgentMessage({
      project_id: req.projectId,
      from_role: req.requestedByRole,
      to_role: 'Web Operator',
      message_type: 'instruction',
      subject: req.instruction,
      content: `Action: ${req.actionType}\n${req.targetUrl ? `URL: ${req.targetUrl}\n` : ''}${req.query ? `Query: ${req.query}\n` : ''}Reason: ${req.reason ?? 'Delegated action'}`,
    })
  } catch {
    // non-fatal
  }

  // 3. Get or start session
  const activeSession = await getActiveSession()
  const session = activeSession ?? await startWebOperatorSession({
    project_id: req.projectId,
    agent_role: req.requestedByRole,
    permission_mode: modeCheck.mode,
  })

  // 4. Build action input
  const input: Record<string, unknown> = {}
  if (req.query) input.query = req.query
  if (req.targetUrl) input.url = req.targetUrl
  if (req.payload) Object.assign(input, req.payload)

  // 5. Run Web Operator action
  const result = await runWebOperatorAction({
    session_id: session.id,
    project_id: req.projectId,
    agent_role: req.requestedByRole,
    action_type: req.actionType as WebOperatorActionType,
    target_url: req.targetUrl,
    description: req.instruction,
    input,
    source_task_id: req.taskId,
    requested_by_role: req.requestedByRole,
  })

  // Handle waiting_approval
  if (result.waiting_approval) {
    return {
      status: 'approval_required',
      actionId: result.action?.id,
      sessionId: session.id,
      approvalId: result.approval?.id,
      message: `${req.requestedByRole} requested a browser action that needs your approval before proceeding.`,
    }
  }

  if (!result.success) {
    return {
      status: 'failed',
      actionId: result.action?.id,
      error: result.error,
      message: result.error ?? 'Web Operator action failed.',
    }
  }

  // 6. Save result as task output if useful
  const actionOutput = result.action?.output ?? {}
  let taskOutputId: string | undefined
  if (Object.keys(actionOutput).length > 0 && req.projectId && shouldSaveOutput(req.actionType)) {
    try {
      const outputContent = formatOutputContent(req.actionType, actionOutput)
      const taskOutput = await createTaskOutput({
        project_id: req.projectId,
        agent_role: req.requestedByRole,
        output_type: mapActionTypeToOutputType(req.actionType),
        title: req.instruction,
        content: outputContent,
        task_id: req.taskId,
      })
      taskOutputId = taskOutput.id
    } catch {
      // non-fatal
    }
  }

  return {
    status: 'completed',
    actionId: result.action?.id,
    sessionId: session.id,
    output: actionOutput,
    taskOutputId,
    message: buildCompletionMessage(req.actionType, actionOutput),
  }
}

// ── Task creation ──────────────────────────────────────────────────────────────

export async function createOperatorTaskFromAgentRequest(
  req: DelegationRequest,
  delegationResult: DelegationResult
): Promise<void> {
  if (req.taskId) return // already linked to an existing task

  try {
    await createAgentTask({
      project_id: req.projectId,
      owner_role: 'Web Operator',
      assigned_by_role: req.requestedByRole,
      title: req.instruction,
      status:
        delegationResult.status === 'completed' ? 'completed' :
        delegationResult.status === 'approval_required' ? 'review' :
        delegationResult.status === 'blocked' ? 'blocked' : 'in_progress',
      task_type: mapActionTypeToTaskType(req.actionType),
      description: req.reason ?? '',
    })
  } catch {
    // non-fatal
  }
}

// ── Convenience wrappers ───────────────────────────────────────────────────────

export async function delegateSearch(opts: {
  query: string
  projectId?: string
  requestedByRole: string
  taskId?: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'search',
    instruction: `Search: ${opts.query}`,
    query: opts.query,
    reason: 'Web search requested',
    taskId: opts.taskId,
  })
}

export async function delegateReadWebsite(opts: {
  url: string
  projectId?: string
  requestedByRole: string
  taskId?: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'read_page',
    instruction: `Read page: ${opts.url}`,
    targetUrl: opts.url,
    reason: 'Page read requested',
    taskId: opts.taskId,
  })
}

export async function delegateOpenUrl(opts: {
  url: string
  projectId?: string
  requestedByRole: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'open_url',
    instruction: `Open URL: ${opts.url}`,
    targetUrl: opts.url,
    reason: 'URL navigation requested',
  })
}

export async function delegateEmailDraft(opts: {
  to?: string
  subject?: string
  body?: string
  projectId?: string
  requestedByRole: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'create_email_draft',
    instruction: `Prepare email draft${opts.subject ? `: ${opts.subject}` : ''}`,
    payload: { to: opts.to, subject: opts.subject, body: opts.body },
    reason: 'Email draft preparation',
  })
}

export async function delegateExternalAction(opts: {
  actionType: string
  instruction: string
  projectId?: string
  requestedByRole: string
  targetUrl?: string
  payload?: Record<string, unknown>
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: opts.actionType,
    instruction: opts.instruction,
    targetUrl: opts.targetUrl,
    payload: opts.payload,
    reason: 'Delegated external action',
  })
}
