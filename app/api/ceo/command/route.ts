import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db/client'
import { runCeoCommandAgent } from '@/lib/agents/ceo-command-agent'
import { getProviderForRole, getAnyConnectedProvider } from '@/lib/ai/router'
import { delegateSearch, delegateOpenGmail, delegateGmailDraft, delegateSendGmail, delegateToWebOperator, delegateOpenUrl } from '@/lib/web-operator/delegation'
import type { DelegationResult } from '@/lib/web-operator/delegation'
import { extractFirstUrl, getRecommendedSkillForInstruction, inferUnknownWebsiteFromInstruction } from '@/lib/web-operator/skills'
import { getDirectSiteTargetFromInstruction, siteNameForSkill } from '@/lib/web-operator/site-intents'
import { createSystemImprovementProposal, updateSystemImprovementLifecycle } from '@/lib/system-improvements'
import { getSystemImprovementTimeline } from '@/lib/system-improvement-timeline'
import { findProjectByNameOrAlias } from '@/lib/project-context'
import {
  createExecutionTasksFromPlan,
  findLatestStrategyExecutionPlanByHint,
  generateStrategyExecutionPlanFromText,
  type StrategyExecutionPlan,
} from '@/lib/strategy-execution-planner'

// ── Delegation helpers ─────────────────────────────────────────────────────────

function detectWebResearchIntent(command: string, parsed: Record<string, unknown>): boolean {
  const lower = command.toLowerCase()
  const keywords = ['search', 'find', 'research', 'look up', 'browse', 'check online', 'internet', 'web']
  return keywords.some(k => lower.includes(k))
}

function extractSearchQuery(command: string, _parsed: Record<string, unknown>): string {
  return command
    .replace(/^(search for|find|research|look up|browse|check)\s+/i, '')
    .trim()
    .slice(0, 200)
}

function playbookDelegationCopy(operatorName: string, result: DelegationResult): string {
  if (!result.playbookName) {
    const siteName = result.skillId ? siteNameForSkill(result.skillId) : 'the site'
    const directCopy = ['Facebook', 'LinkedIn', 'Instagram', 'Canva', 'Gmail'].includes(siteName)
      ? `${operatorName} will open ${siteName} directly in their browser session.`
      : `${operatorName} will open the site in their browser session.`
    return `${directCopy} If a login, CAPTCHA, or security check appears, they will pause and ask you to take over — they will not bypass it automatically.`
  }

  if (result.playbookId === 'facebook_group_research') {
    return `${operatorName} will use the Facebook Group Research playbook. They will open Facebook directly, pause if login/security appears, read visible group results, and ask approval before joining, posting, commenting, or messaging.`
  }
  if (result.playbookId === 'canva_instagram_draft') {
    return `${operatorName} will use the Canva Instagram Draft playbook. They will open Canva directly, pause if login/security appears, create only a safe draft, and ask approval before publishing, sharing, or downloading final assets.`
  }
  if (result.playbookId === 'gmail_prepare_draft') {
    return `${operatorName} will use the Gmail Prepare Draft playbook. They will open Gmail directly, pause if login/security appears, prepare a draft, and ask approval before sending.`
  }
  if (result.playbookId === 'gmail_open_and_check') {
    return `${operatorName} will use the Gmail Open and Check playbook. They will open Gmail directly, pause if login/security appears, and only read visible mail context requested by you.`
  }
  return `${operatorName} will use the ${result.playbookName} playbook. If a login, CAPTCHA, or security check appears, they will pause and ask you to take over — they will not bypass it automatically.`
}

function isStrategyExecutionPlannerIntent(command: string): boolean {
  return /\b(can\s+a[ïi]ko\s+(execute|do)|proceed with the strategy|make the agents execute|execute this strategy|use\s+(whatsapp|reddit|facebook|linkedin|instagram|canva|gmail|email)|best strategy is|strategy execution plan)\b/i.test(command)
}

function isCreateStrategyTasksIntent(command: string): boolean {
  return /\bcreate tasks? from\b.*\bexecution plan\b/i.test(command)
}

