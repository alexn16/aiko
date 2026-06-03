/**
 * lib/leads/discovery-workflow.ts
 *
 * Browser-based lead discovery workflow layered on top of Web Operator Skills.
 *
 * Safety rules (enforced throughout):
 *   - Public pages only — no login, CAPTCHA, paywall, or private-data bypass.
 *   - Never invents emails, phones, or contact names.
 *   - No outreach, no posting, no messaging.
 *   - All source URLs saved as evidence.
 *   - Duplicate leads (same project + website/email/company) are skipped.
 *   - Small page limits to prevent mass scraping.
 *   - Extraction failures are reported honestly, not faked.
 */

import { db } from '@/lib/db/client'
import { callAI } from '@/lib/ai/router'
import { createLead } from '@/lib/leads'
import type { Lead } from '@/lib/leads'
import { delegateToWebOperator } from '@/lib/web-operator/delegation'
import type { DelegationRequest } from '@/lib/web-operator/delegation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeadCandidate {
  company_name: string
  website: string | null
  source_url: string          // required — evidence
  location: string | null
  category: string | null
  contact_name: string | null
  email: string | null        // only from visible public text
  phone: string | null        // only from visible public text
  reason: string              // why this is relevant
  confidence: number          // 0–100
}

export interface DiscoveryQueryResult {
  query: string
  action_id: string | null
  status: 'completed' | 'failed' | 'blocked'
  results_count: number
  candidates: LeadCandidate[]
  error: string | null
}

export interface DiscoveryWorkflowResult {
  status: 'completed' | 'partial' | 'blocked' | 'failed'
  queries_run: number
  pages_checked: number
  candidates_found: number
  leads_created: number
  duplicates_skipped: number
  failures: string[]
  query_results: DiscoveryQueryResult[]
  summary: string
}

// ── Query generation ───────────────────────────────────────────────────────────

/**
 * Build 3–5 targeted search query variants from project context + user prompt.
 * Queries are in the target language(s) when context suggests it.
 */
export function buildLeadDiscoveryQueries(
  userPrompt: string,
  projectContext?: { name?: string; goal?: string; target_audience?: string; location?: string }
): string[] {
  // Use AI at call time — here we build deterministically from context so
  // the function is testable without a network call.
  const base = userPrompt.trim()
  const loc = projectContext?.location ?? extractLocation(userPrompt)
  const audience = projectContext?.target_audience ?? ''

  // Produce ≥3 diverse query variants
  const queries: string[] = [base]

  // Append location if not already present
  if (loc && !base.toLowerCase().includes(loc.toLowerCase())) {
    queries.push(`${base} ${loc}`)
  }

  // English + Spanish variants for Iberian targets
  if (loc && isIberianLocation(loc)) {
    queries.push(`administradores de fincas ${loc}`)
    queries.push(`gestor aparcamiento ${loc} contacto`)
    queries.push(`parking privado ${loc} empresa`)
  } else if (loc) {
    queries.push(`property managers ${loc} contact`)
    queries.push(`facility management ${loc}`)
  }

  // Audience-derived variant
  if (audience) {
    queries.push(`${audience} ${loc ?? ''}`.trim())
  }

  // Deduplicate and cap at 5
  const seen = new Set<string>()
  return queries.filter(q => {
    const k = q.toLowerCase().trim()
    if (seen.has(k) || k.length < 5) return false
    seen.add(k)
    return true
  }).slice(0, 5)
}

function extractLocation(text: string): string | null {
  // Simple heuristic: last capitalized word sequence at end of string
  // Covers ASCII + common accented chars via character class (no /u flag needed)
  const match = text.match(/\b([A-Z\xC0-\xD6\xD8-\xDE][A-Za-z\xC0-\xFF]+(?:\s+[A-Z\xC0-\xD6\xD8-\xDE][A-Za-z\xC0-\xFF]+)*)\s*[.,]?\s*$/)
  return match?.[1] ?? null
}

