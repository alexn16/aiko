import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')

  const [leads, sent, replies, pending] = await Promise.all([
    db.query('SELECT COUNT(*) FROM leads WHERE project_id=$1', [projectId]),
    db.query("SELECT COUNT(*) FROM approvals WHERE project_id=$1 AND status='sent'", [projectId]),
    db.query("SELECT COUNT(*) FROM leads WHERE project_id=$1 AND status='replied'", [projectId]),
    db.query("SELECT COUNT(*) FROM approvals WHERE project_id=$1 AND status IN ('pending','quality_passed')", [projectId]),
  ])

  return NextResponse.json({
    leads:   parseInt(leads.rows[0].count),
    sent:    parseInt(sent.rows[0].count),
    replies: parseInt(replies.rows[0].count),
    pending: parseInt(pending.rows[0].count),
  })
}