function extractProjectNameFromCommand(command: string): string | null {
  const match = command.match(/\bfor\s+([^,.]+?)(?:,|\s+the best\b|\s+use\b|\s+can\b|\s+create\b|$)/i)
  if (!match) return null
  return match[1].trim().replace(/\s+/g, ' ')
}

function hintFromStrategyCommand(command: string): string {
  const lower = command.toLowerCase()
  for (const hint of ['whatsapp', 'reddit', 'facebook', 'linkedin', 'instagram', 'canva', 'gmail', 'email']) {
    if (lower.includes(hint)) return hint
  }
  return command.slice(0, 80)
}

function isSelfImprovementLifecycleIntent(command: string): boolean {
  return /\b(can\s+a[ïi]ko\s+improve\s+itself|approve\s+the\s+.+capability|mark\s+.+capability\s+as\s+implemented|mark\s+.+implementation\s+started|validation\s+is\s+complete|what\s+is\s+the\s+status\s+of\s+the\s+missing\s+capability|status\s+of\s+.+capability)\b/i.test(command)
}

function isSelfImprovementTimelineIntent(command: string): boolean {
  return /\b(what improvements has a[ïi]ko proposed|status of (?:a[ïi]ko )?self-improvement|self-improvement status|which capabilities are missing|what was implemented recently|improvements has a[ïi]ko proposed|missing capabilities)\b/i.test(command)
}

