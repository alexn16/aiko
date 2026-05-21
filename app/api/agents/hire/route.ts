import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function POST(request: NextRequest) {
  const { projectId, name, role, system_prompt, created_by = 'user' } = await request.json()

  if (!projectId || !name?.trim() || !role?.trim()) {
    return NextResponse.json({ error: 'projectId, name, and role required' }, { status: 400 })
  }

  const existing = await db.query(
    'SELECT id FROM agents WHERE project_id=$1 AND name=$2',
    [projectId, name.trim()]
  )
  if (existing.rows[0]) {
    return NextResponse.json({ error: `Agent "${name}" already exists` }, { status: 409 })
  }

  const result = await db.query(
    `INSERT INTO agents (project_id, name, role, system_prompt, created_by, status)
     VALUES ($1,$2,$3,$4,$5,'idle') RETURNING *`,
    [projectId, name.trim(), role.trim(), system_prompt?.trim() ?? null, created_by]
  )

  await db.query(
    'INSERT INTO agent_logs (project_id, action, details) VALUES ($1,$2,$3)',
    [projectId, 'thought', { event: 'agent_hired', name: name.trim(), role: role.trim(), by: created_by }]
  )

  return NextResponse.json({ agent: result.rows[0] })
}
