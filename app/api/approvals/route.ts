/**
 * LEGACY — reads the `approvals` table (lead outreach email drafts).
 *
 * This route exists for backward compatibility with the outreach email
 * "Approve & Send" flow (ApprovalQueue / ApprovalItem components).
 * It is NOT the canonical approval system.
 *
 * Canonical: /api/approval-items  →  approval_items table  →  lib/approvals.ts
 * Canonical UI: /approvals  (Approval Center)
 *
 * Do not add new callers of this route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')

  const result = await db.query(
    `SELECT a.*,
            l.company_name,
            l.email,
            (
              SELECT al.details->>'reason'
              FROM agent_logs al
              WHERE al.details->>'quality_check' IS NOT NULL
                AND al.details->>'quality_check' IN ('passed', 'rejected')
                AND al.project_id = a.project_id
                AND al.created_at > a.created_at
              ORDER BY al.created_at DESC
              LIMIT 1
            ) AS quality_reason
     FROM approvals a
     LEFT JOIN leads l ON a.lead_id = l.id
     WHERE a.project_id=$1
       AND a.status IN ('pending','quality_passed','quality_rejected','approved')
     ORDER BY a.created_at ASC`,
    [projectId]
  )

  return NextResponse.json({ approvals: result.rows })
}
