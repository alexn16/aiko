import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { runCeoCommandAgent } from '@/lib/agents/ceo-command-agent'
import { getProviderForRole, getAnyConnectedProvider } from '@/lib/ai/router'
import { delegateSearch, delegateOpenGmail, delegateGmailDraft, delegateSendGmail, delegateToWebOperator } from '@/lib/web-operator/delegation'
import type { DelegationResult } from '@/lib/web-operator/delegation'
import { getRecommendedSkillForInstruction, inferUnknownWebsiteFromInstruction } from '@/lib/web-operator/skills'
import { createSystemImprovementProposal } from '@/lib/system-improvements'

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

      const recommendedSkill = operatorName
        ? await getRecommendedSkillForInstruction(command.trim())
        : null
      const unknownWebsite = operatorName && !recommendedSkill
        ? inferUnknownWebsiteFromInstruction(command.trim())
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

      if (!delegationResult && recommendedSkill?.skill_id === 'canva_design') {
        delegationResult = await delegateToWebOperator({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
          actionType: 'open_url',
          targetUrl: 'https://www.canva.com/',
          instruction: `${operatorName}, work on Canva as a safe browser-only draft workflow. Manual login/takeover may be required. Publishing, sharing, and downloading final assets require approval.`,
          reason: 'Canva Web Operator skill requested',
          skillId: 'canva_design',
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
      } else if (!delegationResult && recommendedSkill?.skill_id === 'facebook_research') {
        delegationResult = await delegateToWebOperator({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
          actionType: 'search',
          query: command.trim(),
          instruction: `${operatorName}, research Facebook public pages/groups/posts through browser actions only. Manual login may be required; do not message, comment, join, or post without approval.`,
          reason: 'Facebook research Web Operator skill requested',
          skillId: 'facebook_research',
        }).catch(() => null)
      } else if (!delegationResult && recommendedSkill?.skill_id === 'linkedin_research') {
        delegationResult = await delegateToWebOperator({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
          actionType: 'search',
          query: command.trim(),
          instruction: `${operatorName}, research LinkedIn public company/profile information through browser actions only. Do not send connection requests, messages, or posts without approval.`,
          reason: 'LinkedIn research Web Operator skill requested',
          skillId: 'linkedin_research',
        }).catch(() => null)
      } else if (!delegationResult && recommendedSkill?.skill_id === 'instagram_research') {
        delegationResult = await delegateToWebOperator({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
          actionType: 'search',
          query: command.trim(),
          instruction: `${operatorName}, research Instagram public information through browser actions only. Do not message, comment, follow, or post without approval.`,
          reason: 'Instagram research Web Operator skill requested',
          skillId: 'instagram_research',
        }).catch(() => null)
      }

      if (!delegationResult && isOpenGmail && operatorName) {
        delegationResult = await delegateOpenGmail({
          projectId: result.project_id ?? undefined,
          requestedByRole: 'CEO',
          operatorName,
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
      } else if (!delegationResult && needsWebResearch) {
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
          // Append a note about the browser session and manual takeover policy
          const takeover = ` ${operatorName} will open the site in their browser session. If a login, CAPTCHA, or security check appears, they will pause and ask you to take over — they will not bypass it automatically.`
          if (delegationResult.message && !delegationResult.message.includes('take over')) {
            delegationResult = { ...delegationResult, message: delegationResult.message + takeover }
          }
        }
      }

      // If a recommended operator exists, append a mention to the CEO response
      let responseText = String(result.response ?? '')
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
        start_campaign_url:  startCampaignUrl,
        launch_template:     launchTemplate,
        strategy_brief:      strategyBrief,
        recall_chips:        recallChips,
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
