import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { orchestrate } from '@/lib/agents/orchestrator'
import { getAllModelConfigs } from '@/lib/models/config'
import { enqueueBrowserTask, enqueueLlmTask } from '@/lib/queue/agent-queue'

export async function POST(request: NextRequest) {
  const { jobId, projectId, approvedAgents } = await request.json()

  const jobResult = await db.query('SELECT * FROM jobs WHERE id=$1', [jobId])
  const job = jobResult.rows[0]
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  await db.query(
    `UPDATE jobs SET status='running', started_at=NOW() WHERE id=$1`,
    [jobId]
  )

  const configs = await getAllModelConfigs()
  const fallback = configs['researchAgent'] ?? Object.values(configs)[0]
  if (!fallback) return NextResponse.json({ error: 'No model configured' }, { status: 400 })

  // Hire any new agents proposed in the evaluation
  const evaluation = job.evaluation
  const newAgents: { name: string; system_prompt?: string; specialty?: string }[] = []

  if (approvedAgents && evaluation?.agents_needed) {
    for (const agentPlan of evaluation.agents_needed) {
      if (agentPlan.role !== 'new') continue
      if (approvedAgents.includes(agentPlan.name)) {
        // Check if already exists
        const existing = await db.query(
          'SELECT id FROM agents WHERE project_id=$1 AND name=$2',
          [projectId, agentPlan.name]
        )
        if (!existing.rows[0]) {
          await db.query(
            `INSERT INTO agents (project_id, name, role, system_prompt, created_by)
             VALUES ($1,$2,$3,$4,'ceo')`,
            [projectId, agentPlan.name, agentPlan.specialty ?? agentPlan.name, agentPlan.system_prompt ?? null]
          )
          newAgents.push(agentPlan)
        }
      }
    }
  }

  // Dispatch the main instruction via orchestrator
  const agentResult = await db.query(
    "SELECT id FROM agents WHERE project_id=$1 AND name='Research Agent' LIMIT 1",
    [projectId]
  )
  const agentId = agentResult.rows[0]?.id ?? ''

  enqueueLlmTask(async () => {
    try {
      await orchestrate({
        agentId,
        projectId,
        instruction: job.instruction,
      })
      await db.query(
        `UPDATE jobs SET status='complete', completed_at=NOW() WHERE id=$1`,
        [jobId]
      )
    } catch (err) {
      console.error('[job] execution error:', err)
      await db.query(
        `UPDATE jobs SET status='complete', completed_at=NOW() WHERE id=$1`,
        [jobId]
      )
    }
  })

  return NextResponse.json({ success: true, newAgents, message: 'Job started' })
}
