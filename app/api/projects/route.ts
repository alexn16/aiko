import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

const AGENT_DEFINITIONS = [
  { name: 'Research Agent',          role: 'Finds new leads by navigating directories and websites' },
  { name: 'Lead Gen Agent',          role: 'Enriches existing leads with contact data' },
  { name: 'Copywriting Agent',       role: 'Writes outreach messages for approved leads' },
  { name: 'Quality Agent',           role: 'Reviews messages before they reach the Approval Center' },
  { name: 'Outreach Agent',          role: 'Monitors inbox for replies in read-only mode' },
  { name: 'Sales Validation Agent',  role: 'Scores reply intent and qualifies leads' },
  { name: 'Strategy Agent',          role: 'Defines ICP, messaging strategy, and channel priority' },
  { name: 'Social Media Agent',      role: 'Drafts social content for review' },
  { name: 'Reporting Agent',         role: 'Generates structured performance reports' },
  { name: 'CEO Agent',               role: 'Strategic oversight and coordination' },
  { name: 'Project Manager Agent',   role: 'Tracks sprint progress and flags blockers' },
]

export async function GET() {
  const result = await db.query('SELECT * FROM projects WHERE active=true ORDER BY created_at DESC')
  return NextResponse.json({ projects: result.rows })
}

export async function POST(request: NextRequest) {
  const { name, description, target_market, value_prop } = await request.json()

  const projectResult = await db.query(
    `INSERT INTO projects (name, description, target_market, value_prop)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, description, target_market, value_prop]
  )
  const project = projectResult.rows[0]

  // Seed agent rows for this project
  for (const agent of AGENT_DEFINITIONS) {
    await db.query(
      'INSERT INTO agents (project_id, name, role) VALUES ($1,$2,$3)',
      [project.id, agent.name, agent.role]
    )
  }

  return NextResponse.json({ project })
}

export async function PUT(request: NextRequest) {
  const { id, name, description, target_market, value_prop } = await request.json()

  const result = await db.query(
    `UPDATE projects SET name=$1, description=$2, target_market=$3, value_prop=$4
     WHERE id=$5 RETURNING *`,
    [name, description, target_market, value_prop, id]
  )

  return NextResponse.json({ project: result.rows[0] })
}
