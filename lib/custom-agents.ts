/**
 * custom-agents.ts
 *
 * Create and manage custom AI agents defined by the CEO.
 *
 * Security constraints (always enforced — cannot be overridden):
 *   - Custom agents cannot execute web actions directly
 *   - All external actions must be delegated to the Web Operator
 *   - They inherit Operating Mode (manual / supervised / autonomous)
 *   - They cannot bypass the Approval Center
 *   - They cannot send emails directly (all outreach through Web Operator)
 *   - They cannot access secrets (env vars, API keys, tokens)
 *   - They are specs only — no autonomous execution on creation
 */

import { db } from '@/lib/db/client'
import { callAI } from '@/lib/ai/router'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AgentStatus = 'draft' | 'active' | 'archived'

export interface CustomAgent {
  id:                string
  name:              string
  description:       string | null
  purpose:           string
  capabilities:      string[]
  constraints:       string[]
  status:            AgentStatus
  brain_provider_id: string | null
  created_by_role:   string
  project_id:        string | null
  metadata:          Record<string, unknown>
  created_at:        string
  updated_at:        string
}

export interface CreateCustomAgentInput {
  name:              string
  description?:      string | null
  purpose:           string
  capabilities?:     string[]
  project_id?:       string | null
  created_by_role?:  string
  metadata?:         Record<string, unknown>
}

// ── Hardcoded security constraints ────────────────────────────────────────────

