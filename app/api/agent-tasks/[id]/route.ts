import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { completeAgentTask } from '@/lib/agents/tasks'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { id } = params

    if (body.status === 'completed') {
      await completeAgentTask(id, body.output)
    } else {
      const sets: string[] = ['updated_at = NOW()']
      const values: unknown[] = []
      let idx = 1

      if (body.status !== undefined) {
        sets.push(`status = $${idx++}`)
        values.push(body.status)
        if (body.status === 'in_progress') {
          sets.push(`started_at = COALESCE(started_at, NOW())`)
        }
      }
      if (body.priority !== undefined) {
        sets.push(`priority = $${idx++}`)
        values.push(body.priority)
      }
      if (body.output !== undefined) {
        sets.push(`output = $${idx++}`)
        values.push(JSON.stringify(body.output))
      }
      if (body.title !== undefined) {
        sets.push(`title = $${idx++}`)
        values.push(body.title)
      }
      if (body.description !== undefined) {
        sets.push(`description = $${idx++}`)
        values.push(body.description)
      }

      values.push(id)
      await db.query(
        `UPDATE agent_tasks SET ${sets.join(', ')} WHERE id = $${idx}`,
        values
      )
    }

    const result = await db.query('SELECT * FROM agent_tasks WHERE id = $1', [id])
    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    return NextResponse.json({ task: result.rows[0] })
  } catch (err) {
    console.error('[api/agent-tasks/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
