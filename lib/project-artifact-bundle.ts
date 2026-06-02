/**
 * project-artifact-bundle.ts
 *
 * Generate a complete internal project artifact bundle as generated files.
 *
 * Bundle contents:
 *   1. Executive report Markdown   (source_entity_type = 'executive_report')
 *   2. Leads CSV                   (source_entity_type = 'leads_export')
 *   3. Strategy brief Markdown     (source_entity_type = 'strategy_brief')
 *   4. Decision log Markdown       (source_entity_type = 'decision_log')
 *   5. Manifest JSON               (source_entity_type = 'project_bundle')
 *
 * Safety:
 * - Read-only on all source data.
 * - Writes only to storage/generated-files/ via createGeneratedFile.
 * - Never exposes secrets, API keys, or tokens.
 * - Never includes raw source_text (scraped HTML).
 * - Never triggers outreach or Web Operator actions.
 * - Falls back gracefully if source data is missing.
 * - No external sends.
 */

import { db } from '@/lib/db/client'
import { createGeneratedFile, type GeneratedFile } from '@/lib/generated-files'
import { exportLeadsToCsv } from '@/lib/lead-file-export'
import {
  getLatestProjectExecutiveReport,
  generateProjectExecutiveReport,
  type ExecutiveReport,
} from '@/lib/project-executive-report'
import { exportExecutiveReport } from '@/lib/report-file-export'
import { getProjectStrategyBrief, type ProjectStrategyBrief } from '@/lib/project-strategy-brief'
import { listProjectDecisions, type ProjectDecision } from '@/lib/project-decisions'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BundleManifestEntry {
  title:              string
  file_type:          string
  content_type:       string
  download_url:       string
  source_entity_type: string
  source_entity_id:   string | null
}

export interface BundleManifest {
  project_id:    string
  project_name:  string
  generated_at:  string
  files:         BundleManifestEntry[]
}

