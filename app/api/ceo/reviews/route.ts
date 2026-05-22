import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { runCeoReviewAgent } from '@/lib/agents/ceo-review-agent'
import { getAllModelConfigs } from '@/lib/models/config'

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

    const review = await runCeoReviewAgent(modelConfig)
    return NextResponse.json({ review })
  } catch (err) {
    console.error('[api/ceo/reviews POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
