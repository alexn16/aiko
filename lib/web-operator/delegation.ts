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
import {
  getOrCreateOperatorByName,
  getWebOperatorByName,
  createWebOperator,
  updateOperatorStatus,
  updateOperatorMemory,
  storePendingAction,
  clearPendingAction,
} from '@/lib/web-operator/operators'
import type { WebOperator } from '@/lib/web-operator/operators'
import { createSystemImprovementProposal } from '@/lib/system-improvements'
import {
  getRecommendedSkillForInstruction,
  getSkillById,
  inferUnknownWebsiteFromInstruction,
  validateSkillAction,
} from '@/lib/web-operator/skills'
import type { SkillDecision, WebOperatorSkill } from '@/lib/web-operator/skills'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DelegationRequest {
  operatorName?: string    // optional named operator
  projectId?: string
  requestedByRole: string
  actionType: string
  instruction: string
  targetUrl?: string
  query?: string
  payload?: Record<string, unknown>
  reason?: string
  taskId?: string
  leadId?: string          // links the operator action to a specific lead
  skillId?: string
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
  operatorName?: string
  skillId?: string
  skillName?: string
  skillDecision?: SkillDecision
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


async function resolveSkillForDelegation(req: DelegationRequest): Promise<{
  skill: WebOperatorSkill | null
  decision: SkillDecision | null
  unknownWebsite: string | null
}> {
  const skill = req.skillId
    ? await getSkillById(req.skillId)
    : await getRecommendedSkillForInstruction(`${req.instruction} ${req.targetUrl ?? ''} ${req.query ?? ''}`)
  const unknownWebsite = skill ? null : inferUnknownWebsiteFromInstruction(req.instruction)
  const decision = skill ? await validateSkillAction(skill.skill_id, req.actionType, req.payload) : null
  return { skill, decision, unknownWebsite }
}

async function createUnknownWebsiteProposal(req: DelegationRequest, website: string): Promise<void> {
  await createSystemImprovementProposal({
    title: `Add Web Operator skill for ${website}`,
    summary: `Create a governed Web Operator browser workflow for ${website}.`,
    reason: `A Web Operator instruction referenced ${website}, but AÏKO does not have a governed skill profile for that website.`,
    requested_by_role: req.requestedByRole,
    related_project_id: req.projectId ?? null,
    missing_capabilities: [`web_operator_skill:${website}`],
    proposed_changes: [{
      capability_key: `web_operator_skill:${website}`,
      capability_name: `Web Operator skill for ${website}`,
      change_type: 'add',
      description: `Define allowed, approval-required, and forbidden browser actions for ${website}.`,
      estimated_complexity: 'moderate',
    }],
    risk_level: 'medium',
    status: 'draft',
    implementation_prompt: `Implement an AÏKO Web Operator skill for ${website}. Define website_pattern, safe allowed browser actions, approval-required actions for posting/messaging/sending/publishing, forbidden actions including CAPTCHA/login bypass and private-data scraping, and tests proving unknown automation is blocked until the skill exists.`,
  }).catch(() => {})
}

function skillContext(skill: WebOperatorSkill | null, decision: SkillDecision | null): string {
  if (!skill) return ''
  return `
Skill: ${skill.name} (${skill.skill_id})
Skill policy: ${decision?.reason ?? skill.login_policy}`
}

function buildCompletionMessage(actionType: string, output: Record<string, unknown>, operatorName?: string): string {
  const opStr = operatorName ? `${operatorName} ` : 'Web Operator '
  if (actionType === 'search') {
    const count = Array.isArray(output.results) ? output.results.length : 0
    if (count === 0) {
      return `${opStr}completed search, but no structured leads were extracted. Try a more specific query or use Web Operator to open target websites directly.`
    }
    return `${opStr}completed search — ${count} result${count !== 1 ? 's' : ''} found. Lead extraction is running in the background.`
  }
  if (actionType === 'read_page') return `${opStr}read the page and saved the content.`
  if (actionType === 'create_email_draft') return `${opStr}prepared the email draft.`
  return `${opStr}completed the action successfully.`
}

// ── Core delegation function ───────────────────────────────────────────────────

export async function delegateToWebOperator(req: DelegationRequest): Promise<DelegationResult> {
  // 1. Check mode
  const modeCheck = await canPerformAction(
    ['send_email', 'submit_form'].includes(req.actionType) ? 'send_email' : 'browse_web'
  )
  if (!modeCheck.allowed) {
    await sendInternalBlockMessage(req, modeCheck.reason)
    // Produce a user-readable message instead of a raw internal reason string
    const modeBlockMsg = modeCheck.mode === 'read_only'
      ? 'Research is blocked because AÏKO is in Read Only mode. Go to Operating Mode and switch to Auto / Approval Required to allow browser research.'
      : modeCheck.reason
    return { status: 'blocked', message: modeBlockMsg, error: modeCheck.reason }
  }

  const skillResolution = await resolveSkillForDelegation(req)
  const skill = skillResolution.skill
  const skillDecision = skillResolution.decision

  if (skillResolution.unknownWebsite) {
    await createUnknownWebsiteProposal(req, skillResolution.unknownWebsite)
    const message = `AÏKO does not have a Web Operator skill for ${skillResolution.unknownWebsite} yet, so it created a System Improvement Proposal instead of attempting unsafe unknown automation.`
    await sendInternalBlockMessage(req, message)
    return { status: 'blocked', message, error: message }
  }

  // 2. Resolve operator
  let operator: WebOperator | null = null
  let profileKey = 'default'

  if (req.operatorName) {
    operator = await getOrCreateOperatorByName(req.operatorName).catch(() => null)
    profileKey = operator?.browser_profile_key ?? req.operatorName.toLowerCase().replace(/\s+/g, '-')
  } else {
    operator = await getWebOperatorByName('Default').catch(() => null)
    if (!operator) {
      operator = await createWebOperator({ name: 'Default' }).catch(() => null)
    }
    profileKey = operator?.browser_profile_key ?? 'default'
  }

  // 2b. Store pending action for resumable action types
  const RESUMABLE_ACTIONS = ['open_gmail', 'create_email_draft', 'fill_gmail_to', 'fill_gmail_subject', 'fill_gmail_body', 'send_gmail_draft', 'open_url', 'search']
  if (operator && RESUMABLE_ACTIONS.includes(req.actionType)) {
    const safePayload: Record<string, unknown> = {}
    if (req.query) safePayload.query = req.query
    if (req.targetUrl) safePayload.url = req.targetUrl
    if (req.payload) Object.assign(safePayload, req.payload)
    await storePendingAction(operator.id, req.actionType, safePayload).catch(() => {})
  }

  // 3. Send internal message: requestedByRole → Web Operator
  try {
    await sendAgentMessage({
      project_id: req.projectId,
      from_role: req.requestedByRole,
      to_role: req.operatorName ? `Web Operator (${req.operatorName})` : 'Web Operator',
      message_type: 'instruction',
      subject: req.instruction,
      content: `Action: ${req.actionType}\n${req.targetUrl ? `URL: ${req.targetUrl}\n` : ''}${req.query ? `Query: ${req.query}\n` : ''}Reason: ${req.reason ?? 'Delegated action'}${skillContext(skill, skillDecision)}`,
    })
  } catch {
    // non-fatal
  }

  // 4. Mark operator working
  if (operator?.id) {
    await updateOperatorStatus(operator.id, 'working', {
      current_task: req.instruction.slice(0, 200),
    }).catch(() => {})
  }

  // 5. Get or start session
  const activeSession = await getActiveSession()
  const session = activeSession ?? await startWebOperatorSession({
    project_id: req.projectId,
    agent_role: req.requestedByRole,
    permission_mode: modeCheck.mode,
    operator_id: operator?.id ?? null,
    browser_profile_key: profileKey,
  })

  // 6. Build action input
  const input: Record<string, unknown> = {}
  if (req.query) input.query = req.query
  if (req.targetUrl) input.url = req.targetUrl
  if (req.payload) Object.assign(input, req.payload)

  // 7. Run Web Operator action
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
    operator_id: operator?.id ?? null,
    lead_id: req.leadId ?? null,
    profileKey,
    skill_id: skill?.skill_id ?? null,
    skill_name: skill?.name ?? null,
    skill_decision: skillDecision ?? null,
  })

  // Mark operator idle after action
  if (operator?.id) {
    const newStatus = result.waiting_approval ? 'waiting_approval' : result.success ? 'idle' : 'idle'
    await updateOperatorStatus(operator.id, newStatus, {
      current_task: result.success ? null : undefined,
    }).catch(() => {})

    // Clear pending action on success
    if (result.success) {
      await clearPendingAction(operator.id).catch(() => {})
    }
  }

  // Update operator memory after action
  if (operator?.id) {
    const actionOutput = result.action?.output ?? {}
    const isGmailAction = req.actionType.startsWith('open_gmail') ||
      req.actionType.startsWith('fill_gmail') ||
      req.actionType === 'detect_gmail_login' ||
      req.actionType === 'create_email_draft' ||
      req.actionType === 'send_gmail_draft'

    if (result.success) {
      await updateOperatorMemory(operator.id, {
        last_instruction: req.instruction,
        current_workflow: isGmailAction ? 'gmail' : (req.actionType === 'search' ? 'research' : undefined),
        current_goal: req.instruction,
        requires_user_input: false,
        waiting_reason: null,
      }).catch(() => {})
    }

    // If login_required in result output
    if (actionOutput.login_required) {
      await updateOperatorMemory(operator.id, {
        requires_user_input: true,
        waiting_reason: String(actionOutput.error ?? 'Login required'),
      }).catch(() => {})
    }
  }

  // Handle waiting_approval
  if (result.waiting_approval) {
    return {
      status: 'approval_required',
      actionId: result.action?.id,
      sessionId: session.id,
      approvalId: result.approval?.id,
      operatorName: operator?.name,
      skillId: skill?.skill_id,
      skillName: skill?.name,
      skillDecision: skillDecision ?? undefined,
      message: `${req.requestedByRole} requested a browser action that needs your approval before proceeding.`,
    }
  }

  if (!result.success) {
    // ── Manual takeover required (CAPTCHA / login / security checkpoint) ──
    if ((result as { waiting_user?: boolean }).waiting_user) {
      const name = operator?.name ?? 'The operator'
      return {
        status: 'blocked',
        actionId: result.action?.id,
        operatorName: operator?.name,
        skillId: skill?.skill_id,
        skillName: skill?.name,
        skillDecision: skillDecision ?? undefined,
        message: `${name} needs your help. Please solve the CAPTCHA, complete the login, or pass the security check in the browser, then click "Login / CAPTCHA completed" in the operator panel.`,
        error: result.error,
      }
    }

    // Produce a clean user-facing message for known error patterns
    const rawError = result.error ?? 'Web Operator action failed.'
    let userMessage = rawError
    if (rawError.includes("Executable doesn't exist") || rawError.includes('browserType.launch')) {
      userMessage = 'Browser runtime is missing. Run: npx playwright install chromium'
    }
    return {
      status: 'failed',
      actionId: result.action?.id,
      error: rawError,
      operatorName: operator?.name,
      skillId: skill?.skill_id,
      skillName: skill?.name,
      skillDecision: skillDecision ?? undefined,
      message: userMessage,
    }
  }

  // 8. Save result as task output if useful
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

  // Auto-extract leads after research (non-blocking, fire-and-forget)
  if (result.action?.id && req.projectId && ['search', 'read_page'].includes(req.actionType)) {
    import('@/lib/leads').then(({ extractLeadsFromWebOperatorAction }) => {
      extractLeadsFromWebOperatorAction(result.action!.id, req.projectId).catch(() => {})
    }).catch(() => {})
  }

  return {
    status: 'completed',
    actionId: result.action?.id,
    sessionId: session.id,
    output: actionOutput,
    taskOutputId,
    operatorName: operator?.name,
    skillId: skill?.skill_id,
    skillName: skill?.name,
    skillDecision: skillDecision ?? undefined,
    message: buildCompletionMessage(req.actionType, actionOutput, operator?.name),
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
  operatorName?: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'search',
    instruction: `Search: ${opts.query}`,
    query: opts.query,
    reason: 'Web search requested',
    taskId: opts.taskId,
    operatorName: opts.operatorName,
    skillId: 'general_web_research',
  })
}

