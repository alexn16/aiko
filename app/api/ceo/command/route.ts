import { NextRequest, NextResponse } from 'next/server'
import { runCeoCommandAgent } from '@/lib/agents/ceo-command-agent'
import { getProviderForRole, getAnyConnectedProvider } from '@/lib/ai/router'
import { getAllModelConfigs } from '@/lib/models/config'
import { delegateSearch } from '@/lib/web-operator/delegation'
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
      const needsWebResearch = detectWebResearchIntent(command.trim(), result as unknown as Record<string, unknown>)
      if (needsWebResearch) {
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

      let delegationResult: DelegationResult | null = null
      const needsWebResearch = detectWebResearchIntent(command.trim(), result as unknown as Record<string, unknown>)
      if (needsWebResearch) {
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
