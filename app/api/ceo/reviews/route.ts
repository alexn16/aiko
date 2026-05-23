import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { runCeoReviewAgent } from '@/lib/agents/ceo-review-agent'
import { getAllModelConfigs } from '@/lib/models/config'
import { createInstruction } from '@/lib/agents/internal-communication'
import { getTaskSummaryForCompany } from '@/lib/agents/tasks'

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

    // Fetch task summary for enriched review context
    let taskContext: string | undefined
    try {
      const ts = await getTaskSummaryForCompany()
      const staleThreshold = Date.now() - 24 * 60 * 60 * 1000
      const staleTasks = [...ts.active, ...ts.blocked].filter(
        t => new Date(t.updated_at ?? t.created_at).getTime() < staleThreshold
      )
      taskContext = JSON.stringify({
        blocked_tasks: ts.blocked.map(t => ({ title: t.title, project_id: t.project_id })),
        stale_tasks: staleTasks.map(t => ({ title: t.title, project_id: t.project_id })),
        review_queue_count: ts.review.length,
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
