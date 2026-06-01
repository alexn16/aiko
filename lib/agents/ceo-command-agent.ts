import { callAI } from '@/lib/ai/router'
import { db } from '@/lib/db/client'
import { createInstruction } from '@/lib/agents/internal-communication'
import { getTaskSummaryForCompany } from '@/lib/agents/tasks'
import { getOutputSummaryForCompany } from '@/lib/agents/task-outputs'
import { getApprovalSummaryForCompany } from '@/lib/approvals'
import { getCampaignSummaryForCompany } from '@/lib/campaigns'
import { getLaunchReadinessSummaryForCompany } from '@/lib/campaign-launch-readiness'
import { getModeState } from '@/lib/operating-mode'
import { listToolConnections } from '@/lib/tools/tool-router'
import { getWebOperatorStatus } from '@/lib/web-operator/web-operator'
import { getMissingCapabilities } from '@/lib/system-capabilities'
import { listWebOperators } from '@/lib/web-operator/operators'
import { getLeadSummaryForCompany } from '@/lib/leads'

export interface CEOCommandResult {
  response: string
  intent: string
  actions: Array<{ type: string; data: Record<string, unknown> }>
  project_id?: string | null
  capability_gap?: {
    missing: string[]
    proposal_id: string
    score: number
  } | null
}

const CEO_SYSTEM_PROMPT = `You are the CEO of AÏKO, an AI marketing company. You manage multiple client projects, a team of 3 Project Managers (Kenji, Mara, Sven), and autonomous AI agents.

Your personality: calm, decisive, sharp. You speak in first person. No filler. No excessive positivity. You sound like a founder who actually knows what is happening.

Speak conversationally and naturally. Your "response" should read like a real message from an executive — not a summary, not a log. Use 2-5 sentences. Break into short paragraphs if useful. Mention the PM you're assigning and why. Explain what will happen next. If something is blocked, say so clearly.

Example of good response tone:
"Understood. I'll open Foreman as a dedicated marketing project. I'm assigning Kenji as Project Manager — Foreman is a B2B industrial product and needs a structured outbound strategy. Kenji will coordinate Research, Lead Generation, Copywriting, and Outreach. The first step is to define Foreman's target buyer profile and campaign angles. I'll prepare the workspace now."

Example of bad response (do NOT do this):
"Project created. PM assigned. Memory updated."

When given a command, analyze the context and return ONLY valid JSON:
{
  "response": "Your natural-language conversational reply (2-5 sentences, first person, no bullet points in this field)",
  "intent": "create_project|assign_pm|update_memory|status_check|strategy|general",
  "project_name": "exact project name if relevant, else null",
  "is_new_project": false,
  "assign_pm": "Kenji|Mara|Sven|null",
  "actions": [
    {
      "type": "create_project",
      "data": { "name": "...", "description": "...", "target_market": "...", "value_prop": "...", "goal": "..." }
    },
    {
      "type": "assign_pm",
      "data": { "pm_name": "Kenji|Mara|Sven", "project_name": "...", "focus": "..." }
    },
    {
      "type": "update_company_memory",
      "data": { "summary": "...", "global_priorities": ["..."], "blocked_items": ["..."] }
    },
    {
      "type": "update_project_memory",
      "data": { "project_name": "...", "notes": "...", "next_steps": ["..."], "blockers": ["..."] }
    },
    {
      "type": "generate_project_map",
      "data": { "project_name": "...", "nodes": [{"id":"1","label":"...","type":"stage"}], "edges": [{"from":"1","to":"2"}] }
    }
  ]
}

Rules:
- Only include relevant actions — do not add empty or placeholder actions
- assign_pm: choose based on PM specialty (Kenji=growth/outbound, Mara=brand/content, Sven=data/automation)
- Always update_company_memory when projects change or priorities shift
- When creating a project, also generate a project map with 3-5 pipeline stages
- Never include external API calls, secrets, or send real messages
- response must always be natural language — never raw JSON, never bullet points, never technical field names
- When a strategy requires capabilities listed as missing in the system context, acknowledge the gap, explain what is missing, and mention that a System Improvement Proposal can be created. Never pretend capabilities exist that are marked as missing.
- When asked to "execute" a strategy fully (including email sending, reply tracking, etc.), check missing_capabilities first and if blockers exist, explain what needs to be built.
- AÏKO does not use native SMTP, Gmail API, Resend, CRM API, LinkedIn API, or any direct platform integrations. All external work is performed by the Web Operator through a real browser. When referring to external actions (email, LinkedIn, search, web forms), always say "I will ask the Web Operator to..." and never mention APIs, SMTP, or direct integrations.
- When a user asks to "send an email", respond: "I will ask the Web Operator to open Gmail in the browser, prepare the draft, and request your approval before sending."
- When a user asks to "search the internet" or "find companies", respond that you will delegate this to the Web Operator for browser-based search.
- When a user mentions a person's name followed by an action (e.g. "Kevin, open Gmail"), treat the name as a Web Operator. Route the task to that named operator. Each operator has their own isolated browser session. Say "I'll ask [Name] to [action] in their dedicated browser session."
- Named operators can be anyone: Kevin, Hana, Kenji (as operator, distinct from PM role), or any name the user provides. Check web_operators in context to see who already exists.`

