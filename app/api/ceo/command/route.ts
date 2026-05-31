import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { runCeoCommandAgent } from '@/lib/agents/ceo-command-agent'
import { getProviderForRole, getAnyConnectedProvider } from '@/lib/ai/router'
import { delegateSearch, delegateOpenGmail, delegateGmailDraft, delegateSendGmail } from '@/lib/web-operator/delegation'
import type { DelegationResult } from '@/lib/web-operator/delegation'

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null

    const { command } = await request.json()
    if (!command?.trim()) {
      return NextResponse.json({ error: 'No command provided' }, { status: 400 })
    }

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

      if (isOpenGmail && operatorName) {
        delegationResult = await delegateOpenGmail({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
        }).catch(() => null)
      } else if (isPrepareEmail && operatorName && emailTo) {
        delegationResult = await delegateGmailDraft({
          to: emailTo,
          subject: emailSubject ?? 'No subject',
          body: command.trim(),
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
        }).catch(() => null)
      } else if (isSendEmail && operatorName) {
        delegationResult = await delegateSendGmail({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
        }).catch(() => null)
      } else if (isLeadOutreachIntent) {
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
      } else if (
        !!(command.trim().match(/check.*(repl(y|ied|ies)|response|inbox).*lead/i)) ||
        !!(command.trim().match(/has.*(lead|anyone|they).*(repl(ied|ies)|responded)/i)) ||
        !!(command.trim().match(/any.*(repl(y|ies)|response).*(from|gmail)/i))
      ) {
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
      } else if (needsWebResearch) {
        const query = extractSearchQuery(command.trim(), result as unknown as Record<string, unknown>)
        delegationResult = await delegateSearch({
          query,
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
        }).catch(() => null)
      }

      // Check capability gaps for strategy/create_project intents
      let capabilityGap: { missing: string[]; proposal_id: string; score: number } | null = null
      const resolvedProjectId = result.project_id
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

      return NextResponse.json({
        ...result,
        capability_gap: capabilityGap,
        delegation: delegationResult ? {
          status: delegationResult.status,
          message: delegationResult.message,
          actionId: delegationResult.actionId,
          taskOutputId: delegationResult.taskOutputId,
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
