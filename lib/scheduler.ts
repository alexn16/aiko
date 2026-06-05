import cron from 'node-cron'
import { db } from '@/lib/db/client'
import { getAllModelConfigs } from '@/lib/models/config'
import { runCeoAgent } from '@/lib/agents/ceo-agent'
import { runProjectManagerAgent } from '@/lib/agents/project-manager-agent'

export function summarizeSchedulerError(err: unknown) {
  const record = err && typeof err === 'object' ? err as Record<string, unknown> : {}
  const rawMessage = err instanceof Error ? err.message : String(err ?? 'Unknown scheduler error')
  const message = rawMessage
    .replace(/Incorrect API key provided:[^.]+\.?/i, 'Provider authentication failed.')
    .replace(/(access|refresh|id|api)[_-]?token[=:]\s*["']?[^"'\s,}]+/gi, '$1_token=[redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-api-key]')

  return {
    name: err instanceof Error ? err.name : 'Error',
    status: typeof record.status === 'number' ? record.status : null,
    code: typeof record.code === 'string' ? record.code : null,
    type: typeof record.type === 'string' ? record.type : null,
    message,
  }
}

async function runScheduledAgents() {
  try {
    const configs = await getAllModelConfigs()
    const fallback = configs['researchAgent'] ?? Object.values(configs)[0]
    if (!fallback) return

    const projects = await db.query('SELECT id FROM projects WHERE active=true')

    for (const project of projects.rows) {
      const [ceoRow, pmRow] = await Promise.all([
        db.query("SELECT id FROM agents WHERE project_id=$1 AND name='CEO Agent' LIMIT 1", [project.id]),
        db.query("SELECT id FROM agents WHERE project_id=$1 AND name='Project Manager Agent' LIMIT 1", [project.id]),
      ])

      if (ceoRow.rows[0]) {
        await runCeoAgent({
          projectId: project.id,
          agentId: ceoRow.rows[0].id,
          modelConfig: configs['ceoAgent'] ?? fallback,
        }).catch(err => console.error('[scheduler] CEO agent error:', summarizeSchedulerError(err)))
      }

      if (pmRow.rows[0]) {
        await runProjectManagerAgent({
          projectId: project.id,
          agentId: pmRow.rows[0].id,
          modelConfig: configs['projectManagerAgent'] ?? fallback,
        }).catch(err => console.error('[scheduler] PM agent error:', summarizeSchedulerError(err)))
      }
    }
  } catch (err) {
    console.error('[scheduler] error:', summarizeSchedulerError(err))
  }
}

export function setupScheduler() {
  // CEO and PM agents run every 30 minutes as per spec
  cron.schedule('*/30 * * * *', runScheduledAgents)
  console.log('[scheduler] CEO + PM agents scheduled every 30 minutes')
}