async function buildCompanyContext(): Promise<string> {
  const [memRow, projects, pms, approvals, agents, taskSummary, outputSummary, approvalSummary, campaignSummary, launchReadiness, modeState, toolConnectionsList, webOperatorStatus, missingCaps, webOperatorsList, leadSummary] = await Promise.all([
    db.query('SELECT * FROM company_memory LIMIT 1'),
    db.query(`
      SELECT p.id, p.name, p.active, p.goal, p.strategy,
             pm.name AS pm_name, pm.current_focus
      FROM projects p
      LEFT JOIN project_managers pm ON pm.id = p.assigned_pm_id
      WHERE p.active = true
      ORDER BY p.created_at DESC
    `),
    db.query('SELECT id, name, specialty, status, current_focus FROM project_managers'),
    db.query("SELECT COUNT(*) AS n FROM approvals WHERE status IN ('pending','quality_passed')"),
    db.query(`
      SELECT a.name, a.status, a.current_task, p.name AS project_name
      FROM agents a
      JOIN projects p ON p.id = a.project_id
      WHERE a.status NOT IN ('idle','paused')
      ORDER BY a.updated_at DESC
      LIMIT 10
    `),
    getTaskSummaryForCompany(),
    getOutputSummaryForCompany(),
    getApprovalSummaryForCompany(),
    getCampaignSummaryForCompany(),
    getLaunchReadinessSummaryForCompany(),
    getModeState(),
    listToolConnections(),
    getWebOperatorStatus(),
    getMissingCapabilities(),
    listWebOperators().catch(() => []),
    getLeadSummaryForCompany().catch(() => ({ total: 0, needs_review: 0, approved: 0 })),
  ])

  const mem = memRow.rows[0] ?? {}
  const ctx = {
    company_memory: {
      summary: mem.summary ?? '',
      global_priorities: mem.global_priorities ?? [],
      blocked_items: mem.blocked_items ?? [],
    },
    projects: projects.rows.map(p => ({
      id: p.id,
      name: p.name,
      goal: p.goal ?? null,
      pm: p.pm_name ?? 'unassigned',
      pm_focus: p.current_focus ?? '',
      strategy_snapshot: p.strategy?.ceo_update?.strategic_update ?? null,
    })),
    project_managers: pms.rows,
    pending_approvals: parseInt(approvals.rows[0]?.n ?? '0', 10),
    active_agents: agents.rows,
    task_summary: {
      total: taskSummary.total,
      by_status: taskSummary.by_status,
      active_count: taskSummary.active.length,
      blocked_count: taskSummary.blocked.length,
      review_count: taskSummary.review.length,
      active_titles: taskSummary.active.slice(0, 5).map(t => t.title),
    },
    output_summary: {
      total: outputSummary.total,
      pending_approval_count: outputSummary.pending_approval.length,
      recent_titles: outputSummary.recent.slice(0, 3).map(o => o.title),
    },
    approval_summary: {
      pending: approvalSummary.pending,
      approved: approvalSummary.approved,
      changes_requested: approvalSummary.changes_requested,
    },
    campaign_summary: {
      total: campaignSummary.total,
      draft: campaignSummary.by_status['draft'] ?? 0,
      ready_for_review: campaignSummary.by_status['ready_for_review'] ?? 0,
      approved: campaignSummary.by_status['approved'] ?? 0,
      active: campaignSummary.by_status['active'] ?? 0,
    },
    launch_readiness: {
      ready: launchReadiness.ready,
      needs_attention: launchReadiness.needs_attention,
      not_ready: launchReadiness.not_ready,
      blocked: launchReadiness.blocked,
    },
    operating_mode: {
      mode: modeState.mode,
      paused: modeState.paused,
      sends_today: modeState.sends_today,
      daily_send_limit: modeState.daily_send_limit,
    },
    tool_connections: toolConnectionsList.map(t => ({
      tool_type: t.tool_type,
      name: t.name,
      status: t.status,
    })),
    web_operator: {
      browser_available: webOperatorStatus.browser_available,
      active_session_id: webOperatorStatus.active_session?.id ?? null,
      pending_approvals: webOperatorStatus.pending_approvals,
    },
    web_operators: webOperatorsList.map(op => ({
      name: op.name,
      status: op.status,
      current_url: op.current_url,
      current_task: op.current_task,
    })),
    missing_capabilities: missingCaps.map(c => ({ key: c.key, name: c.name })),
    lead_summary: {
      total: leadSummary.total,
      needs_review: leadSummary.needs_review,
      approved: leadSummary.approved,
    },
  }

  return JSON.stringify(ctx, null, 2)
}