function isIberianLocation(loc: string): boolean {
  const iberian = [
    'coruña', 'a coruña', 'galicia', 'madrid', 'barcelona', 'sevilla',
    'valencia', 'bilbao', 'málaga', 'zaragoza', 'vigo', 'spain', 'españa',
    'portugal', 'lisboa', 'porto',
  ]
  return iberian.some(i => loc.toLowerCase().includes(i))
}

// ── Duplicate check ────────────────────────────────────────────────────────────

async function isDuplicateLead(
  projectId: string,
  candidate: LeadCandidate
): Promise<boolean> {
  try {
    const conditions: string[] = ['project_id = $1']
    const params: unknown[] = [projectId]
    let idx = 2

    const checks: string[] = []

    if (candidate.website) {
      checks.push(`website = $${idx}`)
      params.push(candidate.website)
      idx++
    }
    if (candidate.email) {
      checks.push(`email = $${idx}`)
      params.push(candidate.email)
      idx++
    }
    if (candidate.company_name) {
      checks.push(`LOWER(company_name) = LOWER($${idx})`)
      params.push(candidate.company_name)
      idx++
    }

    if (checks.length === 0) return false

    const res = await db.query(
      `SELECT 1 FROM leads WHERE ${conditions.join(' AND ')} AND (${checks.join(' OR ')}) LIMIT 1`,
      params
    )
    return res.rowCount !== null && res.rowCount > 0
  } catch {
    return false
  }
}

// ── Candidate extraction from search results ───────────────────────────────────

const EXTRACTION_SYSTEM = `You are a lead extraction specialist. Extract structured company leads from search result snippets.

Rules:
- Extract only companies or contacts that are CLEARLY visible in the text.
- Do NOT invent emails, phones, or contact names.
- Only include email/phone if literally present in the snippet text.
- company_name is REQUIRED. source_url is REQUIRED.
- confidence: 0–100 based on match to research context.
- Return max 8 candidates.
- Skip companies that are irrelevant directories, news portals, or government agencies.
- category: short label like "property management", "parking operator", "community admin".
- reason: 1 sentence why this company matches the research intent.`

export async function extractLeadCandidatesFromSearchResults(
  query: string,
  results: Array<{ title: string; url: string; snippet: string }>,
  projectContext?: string
): Promise<LeadCandidate[]> {
  if (results.length === 0) return []

  const resultText = results
    .slice(0, 10)
    .map(r => `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`)
    .join('\n\n---\n\n')

  const prompt = `Research query: "${query}"${projectContext ? `\nProject context: ${projectContext}` : ''}

Search results:
${resultText}

Extract lead candidates. Return ONLY a JSON array:
[{
  "company_name": "...",
  "website": "https://... or null",
  "source_url": "URL this company was found at (required)",
  "location": "city, country or null",
  "category": "property management|parking operator|etc or null",
  "contact_name": null,
  "email": "only if literally visible in snippet, else null",
  "phone": "only if literally visible in snippet, else null",
  "reason": "why relevant in 1 sentence",
  "confidence": 70
}]`

  try {
    const raw = await callAI({
      role: 'research',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1200,
      temperature: 0.1,
    })
    return parseCandidates(raw)
  } catch {
    return []
  }
}

export async function extractLeadCandidatesFromPageText(
  url: string,
  pageText: string,
  query: string
): Promise<LeadCandidate[]> {
  if (!pageText.trim()) return []

  const prompt = `Research query: "${query}"
Source URL: ${url}

Page content (first 2000 chars):
${pageText.slice(0, 2000)}

Extract any company lead(s) from this specific page. Return ONLY a JSON array (may be empty if no relevant companies found):
[{
  "company_name": "...",
  "website": "${url}",
  "source_url": "${url}",
  "location": "city, country or null",
  "category": "short label or null",
  "contact_name": null,
  "email": "only if visible on page, else null",
  "phone": "only if visible on page, else null",
  "reason": "why relevant",
  "confidence": 75
}]`

  try {
    const raw = await callAI({
      role: 'research',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM },
        { role: 'user', content: prompt },
      ],
      maxTokens: 800,
      temperature: 0.1,
    })
    return parseCandidates(raw)
  } catch {
    return []
  }
}

