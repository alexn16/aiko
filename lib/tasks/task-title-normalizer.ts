/**
 * lib/tasks/task-title-normalizer.ts
 *
 * Converts raw/technical task titles and descriptions into concise,
 * owner-friendly text. Applied at task creation time and as a render-time
 * fallback so the owner always sees clean labels.
 */

// ── Prefix stripping ───────────────────────────────────────────────────────────

const STRIP_PREFIXES = [
  /^(Blocked|Completed|Failed|Search|Task|AI Skill|Web Operator|Instruction|Handoff):\s*/i,
  /^(Open URL|Open url|Open page|Browse):\s*/i,
  /^Item approved?:\s*/i,
]

function stripPrefixes(s: string): string {
  let result = s.trim()
  for (const re of STRIP_PREFIXES) {
    result = result.replace(re, '')
  }
  return result.trim()
}

// ── Action phrase normalisation ────────────────────────────────────────────────

// Maps skill IDs, work_type values, and common raw prompts to clean titles.
const ACTION_MAP: Array<[RegExp, string]> = [
  [/\bcreate[_\s]+7[\s-]day[_\s]+(marketing[_\s]+)?plan\b/i, 'Create 7-day marketing plan'],
  [/\bplan[_\s]+the[_\s]+next[_\s]+7[_\s]days\b/i, 'Create 7-day marketing plan'],
  [/\b7[\s-]day[_\s]+(marketing[_\s]+)?plan\b/i, 'Create 7-day marketing plan'],
  [/\bcreate[_\s]+7[_\s]day[_\s]plan\b/i, 'Create 7-day marketing plan'],
  [/\bwhat[_\s]+should[_\s]+we[_\s]+do[_\s]+next\b/i, 'Recommend next step'],
  [/\brecommend[_\s]+next[_\s]step\b/i, 'Recommend next step'],
  [/^create[_\s]+a[_\s]+linkedin[_\s]+post\b/i, 'Draft LinkedIn post'],
  [/^draft[_\s]+a?[_\s]*linkedin[_\s]+post\b/i, 'Draft LinkedIn post'],
  [/^write[_\s]+a?[_\s]*linkedin[_\s]+post\b/i, 'Draft LinkedIn post'],
  [/\blinkedin[_\s]+post\b.*\b(draft|create|write|prepare)\b/i, 'Draft LinkedIn post'],
  [/\b(draft|create|write|prepare)\b.*\blinkedin[_\s]+post\b/i, 'Draft LinkedIn post'],
  [/\bstart[_\s]+marketing\b/i, 'Start marketing research'],
  [/^start[_\s]+marketing[_\s]+(?:for|on)\b.*/i, 'Start marketing research'],
  [/\bgenerate[_\s]+(?:a[_\s]+)?(?:concise[_\s]+)?executive[_\s]+report\b/i, 'Generate executive report'],
  [/^report[_generation_]+\b/i, 'Generate report'],
  [/^generate[_\s]+(?:a[_\s]+)?report\b/i, 'Generate report'],
  [/^daily[_\s]+brief\b/i, 'Review daily brief'],
  [/^system[_\s]+improvement[_\s]+check\b/i, 'Check system improvements'],
  [/^web[_\s]+research\b/i, 'Research websites'],
  [/^web[_\s]+operator[_\s]+action\b/i, 'Browser task'],
  [/^strategy[_\s]+plan\b/i, 'Create strategy plan'],
  [/^project[_\s]+next[_\s]+step\b/i, 'Plan next step'],
  [/^content[_\s]+draft\b/i, 'Draft content'],
  [/^task[_\s]+creation\b/i, 'Create follow-up tasks'],
  [/^ai[_\s]+skill\b/i, 'Run AI task'],
]

function applyActionMap(s: string): string | null {
  for (const [re, replacement] of ACTION_MAP) {
    if (re.test(s)) return replacement
  }
  return null
}

// ── URL / path / ID cleaning ───────────────────────────────────────────────────

