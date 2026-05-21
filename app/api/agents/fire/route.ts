import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

const PROTECTED = [
  'Research Agent', 'Lead Gen Agent', 'Copywriting Agent', 'Quality Agent',
  'Outreach Agent', 'Sales Validation Agent', 'Strategy Agent', 'Social Media Agent',
  'Reporting Agent', 'CEO Agent', 'Project Manager Agent',
]

export async function POST(request: NextRequest) {
  const { agentId } = await request.json()
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const result = await db.query('SELECT name, project_id FROM agents WHERE id=$1', [agentId])
  const agent = result.rows[0]
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  if (PROTECTED.includes(agent.name)) {
    return NextResponse.json({ error: `${agent.name} is a core agent and cannot be removed` }, { status: 403 })
  }

  await db.query(
    'INSERT INTO agent_logs (project_id, action, details) VALUES ($1,$2,$3)',
    [agent.project_id, 'thought', { event: 'agent_fired', name: agent.name }]
  )

  await db.query('DELETE FROM agents WHERE id=$1', [agentId])

  return NextResponse.json({ success: true })
}
