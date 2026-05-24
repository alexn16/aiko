import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { runProjectManagerReportAgent } from '@/lib/agents/project-manager-report-agent'
import { getAllModelConfigs } from '@/lib/models/config'
import { createManagerReport } from '@/lib/agents/internal-communication'
import { getTaskSummaryForProject } from '@/lib/agents/tasks'
import { getOutputSummaryForProject } from '@/lib/agents/task-outputs'
import { getApprovalSummaryForProject } from '@/lib/approvals'
import { getCampaignSummaryForProject } from '@/lib/campaigns'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await db.query(`
      SELECT r.*, pm.name AS pm_name
      FROM project_manager_reports r
      LEFT JOIN project_managers pm ON pm.id = r.project_manager_id
      WHERE r.project_id = $1
      ORDER BY r.created_at DESC
      LIMIT 10
    `, [params.id])
    return NextResponse.json({ reports: result.rows })
  } catch (err) {
    console.error('[api/projects/[id]/pm-reports GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const configs = await getAllModelConfigs()
    const modelConfig =
      configs['projectManagerAgent'] ??
      configs['ceoAgent'] ??
      configs['researchAgent'] ??
      Object.values(configs)[0]

    if (!modelConfig) {
      return NextResponse.json(
        { error: 'No model configured. Add a model in Settings.' },
        { status: 503 }
      )
    }

    // Fetch task summary and output summary for context
    let taskSummaryData: Record<string, unknown> | undefined
    try {
      const [ts, os, approvalSummary, campaignSummary] = await Promise.all([
        getTaskSummaryForProject(params.id),
        getOutputSummaryForProject(params.id),
        getApprovalSummaryForProject(params.id),
        getCampaignSummaryForProject(params.id),
      ])

      // Calculate this week's outputs
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const outputsThisWeek = os.recent.filter(
        o => new Date(o.created_at).getTime() > weekAgo
      ).length

      taskSummaryData = {
        total: ts.total,
        by_status: ts.by_status,
        completed_today: ts.completed_today.map(t => t.title),
        active: ts.active.slice(0, 5).map(t => t.title),
        blocked: ts.blocked.map(t => t.title),
        planned: [] as string[],
        outputs: {
          total: os.total,
          pending_approval: os.pending_approval.length,
          completed_outputs: os.recent.filter(o => o.status === 'approved').map(o => o.title),
          outputs_this_week: outputsThisWeek,
        },
        approvals: {
          pending: approvalSummary.pending,
          approved: approvalSummary.approved,
          changes_requested: approvalSummary.changes_requested,
        },
        campaigns: {
          total: campaignSummary.total,
          by_status: campaignSummary.by_status,
          active_names: campaignSummary.active.map(c => c.name),
        },
      }
    } catch {
      // non-fatal
    }

    const report = await runProjectManagerReportAgent(params.id, modelConfig)

    // Send report message to CEO via internal comms
    try {
      const reportResult = report as { project_name?: string; status?: string; summary?: string; id?: string }
      await createManagerReport({
        from_role: 'Project Manager',
        to_role: 'CEO',
        subject: `PM Report: ${reportResult.project_name ?? 'Project'} — ${reportResult.status ?? 'update'}`,
        content: reportResult.summary ?? '',
        project_id: params.id,
        metadata: { report_id: reportResult.id, status: reportResult.status, task_summary: taskSummaryData },
      })
    } catch (msgErr) {
      console.error('[api/projects/[id]/pm-reports] failed to send report message', msgErr)
    }

    return NextResponse.json({ report, task_summary: taskSummaryData })
  } catch (err) {
    console.error('[api/projects/[id]/pm-reports POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