function cleanUrlsAndPaths(s: string): string {
  return s
    .replace(/https?:\/\/([^\s/]+)[^\s]*/g, (_, host) => host)
    .replace(/\/[a-z0-9_-]+(?:\/[a-z0-9_-]+){2,}/gi, '[path]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
}

// ── Main normalizers ───────────────────────────────────────────────────────────

export type TitleContext = {
  status?: string | null
  task_type?: string | null
  owner_role?: string | null
  is_blocked?: boolean
}

/**
 * Normalize a task title to be concise (≤70 chars) and owner-friendly.
 */
export function normalizeTaskTitle(raw: string, ctx: TitleContext = {}): string {
  if (!raw || !raw.trim()) return 'Task'

  // Blocked tasks → resolve blocker unless already meaningful
  if (ctx.is_blocked || ctx.status === 'blocked') {
    const stripped = stripPrefixes(raw)
    // If it looks like a meaningful action title already, keep it
    if (stripped.length <= 70 && !/\bhttps?:\/\//i.test(stripped) && !/^(search|open url|blocked)/i.test(stripped)) {
      return stripped.slice(0, 70)
    }
    return 'Resolve blocker'
  }

  let s = stripPrefixes(raw)
  s = cleanUrlsAndPaths(s)

  // Try action map first
  const mapped = applyActionMap(s)
  if (mapped) return mapped

  // Remove trailing boilerplate
  s = s
    .replace(/\.\s*Internal(ly)?[^.]*$/i, '')
    .replace(/\.\s*No external action[^.]*$/i, '')
    .replace(/\s+in\s+(?:their|the)\s+(?:dedicated\s+)?browser[_\s]+session\.?$/i, '')
    .trim()

  // Capitalise first letter
  s = s.charAt(0).toUpperCase() + s.slice(1)

  // Truncate to 70 chars at a word boundary
  if (s.length <= 70) return s
  const truncated = s.slice(0, 70)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + '…'
}

/**
 * Normalize a task description: 1-2 sentences, no raw JSON, no stack traces,
 * no filesystem paths, no internal action IDs.
 */
export function normalizeTaskDescription(raw: string | null | undefined, ctx: TitleContext = {}): string {
  if (!raw) return ''
  let s = raw

  // Strip stack traces
  s = s.replace(/\s+at [A-Z][a-zA-Z.]+\s*\([^)]+\)/g, '')
  s = s.replace(/\s+at <anonymous>[^\n]*/g, '')

  // Strip filesystem paths
  s = s.replace(/\/Users\/[^\s'"]+/g, '[path]')
  s = s.replace(/\/home\/[^\s'"]+/g, '[path]')
  s = s.replace(/[A-Z]:\\[^\s'"]+/g, '[path]')

  // Strip raw JSON blobs
  s = s.replace(/\{[^}]{100,}\}/g, '[data]')

  // Strip internal action IDs
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')

  // Strip source line (added by create-tasks route)
  s = s.replace(/\n\nSource: [^\n]+\. Internal task only[^\n]*$/i, '')

  // Keep first 2 sentences
  const sentences = s.match(/[^.!?]+[.!?]+/g) ?? []
  if (sentences.length > 2) {
    s = sentences.slice(0, 2).join(' ')
  }

  s = s.trim()
  if (s.length > 300) s = s.slice(0, 300) + '…'

  return s
}

/**
 * Map an assigned_by_role or task_type to a clean owner-facing source label.
 */
export function normalizeSourceLabel(assignedByRole?: string | null, taskType?: string | null): string {
  const role = (assignedByRole ?? '').toLowerCase().trim()
  const type = (taskType ?? '').toLowerCase().trim()

  if (role === 'ai_skill' || role === 'ai skill') return 'AI plan'
  if (role === 'strategy_execution_planner' || role.includes('strategy')) return 'Strategy plan'
  if (role === 'intensive_work') return 'Work cycle'
  if (role === 'ceo') return 'CEO'
  if (role === 'system') return 'System'
  if (role.includes('web operator') || role === 'web_operator') return 'Web research'
  if (role === 'reporting_agent' || type === 'report') return 'Report'
  if (type === 'repo_operational_audit') return 'Audit'
  if (type === 'risk_analysis') return 'Risk analysis'
  if (type.includes('research')) return 'Research'
  if (type.includes('strategy') || type === 'project_map') return 'Strategy plan'
  if (type === 'approval_preparation') return 'Approval needed'
  if (role === 'manual' || !role) return 'Manual'

  // Fallback: clean up underscores and capitalise
  return (assignedByRole ?? 'Manual').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
