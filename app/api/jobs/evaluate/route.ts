import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { evaluateJob } from '@/lib/agents/evaluator-agent'
import { getAllModelConfigs } from '@/lib/models/config'

export async function POST(request: NextRequest) {
  const { instruction, projectId } = await request.json()

  if (!instruction?.trim() || !projectId) {
    return NextResponse.json({ error: 'instruction and projectId required' }, { status: 400 })
  }

  const configs = await getAllModelConfigs()
  const fallback = configs['researchAgent'] ?? Object.values(configs)[0]
  if (!fallback) {
    return NextResponse.json({ error: 'No model configured' }, { status: 400 })
  }

  // Create job record
  const jobResult = await db.query(
    `INSERT INTO jobs (project_id, instruction, status) VALUES ($1,$2,'evaluating') RETURNING id`,
    [projectId, instruction]
  )
  const jobId = jobResult.rows[0].id

  // Run evaluation
  const evaluation = await evaluateJob({
    instruction,
    projectId,
    modelConfig: fallback,
  })

  await db.query(
    `UPDATE jobs SET status='awaiting_approval', evaluation=$1 WHERE id=$2`,
    [JSON.stringify(evaluation), jobId]
  )

  return NextResponse.json({ jobId, evaluation })
}