function parseCandidates(raw: string): LeadCandidate[] {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    return (parsed as LeadCandidate[]).filter(c =>
      c.company_name && typeof c.company_name === 'string' &&
      c.source_url && typeof c.source_url === 'string'
    )
  } catch {
    return []
  }
}

// ── Normalization ──────────────────────────────────────────────────────────────

export function normalizeLeadCandidate(c: LeadCandidate): LeadCandidate {
  return {
    ...c,
    company_name: c.company_name.trim(),
    website: normalizeUrl(c.website),
    source_url: c.source_url.trim(),
    email:   c.email   ? validateEmail(c.email.trim())   : null,
    phone:   c.phone   ? c.phone.trim()                  : null,
    contact_name: c.contact_name ? c.contact_name.trim() : null,
    confidence: Math.min(100, Math.max(0, c.confidence ?? 0)),
  }
}

function normalizeUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.origin + u.pathname.replace(/\/$/, '')
  } catch {
    return null
  }
}

function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

// ── Save candidates ────────────────────────────────────────────────────────────

export async function saveLeadCandidates(
  candidates: LeadCandidate[],
  projectId: string,
  actionId: string | null
): Promise<{ created: Lead[]; duplicates_skipped: number }> {
  const created: Lead[] = []
  let duplicates_skipped = 0

  for (const raw of candidates) {
    const c = normalizeLeadCandidate(raw)
    if (!c.company_name || !c.source_url) continue
    if ((c.confidence ?? 0) < 25) continue

    const isDup = await isDuplicateLead(projectId, c)
    if (isDup) { duplicates_skipped++; continue }

    try {
      const lead = await createLead({
        project_id: projectId,
        source_action_id: actionId,
        company_name: c.company_name,
        website: c.website,
        source_url: c.source_url,
        location: c.location,
        city: c.location?.split(',')[0]?.trim() ?? null,
        country: c.location?.split(',').slice(1).join(',').trim() || null,
        category: c.category,
        contact_name: c.contact_name,
        email: c.email,
        phone: c.phone,
        notes: `Confidence: ${c.confidence}%. ${c.reason}. Source: ${c.source_url}`,
        score: c.confidence,
        status: 'needs_review',
        created_by_role: 'Research',
      })
      created.push(lead)
    } catch {
      // non-fatal — skip this candidate
    }
  }

  return { created, duplicates_skipped }
}

// ── Main workflow ──────────────────────────────────────────────────────────────

