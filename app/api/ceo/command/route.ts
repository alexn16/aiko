import { NextRequest, NextResponse } from 'next/server'
import { runCeoCommandAgent } from '@/lib/agents/ceo-command-agent'
import { getProviderForRole, getAnyConnectedProvider } from '@/lib/ai/router'
import { getAllModelConfigs } from '@/lib/models/config'
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
    const { command } = await request.json()
    if (!command?.trim()) {
      return NextResponse.json({ error: 'No command provided' }, { status: 400 })
    }

    // Try new provider router first
    const provider = await getProviderForRole('ceo') ?? await getAnyConnectedProvider()
    if (provider) {
      const modelConfig = {
        baseURL: provider.base_url ?? '',
        apiKey: provider.api_key_encrypted ?? '',
        model: provider.model ?? '',
      }
      const result = await runCeoCommandAgent(command.trim(), modelConfig)

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
    const configs = await getAllModelConfigs()
    const legacyConfig = configs['ceoAgent'] ?? configs['researchAgent'] ?? Object.values(configs)[0]
    if (legacyConfig) {
      const result = await runCeoCommandAgent(command.trim(), legacyConfig)

      // Extract operator name (legacy path)
      let operatorNameLegacy: string | undefined
      const operatorMatchLegacy = command.trim().match(/^([A-Z][a-z]+),\s+/i)
      if (operatorMatchLegacy) operatorNameLegacy = operatorMatchLegacy[1]
      if (!operatorNameLegacy) {
        const askMatchLegacy = command.trim().match(/(?:ask|have|get|tell)\s+([A-Z][a-z]+)\s+to/i)
        if (askMatchLegacy) operatorNameLegacy = askMatchLegacy[1]
      }

      // Detect Gmail workflow intents (legacy path)
      const lcCommandLegacy = command.trim().toLowerCase()
      const isOpenGmailLegacy = lcCommandLegacy.includes('open gmail') || (lcCommandLegacy.includes('gmail') && !lcCommandLegacy.includes('draft') && !lcCommandLegacy.includes('send') && !lcCommandLegacy.includes('email to'))
      const isPrepareEmailLegacy = !!(command.trim().match(/prepare.*(email|mail)|write.*(email|mail)|draft.*(email|mail)/i))
      const isSendEmailLegacy = !!(command.trim().match(/\bsend\s+(it|the email|the draft|that)\b/i)) && !lcCommandLegacy.includes('send email to')
      const emailToMatchLegacy = command.trim().match(/to\s+([\w.+-]+@[\w-]+\.\w+)/)
      const emailToLegacy = emailToMatchLegacy?.[1]
      const subjectMatchLegacy = command.trim().match(/(?:subject|about|re:)\s+([^,\n.]{3,80})/i)
      const emailSubjectLegacy = subjectMatchLegacy?.[1]

      let delegationResult: DelegationResult | null = null
      const needsWebResearch = detectWebResearchIntent(command.trim(), result as unknown as Record<string, unknown>)

      if (isOpenGmailLegacy && operatorNameLegacy) {
        delegationResult = await delegateOpenGmail({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName: operatorNameLegacy,
        }).catch(() => null)
      } else if (isPrepareEmailLegacy && operatorNameLegacy && emailToLegacy) {
        delegationResult = await delegateGmailDraft({
          to: emailToLegacy,
          subject: emailSubjectLegacy ?? 'No subject',
          body: command.trim(),
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName: operatorNameLegacy,
        }).catch(() => null)
      } else if (isSendEmailLegacy && operatorNameLegacy) {
        delegationResult = await delegateSendGmail({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName: operatorNameLegacy,
        }).catch(() => null)
      } else if (needsWebResearch) {
        const query = extractSearchQuery(command.trim(), result as unknown as Record<string, unknown>)
        delegationResult = await delegateSearch({
          query,
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName: operatorNameLegacy,
        }).catch(() => null)
      }

      // Check capability gaps for strategy/create_project intents
      let capabilityGap: { missing: string[]; proposal_id: string; score: number } | null = null
      const resolvedProjectIdLegacy = result.project_id
      if (['strategy', 'create_project'].includes(String(result.intent)) && resolvedProjectIdLegacy) {
        const strategyText = command.trim()
        try {
          const { generateCapabilityGapReport } = await import('@/lib/system-improvements')
          const gap = await generateCapabilityGapReport(strategyText, resolvedProjectIdLegacy)
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

    return NextResponse.json(
      { error: 'AÏKO has no AI brain connected. Go to Connect AI to add a provider.' },
      { status: 503 }
    )
  } catch (err) {
    console.error('[api/ceo/command]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
