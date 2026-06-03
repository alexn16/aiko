import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { getProjectLaunchTemplate, computeChecklistCompletion } from '@/lib/project-launch-template'
import { getProjectStrategyBrief } from '@/lib/project-strategy-brief'

export const dynamic = 'force-dynamic'

/**
 * GET /api/start-campaign/summary
 *
 * Lightweight summary for the First Campaign Flow page.
 * Aggregates existing tables — no new business logic.
 *
 * Optional query param: project_id — scope lead counts and trails to one project.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id') ?? undefined

  try {
    // 1. Projects
    const projectsRes = await db.query(
      `SELECT id, name, created_at FROM projects WHERE active=true ORDER BY created_at DESC LIMIT 20`
    )

    // 2. Named operators
    const operatorsRes = await db.query(
      `SELECT id, name, role, status, browser_profile_key, project_id FROM web_operators ORDER BY created_at DESC LIMIT 20`
    )

    // 3. Lead counts (scoped to project if provided)
    const leadWhere = projectId ? `WHERE project_id = $1` : ``
    const leadParams = projectId ? [projectId] : []
    const leadCountsRes = await db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM leads
       ${leadWhere}
       GROUP BY status`,
      leadParams
    )
    const leadCounts: Record<string, number> = {}
    for (const row of leadCountsRes.rows) {
      leadCounts[row.status] = row.count
    }

    // 4. Approved leads with email (ready for Gmail draft)
    const approvedLeadsWhere = projectId
      ? `WHERE status='approved' AND email IS NOT NULL AND project_id = $1`
      : `WHERE status='approved' AND email IS NOT NULL`
    const approvedLeadsRes = await db.query(
      `SELECT id, company_name, contact_name, email, status FROM leads ${approvedLeadsWhere} ORDER BY created_at DESC LIMIT 10`,
      projectId ? [projectId] : []
    )

    // 5. Contacted leads (for reply-check step)
    const contactedWhere = projectId
      ? `WHERE status IN ('contacted','replied') AND email IS NOT NULL AND project_id = $1`
      : `WHERE status IN ('contacted','replied') AND email IS NOT NULL`
    const contactedLeadsRes = await db.query(
      `SELECT id, company_name, email, status, last_checked_at, last_reply_at, reply_summary
       FROM leads ${contactedWhere} ORDER BY created_at DESC LIMIT 10`,
      projectId ? [projectId] : []
    )

    // 6. Pending approval_items (web_operator_action type)
    const pendingApprovalsWhere = projectId
      ? `WHERE ai.status='pending' AND ai.item_type='web_operator_action' AND woa.project_id=$1`
      : `WHERE ai.status='pending' AND ai.item_type='web_operator_action'`
    const pendingApprovalsRes = await db.query(
      `SELECT ai.id, ai.title, ai.created_at, woa.action_type, woa.description
       FROM approval_items ai
       LEFT JOIN web_operator_actions woa ON woa.approval_item_id = ai.id
       ${pendingApprovalsWhere}
       ORDER BY ai.created_at DESC LIMIT 10`,
      projectId ? [projectId] : []
    )

    // 7. Approved-but-not-resumed Web Operator actions
    const resumeCandidatesWhere = projectId
      ? `WHERE woa.status='approved' AND woa.approval_item_id IS NOT NULL AND ai.status='approved' AND woa.project_id=$1`
      : `WHERE woa.status='approved' AND woa.approval_item_id IS NOT NULL AND ai.status='approved'`
    const resumeCandidatesRes = await db.query(
      `SELECT woa.id, woa.action_type, woa.description, woa.project_id, woa.operator_id, woa.approval_item_id
       FROM web_operator_actions woa
       JOIN approval_items ai ON ai.id = woa.approval_item_id
       ${resumeCandidatesWhere}
       ORDER BY woa.created_at DESC LIMIT 10`,
      projectId ? [projectId] : []
    )

    // 8. Recent execution trail events (project-scoped if provided)
    const trailWhere = projectId
      ? `WHERE woa.project_id = $1`
      : ``
    const trailRes = await db.query(
      `SELECT woa.id AS action_id, woa.action_type, woa.description, woa.status,
              woa.completed_at, woa.created_at, woa.lead_id, woa.is_sensitive,
              woa.screenshot_url, woa.failure_reason,
              ai.status AS approval_status, ai.title AS approval_title
       FROM web_operator_actions woa
       LEFT JOIN approval_items ai ON ai.id = woa.approval_item_id
       ${trailWhere}
       ORDER BY COALESCE(woa.completed_at, woa.created_at) DESC
       LIMIT 8`,
      projectId ? [projectId] : []
    )

    const trailEvents = trailRes.rows.map(row => ({
      action_id:      String(row.action_id),
      action_type:    String(row.action_type),
      description:    String(row.description ?? ''),
      status:         String(row.status),
      created_at:     String(row.created_at),
      completed_at:   row.completed_at ? String(row.completed_at) : null,
      lead_id:        row.lead_id ? String(row.lead_id) : null,
      // Safety: never expose screenshots from sensitive actions
      screenshot_url: row.is_sensitive ? null : (row.screenshot_url ? String(row.screenshot_url) : null),
      failure_reason: row.failure_reason ? String(row.failure_reason) : null,
    }))

    // 9. Launch template (project-scoped only)
    let launchTemplate = null
    if (projectId) {
      try {
        const tpl = await getProjectLaunchTemplate(projectId)
        if (tpl) {
          // Derive completion signals from the summary data we already have
          const hasDraftAction = trailRes.rows.some(r =>
            ['create_email_draft','fill_gmail_body','fill_gmail_to','fill_gmail_subject'].includes(String(r.action_type)) &&
            String(r.status) === 'completed'
          )
          const hasSendAction = trailRes.rows.some(r =>
            ['send_email','send_gmail_draft','submit_form'].includes(String(r.action_type)) &&
            String(r.status) === 'completed'
          )
          const hasReplyCheck = trailRes.rows.some(r =>
            ['check_gmail_reply','search_gmail'].includes(String(r.action_type))
          )
          // "has_operator" = at least one operator exists (any operator can be used
          // for any project; project scoping is by user selection not by assignment)
          const hasAnyOperator = operatorsRes.rows.length > 0
          const computedChecklist = computeChecklistCompletion(tpl, {
            has_operator:       hasAnyOperator,
            has_leads:          Object.values(leadCounts).reduce((a, b) => a + b, 0) > 0,
            has_approved_leads: (leadCounts['approved'] ?? 0) > 0,
            has_draft_action:   hasDraftAction,
            has_send_action:    hasSendAction,
            has_reply_check:    hasReplyCheck,
            has_trail:          trailRes.rows.length > 0,
          })
          launchTemplate = {
            ...tpl,
            checklist: computedChecklist,
            checklist_done: computedChecklist.filter(i => i.completed).length,
            start_campaign_url: `/start-campaign?project_id=${projectId}`,
          }
        }
      } catch { /* non-fatal */ }
    }

    // 10. Strategy brief (project-scoped only)
    let strategyBrief = null
    if (projectId) {
      try {
        strategyBrief = await getProjectStrategyBrief(projectId)
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      projects:           projectsRes.rows,
      operators:          operatorsRes.rows,
      lead_counts:        leadCounts,
      approved_leads:     approvedLeadsRes.rows,
      contacted_leads:    contactedLeadsRes.rows,
      pending_approvals:  pendingApprovalsRes.rows,
      resume_candidates:  resumeCandidatesRes.rows,
      recent_trail:       trailEvents,
      launch_template:    launchTemplate,
      strategy_brief:     strategyBrief,
    })
  } catch (err) {
    console.error('[start-campaign/summary GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