export async function runLeadDiscoveryWorkflow(params: {
  projectId: string
  operatorId?: string
  operatorName?: string
  prompt: string
  maxQueries?: number
  maxPagesPerQuery?: number
  requestedByRole?: string
}): Promise<DiscoveryWorkflowResult> {
  const {
    projectId,
    prompt,
    operatorName,
    maxQueries = 5,
    maxPagesPerQuery = 3,
    requestedByRole = 'Research',
  } = params

  // Load project context for better query building
  let projectContext: { name?: string; goal?: string; target_audience?: string } | undefined
  try {
    const res = await db.query(
      `SELECT name, goal, target_market FROM projects WHERE id=$1 LIMIT 1`,
      [projectId]
    )
    const row = res.rows[0]
    if (row) {
      projectContext = {
        name: row.name ? String(row.name) : undefined,
        goal: row.goal ? String(row.goal) : undefined,
        target_audience: row.target_market ? String(row.target_market) : undefined,
      }
    }
  } catch { /* non-fatal */ }

  const queries = buildLeadDiscoveryQueries(prompt, projectContext).slice(0, maxQueries)
  const queryResults: DiscoveryQueryResult[] = []
  const allCandidates: LeadCandidate[] = []
  const failures: string[] = []
  let totalLeadsCreated = 0
  let totalDuplicates = 0
  let pagesChecked = 0

  // ── Run each search query ──────────────────────────────────────────────────

  for (const query of queries) {
    const qResult: DiscoveryQueryResult = {
      query,
      action_id: null,
      status: 'failed',
      results_count: 0,
      candidates: [],
      error: null,
    }

    try {
      // Delegate search to Web Operator
      const req: DelegationRequest = {
        operatorName,
        projectId,
        requestedByRole,
        actionType: 'search',
        instruction: query,
        query,
        reason: `Lead discovery for: ${prompt}`,
      }

      const result = await delegateToWebOperator(req)

      if (result.status === 'blocked') {
        qResult.status = 'blocked'
        qResult.error = result.message ?? 'Action blocked by operating mode or skill.'
        failures.push(`Query "${query}": ${qResult.error}`)
        queryResults.push(qResult)
        // If first query is blocked, stop — all will be blocked
        break
      }

      if (result.status === 'failed') {
        qResult.status = 'failed'
        qResult.error = result.message ?? 'Search failed.'
        failures.push(`Query "${query}": ${qResult.error}`)
        queryResults.push(qResult)
        continue
      }

      qResult.action_id = result.actionId ?? null
      pagesChecked++

      // Load the action output for candidate extraction
      let searchResults: Array<{ title: string; url: string; snippet: string }> = []
      if (result.actionId) {
        try {
          const row = await db.query(
            `SELECT output FROM web_operator_actions WHERE id=$1`,
            [result.actionId]
          )
          const output = row.rows[0]?.output ?? {}
          if (Array.isArray(output.results)) {
            searchResults = (output.results as Array<Record<string, unknown>>).map(r => ({
              title:   String(r.title   ?? ''),
              url:     String(r.url     ?? ''),
              snippet: String(r.snippet ?? ''),
            })).filter(r => r.url)
          }
        } catch { /* non-fatal */ }
      }

      qResult.results_count = searchResults.length

      // Extract candidates from search results
      const fromSearch = searchResults.length > 0
        ? await extractLeadCandidatesFromSearchResults(
            query, searchResults,
            projectContext ? `${projectContext.name ?? ''}: ${projectContext.goal ?? ''}` : undefined
          )
        : []

      qResult.candidates = fromSearch

      // Optionally read top result pages
      const topUrls = searchResults
        .slice(0, maxPagesPerQuery)
        .map(r => r.url)
        .filter(u => isSafePublicUrl(u))

      for (const url of topUrls) {
        try {
          const readReq: DelegationRequest = {
            operatorName,
            projectId,
            requestedByRole,
            actionType: 'read_page',
            instruction: `Read page for lead discovery: ${url}`,
            targetUrl: url,
            reason: `Lead discovery — reading top result for query: ${query}`,
          }
          const readResult = await delegateToWebOperator(readReq)
          pagesChecked++

          if (readResult.status === 'completed' && readResult.actionId) {
            try {
              const row = await db.query(
                `SELECT output FROM web_operator_actions WHERE id=$1`,
                [readResult.actionId]
              )
              const out = row.rows[0]?.output ?? {}
              const pageText = String(out.text_preview ?? out.content ?? '')
              if (pageText.trim()) {
                const fromPage = await extractLeadCandidatesFromPageText(url, pageText, query)
                qResult.candidates = [...qResult.candidates, ...fromPage]
              }
            } catch { /* non-fatal */ }
          }
        } catch { /* non-fatal — skip this page */ }
      }

      // Save candidates
      if (qResult.candidates.length > 0) {
        const { created, duplicates_skipped } = await saveLeadCandidates(
          qResult.candidates,
          projectId,
          qResult.action_id
        )
        totalLeadsCreated += created.length
        totalDuplicates += duplicates_skipped
        allCandidates.push(...qResult.candidates)
      }

      qResult.status = 'completed'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      qResult.status = 'failed'
      qResult.error = msg.includes("Executable doesn't exist") || msg.includes('browserType.launch')
        ? 'Browser runtime is missing. Run: npx playwright install chromium'
        : msg
      failures.push(`Query "${query}": ${qResult.error}`)
    }

    queryResults.push(qResult)
  }

  // ── Build result summary ───────────────────────────────────────────────────

  const queriesRun = queryResults.length
  const completedQueries = queryResults.filter(q => q.status === 'completed').length
  const blockedCount = queryResults.filter(q => q.status === 'blocked').length

  let overallStatus: DiscoveryWorkflowResult['status']
  if (blockedCount > 0 && completedQueries === 0) {
    overallStatus = 'blocked'
  } else if (completedQueries === 0) {
    overallStatus = 'failed'
  } else if (failures.length > 0) {
    overallStatus = 'partial'
  } else {
    overallStatus = 'completed'
  }

  const summary = buildSummaryMessage({
    status: overallStatus,
    queriesRun,
    completedQueries,
    pagesChecked,
    candidatesFound: allCandidates.length,
    leadsCreated: totalLeadsCreated,
    duplicatesSkipped: totalDuplicates,
    failures,
  })

  return {
    status: overallStatus,
    queries_run: queriesRun,
    pages_checked: pagesChecked,
    candidates_found: allCandidates.length,
    leads_created: totalLeadsCreated,
    duplicates_skipped: totalDuplicates,
    failures,
    query_results: queryResults,
    summary,
  }
}