export async function delegateReadWebsite(opts: {
  url: string
  projectId?: string
  requestedByRole: string
  taskId?: string
  operatorName?: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'read_page',
    instruction: `Read page: ${opts.url}`,
    targetUrl: opts.url,
    reason: 'Page read requested',
    taskId: opts.taskId,
    operatorName: opts.operatorName,
    skillId: 'website_reader',
  })
}

export async function delegateOpenUrl(opts: {
  url: string
  projectId?: string
  requestedByRole: string
  operatorName?: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'open_url',
    instruction: `Open URL: ${opts.url}`,
    targetUrl: opts.url,
    reason: 'URL navigation requested',
    operatorName: opts.operatorName,
    skillId: 'website_reader',
  })
}

export async function delegateEmailDraft(opts: {
  to?: string
  subject?: string
  body?: string
  projectId?: string
  requestedByRole: string
  operatorName?: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'create_email_draft',
    instruction: `Prepare email draft${opts.subject ? `: ${opts.subject}` : ''}`,
    payload: { to: opts.to, subject: opts.subject, body: opts.body },
    reason: 'Email draft preparation',
    operatorName: opts.operatorName,
    skillId: 'gmail_workflow',
  })
}

export async function delegateExternalAction(opts: {
  actionType: string
  instruction: string
  projectId?: string
  requestedByRole: string
  targetUrl?: string
  payload?: Record<string, unknown>
  operatorName?: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: opts.actionType,
    instruction: opts.instruction,
    targetUrl: opts.targetUrl,
    payload: opts.payload,
    reason: 'Delegated external action',
    operatorName: opts.operatorName,
    skillId: opts.payload?.skillId ? String(opts.payload.skillId) : undefined,
  })
}

