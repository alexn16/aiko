import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { runCeoReviewAgent } from '@/lib/agents/ceo-review-agent'
import { getAllModelConfigs } from '@/lib/models/config'
import { createInstruction } from '@/lib/agents/internal-communication'
import { getTaskSummaryForCompany } from '@/lib/agents/tasks'
import { getOutputSummaryForCompany } from '@/lib/agents/task-outputs'
import { getApprovalSummaryForCompany } from '@/lib/approvals'
import { getCampaignSummaryForCompany } from '@/lib/campaigns'
import { getLaunchReadinessSummaryForCompany } from '@/lib/campaign-launch-readiness'
import { getLeadSummaryForCompany } from '@/lib/leads'

export async function GET() {
  try {
    const result = await db.query(`
      SELECT
        r.*,
        p.name AS priority_project_name
      FROM ceo_reviews r
      LEFT JOIN projects p ON p.id = r.priority_project_id
      ORDER BY r.created_at DESC
      LIMIT 20
    `)
    return NextResponse.json({ reviews: result.rows })
  } catch (err) {
    console.error('[api/ceo/reviews GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const configs = await getAllModelConfigs()
    const modelConfig = configs['ceoAgent'] ?? configs['researchAgent'] ?? Object.values(configs)[0]
    if (!modelConfig) {
      return NextResponse.json({ error: 'No model configured. Add a model in Settings.' }, { status: 503 })
    }

    // Fetch task summary and output summary for enriched review context
    let taskContext: string | undefined
    try {
      const [ts, os, as_, cs, launchReadiness, leadSummary] = await Promise.all([
        getTaskSummaryForCompany(),
        getOutputSummaryForCompany(),
        getApprovalSummaryForCompany(),
        getCampaignSummaryForCompany(),
        getLaunchReadinessSummaryForCompany(),
        getLeadSummaryForCompany().catch(() => ({ total: 0, needs_review: 0, approved: 0 })),
      ])
      const staleThreshold = Date.now() - 24 * 60 * 60 * 1000
      const staleTasks = [...ts.active, ...ts.blocked].filter(
        t => new Date(t.updated_at ?? t.created_at).getTime() < staleThreshold
      )
      taskContext = JSON.stringify({
        blocked_tasks: ts.blocked.map(t => ({ title: t.title, project_id: t.project_id })),
        stale_tasks: staleTasks.map(t => ({ title: t.title, project_id: t.project_id })),
        review_queue_count: ts.review.length,
        outputs_pending_approval: os.pending_approval.map(o => ({
          title: o.title,
          output_type: o.output_type,
          project_id: o.project_id,
        })),
        projects_with_no_outputs: [] as string[], // populated below
        total_outputs: os.total,
        approval_items: {
          pending: as_.pending,
          approved: as_.approved,
          changes_requested: as_.changes_requested,
          pending_titles: as_.pending_items.map(i => ({
            title: i.title,
            project_name: i.project_name ?? null,
          })),
        },
        campaigns: {
          total: cs.total,
          draft: cs.draft.map(c => ({ name: c.name, project_name: c.project_name ?? null })),
          ready_for_review: cs.ready.map(c => ({ name: c.name, project_name: c.project_name ?? null })),
          active: cs.active.map(c => ({ name: c.name, project_name: c.project_name ?? null })),
        },
        leads: {
          total: leadSummary.total,
          needs_review: leadSummary.needs_review,
          approved: leadSummary.approved,
        },
        campaign_launch_readiness: {
          campaigns_checked: launchReadiness.campaigns_checked,
          ready: launchReadiness.ready,
          needs_attention: launchReadiness.needs_attention,
          not_ready: launchReadiness.not_ready,
          blocked: launchReadiness.blocked,
          ready_campaigns: launchReadiness.latest_checks
            .filter(lc => lc.status === 'ready')
            .map(lc => ({ name: lc.campaign_name, score: lc.readiness_score })),
          blocked_or_not_ready: launchReadiness.latest_checks
            .filter(lc => lc.status === 'blocked' || lc.status === 'not_ready')
            .map(lc => ({ name: lc.campaign_name, status: lc.status, score: lc.readiness_score })),
        },
      })
    } catch {
      // non-fatal
    }

    const review = await runCeoReviewAgent(modelConfig, taskContext)

    // Dispatch instructions for recommended actions
    try {
      if (Array.isArray(review.recommended_actions) && review.recommended_actions.length > 0) {
        for (const action of review.recommended_actions.slice(0, 3)) {
          await createInstruction({
            from_role: 'CEO',
            to_role: 'Project Manager',
            subject: 'CEO Review Action',
            content: String(action),
            project_id: review.priority_project_id ?? undefined,
          })
        }
      }
    } catch (msgErr) {
      console.error('[api/ceo/reviews] failed to send review instructions', msgErr)
    }

    return NextResponse.json({ review })
  } catch (err) {
    console.error('[api/ceo/reviews POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