async function executeActions(
  actions: Array<{ type: string; data: Record<string, unknown> }>,
  projectLookup: Map<string, string>
): Promise<string | null> {
  let resolvedProjectId: string | null = null

  for (const action of actions) {
    try {
      if (action.type === 'create_project') {
        const d = action.data
        const result = await db.query(
          `INSERT INTO projects (name, description, target_market, value_prop, goal)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [d.name, d.description ?? null, d.target_market ?? null, d.value_prop ?? null, d.goal ?? null]
        )
        const projectId = result.rows[0].id
        resolvedProjectId = projectId
        projectLookup.set(String(d.name), projectId)

        // Seed standard agents
        const AGENT_DEFINITIONS = [
          { name: 'Research Agent',         role: 'Finds new leads by navigating directories and websites' },
          { name: 'Lead Gen Agent',         role: 'Enriches existing leads with contact data' },
          { name: 'Copywriting Agent',      role: 'Writes outreach messages for approved leads' },
          { name: 'Quality Agent',          role: 'Reviews messages before they reach the Approval Center' },
          { name: 'Outreach Agent',         role: 'Monitors inbox for replies in read-only mode' },
          { name: 'Sales Validation Agent', role: 'Scores reply intent and qualifies leads' },
          { name: 'Strategy Agent',         role: 'Defines ICP, messaging strategy, and channel priority' },
          { name: 'Social Media Agent',     role: 'Drafts social content for review' },
          { name: 'Reporting Agent',        role: 'Generates structured performance reports' },
          { name: 'CEO Agent',              role: 'Strategic oversight and coordination' },
          { name: 'Project Manager Agent',  role: 'Tracks sprint progress and flags blockers' },
        ]
        for (const agent of AGENT_DEFINITIONS) {
          await db.query(
            'INSERT INTO agents (project_id, name, role) VALUES ($1,$2,$3)',
            [projectId, agent.name, agent.role]
          )
        }

        // Seed project memory row
        await db.query(
          'INSERT INTO project_memory (project_id) VALUES ($1) ON CONFLICT DO NOTHING',
          [projectId]
        )

        // Create first-campaign launch template (idempotent — guidance only, no automation)
        try {
          const { createProjectLaunchTemplate } = await import('@/lib/project-launch-template')
          await createProjectLaunchTemplate({
            project_id:    projectId,
            campaign_goal: d.goal ? String(d.goal) : null,
            created_by_role: 'CEO',
          })
        } catch { /* non-fatal — template is optional guidance */ }

        // Generate first-campaign strategy brief (idempotent — guidance only, never executes)
        try {
          const { generateStrategyBriefFromProject } = await import('@/lib/project-strategy-brief')
          await generateStrategyBriefFromProject({
            project_id:    projectId,
            project_name:  String(d.name ?? ''),
            goal:          d.goal          ? String(d.goal)          : null,
            description:   d.description   ? String(d.description)   : null,
            target_market: d.target_market ? String(d.target_market) : null,
          })
        } catch { /* non-fatal — brief is optional guidance */ }
      }

      if (action.type === 'assign_pm') {
        const d = action.data
        const pmName = String(d.pm_name ?? '')
        const projectName = String(d.project_name ?? '')
        if (!pmName || !projectName) continue

        const pmRow = await db.query('SELECT id FROM project_managers WHERE name=$1', [pmName])
        if (!pmRow.rows[0]) continue
        const pmId = pmRow.rows[0].id

        let projectId = projectLookup.get(projectName)
        if (!projectId) {
          const pRow = await db.query('SELECT id FROM projects WHERE name=$1', [projectName])
          projectId = pRow.rows[0]?.id
        }
        if (!projectId) continue

        await db.query('UPDATE projects SET assigned_pm_id=$1 WHERE id=$2', [pmId, projectId])
        await db.query(
          "UPDATE project_managers SET project_id=$1, current_focus=$2, status='busy' WHERE id=$3",
          [projectId, d.focus ?? '', pmId]
        )
        resolvedProjectId = resolvedProjectId ?? projectId

        // Notify the assigned PM via internal messaging
        try {
          await createInstruction({
            from_role: 'CEO',
            to_role: 'Project Manager',
            subject: `Open ${projectName} — build memory and prepare first campaign direction`,
            content: `You have been assigned to ${projectName}. Build the project memory, create the project map, define the target buyer profile, and prepare the first campaign direction. Report back when ready.`,
            project_id: projectId,
          })
        } catch (msgErr) {
          console.error('[ceo-command] failed to send PM instruction', msgErr)
        }
      }

      if (action.type === 'update_company_memory') {
        const d = action.data
        const existing = await db.query('SELECT id FROM company_memory LIMIT 1')
        if (existing.rows[0]) {
          await db.query(
            `UPDATE company_memory SET
               summary=$1, global_priorities=$2, blocked_items=$3,
               last_updated_by='ceo', updated_at=NOW()
             WHERE id=$4`,
            [
              d.summary ?? '',
              JSON.stringify(d.global_priorities ?? []),
              JSON.stringify(d.blocked_items ?? []),
              existing.rows[0].id,
            ]
          )
        } else {
          await db.query(
            `INSERT INTO company_memory (summary, global_priorities, blocked_items, last_updated_by)
             VALUES ($1,$2,$3,'ceo')`,
            [d.summary ?? '', JSON.stringify(d.global_priorities ?? []), JSON.stringify(d.blocked_items ?? [])]
          )
        }
      }

      if (action.type === 'update_project_memory') {
        const d = action.data
        const projectName = String(d.project_name ?? '')
        let projectId = projectLookup.get(projectName)
        if (!projectId) {
          const pRow = await db.query('SELECT id FROM projects WHERE name=$1', [projectName])
          projectId = pRow.rows[0]?.id
        }
        if (!projectId) continue

        await db.query(
          `INSERT INTO project_memory (project_id, notes, next_steps, blockers)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (project_id) DO UPDATE SET
             notes=$2, next_steps=$3, blockers=$4, updated_at=NOW()`,
          [
            projectId,
            d.notes ?? '',
            JSON.stringify(d.next_steps ?? []),
            JSON.stringify(d.blockers ?? []),
          ]
        )
        resolvedProjectId = resolvedProjectId ?? projectId
      }

      if (action.type === 'generate_project_map') {
        const d = action.data
        const projectName = String(d.project_name ?? '')
        let projectId = projectLookup.get(projectName)
        if (!projectId) {
          const pRow = await db.query('SELECT id FROM projects WHERE name=$1', [projectName])
          projectId = pRow.rows[0]?.id
        }
        if (!projectId) continue

        await db.query(
          `INSERT INTO project_map (project_id, nodes, edges)
           VALUES ($1,$2,$3)
           ON CONFLICT (project_id) DO UPDATE SET nodes=$2, edges=$3, updated_at=NOW()`,
          [
            projectId,
            JSON.stringify(d.nodes ?? []),
            JSON.stringify(d.edges ?? []),
          ]
        )
        resolvedProjectId = resolvedProjectId ?? projectId
      }
    } catch (err) {
      console.error('[ceo-command] action error', action.type, err)
    }
  }

  return resolvedProjectId
}

// ── Recall intent detection ────────────────────────────────────────────────────

/**
 * Patterns that signal a project recall question.
 * Matched case-insensitively before full CEO agent call.
 */
const RECALL_PATTERNS: RegExp[] = [
  /what\s+are\s+we\s+doing\s+(for|on|with)\s+/i,
  /summarize\s+/i,
  /summary\s+(of|for)\s+/i,
  /status\s+(of|for|on)\s+/i,
  /who\s+is\s+assigned\s+to\s+/i,
  /next\s+step\s+(for|on)\s+/i,
  /what.*(strategy|campaign|brief|plan)\s+(for|on)\s+/i,
  /what\s+has\s+\w+\s+done\s+(for|on)\s+/i,
  /tell\s+me\s+about\s+/i,
  /what.*(happening|going\s+on)\s+(with|for|on)\s+/i,
]

function isRecallIntent(command: string): boolean {
  return RECALL_PATTERNS.some(p => p.test(command))
}

/**
 * Extract the project name hint from a recall command.
 * Strips the leading verb phrase to isolate the project name.
 */
function extractRecallProjectName(command: string): string {
  const cleaned = command
    .replace(/^what\s+are\s+we\s+doing\s+(for|on|with)\s+/i, '')
    .replace(/^summarize\s+/i, '')
    .replace(/^summary\s+(of|for)\s+/i, '')
    .replace(/^status\s+(of|for|on)\s+/i, '')
    .replace(/^who\s+is\s+assigned\s+to\s+/i, '')
    .replace(/^next\s+step\s+(for|on)\s+/i, '')
    .replace(/^tell\s+me\s+about\s+/i, '')
    .replace(/^what.*(strategy|campaign|brief|plan)\s+(for|on)\s+/i, '')
    .replace(/^what\s+has\s+\w+\s+done\s+(for|on)\s+/i, '')
    .replace(/^what.*(happening|going\s+on)\s+(with|for|on)\s+/i, '')
    .trim()
    // Strip trailing punctuation
    .replace(/[?.!]+$/, '')
    .trim()
  return cleaned
}

const RECALL_SYSTEM_PROMPT = `You are the CEO of AÏKO. You have been given detailed context about a specific project.

Answer the user's question in a natural, conversational CEO voice (2-6 sentences).
- Speak in first person
- Be specific — use the actual data provided
- If something is missing or unknown, say so clearly ("We don't have that data yet")
- Do not make up leads, actions, or status that aren't in the context
- Do not suggest running any external action or browser task unless asked
- This is a read-only status check — do not create anything

Return ONLY valid JSON:
{
  "response": "Your natural-language answer",
  "intent": "project_recall",
  "project_id": "<the project id from context or null>"
}`

async function runRecallQuery(command: string, projectName: string): Promise<CEOCommandResult> {
  const {
    findProjectByNameOrAlias,
    listActiveProjectNames,
    getProjectContext,
    getProjectExecutiveSummary,
    getProjectNextStep,
  } = await import('@/lib/project-context')

  const project = await findProjectByNameOrAlias(projectName)

  if (!project) {
    const allNames = await listActiveProjectNames()
    const list = allNames.length > 0
      ? `Active projects: ${allNames.join(', ')}.`
      : 'No active projects found.'
    return {
      response: `I don't have a project matching "${projectName}". ${list}`,
      intent: 'project_recall',
      actions: [],
      project_id: null,
    }
  }

  const ctx = await getProjectContext(project.id)
  if (!ctx) {
    return {
      response: `I found the project "${project.name}" but couldn't load its context right now.`,
      intent: 'project_recall',
      actions: [],
      project_id: project.id,
    }
  }

  const summary  = getProjectExecutiveSummary(ctx)
  const nextStep = getProjectNextStep(ctx)

  const raw = await callAI({
    role: 'ceo',
    messages: [
      { role: 'system', content: RECALL_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Project context:\n${summary}\n\nSuggested next step: ${nextStep}\n\nUser question: ${command}`,
      },
    ],
    jsonMode: true,
    maxTokens: 600,
  })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      response: raw.slice(0, 500),
      intent: 'project_recall',
      actions: [],
      project_id: project.id,
    }
  }

  // Log the command
  await db.query(
    `INSERT INTO ceo_commands (command, response, intent, actions, project_id)
     VALUES ($1,$2,$3,$4,$5)`,
    [command, String(parsed.response ?? ''), 'project_recall', '[]', project.id]
  )

  return {
    response:   String(parsed.response ?? ''),
    intent:     'project_recall',
    actions:    [],
    project_id: project.id,
  }
}

export async function runCeoCommandAgent(
  command: string,
  // modelConfig is kept for backward-compatibility but is no longer used.
  // callAI() resolves the provider from the role assignment table.
  _modelConfig?: unknown
): Promise<CEOCommandResult> {
  // ── Fast-path: project recall questions bypass the full CEO agent ────────────
  if (isRecallIntent(command)) {
    const projectName = extractRecallProjectName(command)
    if (projectName.length >= 2) {
      try {
        return await runRecallQuery(command, projectName)
      } catch {
        // Fall through to normal agent if recall fails
      }
    }
  }

  const context = await buildCompanyContext()

  const raw = await callAI({
    role: 'ceo',
    messages: [
      { role: 'system', content: CEO_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Current company state:\n${context}\n\nUser command: ${command}`,
      },
    ],
    jsonMode: true,
    maxTokens: 1200,
  })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      response: raw.slice(0, 500),
      intent: 'general',
      actions: [],
      project_id: null,
    }
  }

  const actions = Array.isArray(parsed.actions) ? parsed.actions as Array<{ type: string; data: Record<string, unknown> }> : []
  const projectLookup = new Map<string, string>()

  const resolvedProjectId = await executeActions(actions, projectLookup)

  // Log command
  await db.query(
    `INSERT INTO ceo_commands (command, response, intent, actions, project_id)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      command,
      String(parsed.response ?? ''),
      String(parsed.intent ?? 'general'),
      JSON.stringify(actions),
      resolvedProjectId ?? null,
    ]
  )

  return {
    response: String(parsed.response ?? ''),
    intent: String(parsed.intent ?? 'general'),
    actions,
    project_id: resolvedProjectId,
    capability_gap: null,
  }
}
