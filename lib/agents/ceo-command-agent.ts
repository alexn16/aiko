import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'
import { createInstruction } from '@/lib/agents/internal-communication'
import { getTaskSummaryForCompany } from '@/lib/agents/tasks'
import { getOutputSummaryForCompany } from '@/lib/agents/task-outputs'
import { getApprovalSummaryForCompany } from '@/lib/approvals'
import { getCampaignSummaryForCompany } from '@/lib/campaigns'

export interface CEOCommandResult {
  response: string
  intent: string
  actions: Array<{ type: string; data: Record<string, unknown> }>
  project_id?: string | null
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
- response must always be natural language — never raw JSON, never bullet points, never technical field names`

async function buildCompanyContext(): Promise<string> {
  const [memRow, projects, pms, approvals, agents, taskSummary, outputSummary, approvalSummary, campaignSummary] = await Promise.all([
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

export async function runCeoCommandAgent(
  command: string,
  modelConfig: LLMConfig
): Promise<CEOCommandResult> {
  const context = await buildCompanyContext()

  const raw = await callLLM(
    modelConfig,
    [
      { role: 'system', content: CEO_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Current company state:\n${context}\n\nUser command: ${command}`,
      },
    ],
    { jsonMode: true, maxTokens: 1200 }
  )

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
  }
}