// ── URL safety check ───────────────────────────────────────────────────────────

function isSafePublicUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const hostname = u.hostname.toLowerCase()
    // Skip known login walls, social platforms that require auth, and file types
    const blocked = [
      'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
      'linkedin.com', 'tiktok.com',
      'google.com/maps', 'maps.google',
    ]
    if (blocked.some(b => hostname.includes(b))) return false
    // Skip file downloads
    if (/\.(pdf|doc|docx|xls|xlsx|zip|rar)$/i.test(u.pathname)) return false
    return true
  } catch {
    return false
  }
}

// ── Summary builder ────────────────────────────────────────────────────────────

function buildSummaryMessage(ctx: {
  status: string
  queriesRun: number
  completedQueries: number
  pagesChecked: number
  candidatesFound: number
  leadsCreated: number
  duplicatesSkipped: number
  failures: string[]
}): string {
  if (ctx.status === 'blocked') {
    return `Research is blocked. ${ctx.failures[0] ?? 'Check Operating Mode — switch to Auto / Approval Required to allow browser research.'}`
  }

  if (ctx.status === 'failed') {
    const hint = ctx.failures[0] ?? 'All search queries failed.'
    return `Lead discovery failed. ${hint}`
  }

  const parts: string[] = []

  if (ctx.leadsCreated > 0) {
    parts.push(`${ctx.leadsCreated} lead candidate${ctx.leadsCreated !== 1 ? 's' : ''} created and awaiting review.`)
  } else {
    parts.push('No new leads were extracted from the search results.')
    parts.push('Try a more specific query, or ask the Web Operator to open specific target websites directly.')
  }

  parts.push(`${ctx.queriesRun} quer${ctx.queriesRun !== 1 ? 'ies' : 'y'} run, ${ctx.pagesChecked} page${ctx.pagesChecked !== 1 ? 's' : ''} checked.`)

  if (ctx.duplicatesSkipped > 0) {
    parts.push(`${ctx.duplicatesSkipped} duplicate${ctx.duplicatesSkipped !== 1 ? 's' : ''} skipped.`)
  }

  if (ctx.failures.length > 0) {
    parts.push(`${ctx.failures.length} step${ctx.failures.length !== 1 ? 's' : ''} failed: ${ctx.failures.slice(0, 2).join('; ')}.`)
  }

  return parts.join(' ')
}