const REQUIRED_CONSTRAINTS = [
  'must_delegate_to_web_operator',
  'inherits_operating_mode',
  'cannot_bypass_approvals',
  'cannot_send_emails_directly',
  'cannot_access_secrets',
] as const

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createCustomAgent(
  input: CreateCustomAgentInput
): Promise<CustomAgent> {
  const capabilities  = input.capabilities ?? []
  const constraints   = [...REQUIRED_CONSTRAINTS]

  const res = await db.query(
    `INSERT INTO custom_agents
       (name, description, purpose, capabilities, constraints, status,
        created_by_role, project_id, metadata)
     VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8)
     RETURNING *`,
    [
      input.name,
      input.description ?? null,
      input.purpose,
      JSON.stringify(capabilities),
      JSON.stringify(constraints),
      input.created_by_role ?? 'ceo',
      input.project_id ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  )
  return normaliseAgent(res.rows[0])
}

export async function getCustomAgent(id: string): Promise<CustomAgent | null> {
  const res = await db.query(
    `SELECT * FROM custom_agents WHERE id=$1`, [id]
  )
  return res.rows[0] ? normaliseAgent(res.rows[0]) : null
}

export interface ListCustomAgentsFilter {
  project_id?: string
  status?:     AgentStatus
  limit?:      number
  offset?:     number
}

export async function listCustomAgents(
  filter: ListCustomAgentsFilter = {}
): Promise<CustomAgent[]> {
  const conditions: string[] = []
  const params: unknown[]    = []

  if (filter.project_id !== undefined) {
    params.push(filter.project_id)
    conditions.push(`project_id = $${params.length}`)
  }
  if (filter.status) {
    params.push(filter.status)
    conditions.push(`status = $${params.length}`)
  }

  const where  = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit  = filter.limit  ?? 50
  const offset = filter.offset ?? 0
  params.push(limit, offset)

  const res = await db.query(
    `SELECT * FROM custom_agents ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return res.rows.map(normaliseAgent)
}

export async function updateCustomAgent(
  id:    string,
  patch: Partial<Pick<CustomAgent, 'name' | 'description' | 'purpose' | 'capabilities' | 'status' | 'metadata'>>
): Promise<CustomAgent | null> {
  const fields: string[] = []
  const params: unknown[] = []

  if (patch.name !== undefined)         { params.push(patch.name);                       fields.push(`name=$${params.length}`) }
  if (patch.description !== undefined)  { params.push(patch.description);                fields.push(`description=$${params.length}`) }
  if (patch.purpose !== undefined)      { params.push(patch.purpose);                    fields.push(`purpose=$${params.length}`) }
  if (patch.capabilities !== undefined) { params.push(JSON.stringify(patch.capabilities));fields.push(`capabilities=$${params.length}`) }
  if (patch.status !== undefined)       { params.push(patch.status);                     fields.push(`status=$${params.length}`) }
  if (patch.metadata !== undefined)     { params.push(JSON.stringify(patch.metadata));   fields.push(`metadata=$${params.length}`) }

  if (fields.length === 0) return getCustomAgent(id)

  params.push(new Date().toISOString(), id)
  fields.push(`updated_at=$${params.length - 1}`)

  const res = await db.query(
    `UPDATE custom_agents SET ${fields.join(',')} WHERE id=$${params.length} RETURNING *`,
    params
  )
  return res.rows[0] ? normaliseAgent(res.rows[0]) : null
}

export async function archiveCustomAgent(id: string): Promise<void> {
  await db.query(`UPDATE custom_agents SET status='archived', updated_at=NOW() WHERE id=$1`, [id])
}

// ── Agent spec generation ──────────────────────────────────────────────────────

export interface AgentSpec {
  name:         string
  description:  string
  purpose:      string
  capabilities: string[]
}

/**
 * Ask the CEO AI to generate an agent specification from a natural-language need.
 * Returns a structured spec with name, description, purpose, and capabilities.
 * Falls back to a deterministic spec if AI is unavailable.
 */
export async function generateAgentSpecFromNeed(
  need:       string,
  projectId?: string | null
): Promise<AgentSpec> {
  const systemPrompt = `You are AÏKO CEO creating an internal agent specification.
The user wants to create an agent for: "${need}"
${projectId ? `Project context: project_id=${projectId}` : ''}

Return ONLY valid JSON in this exact format:
{
  "name": "Short agent name (3-6 words)",
  "description": "One sentence describing what this agent does",
  "purpose": "Detailed purpose: what it does, for whom, and why it helps",
  "capabilities": ["capability1", "capability2", "capability3"]
}

Rules:
- name must be concise and action-oriented
- capabilities are strings like "lead_research", "outreach_drafting", "market_analysis"
- Do NOT include any capability that bypasses approvals, sends emails directly, or accesses secrets
- All external actions will be delegated to the Web Operator automatically
- Max 5 capabilities`

  try {
    const raw = await callAI({
      role: 'ceo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `Create agent spec for: ${need}` },
      ],
      jsonMode:  true,
      maxTokens: 400,
    })

    const parsed = JSON.parse(raw)
    if (parsed.name && parsed.purpose) {
      return {
        name:         String(parsed.name).slice(0, 80),
        description:  String(parsed.description ?? '').slice(0, 200),
        purpose:      String(parsed.purpose).slice(0, 500),
        capabilities: Array.isArray(parsed.capabilities)
          ? (parsed.capabilities as unknown[]).map(String).slice(0, 5)
          : [],
      }
    }
  } catch { /* non-fatal — fall through to deterministic fallback */ }

  // Deterministic fallback
  const safeName = need.slice(0, 50).trim().replace(/[^a-zA-Z0-9 ]/g, '')
  return {
    name:         `${safeName} Agent`,
    description:  `Agent created to handle: ${need}`,
    purpose:      `This agent was created by the CEO to assist with: ${need}. It delegates all external actions to the Web Operator and operates within the configured operating mode.`,
    capabilities: ['task_execution', 'reporting'],
  }
}

// ── Built-in agent definitions ─────────────────────────────────────────────────

export interface BuiltInAgent {
  id:           string
  name:         string
  description:  string
  capabilities: string[]
  is_built_in:  true
}

export const BUILT_IN_AGENTS: BuiltInAgent[] = [
  {
    id:           'web_operator',
    name:         'Web Operator',
    description:  'Browses the web, fills forms, and researches leads via Playwright automation.',
    capabilities: ['web_browsing', 'form_filling', 'lead_research', 'screenshot_capture'],
    is_built_in:  true,
  },
  {
    id:           'ceo',
    name:         'AÏKO CEO',
    description:  'Orchestrates the company, assigns work, reviews decisions, and responds to strategy questions.',
    capabilities: ['strategy', 'decision_making', 'project_oversight', 'executive_reporting'],
    is_built_in:  true,
  },
  {
    id:           'project_manager',
    name:         'Project Manager',
    description:  'Manages project execution, tracks progress, coordinates agents, and answers project questions.',
    capabilities: ['project_tracking', 'sprint_planning', 'team_coordination', 'pm_reporting'],
    is_built_in:  true,
  },
  {
    id:           'research',
    name:         'Research Agent',
    description:  'Discovers leads, markets, and information. All browsing delegated to Web Operator.',
    capabilities: ['lead_discovery', 'market_research', 'competitor_analysis'],
    is_built_in:  true,
  },
  {
    id:           'copywriting',
    name:         'Copywriting Agent',
    description:  'Drafts outreach messages, campaign copy, and marketing content.',
    capabilities: ['outreach_drafting', 'campaign_copy', 'email_templates'],
    is_built_in:  true,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseAgent(row: CustomAgent): CustomAgent {
  return {
    ...row,
    capabilities: parseJsonArray(row.capabilities),
    constraints:  parseJsonArray(row.constraints),
    metadata:     typeof row.metadata === 'object' && row.metadata !== null
      ? row.metadata as Record<string, unknown>
      : {},
  }
}

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : [] }
    catch { return [] }
  }
  return []
}
