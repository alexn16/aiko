import { NextRequest, NextResponse } from 'next/server'
import { generateOutputForTask } from '@/lib/agents/task-outputs'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const output = await generateOutputForTask(params.id)

    // Fetch updated task
    let task = null
    try {
      const taskRes = await db.query(`SELECT * FROM agent_tasks WHERE id=$1`, [params.id])
      task = taskRes.rows[0] ?? null
    } catch {
      // non-fatal
    }

    return NextResponse.json({ output, task })
  } catch (err) {
    console.error('[api/agent-tasks/[id]/generate-output POST]', err)
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