// ── Gmail delegation helpers ───────────────────────────────────────────────────

export async function delegateOpenGmail(opts: {
  projectId?: string
  requestedByRole: string
  operatorName?: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    operatorName: opts.operatorName,
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'open_gmail',
    instruction: 'Open Gmail in browser',
    reason: 'Email workflow',
    skillId: 'gmail_workflow',
  })
}

export async function delegateGmailDraft(opts: {
  to: string
  subject: string
  body: string
  projectId?: string
  requestedByRole: string
  operatorName?: string
  leadId?: string
}): Promise<DelegationResult> {
  return delegateToWebOperator({
    operatorName: opts.operatorName,
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'create_email_draft',
    instruction: `Prepare Gmail draft to ${opts.to}`,
    payload: { to: opts.to, subject: opts.subject, body: opts.body },
    reason: 'Email draft preparation',
    leadId: opts.leadId,
    skillId: 'gmail_workflow',
  })
}

export async function delegateSendGmail(opts: {
  projectId?: string
  requestedByRole: string
  operatorName?: string
}): Promise<DelegationResult> {
  const modeCheck = await canPerformAction('send_email')
  if (!modeCheck.allowed) {
    return { status: 'blocked', message: modeCheck.reason, error: modeCheck.reason }
  }
  if (modeCheck.mode === 'auto_approval') {
    return {
      status: 'approval_required',
      message: 'Sending email requires approval. Go to the Approval Center to authorize this send.',
    }
  }
  // full_access: proceed
  return delegateToWebOperator({
    operatorName: opts.operatorName,
    projectId: opts.projectId,
    requestedByRole: opts.requestedByRole,
    actionType: 'send_gmail_draft',
    instruction: 'Send Gmail draft',
    reason: 'Approved email send',
    skillId: 'gmail_workflow',
  })
}