export interface ArtifactBundleResult {
  files:         GeneratedFile[]
  manifest:      BundleManifest
  download_urls: Record<string, string>
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a full project artifact bundle.
 *
 * Each component is generated independently and errors in one component do
 * not block the others. The manifest is always created last, listing every
 * successfully-generated file.
 *
 * Never throws — wraps all errors and returns partial bundles on failure.
 */
export async function generateProjectArtifactBundle(
  projectId: string
): Promise<ArtifactBundleResult> {
  // Fetch project metadata (name)
  const project = await fetchProjectMeta(projectId)
  const projectName = project?.name ?? projectId

  const files: GeneratedFile[] = []
  const downloadUrls: Record<string, string> = {}
  const now = new Date().toISOString()

  // ── 1. Executive report (Markdown) ────────────────────────────────────────

  let execReportFile: GeneratedFile | null = null
  try {
    // Use existing latest report or generate a new one
    const existing = await getLatestProjectExecutiveReport(projectId)
    let report: ExecutiveReport
    if (existing) {
      report = existing
    } else {
      // Generate a fresh report as fallback
      report = await generateProjectExecutiveReport(projectId)
    }
    const result = await exportExecutiveReport(projectId, report, 'markdown', true)
    execReportFile = result.file
    files.push(execReportFile)
    downloadUrls['executive_report'] = `/api/files/${execReportFile.id}/download`
  } catch {
    // Non-fatal — create a factual fallback markdown
    try {
      execReportFile = await createGeneratedFile({
        project_id:         projectId,
        filename:           `executive-report-${now.slice(0, 10)}.md`,
        content:            buildFallbackExecReportMarkdown(projectName, now),
        content_type:       'markdown',
        title:              `${projectName} — Executive Report`,
        description:        'Auto-generated fallback report (no report data available)',
        generated_by_role:  'system',
        source_entity_type: 'executive_report',
        source_entity_id:   null,
      })
      files.push(execReportFile)
      downloadUrls['executive_report'] = `/api/files/${execReportFile.id}/download`
    } catch { /* skip */ }
  }

  // ── 2. Leads CSV ──────────────────────────────────────────────────────────

  let leadsFile: GeneratedFile | null = null
  try {
    const result = await exportLeadsToCsv({
      project_id: projectId,
      title: `${projectName} — Leads Export`,
    })
    leadsFile = result.file
    files.push(leadsFile)
    downloadUrls['leads_export'] = `/api/files/${leadsFile.id}/download`
  } catch { /* skip */ }

  // ── 3. Strategy brief (Markdown) ─────────────────────────────────────────

  let stratFile: GeneratedFile | null = null
  try {
    const brief = await getProjectStrategyBrief(projectId)
    const content = brief
      ? formatStrategyBriefMarkdown(brief, projectName)
      : buildEmptyStrategyBriefMarkdown(projectName, now)
    stratFile = await createGeneratedFile({
      project_id:         projectId,
      filename:           `strategy-brief-${now.slice(0, 10)}.md`,
      content,
      content_type:       'markdown',
      title:              `${projectName} — Strategy Brief`,
      description:        brief ? 'Project first-campaign strategy brief' : 'Strategy brief (no data yet)',
      generated_by_role:  'system',
      source_entity_type: 'strategy_brief',
      source_entity_id:   brief?.id ?? null,
    })
    files.push(stratFile)
    downloadUrls['strategy_brief'] = `/api/files/${stratFile.id}/download`
  } catch { /* skip */ }

  // ── 4. Decision log (Markdown) ────────────────────────────────────────────

  let decisionFile: GeneratedFile | null = null
  try {
    const decisions = await listProjectDecisions(projectId, { limit: 100 })
    const content   = formatDecisionLogMarkdown(decisions, projectName, now)
    decisionFile = await createGeneratedFile({
      project_id:         projectId,
      filename:           `decision-log-${now.slice(0, 10)}.md`,
      content,
      content_type:       'markdown',
      title:              `${projectName} — Decision Log`,
      description:        `${decisions.length} decision${decisions.length !== 1 ? 's' : ''} recorded`,
      generated_by_role:  'system',
      source_entity_type: 'decision_log',
      source_entity_id:   null,
    })
    files.push(decisionFile)
    downloadUrls['decision_log'] = `/api/files/${decisionFile.id}/download`
  } catch { /* skip */ }

  // ── 5. Bundle manifest (JSON) ─────────────────────────────────────────────

  const manifest = buildBundleManifest(projectId, projectName, now, files)
  let manifestFile: GeneratedFile | null = null
  try {
    manifestFile = await createGeneratedFile({
      project_id:         projectId,
      filename:           `project-bundle-manifest-${now.slice(0, 10)}.json`,
      content:            JSON.stringify(manifest, null, 2),
      content_type:       'json',
      title:              `${projectName} — Bundle Manifest`,
      description:        `Manifest for ${files.length}-file project bundle`,
      generated_by_role:  'system',
      source_entity_type: 'project_bundle',
      source_entity_id:   null,
    })
    files.push(manifestFile)
    downloadUrls['manifest'] = `/api/files/${manifestFile.id}/download`
  } catch { /* skip */ }

  return { files, manifest, download_urls: downloadUrls }
}

// ── Strategy brief formatter ───────────────────────────────────────────────────

export function formatStrategyBriefMarkdown(
  brief: ProjectStrategyBrief,
  projectName: string
): string {
  const lines: string[] = [
    `# ${brief.title || `${projectName} — Strategy Brief`}`,
    '',
    `> Generated ${new Date().toISOString().slice(0, 10)} · Project: ${projectName}`,
    '',
    '## Objective',
    '',
    brief.objective || '_No objective defined._',
    '',
    '## Target Audience',
    '',
    brief.target_audience || '_Not specified._',
    '',
    '## Recommended Channel',
    '',
    brief.recommended_channel || '_Not specified._',
    '',
    '## Value Proposition',
    '',
    brief.value_proposition || '_Not specified._',
    '',
    '## Research Prompt',
    '',
    brief.research_prompt || '_Not specified._',
    '',
  ]

  if (brief.risks.length > 0) {
    lines.push('## Risks', '')
    brief.risks.forEach(r => lines.push(`- ${r}`))
    lines.push('')
  }

  if (brief.assumptions.length > 0) {
    lines.push('## Assumptions', '')
    brief.assumptions.forEach(a => lines.push(`- ${a}`))
    lines.push('')
  }

  if (brief.next_actions.length > 0) {
    lines.push('## Next Actions', '')
    brief.next_actions.forEach(a => lines.push(`- [ ] ${a}`))
    lines.push('')
  }

  if (brief.recommended_operator_name) {
    lines.push('## Recommended Operator', '')
    lines.push(`**${brief.recommended_operator_name}**`)
    if (brief.operator_reason) lines.push('', brief.operator_reason)
    lines.push('')
  }

  lines.push('---', '_This brief is internal guidance only. No automation is triggered by this document._')
  return lines.join('\n')
}

// ── Decision log formatter ────────────────────────────────────────────────────

export function formatDecisionLogMarkdown(
  decisions: ProjectDecision[],
  projectName: string,
  isoDate: string
): string {
  const lines: string[] = [
    `# ${projectName} — Decision Log`,
    '',
    `> Generated ${isoDate.slice(0, 10)} · ${decisions.length} decision${decisions.length !== 1 ? 's' : ''} recorded`,
    '',
  ]

  if (decisions.length === 0) {
    lines.push('_No decisions have been recorded for this project yet._', '')
    lines.push('Decisions are recorded automatically when key events occur, such as:')
    lines.push('- Project creation')
    lines.push('- Lead approvals or rejections')
    lines.push('- Campaign approvals')
    lines.push('- PM assignments')
    lines.push('')
  } else {
    lines.push('## Decisions', '')
    for (const d of decisions) {
      // Format date safely — never expose internal IDs or raw metadata
      const date = new Date(d.created_at).toISOString().slice(0, 10)
      const role = d.decided_by_role ? ` _(${d.decided_by_role})_` : ''
      lines.push(`### ${d.title}${role}`)
      lines.push('')
      lines.push(`**Type:** ${d.decision_type.replace(/_/g, ' ')}  `)
      lines.push(`**Date:** ${date}`)
      if (d.summary) {
        lines.push('')
        lines.push(d.summary)
      }
      lines.push('')
    }
  }

  lines.push('---', '_Decision log is internal only. No outreach or automation is triggered._')
  return lines.join('\n')
}

// ── Manifest builder ──────────────────────────────────────────────────────────

export function generateBundleManifest(
  projectId:   string,
  projectName: string,
  files:       GeneratedFile[]
): BundleManifest {
  return buildBundleManifest(projectId, projectName, new Date().toISOString(), files)
}

function buildBundleManifest(
  projectId:   string,
  projectName: string,
  isoDate:     string,
  files:       GeneratedFile[]
): BundleManifest {
  return {
    project_id:   projectId,
    project_name: projectName,
    generated_at: isoDate,
    files: files.map(f => ({
      title:              f.title ?? f.filename,
      file_type:          f.content_type,
      content_type:       f.mime_type,
      download_url:       `/api/files/${f.id}/download`,
      source_entity_type: f.source_entity_type ?? 'unknown',
      source_entity_id:   f.source_entity_id,
    })),
  }
}

// ── Latest bundle lookup ──────────────────────────────────────────────────────

/**
 * Return the most recent project_bundle manifest file for a project, if any.
 * Useful for showing a "last generated" timestamp without regenerating.
 */
export async function getLatestProjectBundle(
  projectId: string
): Promise<GeneratedFile | null> {
  try {
    const res = await db.query(
      `SELECT * FROM generated_files
       WHERE project_id=$1 AND source_entity_type='project_bundle'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    )
    if (!res.rows[0]) return null
    const r = res.rows[0]
    return {
      id:                 String(r.id),
      project_id:         r.project_id ? String(r.project_id) : null,
      filename:           String(r.filename),
      mime_type:          String(r.mime_type),
      content_type:       String(r.content_type) as GeneratedFile['content_type'],
      title:              r.title ? String(r.title) : null,
      description:        r.description ? String(r.description) : null,
      generated_by_role:  r.generated_by_role ? String(r.generated_by_role) : null,
      storage_path:       String(r.storage_path),
      size_bytes:         Number(r.size_bytes),
      source_entity_type: r.source_entity_type ? String(r.source_entity_type) : null,
      source_entity_id:   r.source_entity_id ? String(r.source_entity_id) : null,
      created_at:         r.created_at instanceof Date
                            ? (r.created_at as Date).toISOString()
                            : String(r.created_at),
    }
  } catch {
    return null
  }
}

// ── Fallback builders ─────────────────────────────────────────────────────────

function buildFallbackExecReportMarkdown(projectName: string, isoDate: string): string {
  return [
    `# ${projectName} — Executive Report`,
    '',
    `> Generated ${isoDate.slice(0, 10)} · Auto-generated fallback`,
    '',
    '## Summary',
    '',
    'No executive report data is available for this project yet.',
    'This document was auto-generated as a placeholder.',
    '',
    '## Next Steps',
    '',
    '- Generate a full executive report from the project workspace',
    '- Complete the First Campaign Flow to populate project data',
    '',
    '---',
    '_This is an internal document. No outreach or automation is triggered._',
  ].join('\n')
}

function buildEmptyStrategyBriefMarkdown(projectName: string, isoDate: string): string {
  return [
    `# ${projectName} — Strategy Brief`,
    '',
    `> Generated ${isoDate.slice(0, 10)} · No strategy brief data available`,
    '',
    '_No strategy brief has been created for this project yet._',
    '',
    'A strategy brief is automatically generated when you complete the First Campaign Flow.',
    '',
    '---',
    '_This is an internal document. No outreach or automation is triggered._',
  ].join('\n')
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function fetchProjectMeta(
  projectId: string
): Promise<{ name: string } | null> {
  try {
    const res = await db.query(
      `SELECT name FROM projects WHERE id=$1 LIMIT 1`,
      [projectId]
    )
    if (!res.rows[0]) return null
    return { name: String(res.rows[0].name) }
  } catch {
    return null
  }
}