async function persistCeoShortcutCommand(
  command: string,
  response: string,
  intent: string,
  actions: Array<Record<string, unknown>> = [],
  projectId: string | null = null,
) {
  await db.query(
    `INSERT INTO ceo_commands (command, response, intent, actions, project_id)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [command, response, intent, JSON.stringify(actions), projectId],
  )
}

async function handleSelfImprovementTimelineCommand(command: string): Promise<NextResponse | null> {
  if (!isSelfImprovementTimelineIntent(command)) return null

  const data = await getSystemImprovementTimeline()
  const latest = data.timeline.slice(0, 3)
  const latestText = latest.length > 0
    ? ` Recent events: ${latest.map(e => `${e.event_label} for "${e.title}"${e.project_name ? ` (${e.project_name})` : ''}`).join('; ')}.`
    : ' No improvement events have been recorded yet.'
  const health = data.health
    ? ` Health: ${data.health.blocked_by_validation} blocked by validation, ${data.health.waiting_for_implementation} waiting for implementation, ${data.health.capabilities_validated_this_week} validated this week.`
    : ''
  const response = `AÏKO has ${data.summary.proposed} proposed, ${data.summary.approved} approved, ${data.summary.in_progress} in progress, ${data.summary.pending_validation} pending validation, ${data.summary.validated} validated, and ${data.summary.rejected} rejected improvement proposal${data.timeline.length === 1 ? '' : 's'}.${latestText}${health} This is read-only status; no code was executed and no capability was enabled.`
  await persistCeoShortcutCommand(command, response, 'system_improvement_status')

  return NextResponse.json({
    response,
    intent: 'system_improvement_status',
    actions: [],
    project_id: null,
    improvement_timeline: data,
    delegation: null,
  })
}

function selfImprovementHint(command: string): string {
  const lower = command.toLowerCase()
  for (const hint of ['whatsapp', 'reddit', 'facebook', 'linkedin', 'instagram', 'canva', 'gmail', 'email']) {
    if (lower.includes(hint)) return hint
  }
  return ''
}

async function findSelfImprovementProposalForCommand(command: string): Promise<Record<string, unknown> | null> {
  const projectName = extractProjectNameFromCommand(command)
  const project = projectName ? await findProjectByNameOrAlias(projectName) : null
  const hint = selfImprovementHint(command)
  const values: unknown[] = []
  const conditions = [`sip.status NOT IN ('archived')`]
  let idx = 1

  if (project?.id) {
    conditions.push(`sip.related_project_id = $${idx++}`)
    values.push(project.id)
  }
  if (hint) {
    conditions.push(`(
      lower(sip.title) LIKE lower($${idx})
      OR lower(sip.summary) LIKE lower($${idx})
      OR lower(sip.reason) LIKE lower($${idx})
      OR lower(sip.proposal_metadata::text) LIKE lower($${idx})
      OR lower(sip.missing_capabilities::text) LIKE lower($${idx})
    )`)
    values.push(`%${hint}%`)
    idx++
  }

  const res = await db.query(
    `SELECT sip.*, p.name AS project_name
     FROM system_improvement_proposals sip
     LEFT JOIN projects p ON p.id = sip.related_project_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY sip.created_at DESC
     LIMIT 1`,
    values
  )
  return res.rows[0] ?? null
}

async function handleSelfImprovementLifecycleCommand(command: string): Promise<NextResponse | null> {
  if (!isSelfImprovementLifecycleIntent(command)) return null

  const proposal = await findSelfImprovementProposalForCommand(command)
  if (!proposal) {
    const response = 'I could not find a matching System Improvement Proposal. Create a strategy execution plan first so AÏKO can identify the missing capability.'
    await persistCeoShortcutCommand(command, response, 'system_improvement_lifecycle')
    return NextResponse.json({
      response,
      intent: 'system_improvement_lifecycle',
      actions: [],
      project_id: null,
      delegation: null,
    })
  }

  const id = String(proposal.id)
  const title = String(proposal.title)
  const status = String(proposal.status)
  const projectId = proposal.related_project_id ? String(proposal.related_project_id) : null

  const lower = command.toLowerCase()
  let response = `The proposal "${title}" is currently ${status.replace(/_/g, ' ')}.`
  let action: string | null = null

  if (/\bapprove\b/i.test(command)) {
    const updated = await updateSystemImprovementLifecycle(id, { action: 'approve' })
    response = `Approved "${updated.title}" for implementation. AÏKO did not run Codex or modify code; copy the implementation prompt and implement it externally.`
    action = 'approve'
  } else if (/\b(start|started|in progress)\b/i.test(command) && /\bimplementation\b/i.test(command)) {
    const updated = await updateSystemImprovementLifecycle(id, { action: 'start_implementation' })
    response = `Marked "${updated.title}" as implementation in progress. This only updates lifecycle tracking; no code ran inside AÏKO.`
    action = 'start_implementation'
  } else if (/\bimplemented\b/i.test(command) && !/\bvalidat/i.test(command)) {
    const updated = await updateSystemImprovementLifecycle(id, { action: 'mark_implemented' })
    response = `Marked "${updated.title}" as implemented pending validation. Build, tests, and runtime validation still need to be confirmed before it can be marked available.`
    action = 'mark_implemented'
  } else if (/\bvalidat/i.test(command)) {
    if (!/\b(complete|passed|done|validated)\b/i.test(command)) {
      response = `I will not mark "${title}" available yet. Explicitly confirm validation is complete and include the build/test/runtime result.`
    } else {
      try {
        const updated = await updateSystemImprovementLifecycle(id, {
          action: 'validate_available',
          validation_summary: command,
          validation_build_status: lower.includes('build') || lower.includes('passed') ? 'passed' : undefined,
          validation_test_status: lower.includes('test') || lower.includes('passed') ? 'passed' : undefined,
        })
        response = `Marked "${updated.title}" as validated available based on your validation summary. AÏKO did not run code automatically.`
        action = 'validate_available'
      } catch (err) {
        response = err instanceof Error ? err.message : `Could not mark "${title}" available.`
      }
    }
  }

  const actions = action ? [{ type: `system_improvement_${action}`, data: { proposal_id: id } }] : []
  await persistCeoShortcutCommand(command, response, 'system_improvement_lifecycle', actions, projectId)

  return NextResponse.json({
    response,
    intent: 'system_improvement_lifecycle',
    actions,
    project_id: projectId,
    delegation: null,
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null

    const { command } = await request.json()
    if (!command?.trim()) {
      return NextResponse.json({ error: 'No command provided' }, { status: 400 })
    }

    const timelineResponse = await handleSelfImprovementTimelineCommand(command.trim())
    if (timelineResponse) return timelineResponse

    const lifecycleResponse = await handleSelfImprovementLifecycleCommand(command.trim())
    if (lifecycleResponse) return lifecycleResponse

    // Check that at least one provider is reachable before calling the agent.
    // runCeoCommandAgent resolves its own provider via callAI(role:'ceo').
    const provider = await getProviderForRole('ceo', userId) ?? await getAnyConnectedProvider(userId)
    if (provider) {
      const result = await runCeoCommandAgent(command.trim())

      // Extract operator name from command
      let operatorName: string | undefined
      const operatorMatch = command.trim().match(/^([A-Z][a-z]+),\s+/i)
      if (operatorMatch) operatorName = operatorMatch[1]
      if (!operatorName) {
        const askMatch = command.trim().match(/(?:ask|have|get|tell)\s+([A-Z][a-z]+)\s+to/i)
        if (askMatch) operatorName = askMatch[1]
      }

      // Auto-delegate web research if intent detected
      let delegationResult: DelegationResult | null = null
      let strategyExecution: {
        plan: StrategyExecutionPlan
        missing_capabilities: string[]
        proposals_created: number
        tasks_created: number
        ready_to_execute: boolean
      } | null = null

      // Detect operator control commands
      const lcCommand = command.trim().toLowerCase()
      const isLoginDone = lcCommand.match(/(\w+)\s+(is\s+)?logged\s+in\s*(now)?/i)
      const isContinue = lcCommand.match(/(\w+),?\s+continue/i)
      const isStop = lcCommand.match(/(\w+),?\s+stop/i) ?? lcCommand.match(/stop\s+(\w+)/i)
      const isClearWorkflow = lcCommand.match(/clear\s+(\w+)'?s?\s+workflow/i)

      if (isLoginDone || isContinue) {
        const nameMatch = (isLoginDone || isContinue)?.[1]
        if (nameMatch && nameMatch.length > 2) {
          try {
            const { getWebOperatorByName, markLoginCompleted, resumeOperatorWorkflow } = await import('@/lib/web-operator/operators')
            const op = await getWebOperatorByName(nameMatch)
            if (op) {
              if (isLoginDone) {
                await markLoginCompleted(op.id)
              }
              if (op.pending_action_type) {
                await resumeOperatorWorkflow(op.id)
              }
              if (!delegationResult) {
                delegationResult = { status: 'completed', message: `${op.name} is resuming workflow.` }
              }
            }
          } catch { /* non-fatal */ }
        }
      }

      if (isStop) {
        const nameMatch = isStop?.[1]
        if (nameMatch && nameMatch.length > 2) {
          try {
            const { getWebOperatorByName, pauseOperator } = await import('@/lib/web-operator/operators')
            const op = await getWebOperatorByName(nameMatch)
            if (op) {
              await pauseOperator(op.id, 'Stopped by CEO')
              delegationResult = { status: 'blocked', message: `${op.name} has been paused.` }
            }
          } catch { /* non-fatal */ }
        }
      }

      if (isClearWorkflow) {
        const nameMatch = isClearWorkflow?.[1]
        if (nameMatch && nameMatch.length > 2) {
          try {
            const { getWebOperatorByName, clearOperatorWorkflow } = await import('@/lib/web-operator/operators')
            const op = await getWebOperatorByName(nameMatch)
            if (op) {
              await clearOperatorWorkflow(op.id)
              delegationResult = { status: 'completed', message: `${op.name}'s workflow has been cleared.` }
            }
          } catch { /* non-fatal */ }
        }
      }

      // Detect Gmail workflow intents (moved below control command detection)
      const isOpenGmail = lcCommand.includes('open gmail') || (lcCommand.includes('gmail') && !lcCommand.includes('draft') && !lcCommand.includes('send') && !lcCommand.includes('email to'))
      const isPrepareEmail = !!(command.trim().match(/prepare.*(email|mail)|write.*(email|mail)|draft.*(email|mail)/i))
      const isSendEmail = !!(command.trim().match(/\bsend\s+(it|the email|the draft|that)\b/i)) && !lcCommand.includes('send email to')
      const emailToMatch = command.trim().match(/to\s+([\w.+-]+@[\w-]+\.\w+)/)
      const emailTo = emailToMatch?.[1]
      const subjectMatch = command.trim().match(/(?:subject|about|re:)\s+([^,\n.]{3,80})/i)
      const emailSubject = subjectMatch?.[1]

      // Lead outreach intent detection (must come before generic web research)
      const isLeadOutreachIntent = !isPrepareEmail && !isOpenGmail && (
        !!(command.trim().match(/prepare.*(outreach|draft|email).*(lead|contact|prospect|approved)/i)) ||
        !!(command.trim().match(/(outreach|draft|email).*(approved lead|our lead)/i))
      )

      const needsWebResearch = detectWebResearchIntent(command.trim(), result as unknown as Record<string, unknown>)

      if (isCreateStrategyTasksIntent(command.trim())) {
        try {
          const plan = await findLatestStrategyExecutionPlanByHint(hintFromStrategyCommand(command.trim()))
          if (plan) {
            const created = await createExecutionTasksFromPlan(plan.id)
            strategyExecution = {
              plan: created.plan,
              missing_capabilities: created.plan.missing_capabilities.map(m => m.name),
              proposals_created: 0,
              tasks_created: created.tasks.length,
              ready_to_execute: created.plan.missing_capabilities.length === 0,
            }
          }
        } catch { /* non-fatal */ }
      } else if (isStrategyExecutionPlannerIntent(command.trim())) {
        try {
          const projectName = extractProjectNameFromCommand(command.trim())
          const project = projectName ? await findProjectByNameOrAlias(projectName) : null
          const projectId = String(result.project_id ?? project?.id ?? '')
          if (projectId) {
            const created = await generateStrategyExecutionPlanFromText({
              projectId,
              strategyText: command.trim(),
              createdByRole: 'CEO',
              createMissingCapabilityProposals: true,
            })
            strategyExecution = {
              plan: created.plan,
              missing_capabilities: created.plan.missing_capabilities.map(m => m.name),
              proposals_created: created.proposals.length,
              tasks_created: 0,
              ready_to_execute: created.plan.missing_capabilities.length === 0,
            }
          }
        } catch { /* non-fatal */ }
      }

      const recommendedSkill = operatorName
        ? await getRecommendedSkillForInstruction(command.trim())
        : null
      const unknownWebsite = operatorName && !recommendedSkill
        ? inferUnknownWebsiteFromInstruction(command.trim())
        : null
      const requestedUrl = extractFirstUrl(command.trim())
      const directSiteTarget = recommendedSkill
        ? getDirectSiteTargetFromInstruction(command.trim(), recommendedSkill.skill_id)
        : null

      if (unknownWebsite) {
        await createSystemImprovementProposal({
          title: `Add Web Operator skill for ${unknownWebsite}`,
          summary: `Create a governed Web Operator browser workflow for ${unknownWebsite}.`,
          reason: `CEO asked an operator to work on ${unknownWebsite}, but no Web Operator skill profile exists for that website.`,
          requested_by_role: 'CEO',
          related_project_id: result.project_id ?? null,
          missing_capabilities: [`web_operator_skill:${unknownWebsite}`],
          proposed_changes: [{
            capability_key: `web_operator_skill:${unknownWebsite}`,
            capability_name: `Web Operator skill for ${unknownWebsite}`,
            change_type: 'add',
            description: `Define safe browser-only workflow rules for ${unknownWebsite}.`,
            estimated_complexity: 'moderate',
          }],
          risk_level: 'medium',
          status: 'draft',
          implementation_prompt: `Add a Web Operator skill for ${unknownWebsite} before attempting automation. Include website_pattern, allowed browser actions, approval-required posting/sending/publishing actions, forbidden CAPTCHA/login bypass/private-data scraping actions, login policy, output types, and smoke tests.`,
        }).catch(() => {})
        delegationResult = {
          status: 'blocked',
          message: `AÏKO does not have a Web Operator skill for ${unknownWebsite} yet. I created a System Improvement Proposal instead of asking ${operatorName} to automate an unknown website blindly.`,
        }
      }

      if (!delegationResult && recommendedSkill?.skill_id === 'website_reader' && requestedUrl) {
        delegationResult = await delegateOpenUrl({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
          url: requestedUrl,
        }).catch(() => null)
      } else if (!delegationResult && recommendedSkill?.skill_id === 'facebook_research' && /\b(post|publish|comment|message|join)\b/i.test(command.trim())) {
        delegationResult = await delegateToWebOperator({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
          actionType: /\bmessage\b/i.test(command.trim()) ? 'send_message' : /\bcomment\b/i.test(command.trim()) ? 'post_comment' : /\bjoin\b/i.test(command.trim()) ? 'join_group' : 'create_post',
          targetUrl: 'https://www.facebook.com/',
          instruction: `${operatorName}, prepare the requested Facebook action but do not post, message, comment, or join until the approval item is approved.`,
          reason: 'Facebook action requires explicit approval',
          skillId: 'facebook_research',
        }).catch(() => null)
      } else if (!delegationResult && directSiteTarget && recommendedSkill && ['facebook_research', 'linkedin_research', 'instagram_research', 'canva_design'].includes(recommendedSkill.skill_id)) {
        const siteName = siteNameForSkill(recommendedSkill.skill_id)
        delegationResult = await delegateToWebOperator({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
          actionType: 'open_url',
          targetUrl: directSiteTarget.url,
          payload: directSiteTarget.query ? { query: directSiteTarget.query } : undefined,
          instruction: `${operatorName}, open ${siteName} directly in the browser session. Manual login/takeover may be required. Continue only safe browser actions; do not post, message, join, publish, share, or download final assets without approval.`,
          reason: `${siteName} Web Operator skill requested`,
          skillId: recommendedSkill.skill_id,
        }).catch(() => null)
      }

      if (!delegationResult && isOpenGmail && operatorName) {
        delegationResult = await delegateOpenGmail({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
        }).catch(() => null)
      } else if (!delegationResult && isPrepareEmail && operatorName && recommendedSkill?.skill_id === 'gmail_workflow' && !emailTo) {
        delegationResult = await delegateToWebOperator({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
          actionType: 'create_email_draft',
          targetUrl: 'https://mail.google.com/',
          payload: { body: command.trim() },
          instruction: `${operatorName}, open Gmail directly and prepare the requested draft. Do not send without approval.`,
          reason: 'Gmail draft preparation',
          skillId: 'gmail_workflow',
        }).catch(() => null)
      } else if (!delegationResult && isPrepareEmail && operatorName && emailTo) {
        delegationResult = await delegateGmailDraft({
          to: emailTo,
          subject: emailSubject ?? 'No subject',
          body: command.trim(),
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
        }).catch(() => null)
      } else if (!delegationResult && isSendEmail && operatorName) {
        delegationResult = await delegateSendGmail({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
        }).catch(() => null)
      } else if (!delegationResult && isLeadOutreachIntent) {
        try {
          const { delegateLeadToGmailDraft } = await import('@/lib/outreach/lead-outreach')
          const { listLeads } = await import('@/lib/leads')

          // Get first approved lead with email for the project
          const projectIdForLeads = result.project_id as string | undefined
          const leads = await listLeads({
            project_id: projectIdForLeads,
            status: 'approved',
            limit: 1,
          })
          const firstLead = leads.find(l => l.email)

          if (firstLead) {
            const outreachResult = await delegateLeadToGmailDraft({
              lead_id: firstLead.id,
              project_id: projectIdForLeads,
              operator_name: operatorName,
            })
            delegationResult = {
              status: outreachResult.success ? 'completed' : 'blocked',
              message: outreachResult.message,
              actionId: outreachResult.delegation?.actionId,
            }
          } else {
            // No approved lead with email found
            delegationResult = {
              status: 'blocked',
              message: 'No approved leads with email addresses found. Approve some leads and ensure they have email addresses before preparing outreach.',
            }
          }
        } catch { /* non-fatal */ }
      } else if (!delegationResult && (
        !!(command.trim().match(/check.*(repl(y|ied|ies)|response|inbox).*lead/i)) ||
        !!(command.trim().match(/has.*(lead|anyone|they).*(repl(ied|ies)|responded)/i)) ||
        !!(command.trim().match(/any.*(repl(y|ies)|response).*(from|gmail)/i))
      )) {
        // Check Gmail reply status for a lead via Web Operator (browser-only)
        try {
          const { listLeads } = await import('@/lib/leads')
          const { checkLeadReplyViaOperator } = await import('@/lib/outreach/reply-status')
          const projectIdForLeads = result.project_id as string | undefined
          const leads = await listLeads({
            project_id: projectIdForLeads,
            limit: 10,
          })
          // Find most recent lead with email — prefer any that's been contacted
          const target = leads.find(l => l.email && l.status === 'contacted')
            ?? leads.find(l => l.email)
          if (target) {
            const checkResult = await checkLeadReplyViaOperator({
              lead_id:    target.id,
              project_id: projectIdForLeads,
            })
            delegationResult = {
              status:   checkResult.error ? 'blocked' : 'completed',
              message:  checkResult.summary,
              actionId: checkResult.action_id,
            }
          } else {
            delegationResult = {
              status:  'blocked',
              message: 'No leads with email addresses found to check for replies.',
            }
          }
        } catch { /* non-fatal */ }
      } else if (!strategyExecution && !delegationResult && needsWebResearch) {
        const query = extractSearchQuery(command.trim(), result as unknown as Record<string, unknown>)
        delegationResult = await delegateSearch({
          query,
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
        }).catch(() => null)
      }

      // For new projects: attach start_campaign_url + launch template + strategy brief summary
      let startCampaignUrl: string | null = null
      let launchTemplate: Record<string, unknown> | null = null
      let strategyBrief: Record<string, unknown> | null = null
      const resolvedProjectId = result.project_id
      if (String(result.intent) === 'create_project' && resolvedProjectId) {
        startCampaignUrl = `/start-campaign?project_id=${resolvedProjectId}`
        try {
          const { getProjectLaunchTemplate } = await import('@/lib/project-launch-template')
          const tpl = await getProjectLaunchTemplate(String(resolvedProjectId))
          if (tpl) {
            launchTemplate = {
              id:       tpl.id,
              status:   tpl.status,
              checklist_count: tpl.checklist.length,
              checklist_done:  tpl.checklist.filter(i => i.completed).length,
            }
          }
        } catch { /* non-fatal */ }
        try {
          const { getProjectStrategyBrief } = await import('@/lib/project-strategy-brief')
          const brief = await getProjectStrategyBrief(String(resolvedProjectId))
          if (brief) {
            strategyBrief = {
              id:                       brief.id,
              title:                    brief.title,
              objective:                brief.objective,
              target_audience:          brief.target_audience,
              research_prompt:          brief.research_prompt,
              recommended_channel:      brief.recommended_channel,
              value_proposition:        brief.value_proposition,
              recommended_operator_id:  brief.recommended_operator_id,
              recommended_operator_name: brief.recommended_operator_name,
              operator_reason:          brief.operator_reason,
            }
          }
        } catch { /* non-fatal */ }
      }

      // Check capability gaps for strategy/create_project intents
      let capabilityGap: { missing: string[]; proposal_id: string; score: number } | null = null
      if (['strategy', 'create_project'].includes(String(result.intent)) && resolvedProjectId) {
        const strategyText = command.trim()
        try {
          const { generateCapabilityGapReport } = await import('@/lib/system-improvements')
          const gap = await generateCapabilityGapReport(strategyText, resolvedProjectId)
          if (gap.proposal && gap.check_result.missing.length > 0) {
            capabilityGap = {
              missing: gap.check_result.missing.map(c => c.name),
              proposal_id: gap.proposal.id,
              score: gap.check_result.score,
            }
          }
        } catch { /* non-fatal */ }
      }

      // ── Enrich delegation message with browser session and takeover guidance ──
      if (delegationResult && operatorName) {
        if (delegationResult.status === 'blocked' && delegationResult.message?.includes('needs your help')) {
          // CAPTCHA/login detected — make sure CEO also relays this clearly
          // (delegation already set the right message; we just preserve it)
        } else if (delegationResult.status === 'completed' || delegationResult.status === 'approval_required') {
          const takeover = ` ${playbookDelegationCopy(operatorName, delegationResult)}`
          if (delegationResult.message && !delegationResult.message.includes('take over')) {
            delegationResult = { ...delegationResult, message: delegationResult.message + takeover }
          }
        }
      }

      // If a recommended operator exists, append a mention to the CEO response
      let responseText = String(result.response ?? '')
      if (strategyExecution) {
        const missing = strategyExecution.missing_capabilities
        const planCopy = strategyExecution.ready_to_execute
          ? `AÏKO can prepare this campaign internally. I created the ${strategyExecution.plan.title} plan, and it is ready for task creation.`
          : `AÏKO cannot execute this strategy yet. I created the ${strategyExecution.plan.title} plan and flagged the missing capabilities: ${missing.join(', ')}.`
        const proposalCopy = strategyExecution.proposals_created > 0
          ? ` I also linked ${strategyExecution.proposals_created} System Improvement Proposal${strategyExecution.proposals_created === 1 ? '' : 's'} for approval before adding capabilities.`
          : ''
        const taskCopy = strategyExecution.tasks_created > 0
          ? ` I created ${strategyExecution.tasks_created} internal task${strategyExecution.tasks_created === 1 ? '' : 's'} from the plan. No external action was executed.`
          : ' No external action was executed.'
        responseText = `${planCopy}${proposalCopy}${taskCopy}`
      }
      if (
        String(result.intent) === 'create_project' &&
        strategyBrief &&
        typeof strategyBrief === 'object' &&
        'recommended_operator_name' in strategyBrief &&
        strategyBrief.recommended_operator_name
      ) {
        const opName = String(strategyBrief.recommended_operator_name)
        if (!responseText.toLowerCase().includes(opName.toLowerCase())) {
          // Ensure a clean sentence boundary (trim trailing whitespace first)
          const base = responseText.trimEnd()
          const separator = base.endsWith('.') || base.endsWith('!') || base.endsWith('?') ? ' ' : '. '
          responseText = base + separator + `I recommend ${opName} as the first Web Operator for this campaign.`
        }
      }

      // For project recall: attach quick-navigation chips
      let recallChips: Array<{ label: string; href: string }> | null = null
      if (String(result.intent) === 'project_recall' && result.project_id) {
        const pid = String(result.project_id)
        recallChips = [
          { label: '📁 Open project',             href: `/projects/${pid}` },
          { label: '▶ First Campaign Flow',        href: `/start-campaign?project_id=${pid}` },
          { label: '👥 Leads',                     href: `/leads?project_id=${pid}` },
        ]
      }

      // For executive report: attach report + project chips
      if (String(result.intent) === 'executive_report' && result.project_id) {
        const pid = String(result.project_id)
        recallChips = [
          { label: '📊 View reports',              href: `/projects/${pid}?tab=reports` },
          { label: '📁 Open project',              href: `/projects/${pid}` },
          { label: '▶ First Campaign Flow',        href: `/start-campaign?project_id=${pid}` },
        ]
      }

      return NextResponse.json({
        ...result,
        response:            responseText,
        capability_gap:      capabilityGap,
        actions:             strategyExecution ? [{
          type: 'strategy_execution_plan_created',
          data: {
            plan_id: strategyExecution.plan.id,
            status: strategyExecution.plan.status,
            ready_to_execute: strategyExecution.ready_to_execute,
            missing_capabilities: strategyExecution.missing_capabilities,
            tasks_created: strategyExecution.tasks_created,
          },
        }] : result.actions,
        start_campaign_url:  startCampaignUrl,
        launch_template:     launchTemplate,
        strategy_brief:      strategyBrief,
        strategy_execution:   strategyExecution,
        recall_chips:        recallChips,
        delegation: delegationResult ? {
          status: delegationResult.status,
          message: delegationResult.message,
          actionId: delegationResult.actionId,
          operatorId: delegationResult.operatorId,
          taskOutputId: delegationResult.taskOutputId,
          playbookId: delegationResult.playbookId,
          playbookName: delegationResult.playbookName,
        } : null,
      })
    }

    // Legacy fallback: old model_configs table
    return NextResponse.json(
      { error: 'AÏKO has no AI brain connected. Go to Connect AI to add a provider.' },
      { status: 503 }
    )
  } catch (err) {
    console.error('[api/ceo/command]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
